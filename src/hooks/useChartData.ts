import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyData {
  month: string;
  receita: number;
  despesa: number;
}

interface MarginData {
  month: string;
  margemBruta: number;
  margemLiquida: number;
}

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function useRevenueChartData(year?: number) {
  const targetYear = year || new Date().getFullYear();
  
  return useQuery({
    queryKey: ['revenue-chart-data', targetYear],
    queryFn: async (): Promise<MonthlyData[]> => {
      // Fetch budgets for the year
      const { data: orcamentos } = await supabase
        .from('fato_orcamento')
        .select('data_orcamento, receita_esperada')
        .gte('data_orcamento', `${targetYear}-01-01`)
        .lte('data_orcamento', `${targetYear}-12-31`);
      
      // Fetch expenses for the year
      const { data: despesas } = await supabase
        .from('fato_despesas')
        .select('data_da_despesa, valor_da_despesa')
        .gte('data_da_despesa', `${targetYear}-01-01`)
        .lte('data_da_despesa', `${targetYear}-12-31`);
      
      // Group by month
      const monthlyRevenue: Record<number, number> = {};
      const monthlyExpenses: Record<number, number> = {};
      
      (orcamentos || []).forEach(o => {
        const month = new Date(o.data_orcamento).getMonth();
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (o.receita_esperada || 0);
      });
      
      (despesas || []).forEach(d => {
        const month = new Date(d.data_da_despesa).getMonth();
        monthlyExpenses[month] = (monthlyExpenses[month] || 0) + (d.valor_da_despesa || 0);
      });
      
      // Build array for all 12 months
      return monthNames.map((name, index) => ({
        month: name,
        receita: monthlyRevenue[index] || 0,
        despesa: monthlyExpenses[index] || 0,
      }));
    },
    refetchInterval: 60000,
  });
}

export function useProfitMarginChartData(year?: number) {
  const targetYear = year || new Date().getFullYear();
  
  return useQuery({
    queryKey: ['profit-margin-chart-data', targetYear],
    queryFn: async (): Promise<MarginData[]> => {
      // Fetch budgets for the year
      const { data: orcamentos } = await supabase
        .from('fato_orcamento')
        .select('data_orcamento, receita_esperada, lucro_esperado, percentual_imposto')
        .gte('data_orcamento', `${targetYear}-01-01`)
        .lte('data_orcamento', `${targetYear}-12-31`);
      
      // Fetch expenses for the year
      const { data: despesas } = await supabase
        .from('fato_despesas')
        .select('data_da_despesa, valor_da_despesa')
        .gte('data_da_despesa', `${targetYear}-01-01`)
        .lte('data_da_despesa', `${targetYear}-12-31`);
      
      // Group by month
      const monthlyData: Record<number, { receita: number; impostos: number; despesas: number }> = {};
      
      (orcamentos || []).forEach(o => {
        const month = new Date(o.data_orcamento).getMonth();
        const receita = o.receita_esperada || 0;
        const imposto = receita * (o.percentual_imposto || 0) / 100;
        
        if (!monthlyData[month]) {
          monthlyData[month] = { receita: 0, impostos: 0, despesas: 0 };
        }
        monthlyData[month].receita += receita;
        monthlyData[month].impostos += imposto;
      });
      
      (despesas || []).forEach(d => {
        const month = new Date(d.data_da_despesa).getMonth();
        if (!monthlyData[month]) {
          monthlyData[month] = { receita: 0, impostos: 0, despesas: 0 };
        }
        monthlyData[month].despesas += d.valor_da_despesa || 0;
      });
      
      // Calculate margins for each month
      return monthNames.map((name, index) => {
        const data = monthlyData[index] || { receita: 0, impostos: 0, despesas: 0 };
        const receitaLiquida = data.receita - data.impostos;
        const custosDiretos = data.despesas * 0.6; // 60% are direct costs
        const lucroBruto = receitaLiquida - custosDiretos;
        const lucroLiquido = receitaLiquida - data.despesas;
        
        const margemBruta = data.receita > 0 ? (lucroBruto / data.receita) * 100 : 0;
        const margemLiquida = data.receita > 0 ? (lucroLiquido / data.receita) * 100 : 0;
        
        return {
          month: name,
          margemBruta: Math.max(0, Math.min(100, margemBruta)), // Clamp between 0-100
          margemLiquida: Math.max(0, Math.min(100, margemLiquida)),
        };
      });
    },
    refetchInterval: 60000,
  });
}
