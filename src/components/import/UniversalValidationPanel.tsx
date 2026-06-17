/**
 * Universal validation panel — content-aware preview of every column in the
 * uploaded spreadsheet with a 360º summary of detected entities.
 *
 * Pure presentational component. The host (UniversalImporter) feeds in the
 * already-computed {@link HybridMatch} array and a small detection summary.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, AlertTriangle, Sparkles, FileWarning, Info } from "lucide-react";
import { CANONICAL_FIELDS, CANONICAL_BY_ID, type CanonicalEntity, type CanonicalField } from "@/lib/etl/canonicalSchema";
import type { HybridMatch } from "@/lib/etl/hybridMatcher";

export interface DetectionSummary {
  clientesNovos: number;
  clientesExistentes: number;
  propriedades: number;
  orcamentos: number;
  servicos: number;
  receitas: number;
  despesas: number;
  formasPagamento: string[];
  statusDetectados: string[];
}

interface Props {
  matches: HybridMatch[];
  summary: DetectionSummary;
  previewRows: unknown[][];
  headers: string[];
  onOverride: (header: string, fieldId: string | null) => void;
  onConfirm: () => void;
  onBack: () => void;
  isImporting?: boolean;
}

const ENTITY_LABEL: Record<CanonicalEntity, string> = {
  cliente: "Cliente",
  endereco: "Endereço",
  propriedade: "Propriedade",
  servico: "Serviço",
  orcamento: "Orçamento",
  financeiro: "Financeiro",
};

function getFieldHint(field?: CanonicalField): string | null {
  if (!field) return null;
  const typeHints: Record<string, string> = {
    text: "Texto livre",
    number: "Número (ex: 123,45)",
    monetary: "Valor monetário (ex: R$ 1.234,56)",
    percent: "Porcentagem (ex: 15% ou 0,15)",
    date: "Data (ex: 01/01/2024)",
    cpf: "CPF com 11 dígitos",
    cnpj: "CNPJ com 14 dígitos",
    doc: "Documento (CPF ou CNPJ)",
    phone: "Telefone com DDD",
    email: "E-mail válido (ex: nome@email.com)",
    geo: "Coordenada geográfica",
    enum: `Um dos valores: ${field.enumValues?.join(", ") ?? ""}`,
  };
  const hint = typeHints[field.type] ?? field.type;
  return field.required ? `${hint} (obrigatório)` : hint;
}

function FieldInfoIcon({ fieldId }: { fieldId?: string }) {
  const field = fieldId ? CANONICAL_BY_ID[fieldId] : undefined;
  const hint = getFieldHint(field);
  if (!hint) return null;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-medium">{field?.label}</p>
          <p className="text-muted-foreground">{hint}</p>
          {field?.enumValues && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Valores aceitos: {field.enumValues.join(", ")}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function UniversalValidationPanel({
  matches, summary, previewRows, headers, onOverride, onConfirm, onBack, isImporting,
}: Props) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const mapped = matches.filter(m => m.field).length;
    const custom = matches.filter(m => m.isCustomField).length;
    return { total: matches.length, mapped, custom };
  }, [matches]);

  const handleOverride = (header: string, value: string) => {
    const fieldId = value === "__custom__" ? null : value === "__keep__" ? undefined : value;
    if (fieldId !== undefined) {
      setOverrides(prev => ({ ...prev, [header]: value }));
      onOverride(header, fieldId);
    }
  };

  return (
    <div className="space-y-4 min-w-0 w-full">
      {/* Resumo detectado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resumo da detecção
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <SummaryStat label="Clientes novos" value={summary.clientesNovos} />
          <SummaryStat label="Clientes existentes" value={summary.clientesExistentes} />
          <SummaryStat label="Propriedades" value={summary.propriedades} />
          <SummaryStat label="Orçamentos" value={summary.orcamentos} />
          <SummaryStat label="Serviços" value={summary.servicos} />
          <SummaryStat label="Receitas" value={summary.receitas} />
          <SummaryStat label="Despesas" value={summary.despesas} />
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Formas de pagamento</p>
            <div className="flex flex-wrap gap-1">
              {summary.formasPagamento.length
                ? summary.formasPagamento.map(f => <Badge key={f} variant="secondary">{f}</Badge>)
                : <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Status detectados</p>
            <div className="flex flex-wrap gap-1">
              {summary.statusDetectados.length
                ? summary.statusDetectados.map(s => <Badge key={s} variant="outline">{s}</Badge>)
                : <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapeamento de colunas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Mapeamento de colunas</span>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">{stats.mapped} mapeadas</Badge>
              <Badge variant="outline">{stats.custom} personalizadas</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop: tabela ≥ md */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coluna da planilha</TableHead>
                  <TableHead>Destino sugerido</TableHead>
                  <TableHead className="w-[110px]">Confiança</TableHead>
                  <TableHead className="w-[280px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map(m => (
                  <TableRow key={m.header}>
                    <TableCell className="font-medium align-top">{m.header}</TableCell>
                    <TableCell className="align-top">
                      {m.field
                        ? <span>{ENTITY_LABEL[m.field.entity]} → <strong>{m.field.label}</strong></span>
                        : <span className="text-muted-foreground italic">Campo personalizado</span>}
                      <p className="text-xs text-muted-foreground">{m.reason}</p>
                    </TableCell>
                    <TableCell className="align-top">
                      <ConfidenceBadge score={m.score} />
                    </TableCell>
                    <TableCell className="align-top">
                      <Select
                        value={overrides[m.header] ?? (m.field?.id ?? "__custom__")}
                        onValueChange={(v) => handleOverride(m.header, v)}
                      >
                        <SelectTrigger className="h-8 w-full max-w-[260px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__custom__">Marcar como campo personalizado</SelectItem>
                          {CANONICAL_FIELDS.map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              {ENTITY_LABEL[f.entity]} → {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: lista de cards < md */}
          <div className="md:hidden space-y-3">
            {matches.map(m => (
              <div key={m.header} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium break-words min-w-0 flex-1">{m.header}</p>
                  <ConfidenceBadge score={m.score} />
                </div>
                <div className="text-sm">
                  {m.field
                    ? <span>{ENTITY_LABEL[m.field.entity]} → <strong>{m.field.label}</strong></span>
                    : <span className="text-muted-foreground italic">Campo personalizado</span>}
                  <p className="text-xs text-muted-foreground">{m.reason}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ação</p>
                  <Select
                    value={overrides[m.header] ?? (m.field?.id ?? "__custom__")}
                    onValueChange={(v) => handleOverride(m.header, v)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">Marcar como campo personalizado</SelectItem>
                      {CANONICAL_FIELDS.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {ENTITY_LABEL[f.entity]} → {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização (10 primeiras linhas)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  {headers.map(h => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.slice(0, 10).map((row, i) => (
                  <TableRow key={i}>
                    {headers.map((_, idx) => (
                      <TableCell key={idx} className="whitespace-nowrap text-xs">
                        {String(row[idx] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <FileWarning className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Colunas sem destino serão preservadas como campos personalizados.</span>
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={onBack} disabled={isImporting} className="flex-1 sm:flex-none">Voltar</Button>
          <Button onClick={onConfirm} disabled={isImporting} className="flex-1 sm:flex-none">
            {isImporting ? "Importando..." : "Confirmar e importar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 0.8) {
    return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
      <CheckCircle2 className="h-3 w-3 mr-1" />alta
    </Badge>;
  }
  if (score >= 0.45) {
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
      <AlertTriangle className="h-3 w-3 mr-1" />média
    </Badge>;
  }
  return <Badge variant="outline">baixa</Badge>;
}
