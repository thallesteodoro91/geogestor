/**
 * Fonte de verdade dos planos pagos exibidos no front.
 * Mantém Price IDs e metadados num único lugar.
 *
 * Os Price IDs podem ser sobrescritos por env (`VITE_STRIPE_PRICE_*`) para staging/test.
 */

export type PlanId = "mensal" | "anual";

export interface PlanConfig {
  id: PlanId;
  priceId: string;
  productLabel: string;
  amountCents: number;
  interval: "month" | "year";
}

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const PLANS: Record<PlanId, PlanConfig> = {
  mensal: {
    id: "mensal",
    priceId: env.VITE_STRIPE_PRICE_MENSAL ?? "price_1T2DaxK3j5PLJZVV2QghyqC5",
    productLabel: "Plano Mensal",
    amountCents: 9700,
    interval: "month",
  },
  anual: {
    id: "anual",
    priceId: env.VITE_STRIPE_PRICE_ANUAL ?? "price_1TPMGBK3j5PLJZVVFGcr8tdf",
    productLabel: "Plano Anual",
    amountCents: 97000,
    interval: "year",
  },
};

export const getPriceId = (plan: PlanId): string => PLANS[plan].priceId;

export const priceIdToPlan = (priceId: string): PlanId | null => {
  if (priceId === PLANS.mensal.priceId) return "mensal";
  if (priceId === PLANS.anual.priceId) return "anual";
  return null;
};
