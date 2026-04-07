/**
 * Design System — Cores centralizadas para status em todo o SkyGeo
 * 
 * Verde (emerald) → Ativo, Concluído, Pago, Aprovado
 * Amarelo (amber) → Em Andamento, Pendente, Atenção
 * Vermelho (rose) → Atrasado, Cancelado, Inativo, Crítico
 * Azul (blue) → Planejado, Em Revisão, Em Análise
 * Cinza (slate) → Indefinido, Neutro
 */

export type StatusCategory = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_MAP: Record<string, StatusCategory> = {
  // Serviços
  'Concluído': 'success',
  'Em Andamento': 'warning',
  'Pendente': 'warning',
  'Planejado': 'info',
  'Em Revisão': 'info',
  'Cancelado': 'danger',
  'Agendado': 'info',
  // Clientes
  'Ativo': 'success',
  'Inativo': 'danger',
  'Prospecto': 'info',
  // Pagamentos
  'Pago': 'success',
  'Parcial': 'warning',
  'Atrasado': 'danger',
  // Orçamento situação
  'Aprovado': 'success',
  'Rejeitado': 'danger',
  'Recusado': 'danger',
  'Em Analise': 'info',
  'Em Negociacao': 'warning',
  // Despesas
  'pendente': 'warning',
  'confirmada': 'success',
  // Genéricos
  'Sim': 'success',
  'Não': 'neutral',
};

const CATEGORY_CLASSES: Record<StatusCategory, string> = {
  success: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/25 border-transparent',
  warning: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500/25 border-transparent',
  danger: 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-500/25 border-transparent',
  info: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/25 border-transparent',
  neutral: 'bg-muted text-muted-foreground hover:bg-muted/80 border-transparent',
};

/**
 * Retorna classes Tailwind para estilizar um Badge baseado no status textual.
 * Funciona para qualquer módulo (serviços, clientes, pagamentos, orçamentos, etc.)
 */
export function getStatusClasses(status: string | null | undefined): string {
  if (!status) return CATEGORY_CLASSES.neutral;
  const category = STATUS_MAP[status] || 'neutral';
  return CATEGORY_CLASSES[category];
}

/**
 * Retorna a categoria semântica de um status
 */
export function getStatusCategory(status: string | null | undefined): StatusCategory {
  if (!status) return 'neutral';
  return STATUS_MAP[status] || 'neutral';
}
