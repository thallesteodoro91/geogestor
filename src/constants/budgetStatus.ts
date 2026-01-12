/**
 * Constantes centralizadas para status de orçamento
 * Use estas constantes em todo o código para evitar inconsistências
 */

// Status de pagamento do orçamento
export const PAYMENT_STATUS = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  PARCIAL: 'Parcial',
  CANCELADO: 'Cancelado',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

// Opções para dropdown de status de pagamento com cores HSL
export const PAYMENT_STATUS_OPTIONS = [
  { value: PAYMENT_STATUS.PENDENTE, label: 'Pendente', color: 'hsl(48,96%,53%)', textColor: 'text-black' },
  { value: PAYMENT_STATUS.PAGO, label: 'Pago', color: 'hsl(142,76%,36%)', textColor: 'text-white' },
  { value: PAYMENT_STATUS.PARCIAL, label: 'Parcial', color: 'hsl(217,91%,60%)', textColor: 'text-white' },
  { value: PAYMENT_STATUS.CANCELADO, label: 'Cancelado', color: 'hsl(0,100%,50%)', textColor: 'text-white' },
] as const;

// Formas de pagamento
export const PAYMENT_METHOD = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO: 'Cartão',
  TRANSFERENCIA: 'Transferência',
  BOLETO: 'Boleto',
} as const;

export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];

// Opções para dropdown de forma de pagamento com cores HSL
export const PAYMENT_METHOD_OPTIONS = [
  { value: PAYMENT_METHOD.PIX, label: 'PIX', color: 'hsl(48,96%,53%)', textColor: 'text-black', icon: 'Smartphone' },
  { value: PAYMENT_METHOD.DINHEIRO, label: 'Dinheiro', color: 'hsl(142,76%,36%)', textColor: 'text-white', icon: 'Banknote' },
  { value: PAYMENT_METHOD.CARTAO, label: 'Cartão', color: 'hsl(217,91%,60%)', textColor: 'text-white', icon: 'CreditCard' },
  { value: PAYMENT_METHOD.TRANSFERENCIA, label: 'Transferência', color: 'hsl(280,70%,50%)', textColor: 'text-white', icon: 'ArrowLeftRight' },
  { value: PAYMENT_METHOD.BOLETO, label: 'Boleto', color: 'hsl(25,95%,53%)', textColor: 'text-white', icon: 'FileText' },
] as const;

// Status de situação do orçamento (para calendário/aprovação)
export const BUDGET_SITUATION = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  CANCELADO: 'Cancelado',
} as const;

export type BudgetSituation = typeof BUDGET_SITUATION[keyof typeof BUDGET_SITUATION];

// Opções para dropdown de situação do orçamento
export const BUDGET_SITUATION_OPTIONS = [
  { value: BUDGET_SITUATION.PENDENTE, label: 'Pendente' },
  { value: BUDGET_SITUATION.APROVADO, label: 'Aprovado' },
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
    bg: 'hsl(142,76%,36%)',
    bgHover: 'hsl(142,76%,30%)',
    text: 'white',
  },
  PENDENTE: {
    bg: 'hsl(48,96%,53%)',
    bgHover: 'hsl(48,96%,45%)',
    text: 'black',
  },
  PARCIAL: {
    bg: 'hsl(217,91%,60%)',
    bgHover: 'hsl(217,91%,55%)',
    text: 'white',
  },
  CANCELADO: {
    bg: 'hsl(0,100%,50%)',
    bgHover: 'hsl(0,100%,45%)',
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
  APROVADO: {
    bg: 'hsl(142,76%,36%)',
    bgHover: 'hsl(142,76%,30%)',
    text: 'white',
  },
  PENDENTE: {
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
export const getPaymentStatusBadgeClass = (status: string | null | undefined): string => {
  switch (status) {
    case PAYMENT_STATUS.PAGO:
      return `bg-[${PAYMENT_STATUS_COLORS.PAGO.bg}] text-${PAYMENT_STATUS_COLORS.PAGO.text} hover:bg-[${PAYMENT_STATUS_COLORS.PAGO.bgHover}]`;
    case PAYMENT_STATUS.CANCELADO:
      return `bg-[${PAYMENT_STATUS_COLORS.CANCELADO.bg}] text-${PAYMENT_STATUS_COLORS.CANCELADO.text} hover:bg-[${PAYMENT_STATUS_COLORS.CANCELADO.bgHover}]`;
    case PAYMENT_STATUS.PARCIAL:
      return `bg-[${PAYMENT_STATUS_COLORS.PARCIAL.bg}] text-${PAYMENT_STATUS_COLORS.PARCIAL.text} hover:bg-[${PAYMENT_STATUS_COLORS.PARCIAL.bgHover}]`;
    case PAYMENT_STATUS.PENDENTE:
    default:
      return `bg-[${PAYMENT_STATUS_COLORS.PENDENTE.bg}] text-${PAYMENT_STATUS_COLORS.PENDENTE.text} hover:bg-[${PAYMENT_STATUS_COLORS.PENDENTE.bgHover}]`;
  }
};

/**
 * Retorna a cor HSL de fundo para um status de pagamento
 * @param status - O status do pagamento
 * @returns String HSL da cor de fundo
 */
export const getPaymentStatusColor = (status: string | null | undefined): string => {
  switch (status) {
    case PAYMENT_STATUS.PAGO:
      return PAYMENT_STATUS_COLORS.PAGO.bg;
    case PAYMENT_STATUS.CANCELADO:
      return PAYMENT_STATUS_COLORS.CANCELADO.bg;
    case PAYMENT_STATUS.PARCIAL:
      return PAYMENT_STATUS_COLORS.PARCIAL.bg;
    case PAYMENT_STATUS.PENDENTE:
    default:
      return PAYMENT_STATUS_COLORS.PENDENTE.bg;
  }
};

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
  switch (situation) {
    case BUDGET_SITUATION.APROVADO:
      return `bg-[${BUDGET_SITUATION_COLORS.APROVADO.bg}] text-${BUDGET_SITUATION_COLORS.APROVADO.text} hover:bg-[${BUDGET_SITUATION_COLORS.APROVADO.bgHover}]`;
    case BUDGET_SITUATION.CANCELADO:
      return `bg-[${BUDGET_SITUATION_COLORS.CANCELADO.bg}] text-${BUDGET_SITUATION_COLORS.CANCELADO.text} hover:bg-[${BUDGET_SITUATION_COLORS.CANCELADO.bgHover}]`;
    case BUDGET_SITUATION.PENDENTE:
    default:
      return `bg-[${BUDGET_SITUATION_COLORS.PENDENTE.bg}] text-${BUDGET_SITUATION_COLORS.PENDENTE.text} hover:bg-[${BUDGET_SITUATION_COLORS.PENDENTE.bgHover}]`;
  }
};

/**
 * Retorna a cor HSL de fundo para uma situação de orçamento
 * @param situation - A situação do orçamento
 * @returns String HSL da cor de fundo
 */
export const getBudgetSituationColor = (situation: string | null | undefined): string => {
  switch (situation) {
    case BUDGET_SITUATION.APROVADO:
      return BUDGET_SITUATION_COLORS.APROVADO.bg;
    case BUDGET_SITUATION.CANCELADO:
      return BUDGET_SITUATION_COLORS.CANCELADO.bg;
    case BUDGET_SITUATION.PENDENTE:
    default:
      return BUDGET_SITUATION_COLORS.PENDENTE.bg;
  }
};

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
