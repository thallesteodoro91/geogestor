import { Card, CardContent } from "@/components/ui/card";
import { Building2, Wrench, FileText, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ClienteKPIsCompactProps {
  kpis: {
    totalPropriedades: number;
    servicosRealizados: number;
    totalServicos: number;
    orcamentosEmitidos: number;
    receitaTotal: number;
  };
  isLoading?: boolean;
}

export function ClienteKPIsCompact({ kpis, isLoading }: ClienteKPIsCompactProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 h-full">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-6 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* Propriedades */}
          <div className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <div className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Propriedades</p>
              <p className="text-3xl font-bold">{kpis.totalPropriedades}</p>
            </div>
          </div>

          {/* Serviços */}
          <div className="flex flex-col items-center justify-center gap-3 p-6 bg-green-50 dark:bg-green-950/30 rounded-xl">
            <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <Wrench className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Serviços</p>
              <p className="text-3xl font-bold">{kpis.servicosRealizados}/{kpis.totalServicos}</p>
            </div>
          </div>

          {/* Orçamentos */}
          <div className="flex flex-col items-center justify-center gap-3 p-6 bg-yellow-50 dark:bg-yellow-950/30 rounded-xl">
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
              <FileText className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Orçamentos</p>
              <p className="text-3xl font-bold">{kpis.orcamentosEmitidos}</p>
            </div>
          </div>

          {/* Receita */}
          <div className="flex flex-col items-center justify-center gap-3 p-6 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
            <div className="p-4 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <DollarSign className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Receita</p>
              <p className="text-2xl font-bold">{formatCurrency(kpis.receitaTotal)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
