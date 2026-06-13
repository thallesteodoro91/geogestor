import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { PRICE_IDS, priceIdToPlan as sharedPriceIdToPlan, type PlanId } from "../_shared/plans.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://geogestor.lovable.app").split(",").map((s) => s.trim()).filter(Boolean);
const LOVABLE_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.lovable\.(app|dev)$/i;
const ALLOW_HDRS = "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";
function corsFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = (ALLOWED_ORIGINS.includes(origin) || LOVABLE_PREVIEW_RE.test(origin)) ? origin : (ALLOWED_ORIGINS[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": ALLOW_HDRS,
  };
}

type Action = "get_details" | "change_plan" | "cancel" | "reactivate";

class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  constructor(private maxRequests: number, private windowMs: number) {}
  isRateLimited(ip: string): boolean {
    const now = Date.now();
    for (const [key, val] of this.requests) if (val.resetAt <= now) this.requests.delete(key);
    const entry = this.requests.get(ip);
    if (!entry) {
      this.requests.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    if (entry.resetAt <= now) {
      this.requests.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    entry.count++;
    return entry.count > this.maxRequests;
  }
}
const rateLimiter = new RateLimiter(20, 60_000);

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MANAGE-SUBSCRIPTION] ${step}${d}`);
};

const toIso = (unix: unknown): string | null => {
  const n = typeof unix === "number" ? unix : Number(unix);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const priceIdToPlan = sharedPriceIdToPlan;

async function getActiveSubscription(stripe: Stripe, email: string) {
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length === 0) return { customer: null, subscription: null };
  const customerId = customers.data[0].id;
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 5,
  });
  // Prefer active/trialing/past_due, then the latest
  const sub =
    subs.data.find((s) =>
      ["active", "trialing", "past_due"].includes(s.status),
    ) ?? null;
  return { customer: customers.data[0], subscription: sub };
}

function serializeSubscription(sub: Stripe.Subscription | null) {
  if (!sub) return null;
  const item = sub.items.data[0];
  const periodEnd =
    (item as any).current_period_end ?? (sub as any).current_period_end;
  const periodStart =
    (item as any).current_period_start ?? (sub as any).current_period_start;
  const priceId = item.price.id;
  return {
    id: sub.id,
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: toIso(sub.canceled_at as unknown),
    current_period_start: toIso(periodStart),
    current_period_end: toIso(periodEnd),
    price_id: priceId,
    plan: priceIdToPlan(priceId),
    item_id: item.id,
    amount: item.price.unit_amount,
    currency: item.price.currency,
    interval: item.price.recurring?.interval ?? null,
  };
}

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autenticação");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
    if (userErr || !userData.user?.email) throw new Error("Usuário não autenticado");
    const user = userData.user;

    let body: { action?: Action; plan?: PlanId } = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }
    const action: Action = body.action ?? "get_details";
    log("Action", { action, userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    if (action === "get_details") {
      const { subscription } = await getActiveSubscription(stripe, user.email);
      return new Response(
        JSON.stringify({ subscription: serializeSubscription(subscription) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { subscription } = await getActiveSubscription(stripe, user.email);
    if (!subscription) throw new Error("Nenhuma assinatura encontrada");

    if (action === "cancel") {
      const updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
      log("Canceled at period end", { id: updated.id });
      return new Response(
        JSON.stringify({ subscription: serializeSubscription(updated) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "reactivate") {
      const updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
      });
      log("Reactivated", { id: updated.id });
      return new Response(
        JSON.stringify({ subscription: serializeSubscription(updated) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "change_plan") {
      const plan = body.plan;
      if (!plan || !(plan in PRICE_IDS)) throw new Error("Plano inválido");
      const targetPriceId = PRICE_IDS[plan];
      const item = subscription.items.data[0];
      if (item.price.id === targetPriceId) {
        return new Response(
          JSON.stringify({
            subscription: serializeSubscription(subscription),
            unchanged: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const updated = await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: targetPriceId }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
      });
      log("Plan changed", { id: updated.id, plan });
      return new Response(
        JSON.stringify({ subscription: serializeSubscription(updated) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
