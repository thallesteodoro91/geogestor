/**
 * Categorias de evento sincronizado com Google Calendar.
 * Cada categoria mapeia para:
 *  - cor padrão do Google Calendar (colorId)
 *  - classe Tailwind ESTÁTICA usada no calendário interno (sem dynamic class names)
 *  - rótulo amigável em pt-BR
 */

export type EventCategory =
  | 'servico'
  | 'visita'
  | 'orcamento'
  | 'vencimento'
  | 'financeiro'
  | 'reuniao'
  | 'tarefa';

export interface CategoryMeta {
  key: EventCategory;
  label: string;
  /** Google Calendar colorId (https://developers.google.com/calendar/api/v3/reference/colors) */
  googleColorId: string;
  /** Classes Tailwind estáticas para badge/pill no calendário interno */
  badgeClass: string;
  /** Classe de cor de borda lateral em eventos */
  borderClass: string;
}

export const EVENT_CATEGORIES: Record<EventCategory, CategoryMeta> = {
  servico: {
    key: 'servico',
    label: 'Serviço',
    googleColorId: '9', // Blueberry (azul)
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    borderClass: 'border-l-blue-500',
  },
  visita: {
    key: 'visita',
    label: 'Visita técnica',
    googleColorId: '7', // Peacock (azul claro)
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
    borderClass: 'border-l-sky-500',
  },
  orcamento: {
    key: 'orcamento',
    label: 'Orçamento',
    googleColorId: '3', // Grape (roxo)
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
    borderClass: 'border-l-purple-500',
  },
  vencimento: {
    key: 'vencimento',
    label: 'Vencimento',
    googleColorId: '11', // Tomato (vermelho)
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    borderClass: 'border-l-rose-500',
  },
  financeiro: {
    key: 'financeiro',
    label: 'Financeiro',
    googleColorId: '10', // Basil (verde)
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    borderClass: 'border-l-emerald-500',
  },
  reuniao: {
    key: 'reuniao',
    label: 'Reunião',
    googleColorId: '5', // Banana (amarelo)
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    borderClass: 'border-l-amber-500',
  },
  tarefa: {
    key: 'tarefa',
    label: 'Tarefa',
    googleColorId: '8', // Graphite (cinza)
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    borderClass: 'border-l-slate-500',
  },
};

export const ALL_CATEGORIES: EventCategory[] = [
  'servico',
  'visita',
  'orcamento',
  'vencimento',
  'financeiro',
  'reuniao',
  'tarefa',
];

export function getCategoryMeta(category: EventCategory | string | null | undefined): CategoryMeta {
  if (category && category in EVENT_CATEGORIES) {
    return EVENT_CATEGORIES[category as EventCategory];
  }
  return EVENT_CATEGORIES.servico;
}

/** Sugere a categoria a partir do tipo de entidade do GeoGestor. */
export function categoryFromEntityType(
  entityType: 'servico' | 'orcamento' | string,
  hints?: { isVisita?: boolean; isVencimento?: boolean; isReuniao?: boolean }
): EventCategory {
  if (hints?.isVencimento) return 'vencimento';
  if (hints?.isVisita) return 'visita';
  if (hints?.isReuniao) return 'reuniao';
  if (entityType === 'orcamento') return 'orcamento';
  return 'servico';
}

/** Lembretes padrão (em minutos) por categoria, para enviar ao Google. */
export function defaultRemindersForCategory(category: EventCategory): number[] {
  switch (category) {
    case 'vencimento':
      return [60 * 24, 60]; // 1 dia e 1h antes
    case 'visita':
    case 'servico':
      return [60]; // 1h antes
    case 'reuniao':
      return [30, 10]; // 30min e 10min antes
    case 'orcamento':
      return [60 * 24]; // 1 dia antes
    default:
      return [];
  }
}
