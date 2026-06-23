import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  constructor(private maxRequests: number, private windowMs: number) {}
  isRateLimited(ip: string): boolean {
    const now = Date.now();
    for (const [key, val] of this.requests) { if (val.resetAt <= now) this.requests.delete(key); }
    const entry = this.requests.get(ip);
    if (!entry) { this.requests.set(ip, { count: 1, resetAt: now + this.windowMs }); return false; }
    if (entry.resetAt <= now) { this.requests.set(ip, { count: 1, resetAt: now + this.windowMs }); return false; }
    entry.count++;
    return entry.count > this.maxRequests;
  }
}
const rateLimiter = new RateLimiter(5, 60_000);

import { corsFor } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } });
  }

  // Restrict to operators holding the shared CRON_SECRET — prevents priv-esc
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
          status: "trialing",
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
