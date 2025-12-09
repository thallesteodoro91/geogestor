/**
 * @fileoverview Tipos de dados para KPIs e métricas
 */

export interface KPIData {
  receita_total: number;
  receita_realizada_total: number;
  valor_faturado_total: number;
  total_impostos: number;
  receita_liquida: number;
  lucro_bruto: number;
  lucro_liquido: number;
  margem_bruta_percent: number;
  margem_liquida_percent: number;
  margem_contribuicao_percent: number;
  ponto_equilibrio_receita: number;
  total_despesas: number;
  custo_total: number;
  total_servicos: number;
  servicos_concluidos: number;
  total_clientes: number;
  total_orcamentos: number;
  taxa_conversao_percent: number;
  ticket_medio: number;
  desvio_orcamentario_percent: number;
}

export interface ClienteKPIs {
  totalPropriedades: number;
  totalServicos: number;
  servicosConcluidos: number;
  orcamentosEmitidos: number;
  receitaTotal: number;
}

export interface ServicoMetrics {
  nome: string;
  categoria: string;
  receita: number;
  custo: number;
  lucro: number;
  margem: number;
  quantidadeServicos: number;
  tempoMedioConclusao: number;
}

export interface OrcamentoMetrics {
  totalOrcamentos: number;
  orcamentosConvertidos: number;
  taxaConversao: number;
  receitaEsperada: number;
  receitaRealizada: number;
  ticketMedio: number;
}
