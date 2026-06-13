// Fonte única de Price IDs para as Edge Functions de billing.
// Sobrescrevíveis por env (STRIPE_PRICE_MENSAL / STRIPE_PRICE_ANUAL) em staging.

export type PlanId = "mensal" | "anual";

export const PRICE_IDS: Record<PlanId, string> = {
  mensal: Deno.env.get("STRIPE_PRICE_MENSAL") ?? "price_1T2DaxK3j5PLJZVV2QghyqC5",
  anual: Deno.env.get("STRIPE_PRICE_ANUAL") ?? "price_1TPMGBK3j5PLJZVVFGcr8tdf",
};

export const priceIdToPlan = (priceId: string): PlanId | null => {
  if (priceId === PRICE_IDS.mensal) return "mensal";
  if (priceId === PRICE_IDS.anual) return "anual";
  return null;
};

export const isValidPlanId = (raw: unknown): raw is PlanId =>
  raw === "mensal" || raw === "anual";
