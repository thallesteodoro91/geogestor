import { Card, CardContent } from "@/components/ui/card";
import { Building2, Wrench, FileText, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ClienteKPIsProps {
  kpis: {
    totalPropriedades: number;
    servicosRealizados: number;
    totalServicos: number;
    orcamentosEmitidos: number;
    receitaTotal: number;
  };
  isLoading?: boolean;
}

export function ClienteKPIs({ kpis, isLoading }: ClienteKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpiData = [
    {
      title: "Propriedades",
      value: kpis.totalPropriedades,
      icon: Building2,
      tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      title: "Serviços Realizados",
      value: `${kpis.servicosRealizados}/${kpis.totalServicos}`,
      icon: Wrench,
      tone: "bg-success/10 text-success",
    },
    {
      title: "Orçamentos",
      value: kpis.orcamentosEmitidos,
      icon: FileText,
      tone: "bg-warning/15 text-warning",
    },
    {
      title: "Receita Total",
      value: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(kpis.receitaTotal),
      icon: DollarSign,
      tone: "bg-success/10 text-success",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {kpiData.map((kpi) => (
        <Card key={kpi.title}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              </div>
              <div className={cn("p-3 rounded-lg", kpi.tone)}>
                <kpi.icon className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
