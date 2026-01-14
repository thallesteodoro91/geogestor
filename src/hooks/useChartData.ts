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
      // Fetch budgets for the year - usar valor_imposto persistido
      const { data: orcamentos } = await supabase
        .from('fato_orcamento')
        .select('data_orcamento, receita_esperada, incluir_imposto, valor_imposto')
        .gte('data_orcamento', `${targetYear}-01-01`)
        .lte('data_orcamento', `${targetYear}-12-31`);
      
      // Fetch expenses with classification to separate variable costs from fixed expenses
      const { data: despesas } = await supabase
        .from('fato_despesas')
        .select(`
          data_da_despesa, 
          valor_da_despesa,
          dim_tipodespesa:dim_tipodespesa!fk_despesas_tipodespesa(classificacao)
        `)
        .gte('data_da_despesa', `${targetYear}-01-01`)
        .lte('data_da_despesa', `${targetYear}-12-31`);
      
      // Group by month with proper cost classification
      const monthlyData: Record<number, { 
        receita: number; 
        impostos: number; 
        custosVariaveis: number; 
        despesasFixas: number 
      }> = {};
      
      (orcamentos || []).forEach(o => {
        const month = new Date(o.data_orcamento).getMonth();
        const receita = o.receita_esperada || 0;
        // Usar valor_imposto persistido ao invés de recalcular com percentual
        const imposto = o.incluir_imposto ? (o.valor_imposto || 0) : 0;
        
        if (!monthlyData[month]) {
          monthlyData[month] = { receita: 0, impostos: 0, custosVariaveis: 0, despesasFixas: 0 };
        }
        monthlyData[month].receita += receita;
        monthlyData[month].impostos += imposto;
      });
      
      (despesas || []).forEach((d: any) => {
        const month = new Date(d.data_da_despesa).getMonth();
        if (!monthlyData[month]) {
          monthlyData[month] = { receita: 0, impostos: 0, custosVariaveis: 0, despesasFixas: 0 };
        }
        
        const valor = d.valor_da_despesa || 0;
        const classificacao = d.dim_tipodespesa?.classificacao || 'FIXA';
        
        // Separar custos variáveis de despesas fixas baseado na classificação real
        if (classificacao === 'VARIAVEL') {
          monthlyData[month].custosVariaveis += valor;
        } else {
          monthlyData[month].despesasFixas += valor;
        }
      });
      
      // Calculate margins for each month using correct formulas
      return monthNames.map((name, index) => {
        const data = monthlyData[index] || { receita: 0, impostos: 0, custosVariaveis: 0, despesasFixas: 0 };
        
        // Receita Líquida = Receita - Impostos
        const receitaLiquida = data.receita - data.impostos;
        
        // Lucro Bruto = Receita Líquida - Custos Variáveis (dados reais)
        const lucroBruto = receitaLiquida - data.custosVariaveis;
        
        // Lucro Líquido = Lucro Bruto - Despesas Fixas
        const lucroLiquido = lucroBruto - data.despesasFixas;
        
        // Margem Bruta % = (Lucro Bruto / Receita Líquida) * 100
        const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
        
        // Margem Líquida % = (Lucro Líquido / Receita Líquida) * 100
        const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;
        
        return {
          month: name,
          margemBruta: Math.max(-100, Math.min(100, margemBruta)), // Allow negative margins
          margemLiquida: Math.max(-100, Math.min(100, margemLiquida)),
        };
      });
    },
    refetchInterval: 60000,
  });
}
