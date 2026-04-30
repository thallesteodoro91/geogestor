/**
 * Validação e auditoria do payload de checkout (planId / oferta).
 *
 * Centraliza as regras para que possam ser testadas isoladamente
 * (unitários) e reutilizadas em qualquer ponto que dispare checkout.
 */

export const VALID_PLANOS = ["anual", "mensal"] as const;
export const VALID_OFERTAS = ["padrao", "premium"] as const;

export type PlanId = (typeof VALID_PLANOS)[number];
export type OfertaId = (typeof VALID_OFERTAS)[number];

export const isValidPlano = (raw: unknown): raw is PlanId =>
  typeof raw === "string" && (VALID_PLANOS as readonly string[]).includes(raw);

export const isValidOferta = (raw: unknown): raw is OfertaId =>
  typeof raw === "string" && (VALID_OFERTAS as readonly string[]).includes(raw);

export const parsePlano = (raw: unknown): PlanId =>
  isValidPlano(raw) ? raw : "anual";

export const parseOferta = (raw: unknown): OfertaId =>
  isValidOferta(raw) ? raw : "padrao";

export interface CheckoutAuditEntry {
  event: "checkout_planId_rejeitado";
  timestamp: string;
  rejectedPlanId: unknown;
  rejectedPlanIdType: string;
  validValues: PlanId[];
  currentSelectedPlan: string | null;
  currentSelectedOferta: string | null;
  urlPlano: string | null;
  urlOferta: string | null;
  url: string | null;
  userAction:
    | "auto_reset_para_anual"
    | "usuario_clicou_selecionar_anual";
}

export interface BuildAuditContext {
  rejectedPlanId: unknown;
  currentSelectedPlan?: string | null;
  currentSelectedOferta?: string | null;
  urlPlano?: string | null;
  urlOferta?: string | null;
  url?: string | null;
}

export function buildCheckoutAuditEntry(ctx: BuildAuditContext): CheckoutAuditEntry {
  return {
    event: "checkout_planId_rejeitado",
    timestamp: new Date().toISOString(),
    rejectedPlanId: ctx.rejectedPlanId ?? null,
    rejectedPlanIdType: typeof ctx.rejectedPlanId,
    validValues: [...VALID_PLANOS],
    currentSelectedPlan: ctx.currentSelectedPlan ?? null,
    currentSelectedOferta: ctx.currentSelectedOferta ?? null,
    urlPlano: ctx.urlPlano ?? null,
    urlOferta: ctx.urlOferta ?? null,
    url: ctx.url ?? null,
    userAction: "auto_reset_para_anual",
  };
}

export const AUDIT_PREFIX = "[AUDIT][CHECKOUT]";

export function logCheckoutRejection(entry: CheckoutAuditEntry): void {
  console.warn(`${AUDIT_PREFIX} planId rejeitado`, entry);
}

export function logCheckoutRecoveryClick(entry: CheckoutAuditEntry): void {
  console.info(
    `${AUDIT_PREFIX} Usuário clicou em 'Selecionar Anual' após rejeição`,
    {
      ...entry,
      userAction: "usuario_clicou_selecionar_anual" as const,
      clickedAt: new Date().toISOString(),
    },
  );
}
