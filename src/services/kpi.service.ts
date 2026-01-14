/**
 * @fileoverview Serviço de cálculo e processamento de KPIs
 */

import { supabase } from '@/integrations/supabase/client';
import type { KPIData } from '@/domain/types/kpi.types';
import {
  calcularMargemBruta,
  calcularMargemLiquida,
  calcularMargemContribuicao,
  calcularPontoEquilibrio,
  calcularTicketMedio,
  calcularTaxaConversao,
  calcularDesvioOrcamentario,
} from '@/core/finance';

/**
 * Busca KPIs do banco e calcula métricas adicionais
 */
export async function fetchKPIs(): Promise<KPIData> {
  // Garantir que há sessão ativa antes de buscar KPIs
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.warn('fetchKPIs: No active session, returning defaults');
    return getDefaultKPIs();
  }

  const { data, error } = await supabase.rpc('calcular_kpis_v2');

  if (error) {
    console.error('Error fetching KPIs:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn('fetchKPIs: No data returned from RPC');
    return getDefaultKPIs();
  }

  // Log para debug - verificar se os dados estão chegando
  console.log('fetchKPIs: Data received', data[0]);

  return data[0];
}

/**
 * Retorna KPIs padrão quando não há dados
 */
export function getDefaultKPIs(): KPIData {
  return {
    receita_total: 0,
    receita_realizada_total: 0,
    valor_faturado_total: 0,
    total_impostos: 0,
    receita_liquida: 0,
    lucro_bruto: 0,
    lucro_liquido: 0,
    margem_bruta_percent: 0,
    margem_liquida_percent: 0,
    margem_contribuicao_percent: 0,
    ponto_equilibrio_receita: 0,
    total_despesas: 0,
    custo_total: 0,
    custos_variaveis_reais: 0,
    despesas_fixas_reais: 0,
    total_servicos: 0,
    servicos_concluidos: 0,
    total_clientes: 0,
    total_orcamentos: 0,
    taxa_conversao_percent: 0,
    ticket_medio: 0,
    desvio_orcamentario_percent: 0,
  };
}

/**
 * Calcula KPIs de cliente específico
 */
export async function fetchClienteKPIs(clienteId: string) {
  const [propriedades, servicos, orcamentos] = await Promise.all([
    supabase
      .from('dim_propriedade')
      .select('id_propriedade')
      .eq('id_cliente', clienteId),
    supabase
      .from('fato_servico')
      .select('id_servico, receita_servico, situacao_do_servico')
      .eq('id_cliente', clienteId),
    supabase
      .from('fato_orcamento')
      .select('id_orcamento, receita_esperada, receita_realizada')
      .eq('id_cliente', clienteId),
  ]);

  const totalPropriedades = propriedades.data?.length || 0;
  const totalServicos = servicos.data?.length || 0;
  const servicosConcluidos =
    servicos.data?.filter((s) => s.situacao_do_servico === 'Concluído').length || 0;
  const orcamentosEmitidos = orcamentos.data?.length || 0;

  const receitaServicos = servicos.data?.reduce(
    (sum, s) => sum + (Number(s.receita_servico) || 0),
    0
  ) || 0;

  const receitaOrcamentos = orcamentos.data?.reduce(
    (sum, o) => sum + (Number(o.receita_realizada) || 0),
    0
  ) || 0;

  return {
    totalPropriedades,
    totalServicos,
    servicosConcluidos,
    orcamentosEmitidos,
    receitaTotal: receitaServicos + receitaOrcamentos,
  };
}

/**
 * Processa dados brutos para calcular métricas derivadas
 */
export function processarMetricasDerivadas(kpis: KPIData): KPIData {
  const margemBruta = calcularMargemBruta(kpis.receita_total, kpis.custo_total);
  const margemLiquida = calcularMargemLiquida(
    kpis.receita_total,
    kpis.custo_total,
    kpis.total_despesas
  );
  const margemContribuicao = calcularMargemContribuicao(
    kpis.receita_total,
    kpis.custo_total
  );

  return {
    ...kpis,
    margem_bruta_percent: margemBruta,
    margem_liquida_percent: margemLiquida,
    margem_contribuicao_percent: margemContribuicao,
  };
}
