import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlertaFinanceiro {
  id_orcamento: string;
  codigo_orcamento: string | null;
  cliente_nome: string | null;
  propriedade_nome: string | null;
  receita_esperada: number;
  data_do_faturamento: string;
  situacao_do_pagamento: string;
  status_alerta: string;
}

export function AlertasFinanceiros() {
  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas-financeiros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_alertas_financeiros')
        .select('*')
        .order('data_do_faturamento', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data as AlertaFinanceiro[];
    },
    refetchInterval: 60000,
  });

  const getIcon = (status: string) => {
    switch (status) {
      case 'vencido':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'proximo':
        return <Clock className="w-5 h-5 text-warning" />;
      default:
        return <Info className="w-5 h-5 text-accent" />;
    }
  };

  const getVariant = (status: string): "default" | "destructive" => {
    return status === 'vencido' ? 'destructive' : 'default';
  };

  const formatAlerta = (alerta: AlertaFinanceiro) => {
    const dataVencimento = new Date(alerta.data_do_faturamento);
    const diasDiferenca = differenceInDays(dataVencimento, new Date());
    
    if (alerta.status_alerta === 'vencido') {
      return {
        titulo: 'Pagamento Vencido',
        mensagem: `O orçamento ${alerta.codigo_orcamento || ''} de ${alerta.cliente_nome || 'Cliente'} venceu há ${Math.abs(diasDiferenca)} dia(s).`,
      };
    }
    
    return {
      titulo: 'Pagamento Próximo',
      mensagem: `O orçamento ${alerta.codigo_orcamento || ''} de ${alerta.cliente_nome || 'Cliente'} vence em ${diasDiferenca} dia(s).`,
    };
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

  if (!alertas || alertas.length === 0) {
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
          {alertas.map((alerta) => {
            const { titulo, mensagem } = formatAlerta(alerta);
            return (
              <Alert key={alerta.id_orcamento} variant={getVariant(alerta.status_alerta)} className="relative">
                <div className="flex gap-3">
                  {getIcon(alerta.status_alerta)}
                  <div className="flex-1 space-y-2">
                    <AlertTitle className="text-sm font-semibold">
                      {titulo}
                    </AlertTitle>
                    <AlertDescription className="text-xs space-y-1">
                      <p>{mensagem}</p>
                      <p className="font-mono font-medium">
                        Valor: R$ {alerta.receita_esperada?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-muted-foreground">
                        Vencimento: {format(new Date(alerta.data_do_faturamento), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
