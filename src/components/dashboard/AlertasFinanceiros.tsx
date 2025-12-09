import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Alerta {
  tipo: string;
  nivel: 'error' | 'warning' | 'info';
  titulo: string;
  mensagem: string;
  valor: number;
  icon: string;
  sugestao: string;
}

export function AlertasFinanceiros() {
  const { data: alertasData, isLoading } = useQuery({
    queryKey: ['alertas-financeiros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_alertas_financeiros')
        .select('*')
        .limit(1);
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    refetchInterval: 60000, // Atualiza a cada minuto
  });

  const alertas: Alerta[] = [];
  
  if (alertasData) {
    if (alertasData.alerta_margem) alertas.push(alertasData.alerta_margem as unknown as Alerta);
    if (alertasData.alerta_equilibrio) alertas.push(alertasData.alerta_equilibrio as unknown as Alerta);
    if (alertasData.alerta_custos) alertas.push(alertasData.alerta_custos as unknown as Alerta);
    if (alertasData.alerta_conversao) alertas.push(alertasData.alerta_conversao as unknown as Alerta);
  }

  const getIcon = (nivel: string) => {
    switch (nivel) {
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'warning':
        return <TrendingDown className="w-5 h-5 text-warning" />;
      case 'info':
        return <Info className="w-5 h-5 text-accent" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getVariant = (nivel: string) => {
    switch (nivel) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Card className="interactive-lift p-6 border-0">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  if (alertas.length === 0) {
    return (
      <Card className="interactive-lift p-6 border-0">
        <div className="flex items-center gap-3 text-success">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-success/10">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold">Tudo certo!</h3>
            <p className="text-sm text-muted-foreground">Nenhum alerta financeiro no momento.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="interactive-lift p-6 border-0">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-foreground">Alertas Financeiros</h3>
          <span className="text-xs text-muted-foreground">({alertas.length} alerta{alertas.length > 1 ? 's' : ''})</span>
        </div>
        
        <div className="space-y-3">
          {alertas.map((alerta, index) => (
            <Alert key={index} variant={getVariant(alerta.nivel)} className="relative">
              <div className="flex gap-3">
                {getIcon(alerta.nivel)}
                <div className="flex-1 space-y-2">
                  <AlertTitle className="text-sm font-semibold">
                    {alerta.icon} {alerta.titulo}
                  </AlertTitle>
                  <AlertDescription className="text-xs space-y-1">
                    <p>{alerta.mensagem}</p>
                    {alerta.valor && (
                      <p className="font-mono font-medium">
                        Valor: {alerta.tipo === 'margem_baixa' || alerta.tipo === 'conversao_baixa' 
                          ? `${alerta.valor.toFixed(1)}%` 
                          : `R$ ${alerta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      </p>
                    )}
                    {alerta.sugestao && (
                      <p className="text-muted-foreground mt-2">
                        <strong>Sugestão:</strong> {alerta.sugestao}
                      </p>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ))}
        </div>
      </div>
    </Card>
  );
}