/**
 * Constantes centralizadas para status de serviços
 * Use estas constantes em todo o código para evitar inconsistências
 */

export const SERVICE_STATUS = {
  PENDENTE: 'Pendente',
  PLANEJADO: 'Planejado',
  EM_ANDAMENTO: 'Em Andamento',
  EM_REVISAO: 'Em Revisão',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
} as const;

export type ServiceStatus = typeof SERVICE_STATUS[keyof typeof SERVICE_STATUS];

// Array de status para uso em selects/dropdowns
export const SERVICE_STATUS_OPTIONS = [
  { value: SERVICE_STATUS.PENDENTE, label: 'Pendente' },
  { value: SERVICE_STATUS.EM_ANDAMENTO, label: 'Em Andamento' },
  { value: SERVICE_STATUS.EM_REVISAO, label: 'Em Revisão' },
  { value: SERVICE_STATUS.CONCLUIDO, label: 'Concluído' },
] as const;

// Status para calendário (inclui Planejado)
export const CALENDAR_STATUS_OPTIONS = [
  { value: SERVICE_STATUS.PLANEJADO, label: 'Planejado' },
  { value: SERVICE_STATUS.EM_ANDAMENTO, label: 'Em Andamento' },
  { value: SERVICE_STATUS.CONCLUIDO, label: 'Concluído' },
  { value: SERVICE_STATUS.CANCELADO, label: 'Cancelado' },
] as const;

// Opções para filtros (inclui "Todos")
export const SERVICE_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos os Status' },
  ...SERVICE_STATUS_OPTIONS,
] as const;

// ============================================
// CORES HSL CENTRALIZADAS PARA STATUS
// ============================================

export const SERVICE_STATUS_COLORS = {
  CONCLUIDO: {
    bg: 'hsl(142,76%,36%)',
    bgHover: 'hsl(142,76%,30%)',
    text: 'white',
  },
  EM_ANDAMENTO: {
    bg: 'hsl(217,91%,60%)',
    bgHover: 'hsl(217,91%,55%)',
    text: 'white',
  },
  EM_REVISAO: {
    bg: 'hsl(280,70%,50%)',
    bgHover: 'hsl(280,70%,45%)',
    text: 'white',
  },
  PENDENTE: {
    bg: 'hsl(48,96%,53%)',
    bgHover: 'hsl(48,96%,45%)',
    text: 'black',
  },
  PLANEJADO: {
    bg: 'hsl(48,96%,53%)',
    bgHover: 'hsl(48,96%,45%)',
    text: 'black',
  },
  CANCELADO: {
    bg: 'hsl(0,100%,50%)',
    bgHover: 'hsl(0,100%,45%)',
    text: 'white',
  },
} as const;

// Helper para obter variante do badge baseado no status (para shadcn Badge)
export const getStatusBadgeVariant = (status: string | null | undefined) => {
  switch (status) {
    case SERVICE_STATUS.CONCLUIDO:
      return 'default';
    case SERVICE_STATUS.EM_ANDAMENTO:
      return 'secondary';
    case SERVICE_STATUS.EM_REVISAO:
      return 'outline';
    case SERVICE_STATUS.PENDENTE:
    case SERVICE_STATUS.PLANEJADO:
    default:
      return 'destructive';
  }
};

/**
 * Retorna classes Tailwind HSL para estilização de badges de status de serviço
 * @param status - O status do serviço
 * @returns String com classes Tailwind para background, hover e texto
 */
export const getServiceStatusBadgeClasses = (status: string | null | undefined): string => {
  switch (status) {
    case SERVICE_STATUS.CONCLUIDO:
      return `bg-[${SERVICE_STATUS_COLORS.CONCLUIDO.bg}] text-${SERVICE_STATUS_COLORS.CONCLUIDO.text} hover:bg-[${SERVICE_STATUS_COLORS.CONCLUIDO.bgHover}]`;
    case SERVICE_STATUS.EM_ANDAMENTO:
      return `bg-[${SERVICE_STATUS_COLORS.EM_ANDAMENTO.bg}] text-${SERVICE_STATUS_COLORS.EM_ANDAMENTO.text} hover:bg-[${SERVICE_STATUS_COLORS.EM_ANDAMENTO.bgHover}]`;
    case SERVICE_STATUS.EM_REVISAO:
      return `bg-[${SERVICE_STATUS_COLORS.EM_REVISAO.bg}] text-${SERVICE_STATUS_COLORS.EM_REVISAO.text} hover:bg-[${SERVICE_STATUS_COLORS.EM_REVISAO.bgHover}]`;
    case SERVICE_STATUS.CANCELADO:
      return `bg-[${SERVICE_STATUS_COLORS.CANCELADO.bg}] text-${SERVICE_STATUS_COLORS.CANCELADO.text} hover:bg-[${SERVICE_STATUS_COLORS.CANCELADO.bgHover}]`;
    case SERVICE_STATUS.PENDENTE:
    case SERVICE_STATUS.PLANEJADO:
    default:
      return `bg-[${SERVICE_STATUS_COLORS.PENDENTE.bg}] text-${SERVICE_STATUS_COLORS.PENDENTE.text} hover:bg-[${SERVICE_STATUS_COLORS.PENDENTE.bgHover}]`;
  }
};

/**
 * Retorna a cor HSL de fundo para um status de serviço
 * Útil para uso em estilos inline ou gradientes
 * @param status - O status do serviço
 * @returns String HSL da cor de fundo
 */
export const getServiceStatusColor = (status: string | null | undefined): string => {
  switch (status) {
    case SERVICE_STATUS.CONCLUIDO:
      return SERVICE_STATUS_COLORS.CONCLUIDO.bg;
    case SERVICE_STATUS.EM_ANDAMENTO:
      return SERVICE_STATUS_COLORS.EM_ANDAMENTO.bg;
    case SERVICE_STATUS.EM_REVISAO:
      return SERVICE_STATUS_COLORS.EM_REVISAO.bg;
    case SERVICE_STATUS.CANCELADO:
      return SERVICE_STATUS_COLORS.CANCELADO.bg;
    case SERVICE_STATUS.PENDENTE:
    case SERVICE_STATUS.PLANEJADO:
    default:
      return SERVICE_STATUS_COLORS.PENDENTE.bg;
  }
};

// Helper para verificar se serviço está em andamento
export const isServiceInProgress = (status: string | null | undefined): boolean => {
  return status === SERVICE_STATUS.EM_ANDAMENTO || status === SERVICE_STATUS.EM_REVISAO;
};

// Helper para verificar se serviço está concluído
export const isServiceCompleted = (status: string | null | undefined): boolean => {
  return status === SERVICE_STATUS.CONCLUIDO;
};

// Helper para verificar se serviço foi cancelado
export const isServiceCanceled = (status: string | null | undefined): boolean => {
  return status === SERVICE_STATUS.CANCELADO;
};
