/**
 * Constantes centralizadas para status de serviços
 * Use estas constantes em todo o código para evitar inconsistências
 */

import {
  getStatusBadgeVariant as getSemanticStatusBadgeVariant,
  getStatusClasses,
  getStatusColor,
} from "@/lib/statusColors";

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

// Helper para obter variante do badge baseado no status (para shadcn Badge)
export const getStatusBadgeVariant = (status: string | null | undefined) =>
  getSemanticStatusBadgeVariant(status);

/**
 * Retorna classes Tailwind HSL para estilização de badges de status de serviço
 * @param status - O status do serviço
 * @returns String com classes Tailwind para background, hover e texto
 */
export const getServiceStatusBadgeClasses = (status: string | null | undefined): string =>
  getStatusClasses(status);

/**
 * Retorna a cor HSL de fundo para um status de serviço
 * Útil para uso em estilos inline ou gradientes
 * @param status - O status do serviço
 * @returns String HSL da cor de fundo
 */
export const getServiceStatusColor = (status: string | null | undefined): string =>
  getStatusColor(status);

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
