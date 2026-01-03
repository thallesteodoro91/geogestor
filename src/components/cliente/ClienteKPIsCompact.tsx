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
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
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
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Propriedades */}
          <div className="flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-md">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Propriedades</p>
              <p className="text-lg font-bold">{kpis.totalPropriedades}</p>
            </div>
          </div>

          {/* Serviços */}
          <div className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-md">
              <Wrench className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Serviços</p>
              <p className="text-lg font-bold">{kpis.servicosRealizados}/{kpis.totalServicos}</p>
            </div>
          </div>

          {/* Orçamentos */}
          <div className="flex items-center gap-3 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-md">
              <FileText className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Orçamentos</p>
              <p className="text-lg font-bold">{kpis.orcamentosEmitidos}</p>
            </div>
          </div>

          {/* Receita */}
          <div className="flex items-center gap-3 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-md">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita</p>
              <p className="text-base font-bold">{formatCurrency(kpis.receitaTotal)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
