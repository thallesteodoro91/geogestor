import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tipos para os dados retornados pela RPC
export interface DashboardMetrics {
  receita_total: number;
  total_impostos: number;
  total_despesas: number;
  custos_variaveis: number;
  despesas_fixas: number;
  total_orcamentos: number;
  lucro_por_cliente: { cliente: string; lucro: number }[];
  margem_por_servico: { servico: string; margem: number }[];
  custos_por_categoria: { name: string; value: number }[];
  periodo: { data_inicio: string; data_fim: string };
}

interface UseDashboardMetricsOptions {
  dataInicio?: string;
  dataFim?: string;
  enabled?: boolean;
}

/**
 * Hook para buscar métricas do Dashboard Financeiro via RPC
 * Todo o processamento pesado (SUM, COUNT, GROUP BY) é feito no servidor PostgreSQL
 * Otimizado para suportar milhares de registros sem lentidão no cliente
 */
export function useDashboardMetrics(options: UseDashboardMetricsOptions = {}) {
  const { dataInicio, dataFim, enabled = true } = options;

  return useQuery({
    queryKey: ["dashboard-metrics", dataInicio, dataFim],
    queryFn: async (): Promise<DashboardMetrics> => {
      const { data, error } = await supabase.rpc("get_financial_dashboard_metrics", {
        p_data_inicio: dataInicio || null,
        p_data_fim: dataFim || null,
      });

      if (error) {
        console.error("Erro ao buscar métricas do dashboard:", error);
        throw error;
      }

      // Parse dos dados JSON retornados (cast via unknown para evitar erro de tipo)
      const metrics = data as unknown as DashboardMetrics;
      
      return {
        receita_total: metrics.receita_total || 0,
        total_impostos: metrics.total_impostos || 0,
        total_despesas: metrics.total_despesas || 0,
        custos_variaveis: metrics.custos_variaveis || 0,
        despesas_fixas: metrics.despesas_fixas || 0,
        total_orcamentos: metrics.total_orcamentos || 0,
        lucro_por_cliente: metrics.lucro_por_cliente || [],
        margem_por_servico: metrics.margem_por_servico || [],
        custos_por_categoria: metrics.custos_por_categoria || [],
        periodo: metrics.periodo || { data_inicio: '', data_fim: '' },
      };
    },
    enabled,
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000, // 1 minuto
  });
}

/**
 * Calcula KPIs derivados a partir das métricas brutas
 */
export function calculateDerivedKPIs(metrics: DashboardMetrics) {
  const receitaLiquida = metrics.receita_total - metrics.total_impostos;
  const lucroBruto = receitaLiquida - metrics.custos_variaveis;
  const lucroLiquido = lucroBruto - metrics.despesas_fixas;
  
  const margemContribuicao = receitaLiquida > 0 
    ? ((receitaLiquida - metrics.custos_variaveis) / receitaLiquida) * 100 
    : 0;
  
  const pontoEquilibrio = margemContribuicao > 0 
    ? metrics.despesas_fixas / (margemContribuicao / 100) 
    : 0;

  return {
    receita_liquida: receitaLiquida,
    lucro_bruto: lucroBruto,
    lucro_liquido: lucroLiquido,
    margem_contribuicao_percent: margemContribuicao,
    ponto_equilibrio_receita: pontoEquilibrio,
    custo_total: metrics.custos_variaveis + metrics.despesas_fixas,
  };
}
