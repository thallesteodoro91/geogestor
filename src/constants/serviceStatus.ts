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

// Helper para obter variante do badge baseado no status
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

// Helper para verificar se serviço está em andamento
export const isServiceInProgress = (status: string | null | undefined): boolean => {
  return status === SERVICE_STATUS.EM_ANDAMENTO || status === SERVICE_STATUS.EM_REVISAO;
};

// Helper para verificar se serviço está concluído
export const isServiceCompleted = (status: string | null | undefined): boolean => {
  return status === SERVICE_STATUS.CONCLUIDO;
};
