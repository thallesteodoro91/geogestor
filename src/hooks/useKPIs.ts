import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useKPIs() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calcular_kpis_v2');
      
      if (error) {
        console.error('Error fetching KPIs:', error);
        throw error;
      }

      // Se não houver dados, retornar valores padrão
      if (!data || data.length === 0) {
        return {
          receita_total: 0,
          receita_realizada_total: 0,
          valor_faturado_total: 0,
          lucro_bruto: 0,
          lucro_liquido: 0,
          margem_bruta_percent: 0,
          margem_liquida_percent: 0,
          margem_contribuicao_percent: 0,
          ponto_equilibrio_receita: 0,
          total_despesas: 0,
          custo_total: 0,
          total_servicos: 0,
          servicos_concluidos: 0,
          total_clientes: 0,
          total_orcamentos: 0,
          taxa_conversao_percent: 0,
          ticket_medio: 0,
          desvio_orcamentario_percent: 0,
        };
      }

      return data[0];
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}