import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Calendar, Tag, Info,
} from "lucide-react";
import { inferColumnTypes, isMonetaryCompatible, type InferredColumn, type ColumnType } from "@/lib/etl/columnTypeInference";

export interface MappingPanelField {
  key: string;
  label: string;
  required?: boolean;
  type?: "number" | "date" | "boolean" | "text";
}

interface Props {
  headers: string[];
  rawData: string[][];
  fields: MappingPanelField[];
  mappings: Record<string, string>;
  onChangeMapping: (fieldKey: string, header: string) => void;
}

type Domain = "receita" | "custos" | "datas" | "status";

interface DomainConfig {
  id: Domain;
  label: string;
  icon: typeof TrendingUp;
  fieldKeys: string[];
  expectedType: ColumnType[];
  criticalFieldKey?: string; // at least one of fieldKeys should be mapped
}

const DOMAINS: DomainConfig[] = [
  {
    id: "receita",
    label: "Receita",
    icon: TrendingUp,
    fieldKeys: ["valor_unitario", "receita_esperada", "receita_realizada", "receita_servico"],
    expectedType: ["monetario", "numero"],
    criticalFieldKey: "valor_unitario",
  },
  {
    id: "custos",
    label: "Custos & Despesas",
    icon: TrendingDown,
    fieldKeys: ["custo_servico", "valor_despesa", "valor_imposto", "valor_da_despesa", "categoria_despesa", "subcategoria_despesa"],
    expectedType: ["monetario", "numero", "categoria", "subcategoria", "texto"],
  },
  {
    id: "datas",
    label: "Datas",
    icon: Calendar,
    fieldKeys: ["data_orcamento", "data_despesa", "data_do_faturamento", "data_do_servico_inicio", "data_do_servico_fim", "data_da_despesa", "data_inicio", "data_termino", "data_cadastro"],
    expectedType: ["data"],
  },
  {
    id: "status",
    label: "Status",
    icon: Tag,
    fieldKeys: ["situacao_do_pagamento", "situacao_do_servico", "situacao", "status"],
    expectedType: ["status", "categoria", "texto"],
  },
];

const TYPE_LABEL: Record<ColumnType, string> = {
  monetario: "Monetário",
  percentual: "Percentual",
  data: "Data",
  status: "Status",
  documento: "Documento",
  telefone: "Telefone",
  email: "Email",
  categoria: "Categoria",
  subcategoria: "Subcategoria",
  texto: "Texto",
  numero: "Número",
  booleano: "Booleano",
  vazio: "Vazio",
};

export function MappingValidationPanel({
  headers, rawData, fields, mappings, onChangeMapping,
}: Props) {
  const inferred = useMemo<InferredColumn[]>(
    () => inferColumnTypes(headers, rawData, 50),
    [headers, rawData]
  );
  const inferredByHeader = useMemo(
    () => new Map(inferred.map(i => [i.header, i])),
    [inferred]
  );

  const fieldByKey = useMemo(
    () => new Map(fields.map(f => [f.key, f])),
    [fields]
  );

  type Issue =
    | { kind: "missing"; fieldKey: string; fieldLabel: string }
    | { kind: "type-mismatch"; fieldKey: string; fieldLabel: string; header: string; type: ColumnType; expected: ColumnType[] }
    | { kind: "ok"; fieldKey: string; fieldLabel: string; header: string; type: ColumnType };

  const domainsState = DOMAINS.map(d => {
    const issues: Issue[] = [];
    let mappedCount = 0;
    let mismatchCount = 0;

    for (const fk of d.fieldKeys) {
      const f = fieldByKey.get(fk);
      if (!f) continue;
      const header = mappings[fk];
      if (!header) {
        if (d.criticalFieldKey === fk) {
          issues.push({ kind: "missing", fieldKey: fk, fieldLabel: f.label });
        }
        continue;
      }
      mappedCount++;
      const inf = inferredByHeader.get(header);
      const type = inf?.type ?? "texto";
      const isFinancialDomain = d.id === "receita" || (d.id === "custos" && (fk.includes("valor") || fk.includes("custo") || fk === "valor_da_despesa"));
      const compatible = isFinancialDomain
        ? isMonetaryCompatible(type)
        : d.expectedType.includes(type);

      if (!compatible) {
        mismatchCount++;
        issues.push({ kind: "type-mismatch", fieldKey: fk, fieldLabel: f.label, header, type, expected: d.expectedType });
      } else {
        issues.push({ kind: "ok", fieldKey: fk, fieldLabel: f.label, header, type });
      }
    }

    // critical missing?
    if (d.criticalFieldKey && !mappings[d.criticalFieldKey] && !issues.some(i => i.kind === "missing" && i.fieldKey === d.criticalFieldKey)) {
      const f = fieldByKey.get(d.criticalFieldKey);
      if (f) issues.push({ kind: "missing", fieldKey: d.criticalFieldKey, fieldLabel: f.label });
    }

    const hasMissing = issues.some(i => i.kind === "missing");
    const status: "ok" | "warn" | "bad" =
      hasMissing ? "bad" : mismatchCount > 0 ? "warn" : mappedCount > 0 ? "ok" : "warn";

    return { d, issues, status, mappedCount, mismatchCount };
  });

  const totalAlerts = domainsState.reduce(
    (acc, s) => acc + s.issues.filter(i => i.kind !== "ok").length, 0
  );

  // Suggested headers for each field — prioritize by inferred type compatibility
  const suggestionsForField = (fk: string, expected: ColumnType[]): string[] => {
    const matches = headers.filter(h => {
      const t = inferredByHeader.get(h)?.type ?? "texto";
      return expected.includes(t);
    });
    const others = headers.filter(h => !matches.includes(h));
    return [...matches, ...others];
  };

  return (
    <Card className="p-4 space-y-4 border-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Validação de mapeamento
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Confirme como cada coluna foi interpretada. Você pode ajustar antes de importar.
          </p>
        </div>
        <Badge variant={totalAlerts === 0 ? "default" : "secondary"}>
          {totalAlerts === 0 ? "Sem alertas" : `${totalAlerts} alerta(s)`}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {domainsState.map(({ d, issues, status, mappedCount, mismatchCount }) => {
          const Icon = d.icon;
          const tone =
            status === "ok" ? "border-emerald-500/40 bg-emerald-500/5"
            : status === "warn" ? "border-amber-500/40 bg-amber-500/5"
            : "border-rose-500/40 bg-rose-500/5";

          return (
            <div key={d.id} className={`rounded-lg border p-3 space-y-2 ${tone}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4" />
                  {d.label}
                </div>
                {status === "ok" ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                    OK · {mappedCount}
                  </Badge>
                ) : status === "warn" ? (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                    {mismatchCount > 0 ? `${mismatchCount} divergência(s)` : "Revisar"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-700 dark:text-rose-300">
                    Crítico
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {issues.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhuma coluna mapeada nesta categoria.
                  </p>
                )}

                {issues.map((iss, idx) => {
                  if (iss.kind === "ok") {
                    const inf = inferredByHeader.get(iss.header);
                    return (
                      <div key={`${iss.fieldKey}-${idx}`} className="text-xs flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-muted-foreground truncate">{iss.fieldLabel}</span>
                        <span className="ml-auto truncate font-medium">{iss.header}</span>
                        {inf && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {TYPE_LABEL[inf.type]}
                          </Badge>
                        )}
                      </div>
                    );
                  }

                  // missing or mismatch — render inline fix dropdown
                  const isMissing = iss.kind === "missing";
                  const suggestions = suggestionsForField(iss.fieldKey, d.expectedType);

                  return (
                    <div key={`${iss.fieldKey}-${idx}`} className="rounded border bg-background p-2 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isMissing ? "text-rose-500" : "text-amber-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium">{iss.fieldLabel}</div>
                          {isMissing ? (
                            <div className="text-[11px] text-muted-foreground">
                              Coluna obrigatória não mapeada. Selecione abaixo.
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground">
                              Coluna <span className="font-medium">{iss.header}</span> foi detectada como{" "}
                              <span className="font-medium">{TYPE_LABEL[iss.type]}</span>, mas o sistema espera{" "}
                              {iss.expected.map(t => TYPE_LABEL[t]).join(" / ")}.
                            </div>
                          )}
                        </div>
                      </div>

                      <Select
                        value={mappings[iss.fieldKey] || "__none__"}
                        onValueChange={(v) => onChangeMapping(iss.fieldKey, v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Selecionar coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Não mapear —</SelectItem>
                          {suggestions.map(h => {
                            const t = inferredByHeader.get(h)?.type ?? "texto";
                            const compat = d.expectedType.includes(t) ||
                              ((d.id === "receita" || d.id === "custos") && isMonetaryCompatible(t));
                            return (
                              <SelectItem key={h} value={h}>
                                <span className="flex items-center gap-2">
                                  {compat && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                                  <span>{h}</span>
                                  <span className="text-muted-foreground text-[10px]">· {TYPE_LABEL[t]}</span>
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {totalAlerts > 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-300">
            Revise os alertas antes de importar
          </AlertTitle>
          <AlertDescription className="text-amber-600 dark:text-amber-400 text-xs">
            Ajustar mapeamentos aqui evita que receitas, custos, datas ou status sejam importados na coluna errada.
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
}
