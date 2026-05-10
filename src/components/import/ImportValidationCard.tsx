import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Wallet, Network } from "lucide-react";
import { useNavigate } from "react-router-dom";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface Props {
  receita: number;
  despesa: number; // soma de custos + despesas operacionais persistidas
  clientes: number;
  propriedades: number;
  servicos: number;
  orcamentos: number;
  despesasCount: number;
  onClose?: () => void;
}

export function ImportValidationCard({
  receita, despesa, clientes, propriedades, servicos, orcamentos, despesasCount, onClose,
}: Props) {
  const navigate = useNavigate();
  const lucro = receita - despesa;
  const margem = receita > 0 ? (lucro / receita) * 100 : 0;

  // Health logic
  let health: "ok" | "warn" | "bad" = "ok";
  let healthMsg = "Estrutura financeira completa e consistente.";
  if (receita === 0) {
    health = "bad";
    healthMsg = "Nenhuma receita foi reconhecida. Verifique o mapeamento da coluna de receita.";
  } else if (despesa === 0) {
    health = "warn";
    healthMsg = "Nenhum custo ou despesa importado — o lucro será igual à receita. Mapeie colunas de custo/despesa para um cálculo real.";
  } else if (margem < -50 || margem > 95) {
    health = "warn";
    healthMsg = `Margem calculada de ${margem.toFixed(1)}% parece atípica. Confira se receitas e despesas foram classificadas corretamente.`;
  }

  const healthColor =
    health === "ok" ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
    : health === "warn" ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
    : "border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300";

  return (
    <div className="space-y-4">
      <Card className={`p-4 border-2 ${healthColor}`}>
        <div className="flex items-start gap-3">
          {health === "ok" ? <CheckCircle2 className="h-5 w-5 mt-0.5" /> : <AlertTriangle className="h-5 w-5 mt-0.5" />}
          <div className="flex-1">
            <div className="font-medium text-sm">
              {health === "ok" ? "Importação validada" : health === "warn" ? "Importação concluída com observações" : "Importação concluída — atenção necessária"}
            </div>
            <div className="text-xs mt-1 opacity-90">{healthMsg}</div>
          </div>
          <Badge variant={health === "ok" ? "default" : "secondary"} className="shrink-0">
            {health === "ok" ? "OK" : health === "warn" ? "Revisar" : "Crítico"}
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Receita persistida
          </div>
          <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{fmt(receita)}</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> Custos + Despesas
          </div>
          <div className="text-lg font-semibold text-rose-600 dark:text-rose-400">{fmt(despesa)}</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 text-primary" /> Lucro calculado
          </div>
          <div className="text-lg font-semibold">{fmt(lucro)}</div>
          <div className="text-xs text-muted-foreground">Margem: {margem.toFixed(1)}%</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Network className="h-3.5 w-3.5 text-primary" /> Vinculações
          </div>
          <div className="text-xs leading-relaxed">
            {clientes} cliente(s)<br />
            {propriedades} propriedade(s) · {servicos} projeto(s)<br />
            {orcamentos} orçamento(s) · {despesasCount} despesa(s)
          </div>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => {
            onClose?.();
            navigate("/financeiro?source=import");
          }}
        >
          Ver Dashboard Financeiro <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
