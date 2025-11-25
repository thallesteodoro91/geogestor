/**
 * @fileoverview Tipos relacionados a operações financeiras
 */

export interface ReceitaDespesa {
  mes: string;
  receita: number;
  despesa: number;
  lucro: number;
}

export interface CustoCategoria {
  categoria: string;
  valor: number;
  percentual: number;
}

export interface DesvioOrcamentario {
  categoria: string;
  orcado: number;
  realizado: number;
  desvio: number;
  desvioPercent: number;
}

export interface PontoEquilibrio {
  mes: string;
  receita: number;
  custoTotal: number;
  pontoEquilibrio: number;
  margemSeguranca: number;
}

export interface MargemAnalise {
  mes: string;
  margemBruta: number;
  margemLiquida: number;
  margemContribuicao: number;
}
