import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useKPIs() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calcular_kpis');
      
      if (error) {
        console.error('Error fetching KPIs:', error);
        throw error;
      }

      // Se não houver dados, retornar valores padrão
      if (!data || data.length === 0) {
        return {
          receita_total: 0,
          lucro_bruto: 0,
          margem_bruta: 0,
          lucro_liquido: 0,
          margem_liquida: 0,
          total_despesas: 0,
          total_servicos: 0,
          servicos_concluidos: 0,
          taxa_conversao: 0,
          ticket_medio: 0,
        };
      }

      return data[0];
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}