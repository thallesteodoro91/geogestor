/**
 * Universal Importer — pipeline completo:
 *   File → headers/rows → hybrid match → UniversalValidationPanel
 *        → explodeRow → resolveRelations → batch insert
 *        (dim_cliente → dim_propriedade → fato_orcamento → fato_servico → fato_despesas)
 *        → refresh KPIs → relatório pós-importação
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { saveDraft, loadDraft, clearDraft, hasDraft } from "@/lib/etl/importDraft";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { matchAllColumns, type HybridMatch } from "@/lib/etl/hybridMatcher";
import { CANONICAL_BY_ID } from "@/lib/etl/canonicalSchema";
import { explodeRow } from "@/lib/etl/rowExploder";
import {
  resolveRelations,
  type ExistingCliente,
  type ExistingPropriedade,
} from "@/lib/etl/relationResolver";
import { CANONICAL_TO_COLUMN } from "@/lib/etl/canonicalToDb";
import { invalidateDashboardAndKpis } from "@/lib/etl/dashboardRefresh";
import {
  normalizeStatusPagamento,
  normalizeFormaPagamento,
  normalizeStatusOrcamento,
  normalizeStatusServico,
} from "@/lib/etl/statusNormalizer";
import {
  UniversalValidationPanel,
  type DetectionSummary,
} from "@/components/import/UniversalValidationPanel";
import { parseFinancialNumber } from "@/lib/financialNumberParser";
import { coerce } from "@/lib/etl/importCoercion";


type Step = "upload" | "validate" | "importing" | "result";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

interface RowWarning {
  rowIndex: number;
  field: string;
  message: string;
}

interface ImportResult {
  clientesCriados: number;
  propriedadesCriadas: number;
  orcamentosCriados: number;
  servicosCriados: number;
  despesasCriadas: number;
  linhasIgnoradas: number;
  camposNaoReconhecidos: string[];
  erros: string[];
  avisos: RowWarning[];
}

// parseDateBRFirst and coerce live in `@/lib/etl/importCoercion` (re-used by tests).


export function UniversalImporter({ open, onOpenChange, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [matches, setMatches] = useState<HybridMatch[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [truncatedDraft, setTruncatedDraft] = useState(false);
  const [exitGuardOpen, setExitGuardOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeDraftMeta, setResumeDraftMeta] = useState<{
    fileName: string; headerCount: number; rowCount: number; savedAt: string;
  } | null>(null);

  const tenantId = tenant?.id ?? null;
  // Há progresso a proteger sempre que o usuário já está validando ou importando.
  // Não usamos setTimeout/setInterval em lugar nenhum: o modal nunca fecha sozinho.
  const hasProgress = step === "validate" || step === "importing";

  const reset = useCallback(() => {
    setStep("upload");
    setHeaders([]); setRows([]); setMatches([]); setOverrides({});
    setResult(null); setIsImporting(false);
    setFileName(""); setTruncatedDraft(false);
  }, []);

  const requestClose = useCallback(() => {
    if (step === "importing") {
      toast.info("Aguarde a importação terminar antes de fechar.");
      return;
    }
    if (hasProgress) {
      setExitGuardOpen(true);
      return;
    }
    clearDraft(tenantId);
    reset();
    onOpenChange(false);
  }, [step, hasProgress, tenantId, reset, onOpenChange]);

  const confirmExit = useCallback(() => {
    clearDraft(tenantId);
    setExitGuardOpen(false);
    reset();
    onOpenChange(false);
  }, [tenantId, reset, onOpenChange]);

  // Radix chama onOpenChange(false) em vários gatilhos; canalizamos para requestClose.
  const handleOpenChange = useCallback((v: boolean) => {
    if (v) { onOpenChange(true); return; }
    requestClose();
  }, [onOpenChange, requestClose]);


  const finalMatches = useMemo<HybridMatch[]>(() => {
    return matches.map(m => {
      const ovr = overrides[m.header];
      if (ovr === undefined) return m;
      if (ovr === null) return { ...m, field: null, isCustomField: true, reason: "manual: campo personalizado" };
      const field = CANONICAL_BY_ID[ovr] ?? null;
      return { ...m, field, isCustomField: !field, reason: "manual override" };
    });
  }, [matches, overrides]);

  const summary = useMemo<DetectionSummary>(() => {
    const formas = new Set<string>(), statuses = new Set<string>();
    let receitas = 0, despesas = 0, propriedades = 0, orcamentos = 0, servicos = 0;
    const clienteKeys = new Set<string>();
    rows.forEach(row => {
      const ex = explodeRow(headers, finalMatches, row);
      if (ex.cliente) clienteKeys.add(String(ex.cliente.cpf ?? ex.cliente.cnpj ?? ex.cliente.nome ?? ""));
      if (ex.propriedade) propriedades++;
      if (ex.orcamento) orcamentos++;
      if (ex.servico) servicos++;
      const fp = ex.orcamento?.forma_pagamento; if (fp) formas.add(String(fp));
      const st = ex.orcamento?.status; if (st) statuses.add(String(st));
      const r = ex.orcamento?.valor_orcado ?? ex.orcamento?.valor_final ?? ex.financeiro?.receita ?? ex.financeiro?.receita_realizada;
      if (r != null && Number(parseFinancialNumber(String(r))) > 0) receitas++;
      const d = ex.financeiro?.despesas;
      if (d != null && Number(parseFinancialNumber(String(d))) > 0) despesas++;
    });
    return {
      clientesNovos: clienteKeys.size, clientesExistentes: 0,
      propriedades, orcamentos, servicos, receitas, despesas,
      formasPagamento: Array.from(formas).slice(0, 8),
      statusDetectados: Array.from(statuses).slice(0, 8),
    };
  }, [rows, headers, finalMatches]);

  const parseFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const onParsed = (h: string[], r: unknown[][]) => {
      if (r.length === 0) { toast.error("Planilha vazia"); return; }
      const initialMatches = matchAllColumns(h, r);
      setHeaders(h);
      setRows(r);
      setMatches(initialMatches);
      setFileName(file.name);
      setTruncatedDraft(false);
      setStep("validate");
      // Persistência imediata do rascunho — sobrevive a refresh / fechamento acidental.
      saveDraft({
        tenantId, fileName: file.name, headers: h, rows: r,
        matches: initialMatches, overrides: {},
      });
    };
    if (ext === "csv" || ext === "txt") {
      Papa.parse(file, {
        encoding: "UTF-8",
        complete: (res) => {
          const data = res.data as string[][];
          if (data.length < 2) { toast.error("Arquivo sem dados"); return; }
          onParsed(data[0].map(c => String(c ?? "").trim()),
            data.slice(1).filter(r => r.some(c => String(c ?? "").trim())));
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });
        if (data.length < 2) { toast.error("Planilha sem dados"); return; }
        onParsed(
          data[0].map((c: any) => String(c ?? "").trim()),
          data.slice(1)
            .filter((r: any[]) => r.some((c: any) => c != null && String(c).trim()))
            .map((r: any[]) => r.map((c: any) => c instanceof Date ? c.toISOString().slice(0, 10) : (c ?? "")))
        );
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Formato não suportado (use CSV ou XLSX)");
    }
  }, [tenantId]);

  // Persiste mudanças de overrides com debounce curto durante a validação.
  const overridesSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (step !== "validate" || headers.length === 0) return;
    if (overridesSaveRef.current) clearTimeout(overridesSaveRef.current);
    overridesSaveRef.current = setTimeout(() => {
      saveDraft({ tenantId, fileName, headers, rows, matches, overrides });
    }, 300);
    return () => {
      if (overridesSaveRef.current) clearTimeout(overridesSaveRef.current);
    };
  }, [overrides, step, tenantId, fileName, headers, rows, matches]);

  // Ao abrir, oferece retomar se houver rascunho salvo.
  useEffect(() => {
    if (!open) return;
    if (step !== "upload") return;
    if (!hasDraft(tenantId)) return;
    const d = loadDraft(tenantId);
    if (!d) return;
    setResumeDraftMeta({
      fileName: d.fileName,
      headerCount: d.headers.length,
      rowCount: d.totalRows,
      savedAt: d.savedAt,
    });
    setResumeOpen(true);
  }, [open, step, tenantId]);

  const resumeFromDraft = useCallback(() => {
    const d = loadDraft(tenantId);
    setResumeOpen(false);
    if (!d) return;
    setHeaders(d.headers);
    setRows(d.rows);
    setMatches(d.matches);
    setOverrides(d.overrides);
    setFileName(d.fileName);
    setTruncatedDraft(d.truncated);
    setStep("validate");
  }, [tenantId]);

  const discardDraft = useCallback(() => {
    clearDraft(tenantId);
    setResumeOpen(false);
    setResumeDraftMeta(null);
  }, [tenantId]);


  const runImport = useCallback(async () => {
    if (!tenant?.id) { toast.error("Tenant não identificado"); return; }
    setIsImporting(true);
    setStep("importing");
    const errors: string[] = [];
    const avisos: RowWarning[] = [];
    const camposNaoReconhecidos = new Set<string>();

    // Captura colunas não mapeadas para o relatório
    finalMatches.forEach(m => {
      if (!m.field) camposNaoReconhecidos.add(m.header);
    });

    try {
      // Carregar existentes para dedup
      const [{ data: existingClis }, { data: existingProps }] = await Promise.all([
        supabase.from("dim_cliente")
          .select("id_cliente,nome,cpf,cnpj,telefone,email")
          .eq("tenant_id", tenant.id),
        supabase.from("dim_propriedade")
          .select("id_propriedade,nome_da_propriedade,matricula,id_cliente")
          .eq("tenant_id", tenant.id),
      ]);

      // Explode + coerção com captura de warnings
      const exploded = rows.map((r, rowIdx) => {
        const ex = explodeRow(headers, finalMatches, r);
        const out: typeof ex = { customFieldsByEntity: ex.customFieldsByEntity };
        (["cliente","propriedade","servico","orcamento","financeiro","endereco"] as const).forEach(en => {
          const bag = ex[en];
          if (!bag) return;
          const coerced: Record<string, unknown> = {};
          Object.entries(bag).forEach(([key, val]) => {
            const { value, warning } = coerce(`${en}.${key}`, val);
            coerced[key] = value;
            if (warning) avisos.push({ rowIndex: rowIdx + 2, field: `${en}.${key}`, message: warning });
          });
          out[en] = coerced;
        });
        return out;
      });

      const resolved = resolveRelations(
        exploded,
        (existingClis ?? []) as ExistingCliente[],
        (existingProps ?? []) as ExistingPropriedade[],
      );

      // 1) Insert clientes novos — só colunas válidas via CANONICAL_TO_COLUMN whitelist
      const clienteTempToId = new Map<string, string>();
      if (resolved.clientesNovos.length) {
        const payload = resolved.clientesNovos.map(c => {
          const { __tempId, ...rest } = c;
          const row: Record<string, unknown> = { tenant_id: tenant.id };
          Object.entries(rest).forEach(([key, val]) => {
            const col = CANONICAL_TO_COLUMN[`cliente.${key}`];
            if (col?.table === "dim_cliente" && val != null) row[col.column] = val;
          });
          if (!row.nome) row.nome = String(rest.cpf ?? rest.cnpj ?? "Cliente sem nome");
          return { __tempId, row };
        });
        const { data, error } = await supabase
          .from("dim_cliente")
          .insert(payload.map(p => p.row) as any)
          .select("id_cliente");
        if (error) {
          errors.push(`dim_cliente: ${error.message}`);
        } else {
          (data ?? []).forEach((d: any, i: number) => clienteTempToId.set(payload[i].__tempId, d.id_cliente));
        }
      }

      const resolveClienteFromResolved = (resolvedRow: typeof resolved.rows[number]): string | null => {
        if (resolvedRow.id_cliente) return resolvedRow.id_cliente;
        if (!resolvedRow.cliente) return null;
        // Procurar tempId equivalente
        for (const [tmp, real] of clienteTempToId) {
          const c = resolved.clientesNovos.find(x => x.__tempId === tmp);
          if (!c) continue;
          if (
            (c.cpf && c.cpf === resolvedRow.cliente.cpf) ||
            (c.cnpj && c.cnpj === resolvedRow.cliente.cnpj) ||
            (c.nome && c.nome === resolvedRow.cliente.nome)
          ) return real;
        }
        return null;
      };

      // 2) Insert propriedades novas
      const propTempToId = new Map<string, string>();
      if (resolved.propriedadesNovas.length) {
        const payload = resolved.propriedadesNovas.map(p => {
          const { __tempId, __clienteRef, ...rest } = p;
          const id_cliente = clienteTempToId.get(__clienteRef) ?? __clienteRef;
          const row: Record<string, unknown> = {
            tenant_id: tenant.id,
            id_cliente: id_cliente && id_cliente.startsWith("tmp_") ? null : id_cliente,
          };
          Object.entries(rest).forEach(([key, val]) => {
            const col = CANONICAL_TO_COLUMN[`propriedade.${key}`];
            if (col?.table === "dim_propriedade" && val != null) row[col.column] = val;
          });
          if (!row.nome_da_propriedade) row.nome_da_propriedade = String(rest.matricula ?? "Propriedade sem nome");
          return { __tempId, row };
        });
        const { data, error } = await supabase
          .from("dim_propriedade")
          .insert(payload.map(p => p.row) as any)
          .select("id_propriedade");
        if (error) errors.push(`dim_propriedade: ${error.message}`);
        else (data ?? []).forEach((d: any, i: number) => propTempToId.set(payload[i].__tempId, d.id_propriedade));
      }

      // 3) Build orçamentos por linha — guarda rowIndex → id_orcamento p/ associar serviço/despesa
      const orcamentoByRow = new Map<number, string>();
      const orcamentoPayloads: { rowIndex: number; row: Record<string, unknown> }[] = [];
      resolved.rows.forEach((r) => {
        const orc = r.orcamento ?? {};
        const fin = r.financeiro ?? {};
        const temOrcamento = Object.keys(orc).length > 0 || fin.receita != null || fin.receita_realizada != null;
        if (!temOrcamento) return;
        const id_cliente = resolveClienteFromResolved(r);
        if (!id_cliente) {
          avisos.push({ rowIndex: r.rowIndex + 2, field: "orcamento", message: "orçamento ignorado: cliente não identificado" });
          return;
        }
        // Resolve propriedade: usar a propriedade do row, se houver
        let id_propriedade: string | null = r.id_propriedade;
        if (!id_propriedade && r.propriedade) {
          const matricula = String(r.propriedade.matricula ?? "").trim();
          if (matricula) {
            // achar a temp id criada para essa matricula
            const entry = resolved.propriedadesNovas.find(p => String(p.matricula ?? "").trim() === matricula);
            if (entry) id_propriedade = propTempToId.get(entry.__tempId) ?? null;
          }
        }

        const valorOrcado = (orc.valor_orcado ?? orc.valor_final ?? fin.receita ?? fin.receita_prevista) as number | null | undefined;
        const valorRealizado = (fin.receita_realizada) as number | null | undefined;

        const row: Record<string, unknown> = {
          tenant_id: tenant.id,
          id_cliente,
          id_propriedade,
          data_orcamento: (orc.data_emissao as string) ?? new Date().toISOString().slice(0, 10),
          quantidade: 1,
          valor_unitario: valorOrcado ?? 0,
          receita_esperada: valorOrcado ?? 0,
          receita_realizada: valorRealizado ?? null,
          valor_faturado: valorRealizado ?? null,
          desconto: (orc.desconto as number | null) ?? 0,
          valor_imposto: (orc.impostos ?? fin.impostos) as number | null ?? null,
          forma_de_pagamento: normalizeFormaPagamento(orc.forma_pagamento) ?? null,
          situacao_do_pagamento: normalizeStatusPagamento(orc.situacao_pagamento) ?? null,
          situacao: normalizeStatusOrcamento(orc.status) ?? null,
          codigo_orcamento: (orc.codigo as string | null) ?? null,
          data_do_faturamento: (orc.data_faturamento ?? orc.data_vencimento) as string | null ?? null,
          custom_fields: r.customFieldsByEntity.orcamento ?? r.customFieldsByEntity.financeiro ?? {},
        };
        orcamentoPayloads.push({ rowIndex: r.rowIndex, row });
      });

      let orcamentosCriados = 0;
      if (orcamentoPayloads.length) {
        const { data, error } = await supabase
          .from("fato_orcamento")
          .insert(orcamentoPayloads.map(p => p.row) as any)
          .select("id_orcamento");
        if (error) {
          errors.push(`fato_orcamento: ${error.message}`);
        } else {
          orcamentosCriados = data?.length ?? 0;
          (data ?? []).forEach((d: any, i: number) => orcamentoByRow.set(orcamentoPayloads[i].rowIndex, d.id_orcamento));
        }
      }

      // 4) Insert serviços (por linha com servico.* preenchido)
      const servicoByRow = new Map<number, string>();
      const servicoPayloads: { rowIndex: number; row: Record<string, unknown> }[] = [];
      resolved.rows.forEach(r => {
        const sv = r.servico;
        if (!sv || !Object.keys(sv).length) return;
        const id_cliente = resolveClienteFromResolved(r);
        const id_orcamento = orcamentoByRow.get(r.rowIndex) ?? null;
        const row: Record<string, unknown> = {
          tenant_id: tenant.id,
          id_cliente,
          id_propriedade: r.id_propriedade,
          id_orcamento,
          nome_do_servico: (sv.nome as string) ?? `Serviço linha ${r.rowIndex + 2}`,
          categoria: (sv.categoria as string) ?? null,
          situacao_do_servico: normalizeStatusServico(sv.status) ?? "Pendente",
          data_do_servico_inicio: (sv.data_inicio as string) ?? null,
          data_do_servico_fim: (sv.data_fim as string) ?? null,
          receita_servico: orcamentoByRow.has(r.rowIndex)
            ? (r.orcamento?.valor_final ?? r.orcamento?.valor_orcado ?? r.financeiro?.receita ?? 0)
            : 0,
          custom_fields: r.customFieldsByEntity.servico ?? {},
        };
        servicoPayloads.push({ rowIndex: r.rowIndex, row });
      });

      let servicosCriados = 0;
      if (servicoPayloads.length) {
        const { data, error } = await supabase
          .from("fato_servico")
          .insert(servicoPayloads.map(p => p.row) as any)
          .select("id_servico");
        if (error) {
          errors.push(`fato_servico: ${error.message}`);
        } else {
          servicosCriados = data?.length ?? 0;
          (data ?? []).forEach((d: any, i: number) => servicoByRow.set(servicoPayloads[i].rowIndex, d.id_servico));
        }
      }

      // 5) Insert despesas (por linha com financeiro.despesas > 0)
      const despesaPayloads: Record<string, unknown>[] = [];
      resolved.rows.forEach(r => {
        const valor = r.financeiro?.despesas as number | null | undefined;
        if (!valor || valor <= 0) return;
        const dataReferencia =
          (r.orcamento?.data_emissao as string) ??
          (r.servico?.data_inicio as string) ??
          new Date().toISOString().slice(0, 10);
        despesaPayloads.push({
          tenant_id: tenant.id,
          valor_da_despesa: valor,
          data_da_despesa: dataReferencia,
          id_servico: servicoByRow.get(r.rowIndex) ?? null,
          id_orcamento: orcamentoByRow.get(r.rowIndex) ?? null,
          observacoes: r.customFieldsByEntity.financeiro
            ? `Importado de planilha — ${Object.keys(r.customFieldsByEntity.financeiro).join(", ")}`
            : "Importado de planilha",
        });
      });

      let despesasCriadas = 0;
      if (despesaPayloads.length) {
        const { data, error } = await supabase
          .from("fato_despesas")
          .insert(despesaPayloads as any)
          .select("id_despesas");
        if (error) errors.push(`fato_despesas: ${error.message}`);
        else despesasCriadas = data?.length ?? 0;
      }

      // Linhas ignoradas: nenhuma entidade criada
      const linhasIgnoradas = resolved.rows.filter(r => {
        const semCliente = !resolveClienteFromResolved(r);
        const semOrcamento = !orcamentoByRow.has(r.rowIndex);
        const semServico = !servicoByRow.has(r.rowIndex);
        return semCliente && semOrcamento && semServico;
      }).length;

      // Refresh dashboard
      invalidateDashboardAndKpis(queryClient);

      setResult({
        clientesCriados: clienteTempToId.size,
        propriedadesCriadas: propTempToId.size,
        orcamentosCriados,
        servicosCriados,
        despesasCriadas,
        linhasIgnoradas,
        camposNaoReconhecidos: Array.from(camposNaoReconhecidos),
        erros: errors,
        avisos,
      });
      setStep("result");
      clearDraft(tenantId);

      if (!errors.length && !avisos.length) {
        toast.success("Importação concluída — Dashboard atualizado");
        onSuccess?.();
      } else if (errors.length) {
        toast.error(`Importação concluída com ${errors.length} erro(s)`);
      } else {
        toast.warning(`Importação concluída com ${avisos.length} aviso(s)`);
      }
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
      setResult({
        clientesCriados: 0, propriedadesCriadas: 0, orcamentosCriados: 0,
        servicosCriados: 0, despesasCriadas: 0, linhasIgnoradas: rows.length,
        camposNaoReconhecidos: [],
        erros: [err.message], avisos: [],
      });
      setStep("result");
    } finally {
      setIsImporting(false);
    }
  }, [tenant?.id, tenantId, rows, headers, finalMatches, queryClient, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[95vw] sm:w-auto max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Importação Universal de Planilha</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50"
            onClick={() => document.getElementById("universal-file-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Arraste sua planilha ou clique para selecionar</p>
            <p className="text-sm text-muted-foreground mt-1">CSV, XLSX ou XLS — sem modelo obrigatório</p>
            <input
              id="universal-file-input"
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.txt"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
            />
          </div>
        )}

        {step === "validate" && (
          <UniversalValidationPanel
            matches={finalMatches}
            summary={summary}
            previewRows={rows}
            headers={headers}
            onOverride={(header, fieldId) => setOverrides(p => ({ ...p, [header]: fieldId }))}
            onConfirm={runImport}
            onBack={() => setStep("upload")}
            isImporting={isImporting}
          />
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processando, deduplicando e atualizando KPIs…</p>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Relatório de Importação</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat label="Clientes" value={result.clientesCriados} />
              <Stat label="Propriedades" value={result.propriedadesCriadas} />
              <Stat label="Orçamentos" value={result.orcamentosCriados} />
              <Stat label="Serviços" value={result.servicosCriados} />
              <Stat label="Despesas" value={result.despesasCriadas} />
              <Stat label="Linhas ignoradas" value={result.linhasIgnoradas} variant={result.linhasIgnoradas > 0 ? "warn" : "ok"} />
            </div>

            {result.camposNaoReconhecidos.length > 0 && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium">Colunas mantidas como campo personalizado ({result.camposNaoReconhecidos.length}):</p>
                <p className="text-muted-foreground">{result.camposNaoReconhecidos.join(" · ")}</p>
              </div>
            )}

            {result.avisos.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1 max-h-48 overflow-y-auto">
                <p className="font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Avisos por linha ({result.avisos.length}):
                </p>
                {result.avisos.slice(0, 20).map((a, i) => (
                  <p key={i} className="text-amber-700 dark:text-amber-200">
                    • Linha {a.rowIndex} — {a.message}
                  </p>
                ))}
                {result.avisos.length > 20 && (
                  <p className="text-amber-600 italic">…e mais {result.avisos.length - 20} avisos</p>
                )}
              </div>
            )}

            {result.erros.length > 0 && (
              <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs space-y-1">
                <p className="font-medium text-rose-700 dark:text-rose-300">Erros ({result.erros.length}):</p>
                {result.erros.map((e, i) => <p key={i} className="text-rose-700 dark:text-rose-200">• {e}</p>)}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "result" && (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          )}
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, variant = "ok" }: { label: string; value: number; variant?: "ok" | "warn" }) {
  return (
    <div className={`rounded-md border p-3 ${variant === "warn" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-border bg-card"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
