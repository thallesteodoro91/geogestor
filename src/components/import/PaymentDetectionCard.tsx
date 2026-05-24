import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Wallet, Tag, AlertTriangle } from "lucide-react";

interface CountMap { [key: string]: number }

export interface PaymentDetectionStats {
  formaPagamentoColumn?: string;
  formaPagamentoCounts: CountMap;
  formaPagamentoUnmatched: number;
  statusPagamentoColumn?: string;
  statusPagamentoCounts: CountMap;
  statusPagamentoUnmatched: number;
  statusOrcamentoColumn?: string;
  statusOrcamentoCounts: CountMap;
  statusOrcamentoUnmatched: number;
  totalOrcamentos: number;
  orcamentosVinculadosCliente: number;
}

interface Props {
  stats: PaymentDetectionStats;
}

function formatCounts(counts: CountMap): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k} ${v}`).join(" · ");
}

export function PaymentDetectionCard({ stats }: Props) {
  const anyDetection =
    stats.formaPagamentoColumn || stats.statusPagamentoColumn || stats.statusOrcamentoColumn;

  if (!anyDetection && stats.totalOrcamentos === 0) return null;

  const pagos = stats.statusPagamentoCounts["Pago"] || 0;
  const pendentes = stats.statusPagamentoCounts["Pendente"] || 0;
  const atrasados = stats.statusPagamentoCounts["Atrasado"] || 0;
  const cancelados = stats.statusPagamentoCounts["Cancelado"] || 0;

  return (
    <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="h-4 w-4 text-primary" />
        Detecção de pagamento e status
      </div>

      <div className="space-y-2 text-xs">
        {stats.formaPagamentoColumn ? (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div>
                <span className="font-medium">Forma de pagamento</span> detectada em{" "}
                <span className="font-medium">{stats.formaPagamentoColumn}</span>
              </div>
              <div className="text-muted-foreground truncate">{formatCounts(stats.formaPagamentoCounts)}</div>
              {stats.formaPagamentoUnmatched > 0 && (
                <div className="text-amber-600 dark:text-amber-400">
                  {stats.formaPagamentoUnmatched} valor(es) não reconhecido(s) — serão importados como "Outro".
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            Nenhuma coluna de forma de pagamento detectada.
          </div>
        )}

        {stats.statusPagamentoColumn ? (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div>
                <span className="font-medium">Status financeiro</span> detectado em{" "}
                <span className="font-medium">{stats.statusPagamentoColumn}</span>
              </div>
              <div className="text-muted-foreground truncate">{formatCounts(stats.statusPagamentoCounts)}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            Status financeiro não detectado — orçamentos serão marcados como "Pendente".
          </div>
        )}

        {stats.statusOrcamentoColumn && (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div>
                <span className="font-medium">Status do orçamento</span> detectado em{" "}
                <span className="font-medium">{stats.statusOrcamentoColumn}</span>
              </div>
              <div className="text-muted-foreground truncate">{formatCounts(stats.statusOrcamentoCounts)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t">
        <Stat icon={<Wallet className="h-3 w-3" />} label="Orçamentos" value={stats.totalOrcamentos} />
        <Stat icon={<Tag className="h-3 w-3" />} label="Com cliente" value={stats.orcamentosVinculadosCliente} />
        <Stat label="Pagos" value={pagos} tone="emerald" />
        <Stat label="Pendentes" value={pendentes} tone="amber" />
        <Stat label="Atrasados / Cancelados" value={atrasados + cancelados} tone="rose" />
      </div>
    </Card>
  );
}

function Stat({
  icon, label, value, tone,
}: { icon?: React.ReactNode; label: string; value: number; tone?: "emerald" | "amber" | "rose" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400"
    : tone === "rose" ? "text-rose-600 dark:text-rose-400"
    : "text-foreground";
  return (
    <div className="rounded border bg-background p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
