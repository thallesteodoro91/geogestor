import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // If webhook secret is configured, verify signature
    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return new Response(JSON.stringify({ error: "No signature" }), { status: 400, headers: corsHeaders });
      }
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } else {
      // Fallback: parse without verification (dev mode)
      event = JSON.parse(body) as Stripe.Event;
    }

    logStep("Event received", { type: event.type, id: event.id });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Helper: find tenant by stripe_customer_id
    const findTenantByCustomer = async (customerId: string) => {
      const { data } = await serviceClient
        .from("tenant_subscriptions")
        .select("tenant_id, plan_id")
        .eq("stripe_customer_id", customerId)
        .limit(1)
        .maybeSingle();
      return data;
    };

    // Helper: find tenant by customer email
    const findTenantByEmail = async (email: string) => {
      // Find user by email in profiles
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      
      if (!profile) return null;

      const { data: member } = await serviceClient
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", profile.id)
        .maybeSingle();

      return member;
    };

    switch (event.type) {
      // ========== SUBSCRIPTION EVENTS ==========
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" 
          ? subscription.customer 
          : subscription.customer.id;
        
        let tenantData = await findTenantByCustomer(customerId);
        
        // If not found by customer ID, try by email
        if (!tenantData) {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted && customer.email) {
            const memberData = await findTenantByEmail(customer.email);
            if (memberData) {
              tenantData = { tenant_id: memberData.tenant_id, plan_id: "" };
            }
          }
        }

        if (!tenantData) {
          logStep("No tenant found for customer", { customerId });
          break;
        }

        // Map Stripe status to our status
        const statusMap: Record<string, string> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "expired",
          incomplete: "incomplete",
          incomplete_expired: "expired",
          paused: "paused",
        };

        const newStatus = statusMap[subscription.status] || subscription.status;

        await serviceClient
          .from("tenant_subscriptions")
          .update({
            status: newStatus,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: customerId,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenantData.tenant_id);

        logStep("Subscription updated", { 
          tenantId: tenantData.tenant_id, 
          status: newStatus,
          end: new Date(subscription.current_period_end * 1000).toISOString()
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" 
          ? subscription.customer 
          : subscription.customer.id;

        const tenantData = await findTenantByCustomer(customerId);
        if (tenantData) {
          await serviceClient
            .from("tenant_subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", tenantData.tenant_id);

          logStep("Subscription canceled", { tenantId: tenantData.tenant_id });
        }
        break;
      }

      // ========== PAYMENT EVENTS ==========
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
        
        if (customerId) {
          logStep("Payment succeeded", { customerId, amount: invoice.amount_paid });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
        
        if (customerId) {
          const tenantData = await findTenantByCustomer(customerId);
          if (tenantData) {
            await serviceClient
              .from("tenant_subscriptions")
              .update({
                status: "past_due",
                updated_at: new Date().toISOString(),
              })
              .eq("tenant_id", tenantData.tenant_id);

            logStep("Payment failed - marked past_due", { tenantId: tenantData.tenant_id });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
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
