import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface KPIVariation {
  currentPeriod: {
    receita_total: number;
    lucro_bruto: number;
    lucro_liquido: number;
    total_despesas: number;
    margem_bruta_percent: number;
    margem_liquida_percent: number;
    taxa_conversao_percent: number;
    ticket_medio: number;
    total_servicos: number;
    servicos_concluidos: number;
  };
  previousPeriod: {
    receita_total: number;
    lucro_bruto: number;
    lucro_liquido: number;
    total_despesas: number;
    margem_bruta_percent: number;
    margem_liquida_percent: number;
    taxa_conversao_percent: number;
    ticket_medio: number;
    total_servicos: number;
    servicos_concluidos: number;
  };
  variations: {
    receita_total: number;
    lucro_bruto: number;
    lucro_liquido: number;
    total_despesas: number;
    margem_bruta_percent: number;
    margem_liquida_percent: number;
    taxa_conversao_percent: number;
    ticket_medio: number;
    total_servicos: number;
    servicos_concluidos: number;
  };
}

function calculateVariation(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function fetchKPIWithVariation(): Promise<KPIVariation> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Calculate previous period (last 6 months vs 6 months before that)
  const currentPeriodStart = new Date(currentYear, currentMonth - 6, 1);
  const previousPeriodStart = new Date(currentYear, currentMonth - 12, 1);
  const previousPeriodEnd = new Date(currentYear, currentMonth - 6, 0);
  
  // Fetch current period data
  const { data: currentOrcamentos } = await supabase
    .from('fato_orcamento')
    .select('receita_esperada, lucro_esperado, orcamento_convertido, percentual_imposto')
    .gte('data_orcamento', currentPeriodStart.toISOString().split('T')[0]);
  
  const { data: previousOrcamentos } = await supabase
    .from('fato_orcamento')
    .select('receita_esperada, lucro_esperado, orcamento_convertido, percentual_imposto')
    .gte('data_orcamento', previousPeriodStart.toISOString().split('T')[0])
    .lte('data_orcamento', previousPeriodEnd.toISOString().split('T')[0]);
  
  const { data: currentDespesas } = await supabase
    .from('fato_despesas')
    .select('valor_da_despesa')
    .gte('data_da_despesa', currentPeriodStart.toISOString().split('T')[0]);
  
  const { data: previousDespesas } = await supabase
    .from('fato_despesas')
    .select('valor_da_despesa')
    .gte('data_da_despesa', previousPeriodStart.toISOString().split('T')[0])
    .lte('data_da_despesa', previousPeriodEnd.toISOString().split('T')[0]);
  
  const { data: currentServicos } = await supabase
    .from('fato_servico')
    .select('id_servico, situacao_do_servico, receita_servico')
    .gte('created_at', currentPeriodStart.toISOString());
  
  const { data: previousServicos } = await supabase
    .from('fato_servico')
    .select('id_servico, situacao_do_servico, receita_servico')
    .gte('created_at', previousPeriodStart.toISOString())
    .lte('created_at', previousPeriodEnd.toISOString());
  
  // Calculate current period metrics
  const currentReceitaTotal = (currentOrcamentos || []).reduce((sum, o) => sum + (o.receita_esperada || 0), 0);
  const currentDespesasTotal = (currentDespesas || []).reduce((sum, d) => sum + (d.valor_da_despesa || 0), 0);
  const currentImpostos = (currentOrcamentos || []).reduce((sum, o) => 
    sum + ((o.receita_esperada || 0) * (o.percentual_imposto || 0) / 100), 0
  );
  const currentReceitaLiquida = currentReceitaTotal - currentImpostos;
  const currentLucroBruto = currentReceitaLiquida - currentDespesasTotal * 0.6; // Custos diretos = 60% despesas
  const currentLucroLiquido = currentReceitaLiquida - currentDespesasTotal;
  const currentTotalServicos = (currentServicos || []).length;
  const currentServicosConcluidos = (currentServicos || []).filter(s => s.situacao_do_servico === 'Concluído').length;
  const currentTotalOrcamentos = (currentOrcamentos || []).length;
  const currentConvertidos = (currentOrcamentos || []).filter(o => o.orcamento_convertido).length;
  
  // Calculate previous period metrics
  const previousReceitaTotal = (previousOrcamentos || []).reduce((sum, o) => sum + (o.receita_esperada || 0), 0);
  const previousDespesasTotal = (previousDespesas || []).reduce((sum, d) => sum + (d.valor_da_despesa || 0), 0);
  const previousImpostos = (previousOrcamentos || []).reduce((sum, o) => 
    sum + ((o.receita_esperada || 0) * (o.percentual_imposto || 0) / 100), 0
  );
  const previousReceitaLiquida = previousReceitaTotal - previousImpostos;
  const previousLucroBruto = previousReceitaLiquida - previousDespesasTotal * 0.6;
  const previousLucroLiquido = previousReceitaLiquida - previousDespesasTotal;
  const previousTotalServicos = (previousServicos || []).length;
  const previousServicosConcluidos = (previousServicos || []).filter(s => s.situacao_do_servico === 'Concluído').length;
  const previousTotalOrcamentos = (previousOrcamentos || []).length;
  const previousConvertidos = (previousOrcamentos || []).filter(o => o.orcamento_convertido).length;
  
  const currentPeriod = {
    receita_total: currentReceitaTotal,
    lucro_bruto: currentLucroBruto,
    lucro_liquido: currentLucroLiquido,
    total_despesas: currentDespesasTotal,
    margem_bruta_percent: currentReceitaTotal > 0 ? (currentLucroBruto / currentReceitaTotal) * 100 : 0,
    margem_liquida_percent: currentReceitaTotal > 0 ? (currentLucroLiquido / currentReceitaTotal) * 100 : 0,
    taxa_conversao_percent: currentTotalOrcamentos > 0 ? (currentConvertidos / currentTotalOrcamentos) * 100 : 0,
    ticket_medio: currentTotalServicos > 0 ? currentReceitaTotal / currentTotalServicos : 0,
    total_servicos: currentTotalServicos,
    servicos_concluidos: currentServicosConcluidos,
  };
  
  const previousPeriod = {
    receita_total: previousReceitaTotal,
    lucro_bruto: previousLucroBruto,
    lucro_liquido: previousLucroLiquido,
    total_despesas: previousDespesasTotal,
    margem_bruta_percent: previousReceitaTotal > 0 ? (previousLucroBruto / previousReceitaTotal) * 100 : 0,
    margem_liquida_percent: previousReceitaTotal > 0 ? (previousLucroLiquido / previousReceitaTotal) * 100 : 0,
    taxa_conversao_percent: previousTotalOrcamentos > 0 ? (previousConvertidos / previousTotalOrcamentos) * 100 : 0,
    ticket_medio: previousTotalServicos > 0 ? previousReceitaTotal / previousTotalServicos : 0,
    total_servicos: previousTotalServicos,
    servicos_concluidos: previousServicosConcluidos,
  };
  
  return {
    currentPeriod,
    previousPeriod,
    variations: {
      receita_total: calculateVariation(currentPeriod.receita_total, previousPeriod.receita_total),
      lucro_bruto: calculateVariation(currentPeriod.lucro_bruto, previousPeriod.lucro_bruto),
      lucro_liquido: calculateVariation(currentPeriod.lucro_liquido, previousPeriod.lucro_liquido),
      total_despesas: calculateVariation(currentPeriod.total_despesas, previousPeriod.total_despesas),
      margem_bruta_percent: calculateVariation(currentPeriod.margem_bruta_percent, previousPeriod.margem_bruta_percent),
      margem_liquida_percent: calculateVariation(currentPeriod.margem_liquida_percent, previousPeriod.margem_liquida_percent),
      taxa_conversao_percent: calculateVariation(currentPeriod.taxa_conversao_percent, previousPeriod.taxa_conversao_percent),
      ticket_medio: calculateVariation(currentPeriod.ticket_medio, previousPeriod.ticket_medio),
      total_servicos: currentPeriod.total_servicos - previousPeriod.total_servicos,
      servicos_concluidos: currentPeriod.servicos_concluidos - previousPeriod.servicos_concluidos,
    },
  };
}

export function useKPIVariation() {
  return useQuery({
    queryKey: ['kpi-variation'],
    queryFn: fetchKPIWithVariation,
    refetchInterval: 60000,
  });
}

export function formatVariation(value: number, isPercentage: boolean = true, isCount: boolean = false): string {
  if (isCount) {
    return value >= 0 ? `+${value}` : `${value}`;
  }
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}
