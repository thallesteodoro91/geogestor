export type TaskPriorityLevel = 'low' | 'medium' | 'high';

export interface TaskPriorityTone {
  level: TaskPriorityLevel;
  label: 'Baixa' | 'Média' | 'Alta';
  cardClass: string;
  badgeClass: string;
}

export function getTaskPriorityTone(priority?: string | null): TaskPriorityTone {
  const normalized = String(priority || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('baix')) {
    return {
      level: 'low',
      label: 'Baixa',
      cardClass: 'border-l-brand-green-500 dark:border-l-brand-green-400 bg-gradient-to-r from-brand-green-50 to-brand-green-50/30 dark:from-brand-green-500/16 dark:to-brand-surface-muted/40',
      badgeClass: 'geo-badge-base geo-badge-success'
    };
  }

  if (normalized.includes('alt')) {
    return {
      level: 'high',
      label: 'Alta',
      cardClass: 'border-l-brand-red-500 dark:border-l-brand-red-400 bg-gradient-to-r from-brand-red-50 to-brand-red-50/30 dark:from-brand-red-500/16 dark:to-brand-surface-muted/40',
      badgeClass: 'geo-badge-base geo-badge-danger'
    };
  }

  return {
    level: 'medium',
    label: 'Média',
    cardClass: 'border-l-brand-rajah-600 dark:border-l-brand-rajah-300 bg-gradient-to-r from-brand-rajah-50 to-brand-rajah-50/30 dark:from-brand-rajah-500/16 dark:to-brand-surface-muted/40',
    badgeClass: 'geo-badge-base geo-badge-warning'
  };
}
