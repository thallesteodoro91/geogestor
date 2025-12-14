import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp } from "lucide-react";

interface ClienteFinanceiroProps {
  servicos: any[];
  orcamentos: any[];
}

export function ClienteFinanceiro({ servicos, orcamentos }: ClienteFinanceiroProps) {
  const receitaServicos = servicos.reduce(
    (sum, s) => sum + (Number(s.receita_servico) || 0),
    0
  );

  const receitaOrcamentos = orcamentos.reduce(
    (sum, o) => sum + (Number(o.receita_realizada) || 0),
    0
  );

  const totalReceita = receitaServicos + receitaOrcamentos;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalReceita)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Serviços realizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita de Serviços</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(receitaServicos)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {servicos.length} serviço(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por Status de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(() => {
              const statusMap = new Map<string, number>();
              orcamentos.forEach((orc) => {
                const status = orc.situacao_do_pagamento || 'Não definido';
                const valor = Number(orc.receita_realizada || orc.receita_esperada) || 0;
                statusMap.set(status, (statusMap.get(status) || 0) + valor);
              });

              return Array.from(statusMap.entries()).map(([status, valor]) => (
                <div key={status} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm font-medium">{status}</span>
                  <span className="text-sm font-bold">{formatCurrency(valor)}</span>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
