import { Card, CardContent } from "@/components/ui/card";
import { Building2, Wrench, FileText, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Serviços Realizados",
      value: `${kpis.servicosRealizados}/${kpis.totalServicos}`,
      icon: Wrench,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Orçamentos",
      value: kpis.orcamentosEmitidos,
      icon: FileText,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Receita Total",
      value: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(kpis.receitaTotal),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
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
              <div className={`p-3 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
