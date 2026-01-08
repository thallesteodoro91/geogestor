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
export function ClienteKPIsCompact({
  kpis,
  isLoading
}: ClienteKPIsCompactProps) {
  if (isLoading) {
    return <Card>
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>;
  }
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  return <Card>
      
    </Card>;
}