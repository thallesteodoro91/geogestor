/**
 * Universal Importer — new pipeline that absorbs any business spreadsheet.
 *
 *   File → headers/rows → hybrid match → UniversalValidationPanel
 *        → explodeRow → resolveRelations → batch insert → refresh KPIs
 *
 * Lives alongside the legacy SmartImporter; reached via "Importar planilha"
 * on /importacao.
 */

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
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
  UniversalValidationPanel,
  type DetectionSummary,
} from "@/components/import/UniversalValidationPanel";
import { parseFinancialNumber } from "@/lib/financialNumberParser";

type Step = "upload" | "validate" | "importing" | "result";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

interface ImportResult {
  clientesCriados: number;
  propriedadesCriadas: number;
  orcamentosCriados: number;
  erros: string[];
}

/** Coerce raw spreadsheet cell to the canonical-typed value the DB expects. */
function coerce(canonicalId: string, raw: unknown): unknown {
  const f = CANONICAL_BY_ID[canonicalId];
  if (!f) return raw;
  const s = String(raw ?? "").trim();
  if (!s) return null;
  switch (f.type) {
    case "monetary":
    case "number":
    case "percent":
      return parseFinancialNumber(s);
    case "date": {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
      if (br) {
        const yy = br[3].length === 2 ? `20${br[3]}` : br[3];
        return `${yy}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
      }
      return s;
    }
    case "cpf":
    case "cnpj":
    case "phone":
      return s.replace(/\D/g, "");
    case "geo":
      return parseFinancialNumber(s);
    default:
      return s;
  }
}

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

  const reset = () => {
    setStep("upload");
    setHeaders([]); setRows([]); setMatches([]); setOverrides({});
    setResult(null); setIsImporting(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

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
      const r = ex.orcamento?.valor_orcado ?? ex.orcamento?.valor_final ?? ex.financeiro?.receita;
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
      setHeaders(h);
      setRows(r);
      setMatches(matchAllColumns(h, r));
      setStep("validate");
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
  }, []);

  const runImport = useCallback(async () => {
    if (!tenant?.id) { toast.error("Tenant não identificado"); return; }
    setIsImporting(true);
    setStep("importing");
    const errors: string[] = [];

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

      // Explode + Resolve
      const exploded = rows.map(r => explodeRow(headers, finalMatches, r));
      const matchesById = new Map(finalMatches.map(m => [m.header, m]));

      // Build canonical-keyed payloads
      const explodedCanonical = exploded.map((ex, idx) => {
        const out: typeof ex = { customFieldsByEntity: ex.customFieldsByEntity };
        (["cliente","propriedade","servico","orcamento","financeiro","endereco"] as const).forEach(en => {
          const bag = ex[en];
          if (!bag) return;
          const coerced: Record<string, unknown> = {};
          Object.entries(bag).forEach(([key, val]) => {
            coerced[key] = coerce(`${en}.${key}`, val);
          });
          out[en] = coerced;
        });
        void idx;
        return out;
      });

      const resolved = resolveRelations(
        explodedCanonical,
        (existingClis ?? []) as ExistingCliente[],
        (existingProps ?? []) as ExistingPropriedade[],
      );

      // 1) Insert new clientes
      const clienteTempToId = new Map<string, string>();
      if (resolved.clientesNovos.length) {
        const payload = resolved.clientesNovos.map(c => {
          const { __tempId, ...rest } = c;
          const row: Record<string, unknown> = { tenant_id: tenant.id };
          // Map canonical keys to columns
          Object.entries(rest).forEach(([key, val]) => {
            const col = CANONICAL_TO_COLUMN[`cliente.${key}`];
            if (col?.table === "dim_cliente") row[col.column] = val;
          });
          if (!row.nome) row.nome = String(rest.cpf ?? rest.cnpj ?? "Cliente sem nome");
          return { __tempId, row };
        });
        const { data, error } = await supabase
          .from("dim_cliente")
          .insert(payload.map(p => p.row) as any)
          .select("id_cliente");
        if (error) throw new Error(`Clientes: ${error.message}`);
        (data ?? []).forEach((d: any, i: number) => clienteTempToId.set(payload[i].__tempId, d.id_cliente));
      }

      const resolveClienteId = (ref: string | null | undefined): string | null => {
        if (!ref) return null;
        if (clienteTempToId.has(ref)) return clienteTempToId.get(ref)!;
        return ref; // already an existing UUID
      };

      // 2) Insert new propriedades
      const propTempToId = new Map<string, string>();
      if (resolved.propriedadesNovas.length) {
        const payload = resolved.propriedadesNovas.map(p => {
          const { __tempId, __clienteRef, ...rest } = p;
          const row: Record<string, unknown> = {
            tenant_id: tenant.id,
            id_cliente: resolveClienteId(__clienteRef),
          };
          Object.entries(rest).forEach(([key, val]) => {
            const col = CANONICAL_TO_COLUMN[`propriedade.${key}`];
            if (col?.table === "dim_propriedade") row[col.column] = val;
          });
          if (!row.nome_da_propriedade) row.nome_da_propriedade = String(rest.matricula ?? "Propriedade sem nome");
          return { __tempId, row };
        });
        const { data, error } = await supabase
          .from("dim_propriedade")
          .insert(payload.map(p => p.row) as any)
          .select("id_propriedade");
        if (error) errors.push(`Propriedades: ${error.message}`);
        else (data ?? []).forEach((d: any, i: number) => propTempToId.set(payload[i].__tempId, d.id_propriedade));
      }

      // 3) Insert orçamentos (one per row that has any orcamento/financeiro data)
      const orcamentoPayloads: Record<string, unknown>[] = [];
      resolved.rows.forEach((r, idx) => {
        const orc = r.orcamento ?? {};
        const fin = r.financeiro ?? {};
        if (!Object.keys(orc).length && !Object.keys(fin).length) return;
        const id_cliente = r.id_cliente
          ?? (r.cliente && clienteTempToId.size
              ? (() => {
                  // Find temp id created above for this row's cliente
                  for (const [tmp, real] of clienteTempToId) {
                    const c = resolved.clientesNovos.find(x => x.__tempId === tmp);
                    if (c && (c.cpf === r.cliente?.cpf || c.cnpj === r.cliente?.cnpj || c.nome === r.cliente?.nome)) return real;
                  }
                  return null;
                })()
              : null);
        if (!id_cliente) return; // orçamento exige cliente
        const id_propriedade = r.id_propriedade
          ?? (r.propriedade?.matricula || r.propriedade?.nome
              ? Array.from(propTempToId.values())[idx] ?? null
              : null);
        const row: Record<string, unknown> = {
          tenant_id: tenant.id,
          id_cliente,
          id_propriedade,
          data_orcamento: orc.data_emissao ?? new Date().toISOString().slice(0, 10),
          quantidade: 1,
          valor_unitario: orc.valor_orcado ?? orc.valor_final ?? fin.receita ?? fin.receita_realizada ?? 0,
          receita_esperada: orc.valor_orcado ?? orc.valor_final ?? fin.receita ?? fin.receita_realizada ?? 0,
          desconto: orc.desconto ?? 0,
          valor_imposto: orc.impostos ?? fin.impostos ?? null,
          forma_de_pagamento: orc.forma_pagamento ?? null,
          situacao_do_pagamento: orc.situacao_pagamento ?? null,
          situacao: orc.status ?? null,
          codigo_orcamento: orc.codigo ?? null,
          data_do_faturamento: orc.data_faturamento ?? orc.data_vencimento ?? null,
          custom_fields: r.customFieldsByEntity.orcamento ?? r.customFieldsByEntity.financeiro ?? {},
        };
        orcamentoPayloads.push(row);
      });

      let orcamentosCriados = 0;
      if (orcamentoPayloads.length) {
        const { data, error } = await supabase
          .from("fato_orcamento")
          .insert(orcamentoPayloads as any)
          .select("id_orcamento");
        if (error) errors.push(`Orçamentos: ${error.message}`);
        else orcamentosCriados = data?.length ?? 0;
      }

      // 4) Refresh dashboard
      invalidateDashboardAndKpis(queryClient);

      setResult({
        clientesCriados: clienteTempToId.size,
        propriedadesCriadas: propTempToId.size,
        orcamentosCriados,
        erros: errors,
      });
      setStep("result");
      if (!errors.length) {
        toast.success("Importação concluída — Dashboard atualizado");
        onSuccess?.();
      } else {
        toast.warning("Importação concluída com avisos");
      }
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
      setResult({ clientesCriados: 0, propriedadesCriadas: 0, orcamentosCriados: 0, erros: [err.message] });
      setStep("result");
    } finally {
      setIsImporting(false);
    }
  }, [tenant?.id, rows, headers, finalMatches, queryClient, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
              <h3 className="text-lg font-semibold">Importação concluída</h3>
            </div>
            <ul className="text-sm space-y-1">
              <li>Clientes criados: <strong>{result.clientesCriados}</strong></li>
              <li>Propriedades criadas: <strong>{result.propriedadesCriadas}</strong></li>
              <li>Orçamentos criados: <strong>{result.orcamentosCriados}</strong></li>
            </ul>
            {result.erros.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
                <p className="font-medium text-amber-700 dark:text-amber-300">Avisos:</p>
                {result.erros.map((e, i) => <p key={i} className="text-amber-700 dark:text-amber-200">• {e}</p>)}
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
