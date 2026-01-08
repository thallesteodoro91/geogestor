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

// Helper para obter classe de cor do badge de status de pagamento
export const getPaymentStatusBadgeClass = (status: string | null | undefined): string => {
  switch (status) {
    case PAYMENT_STATUS.PAGO:
      return 'bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,30%)]';
    case PAYMENT_STATUS.CANCELADO:
      return 'bg-[hsl(0,100%,50%)] text-white hover:bg-[hsl(0,100%,45%)]';
    case PAYMENT_STATUS.PENDENTE:
      return 'bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)]';
    case PAYMENT_STATUS.PARCIAL:
      return 'bg-[hsl(217,91%,60%)] text-white hover:bg-[hsl(217,91%,55%)]';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

// Helper para obter classe de cor do badge de forma de pagamento
export const getPaymentMethodBadgeClass = (method: string | null | undefined): string => {
  switch (method) {
    case PAYMENT_METHOD.PIX:
      return 'bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)]';
    case PAYMENT_METHOD.DINHEIRO:
      return 'bg-[hsl(142,76%,36%)] text-white hover:bg-[hsl(142,76%,30%)]';
    case PAYMENT_METHOD.CARTAO:
      return 'bg-[hsl(217,91%,60%)] text-white hover:bg-[hsl(217,91%,55%)]';
    case PAYMENT_METHOD.TRANSFERENCIA:
      return 'bg-[hsl(280,70%,50%)] text-white hover:bg-[hsl(280,70%,45%)]';
    case PAYMENT_METHOD.BOLETO:
      return 'bg-[hsl(25,95%,53%)] text-white hover:bg-[hsl(25,95%,45%)]';
    default:
      return 'bg-muted text-muted-foreground';
  }
};
