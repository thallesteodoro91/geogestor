import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DespesaPendente {
  id_despesas: string;
  id_orcamento: string;
  id_tipodespesa: string | null;
  valor_da_despesa: number;
  data_da_despesa: string;
  observacoes: string | null;
  status: string;
  dim_tipodespesa?: {
    categoria: string;
    subcategoria: string | null;
  };
  fato_orcamento?: {
    id_orcamento: string;
    data_orcamento: string;
    dim_cliente?: {
      nome: string;
    };
    dim_propriedade?: {
      nome_da_propriedade: string;
    };
  };
}

export function DespesasPendentes() {
  const queryClient = useQueryClient();
  const [expandedOrcamentos, setExpandedOrcamentos] = useState<Set<string>>(new Set());

  const { data: despesasPendentes = [], isLoading } = useQuery({
    queryKey: ['despesas-pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fato_despesas')
        .select(`
          *,
          dim_tipodespesa(categoria, subcategoria),
          fato_orcamento(
            id_orcamento,
            data_orcamento,
            dim_cliente(nome),
            dim_propriedade(nome_da_propriedade)
          )
        `)
        .eq('status', 'pendente')
        .not('id_orcamento', 'is', null)
        .order('data_da_despesa', { ascending: false });
      
      if (error) throw error;
      return (data || []) as DespesaPendente[];
    },
  });

  const confirmarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fato_despesas')
        .update({ status: 'confirmada' })
        .eq('id_despesas', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      toast.success("Despesa confirmada!");
    },
    onError: (error) => {
      toast.error(`Erro ao confirmar: ${error.message}`);
    },
  });

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fato_despesas')
        .delete()
        .eq('id_despesas', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas-pendentes'] });
      toast.success("Despesa excluída!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const confirmarTodasMutation = useMutation({
    mutationFn: async (orcamentoId: string) => {
      const { error } = await supabase
        .from('fato_despesas')
        .update({ status: 'confirmada' })
        .eq('id_orcamento', orcamentoId)
        .eq('status', 'pendente');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      toast.success("Todas as despesas do orçamento foram confirmadas!");
    },
    onError: (error) => {
      toast.error(`Erro ao confirmar: ${error.message}`);
    },
  });

  const excluirTodasMutation = useMutation({
    mutationFn: async (orcamentoId: string) => {
      const { error } = await supabase
        .from('fato_despesas')
        .delete()
        .eq('id_orcamento', orcamentoId)
        .eq('status', 'pendente');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      toast.success("Todas as despesas do orçamento foram excluídas!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Agrupar despesas por orçamento
  const despesasAgrupadas = despesasPendentes.reduce((acc, despesa) => {
    const orcamentoId = despesa.id_orcamento;
    if (!acc[orcamentoId]) {
      acc[orcamentoId] = {
        orcamento: despesa.fato_orcamento,
        despesas: []
      };
    }
    acc[orcamentoId].despesas.push(despesa);
    return acc;
  }, {} as Record<string, { orcamento: DespesaPendente['fato_orcamento']; despesas: DespesaPendente[] }>);

  const toggleOrcamento = (orcamentoId: string) => {
    const newExpanded = new Set(expandedOrcamentos);
    if (newExpanded.has(orcamentoId)) {
      newExpanded.delete(orcamentoId);
    } else {
      newExpanded.add(orcamentoId);
    }
    setExpandedOrcamentos(newExpanded);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (Object.keys(despesasAgrupadas).length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <Clock className="h-5 w-5" />
          Despesas Pendentes de Confirmação
          <Badge variant="secondary" className="ml-2">
            {despesasPendentes.length}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Despesas vinculadas a orçamentos que ainda não foram confirmadas
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(despesasAgrupadas).map(([orcamentoId, { orcamento, despesas }]) => {
          const isExpanded = expandedOrcamentos.has(orcamentoId);
          const totalDespesas = despesas.reduce((sum, d) => sum + d.valor_da_despesa, 0);
          
          return (
            <Collapsible 
              key={orcamentoId} 
              open={isExpanded} 
              onOpenChange={() => toggleOrcamento(orcamentoId)}
            >
              <div className="rounded-lg border bg-card p-3">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-medium text-foreground">
                          {orcamento?.dim_cliente?.nome || 'Cliente não identificado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {orcamento?.dim_propriedade?.nome_da_propriedade && (
                            <span>{orcamento.dim_propriedade.nome_da_propriedade} • </span>
                          )}
                          {orcamento?.data_orcamento && new Date(orcamento.data_orcamento).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {despesas.length} despesa{despesas.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-3">
                  <div className="space-y-2 border-t pt-3">
                    {despesas.map((despesa) => (
                      <div 
                        key={despesa.id_despesas}
                        className="flex items-center justify-between rounded-md bg-muted/50 p-2"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {despesa.dim_tipodespesa?.subcategoria || despesa.dim_tipodespesa?.categoria || 'Sem categoria'}
                          </p>
                          {despesa.observacoes && (
                            <p className="text-xs text-muted-foreground">{despesa.observacoes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium whitespace-nowrap">
                            R$ {despesa.valor_da_despesa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                            onClick={() => confirmarMutation.mutate(despesa.id_despesas)}
                            disabled={confirmarMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => excluirMutation.mutate(despesa.id_despesas)}
                            disabled={excluirMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive hover:bg-destructive/10"
                        onClick={() => excluirTodasMutation.mutate(orcamentoId)}
                        disabled={excluirTodasMutation.isPending}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Excluir Todas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => confirmarTodasMutation.mutate(orcamentoId)}
                        disabled={confirmarTodasMutation.isPending}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Todas
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
