import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { corsFor } from "../_shared/cors.ts";

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
const rateLimiter = new RateLimiter(20, 60_000);

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Usuário não autenticado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) throw new Error("Usuário não autenticado ou sem e-mail");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ invoices: [], customer: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 50,
      expand: ["data.subscription"],
    });

    const formatted = invoices.data.map((inv) => {
      const lineDescription = inv.lines?.data?.[0]?.description ?? null;
      const priceNickname = (inv.lines?.data?.[0] as any)?.price?.nickname ?? null;
      const interval = (inv.lines?.data?.[0] as any)?.price?.recurring?.interval ?? null;

      return {
        id: inv.id,
        number: inv.number,
        status: inv.status, // draft | open | paid | uncollectible | void
        amount_paid: inv.amount_paid,
        amount_due: inv.amount_due,
        amount_remaining: inv.amount_remaining,
        total: inv.total,
        currency: inv.currency,
        created: inv.created,
        period_start: inv.period_start,
        period_end: inv.period_end,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
        description: lineDescription || priceNickname,
        interval, // month | year | null
        paid: inv.paid,
      };
    });

    return new Response(JSON.stringify({ invoices: formatted, customer: customerId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[list-invoices] error:", message);
    return new Response(JSON.stringify({ error: message, invoices: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
