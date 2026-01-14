/**
 * @fileoverview Serviço de KPIs financeiros tenant-aware
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';
import type { KPIData } from '@/domain/types/kpi.types';
import {
  calcularMargemBruta,
  calcularMargemLiquida,
  calcularMargemContribuicao,
} from '@/core/finance';

/**
 * Busca KPIs do banco (usando a view que já filtra por tenant via RLS)
 */
export async function fetchKPIs(): Promise<KPIData> {
  const { data, error } = await supabase.rpc('calcular_kpis_v2');

  if (error) {
    console.error('Error fetching KPIs:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return getDefaultKPIs();
  }

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
 * Calcula KPIs de cliente específico (tenant-aware)
 */
export async function fetchClienteKPIs(clienteId: string) {
  const tenantId = await getCurrentTenantId();
  
  let propQuery = supabase.from('dim_propriedade').select('id_propriedade').eq('id_cliente', clienteId);
  let servQuery = supabase.from('fato_servico').select('id_servico, receita_servico, situacao_do_servico').eq('id_cliente', clienteId);
  let orcQuery = supabase.from('fato_orcamento').select('id_orcamento, receita_esperada, receita_realizada').eq('id_cliente', clienteId);
  
  if (tenantId) {
    propQuery = propQuery.eq('tenant_id', tenantId);
    servQuery = servQuery.eq('tenant_id', tenantId);
    orcQuery = orcQuery.eq('tenant_id', tenantId);
  }

  const [propriedades, servicos, orcamentos] = await Promise.all([propQuery, servQuery, orcQuery]);

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
 * Nota: A view vw_kpis_financeiros já calcula essas métricas corretamente
 * Esta função é mantida para cálculos adicionais no frontend se necessário
 */
export function processarMetricasDerivadas(kpis: KPIData): KPIData {
  // Se já temos custos_variaveis_reais, usamos para calcular margem de contribuição correta
  const custosVariaveis = kpis.custos_variaveis_reais || 0;
  const despesasFixas = kpis.despesas_fixas_reais || 0;
  
  const margemBruta = calcularMargemBruta(kpis.receita_liquida, custosVariaveis);
  const margemLiquida = calcularMargemLiquida(
    kpis.receita_liquida,
    custosVariaveis,
    despesasFixas
  );
  const margemContribuicao = calcularMargemContribuicao(
    kpis.receita_liquida,
    custosVariaveis
  );

  return {
    ...kpis,
    margem_bruta_percent: margemBruta,
    margem_liquida_percent: margemLiquida,
    margem_contribuicao_percent: margemContribuicao,
  };
}
