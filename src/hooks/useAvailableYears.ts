import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch years that have actual data in the system
 * Returns years from budgets and expenses, including current year
 */
export function useAvailableYears() {
  return useQuery({
    queryKey: ['available-years'],
    queryFn: async (): Promise<number[]> => {
      const currentYear = new Date().getFullYear();
      const yearsSet = new Set<number>();
      
      // Always include current year
      yearsSet.add(currentYear);
      
      // Fetch years from budgets
      const { data: orcamentos } = await supabase
        .from('fato_orcamento')
        .select('data_orcamento');
      
      (orcamentos || []).forEach(o => {
        if (o.data_orcamento) {
          const year = new Date(o.data_orcamento).getFullYear();
          yearsSet.add(year);
        }
      });
      
      // Fetch years from expenses
      const { data: despesas } = await supabase
        .from('fato_despesas')
        .select('data_da_despesa');
      
      (despesas || []).forEach(d => {
        if (d.data_da_despesa) {
          const year = new Date(d.data_da_despesa).getFullYear();
          yearsSet.add(year);
        }
      });
      
      // Fetch years from services
      const { data: servicos } = await supabase
        .from('fato_servico')
        .select('data_do_servico_inicio');
      
      (servicos || []).forEach(s => {
        if (s.data_do_servico_inicio) {
          const year = new Date(s.data_do_servico_inicio).getFullYear();
          yearsSet.add(year);
        }
      });
      
      // Sort years descending (most recent first)
      // Filter out future years and sort descending (most recent first)
      return Array.from(yearsSet)
        .filter(year => year <= currentYear)
        .sort((a, b) => b - a);
    },
    staleTime: 60000,
  });
}
