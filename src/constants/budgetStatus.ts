/**
 * Constantes centralizadas para status de orçamento
 * Use estas constantes em todo o código para evitar inconsistências
 */

import { getStatusClasses, getStatusColor } from "@/lib/statusColors";

// Status de pagamento do orçamento
export const PAYMENT_STATUS = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  PARCIAL: 'Parcial',
  CANCELADO: 'Cancelado',
  ATRASADO: 'Atrasado',
  FATURADO: 'Faturado',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

// Opções para dropdown de status de pagamento com cores HSL
export const PAYMENT_STATUS_OPTIONS = [
  { value: PAYMENT_STATUS.PENDENTE, label: 'Pendente', color: 'hsl(48,96%,53%)', textColor: 'text-black' },
  { value: PAYMENT_STATUS.PAGO, label: 'Pago', color: 'hsl(142,76%,36%)', textColor: 'text-white' },
  { value: PAYMENT_STATUS.PARCIAL, label: 'Parcial', color: 'hsl(217,91%,60%)', textColor: 'text-white' },
  { value: PAYMENT_STATUS.ATRASADO, label: 'Atrasado', color: 'hsl(0,84%,55%)', textColor: 'text-white' },
  { value: PAYMENT_STATUS.FATURADO, label: 'Faturado', color: 'hsl(262,83%,58%)', textColor: 'text-white' },
  { value: PAYMENT_STATUS.CANCELADO, label: 'Cancelado', color: 'hsl(0,100%,50%)', textColor: 'text-white' },
] as const;

// Formas de pagamento
export const PAYMENT_METHOD = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO: 'Cartão',
  CARTAO_CREDITO: 'Cartão de Crédito',
  CARTAO_DEBITO: 'Cartão de Débito',
  TRANSFERENCIA: 'Transferência',
  BOLETO: 'Boleto',
  PARCELADO: 'Parcelado',
  OUTRO: 'Outro',
} as const;

export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];

// Opções para dropdown de forma de pagamento com cores HSL
export const PAYMENT_METHOD_OPTIONS = [
  { value: PAYMENT_METHOD.PIX, label: 'PIX', color: 'hsl(48,96%,53%)', textColor: 'text-black', icon: 'Smartphone' },
  { value: PAYMENT_METHOD.DINHEIRO, label: 'Dinheiro', color: 'hsl(142,76%,36%)', textColor: 'text-white', icon: 'Banknote' },
  { value: PAYMENT_METHOD.CARTAO, label: 'Cartão', color: 'hsl(217,91%,60%)', textColor: 'text-white', icon: 'CreditCard' },
  { value: PAYMENT_METHOD.CARTAO_CREDITO, label: 'Cartão de Crédito', color: 'hsl(217,91%,55%)', textColor: 'text-white', icon: 'CreditCard' },
  { value: PAYMENT_METHOD.CARTAO_DEBITO, label: 'Cartão de Débito', color: 'hsl(199,89%,48%)', textColor: 'text-white', icon: 'CreditCard' },
  { value: PAYMENT_METHOD.TRANSFERENCIA, label: 'Transferência', color: 'hsl(280,70%,50%)', textColor: 'text-white', icon: 'ArrowLeftRight' },
  { value: PAYMENT_METHOD.BOLETO, label: 'Boleto', color: 'hsl(25,95%,53%)', textColor: 'text-white', icon: 'FileText' },
  { value: PAYMENT_METHOD.PARCELADO, label: 'Parcelado', color: 'hsl(340,82%,52%)', textColor: 'text-white', icon: 'CreditCard' },
  { value: PAYMENT_METHOD.OUTRO, label: 'Outro', color: 'hsl(215,16%,47%)', textColor: 'text-white', icon: 'CircleEllipsis' },
] as const;

// Status de situação do orçamento (para calendário/aprovação)
export const BUDGET_SITUATION = {
  EM_ANALISE: 'Em Analise',
  EM_NEGOCIACAO: 'Em Negociacao',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  PENDENTE: 'Pendente',
  CANCELADO: 'Cancelado',
} as const;

export type BudgetSituation = typeof BUDGET_SITUATION[keyof typeof BUDGET_SITUATION];

// Opções para dropdown de situação do orçamento
export const BUDGET_SITUATION_OPTIONS = [
  { value: BUDGET_SITUATION.EM_ANALISE, label: 'Em Análise' },
  { value: BUDGET_SITUATION.EM_NEGOCIACAO, label: 'Em Negociação' },
  { value: BUDGET_SITUATION.APROVADO, label: 'Aprovado' },
  { value: BUDGET_SITUATION.RECUSADO, label: 'Recusado' },
  { value: BUDGET_SITUATION.PENDENTE, label: 'Pendente' },
  { value: BUDGET_SITUATION.CANCELADO, label: 'Cancelado' },
] as const;

// Status de despesa (para workflow de confirmação)
export const EXPENSE_STATUS = {
  PENDENTE: 'pendente',
  CONFIRMADA: 'confirmada',
} as const;

export type ExpenseStatus = typeof EXPENSE_STATUS[keyof typeof EXPENSE_STATUS];

// ============================================
// CORES HSL CENTRALIZADAS PARA STATUS
// ============================================

export const PAYMENT_STATUS_COLORS = {
  PAGO: {
    bg: getStatusColor(PAYMENT_STATUS.PAGO),
    bgHover: getStatusColor(PAYMENT_STATUS.PAGO),
    text: 'white',
  },
  PENDENTE: {
    bg: getStatusColor(PAYMENT_STATUS.PENDENTE),
    bgHover: getStatusColor(PAYMENT_STATUS.PENDENTE),
    text: 'black',
  },
  PARCIAL: {
    bg: getStatusColor(PAYMENT_STATUS.PARCIAL),
    bgHover: getStatusColor(PAYMENT_STATUS.PARCIAL),
    text: 'white',
  },
  CANCELADO: {
    bg: getStatusColor(PAYMENT_STATUS.CANCELADO),
    bgHover: getStatusColor(PAYMENT_STATUS.CANCELADO),
    text: 'white',
  },
} as const;

export const PAYMENT_METHOD_COLORS = {
  PIX: {
    bg: 'hsl(48,96%,53%)',
    bgHover: 'hsl(48,96%,45%)',
    text: 'black',
  },
  DINHEIRO: {
    bg: 'hsl(142,76%,36%)',
    bgHover: 'hsl(142,76%,30%)',
    text: 'white',
  },
  CARTAO: {
    bg: 'hsl(217,91%,60%)',
    bgHover: 'hsl(217,91%,55%)',
    text: 'white',
  },
  TRANSFERENCIA: {
    bg: 'hsl(280,70%,50%)',
    bgHover: 'hsl(280,70%,45%)',
    text: 'white',
  },
  BOLETO: {
    bg: 'hsl(25,95%,53%)',
    bgHover: 'hsl(25,95%,45%)',
    text: 'white',
  },
} as const;

export const BUDGET_SITUATION_COLORS = {
  EM_ANALISE: {
    bg: getStatusColor(BUDGET_SITUATION.EM_ANALISE),
    bgHover: getStatusColor(BUDGET_SITUATION.EM_ANALISE),
    text: 'white',
  },
  EM_NEGOCIACAO: {
    bg: 'hsl(var(--accent))',
    bgHover: 'hsl(var(--accent))',
    text: 'white',
  },
  APROVADO: {
    bg: getStatusColor(BUDGET_SITUATION.APROVADO),
    bgHover: getStatusColor(BUDGET_SITUATION.APROVADO),
    text: 'white',
  },
  RECUSADO: {
    bg: getStatusColor(BUDGET_SITUATION.RECUSADO),
    bgHover: getStatusColor(BUDGET_SITUATION.RECUSADO),
    text: 'white',
  },
  PENDENTE: {
    bg: getStatusColor(BUDGET_SITUATION.PENDENTE),
    bgHover: getStatusColor(BUDGET_SITUATION.PENDENTE),
    text: 'black',
  },
  CANCELADO: {
    bg: getStatusColor(BUDGET_SITUATION.CANCELADO),
    bgHover: getStatusColor(BUDGET_SITUATION.CANCELADO),
    text: 'white',
  },
} as const;

// ============================================
// HELPERS PARA CLASSES DE BADGE
// ============================================

// Helper para verificar se despesa está pendente
export const isExpensePending = (status: string | null | undefined): boolean => {
  return status === EXPENSE_STATUS.PENDENTE;
};

// Helper para verificar se despesa está confirmada
export const isExpenseConfirmed = (status: string | null | undefined): boolean => {
  return status === EXPENSE_STATUS.CONFIRMADA || status === null || status === undefined;
};

/**
 * Retorna classes Tailwind HSL para estilização de badges de status de pagamento
 * @param status - O status do pagamento
 * @returns String com classes Tailwind para background, hover e texto
 */
export const getPaymentStatusBadgeClass = (status: string | null | undefined): string =>
  getStatusClasses(status);

/**
 * Retorna a cor HSL de fundo para um status de pagamento
 * @param status - O status do pagamento
 * @returns String HSL da cor de fundo
 */
export const getPaymentStatusColor = (status: string | null | undefined): string =>
  getStatusColor(status);

/**
 * Retorna classes Tailwind HSL para estilização de badges de forma de pagamento
 * @param method - A forma de pagamento
 * @returns String com classes Tailwind para background, hover e texto
 */
export const getPaymentMethodBadgeClass = (method: string | null | undefined): string => {
  switch (method) {
    case PAYMENT_METHOD.PIX:
      return `bg-[${PAYMENT_METHOD_COLORS.PIX.bg}] text-${PAYMENT_METHOD_COLORS.PIX.text} hover:bg-[${PAYMENT_METHOD_COLORS.PIX.bgHover}]`;
    case PAYMENT_METHOD.DINHEIRO:
      return `bg-[${PAYMENT_METHOD_COLORS.DINHEIRO.bg}] text-${PAYMENT_METHOD_COLORS.DINHEIRO.text} hover:bg-[${PAYMENT_METHOD_COLORS.DINHEIRO.bgHover}]`;
    case PAYMENT_METHOD.CARTAO:
      return `bg-[${PAYMENT_METHOD_COLORS.CARTAO.bg}] text-${PAYMENT_METHOD_COLORS.CARTAO.text} hover:bg-[${PAYMENT_METHOD_COLORS.CARTAO.bgHover}]`;
    case PAYMENT_METHOD.TRANSFERENCIA:
      return `bg-[${PAYMENT_METHOD_COLORS.TRANSFERENCIA.bg}] text-${PAYMENT_METHOD_COLORS.TRANSFERENCIA.text} hover:bg-[${PAYMENT_METHOD_COLORS.TRANSFERENCIA.bgHover}]`;
    case PAYMENT_METHOD.BOLETO:
      return `bg-[${PAYMENT_METHOD_COLORS.BOLETO.bg}] text-${PAYMENT_METHOD_COLORS.BOLETO.text} hover:bg-[${PAYMENT_METHOD_COLORS.BOLETO.bgHover}]`;
    default:
      return 'bg-muted text-muted-foreground';
  }
};

/**
 * Retorna a cor HSL de fundo para uma forma de pagamento
 * @param method - A forma de pagamento
 * @returns String HSL da cor de fundo
 */
export const getPaymentMethodColor = (method: string | null | undefined): string => {
  switch (method) {
    case PAYMENT_METHOD.PIX:
      return PAYMENT_METHOD_COLORS.PIX.bg;
    case PAYMENT_METHOD.DINHEIRO:
      return PAYMENT_METHOD_COLORS.DINHEIRO.bg;
    case PAYMENT_METHOD.CARTAO:
      return PAYMENT_METHOD_COLORS.CARTAO.bg;
    case PAYMENT_METHOD.TRANSFERENCIA:
      return PAYMENT_METHOD_COLORS.TRANSFERENCIA.bg;
    case PAYMENT_METHOD.BOLETO:
      return PAYMENT_METHOD_COLORS.BOLETO.bg;
    default:
      return 'hsl(var(--muted))';
  }
};

/**
 * Retorna classes Tailwind HSL para estilização de badges de situação de orçamento
 * @param situation - A situação do orçamento
 * @returns String com classes Tailwind para background, hover e texto
 */
export const getBudgetSituationBadgeClass = (situation: string | null | undefined): string => {
  if (situation === BUDGET_SITUATION.EM_NEGOCIACAO) {
    return 'bg-accent/10 text-accent hover:bg-accent/15 border-transparent';
  }

  return getStatusClasses(situation);
};

/**
 * Retorna a cor HSL de fundo para uma situação de orçamento
 * @param situation - A situação do orçamento
 * @returns String HSL da cor de fundo
 */
export const getBudgetSituationColor = (situation: string | null | undefined): string =>
  situation === BUDGET_SITUATION.EM_NEGOCIACAO ? 'hsl(var(--accent))' : getStatusColor(situation);

// Helper para verificar se orçamento está aprovado
export const isBudgetApproved = (situation: string | null | undefined): boolean => {
  return situation === BUDGET_SITUATION.APROVADO;
};

// Helper para verificar se orçamento está cancelado
export const isBudgetCanceled = (situation: string | null | undefined): boolean => {
  return situation === BUDGET_SITUATION.CANCELADO;
};

// Helper para verificar se pagamento está pendente
export const isPaymentPending = (status: string | null | undefined): boolean => {
  return status === PAYMENT_STATUS.PENDENTE;
};

// Helper para verificar se pagamento está pago
export const isPaymentPaid = (status: string | null | undefined): boolean => {
  return status === PAYMENT_STATUS.PAGO;
};
