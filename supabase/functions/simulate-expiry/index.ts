import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Get authenticated user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Auth failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { action } = await req.json();

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Find user's tenant
    const { data: member } = await serviceClient
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (action === "expire") {
      // Get "completo" plan
      const { data: plan } = await serviceClient
        .from("subscription_plans")
        .select("id")
        .eq("slug", "completo")
        .single();

      if (!plan) {
        return new Response(JSON.stringify({ error: "Plan not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      await serviceClient
        .from("tenant_subscriptions")
        .update({
          plan_id: plan.id,
          status: "expired",
          current_period_end: "2026-02-20T00:00:00Z",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", member.tenant_id);

      return new Response(JSON.stringify({ success: true, action: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "restore") {
      // Get "owner" plan
      const { data: plan } = await serviceClient
        .from("subscription_plans")
        .select("id")
        .eq("slug", "owner")
        .single();

      if (!plan) {
        return new Response(JSON.stringify({ error: "Owner plan not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      await serviceClient
        .from("tenant_subscriptions")
        .update({
          plan_id: plan.id,
          status: "active",
          current_period_end: "2099-12-31T23:59:59Z",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", member.tenant_id);

      return new Response(JSON.stringify({ success: true, action: "restored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'expire' or 'restore'" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
