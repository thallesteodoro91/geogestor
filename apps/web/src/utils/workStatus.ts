export type WorkStatusPresentation = {
  label: string;
  progress: number;
  badgeClass: string;
  ringClass: string;
};

const defaultStatus: WorkStatusPresentation = {
  label: 'Sem status',
  progress: 10,
  badgeClass: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  ringClass: 'text-zinc-500 dark:text-zinc-300'
};

const workStatuses: Record<string, WorkStatusPresentation> = {
  Planejamento: {
    label: 'Planejamento',
    progress: 18,
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
    ringClass: 'text-slate-500 dark:text-slate-300'
  },
  'Em Análise': {
    label: 'Em análise',
    progress: 38,
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200',
    ringClass: 'text-indigo-600 dark:text-indigo-300'
  },
  'Em Andamento': {
    label: 'Em andamento',
    progress: 62,
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
    ringClass: 'text-sky-600 dark:text-sky-300'
  },
  'Aguardando Cliente': {
    label: 'Aguardando cliente',
    progress: 66,
    badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
    ringClass: 'text-violet-600 dark:text-violet-300'
  },
  'Aguardando Documentação': {
    label: 'Aguardando documentação',
    progress: 68,
    badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200',
    ringClass: 'text-cyan-600 dark:text-cyan-300'
  },
  'Aguardando Órgão': {
    label: 'Aguardando órgão',
    progress: 78,
    badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
    ringClass: 'text-amber-600 dark:text-amber-300'
  },
  'Com Pendência': {
    label: 'Com pendência',
    progress: 58,
    badgeClass: 'bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-200',
    ringClass: 'text-orange-600 dark:text-orange-300'
  },
  Suspenso: {
    label: 'Suspenso',
    progress: 50,
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
    ringClass: 'text-rose-600 dark:text-rose-300'
  },
  Finalizado: {
    label: 'Concluído',
    progress: 100,
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
    ringClass: 'text-emerald-600 dark:text-emerald-300'
  },
  Concluído: {
    label: 'Concluído',
    progress: 100,
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
    ringClass: 'text-emerald-600 dark:text-emerald-300'
  },
  Cancelado: {
    label: 'Cancelado',
    progress: 0,
    badgeClass: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
    ringClass: 'text-zinc-500 dark:text-zinc-300'
  }
};

export function getWorkStatusPresentation(status?: string | null): WorkStatusPresentation {
  if (!status) return defaultStatus;
  return workStatuses[status] ?? { ...defaultStatus, label: status };
}
