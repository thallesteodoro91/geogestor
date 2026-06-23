/**
 * sync-stripe-subscription
 *
 * Admin-only manual reconciliation: pulls the current Stripe state for the
 * caller's tenant (customer + active subscription + cancel flags + price ->
 * plan_id) and writes it to public.tenant_subscriptions. Use after a missed
 * webhook, plan change, or whenever the user clicks "Sincronizar com Stripe".
 *
 * Returns the synced row so the UI can refresh immediately.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsFor } from "../_shared/cors.ts";

const STATUS_MAP: Record<string, string> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "expired",
  incomplete: "incomplete",
  incomplete_expired: "expired",
  paused: "paused",
};

const log = (step: string, details?: unknown) => {
  console.log(`[SYNC-STRIPE-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate the caller against their JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // Service client to bypass RLS for the lookup + write
    const svc = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Resolve tenant & ensure caller is admin
    const { data: member } = await svc
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (member.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem sincronizar" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tenantId = member.tenant_id as string;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    if (!user.email) throw new Error("User email indisponível");

    // 1. Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      log("Sem customer Stripe", { email: user.email });
      return new Response(
        JSON.stringify({ synced: false, reason: "no_stripe_customer" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const customer = customers.data[0];

    // 2. Find the most relevant subscription (active/trialing first, then any)
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10,
    });
    const sub =
      subs.data.find((s) => s.status === "active" || s.status === "trialing") ??
      subs.data.sort((a, b) => b.created - a.created)[0] ??
      null;

    if (!sub) {
      // Only customer exists; record customer id and clear sub fields
      await svc
        .from("tenant_subscriptions")
        .update({
          stripe_customer_id: customer.id,
          status: "canceled",
          stripe_subscription_id: null,
          cancel_at_period_end: false,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);
      return new Response(
        JSON.stringify({ synced: true, hasSubscription: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Map price -> internal plan_id
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    let planId: string | null = null;
    if (priceId) {
      const { data: plan } = await svc
        .from("subscription_plans")
        .select("id")
        .eq("stripe_price_id", priceId)
        .maybeSingle();
      planId = plan?.id ?? null;
    }

    const update: Record<string, unknown> = {
      status: STATUS_MAP[sub.status] || sub.status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customer.id,
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: !!sub.cancel_at_period_end,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (planId) update.plan_id = planId;

    const { error: updErr, data: updated } = await svc
      .from("tenant_subscriptions")
      .update(update)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();
    if (updErr) throw new Error(updErr.message);

    log("Reconciliação concluída", { tenantId, status: update.status, planId });

    return new Response(
      JSON.stringify({
        synced: true,
        hasSubscription: true,
        priceId,
        planMapped: !!planId,
        subscription: updated,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsFor(req), "Content-Type": "application/json" },
    });
  }
});
