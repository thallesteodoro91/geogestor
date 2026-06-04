import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map Stripe subscription status -> nosso enum interno
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

// Tenta achar tenant_id, na ordem:
// 1) metadata.tenant_id (vindo do create-checkout)
// 2) tenant_subscriptions.stripe_customer_id
// 3) profiles.email -> tenant_members
async function resolveTenantId(
  serviceClient: SupabaseClient,
  stripe: Stripe,
  opts: { metadataTenantId?: string | null; customerId?: string | null },
): Promise<string | null> {
  if (opts.metadataTenantId) return opts.metadataTenantId;

  if (opts.customerId) {
    const { data } = await serviceClient
      .from("tenant_subscriptions")
      .select("tenant_id")
      .eq("stripe_customer_id", opts.customerId)
      .maybeSingle();
    if (data?.tenant_id) return data.tenant_id;

    try {
      const customer = await stripe.customers.retrieve(opts.customerId);
      if (customer && !customer.deleted && customer.email) {
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("id")
          .eq("email", customer.email)
          .maybeSingle();
        if (profile?.id) {
          const { data: member } = await serviceClient
            .from("tenant_members")
            .select("tenant_id")
            .eq("user_id", profile.id)
            .maybeSingle();
          if (member?.tenant_id) return member.tenant_id;
        }
      }
    } catch (err) {
      logStep("Falha ao buscar customer na Stripe", { customerId: opts.customerId, err: String(err) });
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();

    let event: Stripe.Event;
    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return new Response(JSON.stringify({ error: "No signature" }), { status: 400, headers: corsHeaders });
      }
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } else {
      // Dev fallback — sem verificação de assinatura
      event = JSON.parse(body) as Stripe.Event;
      logStep("AVISO: STRIPE_WEBHOOK_SECRET não configurado — assinatura não verificada");
    }

    logStep("Event received", { type: event.type, id: event.id });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // ========== IDEMPOTÊNCIA ==========
    // Tenta inserir o event_id; se já existe (UNIQUE), ignora silenciosamente.
    const { error: idemErr } = await serviceClient
      .from("stripe_webhook_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload: event as unknown as Record<string, unknown>,
      });

    if (idemErr) {
      // 23505 = unique_violation -> evento já processado
      const code = (idemErr as { code?: string }).code;
      if (code === "23505") {
        logStep("Evento duplicado ignorado", { id: event.id, type: event.type });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      // Outros erros: loga mas segue processando para não perder eventos
      logStep("Falha ao registrar idempotência (seguindo)", { code, message: idemErr.message });
    }

    let handlerError: string | null = null;

    try {
      switch (event.type) {
        // ========== CHECKOUT FINALIZADO ==========
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
          const metadataTenantId = (session.metadata?.tenant_id as string | undefined) ?? null;

          const tenantId = await resolveTenantId(serviceClient, stripe, {
            metadataTenantId,
            customerId,
          });

          if (!tenantId) {
            logStep("checkout.session.completed sem tenant resolvível", {
              sessionId: session.id,
              customerId,
              metadataTenantId,
            });
            break;
          }

          // Buscar status atual da subscription para já refletir corretamente
          let newStatus = "active";
          let periodStart: string | null = null;
          let periodEnd: string | null = null;
          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              newStatus = STATUS_MAP[sub.status] || sub.status;
              periodStart = new Date(sub.current_period_start * 1000).toISOString();
              periodEnd = new Date(sub.current_period_end * 1000).toISOString();
            } catch (err) {
              logStep("Falha ao recuperar subscription da Stripe", { subscriptionId, err: String(err) });
            }
          }

          const update: Record<string, unknown> = {
            status: newStatus,
            updated_at: new Date().toISOString(),
          };
          if (customerId) update.stripe_customer_id = customerId;
          if (subscriptionId) update.stripe_subscription_id = subscriptionId;
          if (periodStart) update.current_period_start = periodStart;
          if (periodEnd) update.current_period_end = periodEnd;

          const { error: updErr } = await serviceClient
            .from("tenant_subscriptions")
            .update(update)
            .eq("tenant_id", tenantId);

          if (updErr) throw new Error(`Falha ao ativar assinatura: ${updErr.message}`);

          logStep("Checkout finalizado e assinatura ativada", {
            tenantId,
            customerId,
            subscriptionId,
            status: newStatus,
          });
          break;
        }

        // ========== SUBSCRIPTION EVENTS ==========
        case "customer.subscription.updated":
        case "customer.subscription.created": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
          const metadataTenantId = (subscription.metadata?.tenant_id as string | undefined) ?? null;

          const tenantId = await resolveTenantId(serviceClient, stripe, {
            metadataTenantId,
            customerId,
          });
          if (!tenantId) {
            logStep("No tenant found for customer", { customerId });
            break;
          }

          const newStatus = STATUS_MAP[subscription.status] || subscription.status;

          const { error: updErr } = await serviceClient
            .from("tenant_subscriptions")
            .update({
              status: newStatus,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", tenantId);
          if (updErr) throw new Error(updErr.message);

          logStep("Subscription updated", {
            tenantId,
            status: newStatus,
            end: new Date(subscription.current_period_end * 1000).toISOString(),
          });
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
          const metadataTenantId = (subscription.metadata?.tenant_id as string | undefined) ?? null;

          const tenantId = await resolveTenantId(serviceClient, stripe, {
            metadataTenantId,
            customerId,
          });
          if (tenantId) {
            await serviceClient
              .from("tenant_subscriptions")
              .update({ status: "canceled", updated_at: new Date().toISOString() })
              .eq("tenant_id", tenantId);
            logStep("Subscription canceled", { tenantId });
          }
          break;
        }

        // ========== PAYMENT EVENTS ==========
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
          if (customerId) {
            logStep("Payment succeeded", { customerId, amount: invoice.amount_paid });
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
          if (customerId) {
            const tenantId = await resolveTenantId(serviceClient, stripe, { customerId });
            if (tenantId) {
              await serviceClient
                .from("tenant_subscriptions")
                .update({ status: "past_due", updated_at: new Date().toISOString() })
                .eq("tenant_id", tenantId);
              logStep("Payment failed - marked past_due", { tenantId });
            }
          }
          break;
        }

        default:
          logStep("Unhandled event type", { type: event.type });
      }
    } catch (handlerErr) {
      handlerError = handlerErr instanceof Error ? handlerErr.message : String(handlerErr);
      logStep("Handler error", { eventId: event.id, message: handlerError });

      // Marca o evento como falho e remove o registro de idempotência para reprocessamento.
      // Como UNIQUE(event_id) impediria retry, deletamos para permitir que a Stripe reenvie.
      await serviceClient
        .from("stripe_webhook_events")
        .update({ error: handlerError })
        .eq("event_id", event.id);
      await serviceClient
        .from("stripe_webhook_events")
        .delete()
        .eq("event_id", event.id);

      // Devolve 500 para que a Stripe faça retry com backoff
      return new Response(JSON.stringify({ error: handlerError, eventId: event.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
