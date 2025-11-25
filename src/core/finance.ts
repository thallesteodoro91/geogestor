/**
 * @fileoverview Camada core de cálculos financeiros centralizados
 * @module core/finance
 * 
 * Todas as funções financeiras da aplicação devem usar esta biblioteca
 * para garantir consistência e facilitar manutenção e testes.
 */

/**
 * Calcula margem percentual
 * @param lucro - Valor do lucro
 * @param receita - Valor da receita total
 * @returns Margem em percentual (0-100)
 */
export function calcularMargem(lucro: number, receita: number): number {
  if (receita === 0) return 0;
  return (lucro / receita) * 100;
}

/**
 * Calcula margem bruta
 * @param receita - Receita total
 * @param custosDiretos - Custos diretos/variáveis
 * @returns Margem bruta em percentual
 */
export function calcularMargemBruta(receita: number, custosDiretos: number): number {
  const lucroBruto = receita - custosDiretos;
  return calcularMargem(lucroBruto, receita);
}

/**
 * Calcula margem líquida
 * @param receita - Receita total
 * @param custoTotal - Custos totais (diretos + indiretos)
 * @param despesas - Despesas operacionais
 * @returns Margem líquida em percentual
 */
export function calcularMargemLiquida(
  receita: number,
  custoTotal: number,
  despesas: number
): number {
  const lucroLiquido = receita - custoTotal - despesas;
  return calcularMargem(lucroLiquido, receita);
}

/**
 * Calcula lucro bruto
 * @param receita - Receita total
 * @param custosDiretos - Custos diretos/variáveis
 * @returns Valor do lucro bruto
 */
export function calcularLucroBruto(receita: number, custosDiretos: number): number {
  return receita - custosDiretos;
}

/**
 * Calcula lucro líquido
 * @param receita - Receita total
 * @param custoTotal - Custos totais
 * @param despesas - Despesas operacionais
 * @returns Valor do lucro líquido
 */
export function calcularLucroLiquido(
  receita: number,
  custoTotal: number,
  despesas: number
): number {
  return receita - custoTotal - despesas;
}

/**
 * Calcula margem de contribuição
 * @param receita - Receita total
 * @param custosVariaveis - Custos variáveis
 * @returns Margem de contribuição em percentual
 */
export function calcularMargemContribuicao(
  receita: number,
  custosVariaveis: number
): number {
  const margemContribuicao = receita - custosVariaveis;
  return calcularMargem(margemContribuicao, receita);
}

/**
 * Calcula ponto de equilíbrio em receita
 * @param custosFixos - Custos fixos totais
 * @param margemContribuicaoPercent - Margem de contribuição em percentual
 * @returns Receita necessária para atingir ponto de equilíbrio
 */
export function calcularPontoEquilibrio(
  custosFixos: number,
  margemContribuicaoPercent: number
): number {
  if (margemContribuicaoPercent === 0) return 0;
  return custosFixos / (margemContribuicaoPercent / 100);
}

/**
 * Calcula markup sobre custo
 * @param custoTotal - Custo total do produto/serviço
 * @param margemDesejada - Margem de lucro desejada em percentual
 * @returns Preço de venda com markup aplicado
 */
export function calcularMarkup(custoTotal: number, margemDesejada: number): number {
  return custoTotal * (1 + margemDesejada / 100);
}

/**
 * Calcula ticket médio
 * @param receitaTotal - Receita total do período
 * @param quantidadeServicos - Quantidade de serviços realizados
 * @returns Ticket médio por serviço
 */
export function calcularTicketMedio(
  receitaTotal: number,
  quantidadeServicos: number
): number {
  if (quantidadeServicos === 0) return 0;
  return receitaTotal / quantidadeServicos;
}

/**
 * Calcula taxa de conversão
 * @param orcamentosConvertidos - Quantidade de orçamentos convertidos
 * @param totalOrcamentos - Total de orçamentos emitidos
 * @returns Taxa de conversão em percentual
 */
export function calcularTaxaConversao(
  orcamentosConvertidos: number,
  totalOrcamentos: number
): number {
  if (totalOrcamentos === 0) return 0;
  return (orcamentosConvertidos / totalOrcamentos) * 100;
}

/**
 * Calcula desvio orçamentário
 * @param valorOrcado - Valor orçado/planejado
 * @param valorRealizado - Valor realizado/executado
 * @returns Desvio em percentual (positivo = acima do orçado, negativo = abaixo)
 */
export function calcularDesvioOrcamentario(
  valorOrcado: number,
  valorRealizado: number
): number {
  if (valorOrcado === 0) return 0;
  return ((valorRealizado - valorOrcado) / valorOrcado) * 100;
}

/**
 * Calcula ROI (Return on Investment)
 * @param ganho - Ganho obtido
 * @param investimento - Valor investido
 * @returns ROI em percentual
 */
export function calcularROI(ganho: number, investimento: number): number {
  if (investimento === 0) return 0;
  return ((ganho - investimento) / investimento) * 100;
}

/**
 * Calcula custo por unidade de área (usado em topografia)
 * @param custoTotal - Custo total do serviço
 * @param areaHectares - Área em hectares
 * @returns Custo por hectare
 */
export function calcularCustoPorHectare(custoTotal: number, areaHectares: number): number {
  if (areaHectares === 0) return 0;
  return custoTotal / areaHectares;
}

/**
 * Calcula receita por unidade de área
 * @param receitaTotal - Receita total do serviço
 * @param areaHectares - Área em hectares
 * @returns Receita por hectare
 */
export function calcularReceitaPorHectare(
  receitaTotal: number,
  areaHectares: number
): number {
  if (areaHectares === 0) return 0;
  return receitaTotal / areaHectares;
}

/**
 * Formata valor em moeda brasileira
 * @param valor - Valor numérico
 * @returns String formatada em R$
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(valor);
}

/**
 * Formata percentual
 * @param valor - Valor numérico
 * @param casasDecimais - Número de casas decimais (padrão: 1)
 * @returns String formatada em percentual
 */
export function formatarPercentual(valor: number, casasDecimais: number = 1): string {
  return `${valor.toFixed(casasDecimais)}%`;
}

/**
 * Calcula variação percentual entre dois valores
 * @param valorAtual - Valor atual
 * @param valorAnterior - Valor anterior
 * @returns Variação em percentual
 */
export function calcularVariacaoPercentual(
  valorAtual: number,
  valorAnterior: number
): number {
  if (valorAnterior === 0) return valorAtual > 0 ? 100 : 0;
  return ((valorAtual - valorAnterior) / valorAnterior) * 100;
}
