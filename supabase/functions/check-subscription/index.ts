import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ subscribed: false, reason: "no_auth" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) {
      logStep("Auth failed", { error: userError?.message });
      return new Response(JSON.stringify({ subscribed: false, reason: "no_user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false, reason: "no_customer" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;

    if (!hasActiveSub) {
      logStep("No active subscription");
      return new Response(JSON.stringify({ subscribed: false, reason: "no_active_sub" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const priceId = subscription.items.data[0].price.id;
    const productId = subscription.items.data[0].price.product as string;

    logStep("Active subscription found", { subscriptionId: subscription.id, priceId, subscriptionEnd });

    // Sync subscription status to our database
    try {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Find user's tenant
      const { data: memberData } = await serviceClient
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberData?.tenant_id) {
        // Find the plan that matches "completo" slug
        const { data: planData } = await serviceClient
          .from("subscription_plans")
          .select("id")
          .eq("slug", "completo")
          .single();

        if (planData) {
          // Update or upsert tenant_subscriptions with Stripe data
          await serviceClient
            .from("tenant_subscriptions")
            .update({
              status: "active",
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: subscriptionEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", memberData.tenant_id);

          logStep("Synced subscription to DB", { tenantId: memberData.tenant_id });
        }
      }
    } catch (syncError) {
      // Non-fatal: log but don't fail the response
      logStep("DB sync failed (non-fatal)", { error: String(syncError) });
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        subscription_end: subscriptionEnd,
        price_id: priceId,
        product_id: productId,
        stripe_subscription_id: subscription.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
