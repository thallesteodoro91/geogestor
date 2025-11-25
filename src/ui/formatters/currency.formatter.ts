/**
 * @fileoverview Formatadores de valores monetários e numéricos
 */

import { formatarMoeda, formatarPercentual } from '@/core/finance';

/**
 * Formata valor em moeda brasileira (wrapper)
 */
export const formatCurrency = formatarMoeda;

/**
 * Formata percentual (wrapper)
 */
export const formatPercent = formatarPercentual;

/**
 * Formata número com separadores de milhar
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata valor compacto (1000 = 1k, 1000000 = 1M)
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
}

/**
 * Formata valor compacto de moeda
 */
export function formatCompactCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return formatCurrency(value);
}
