import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_IDS: Record<string, string> = {
  mensal:      "price_1T2DaxK3j5PLJZVV2QghyqC5",
  anual:       "price_1TPMGBK3j5PLJZVVFGcr8tdf",
};

const VALID_OFERTAS = ["padrao", "premium"] as const;
type OfertaId = (typeof VALID_OFERTAS)[number];
const isValidOferta = (raw: unknown): raw is OfertaId =>
  typeof raw === "string" && (VALID_OFERTAS as readonly string[]).includes(raw);

// Helper de log estruturado para auditoria (filtrável nos logs por [CREATE-CHECKOUT])
const logStep = (step: string, details?: Record<string, unknown>) => {
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${payload}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(clientIP)) {
    logStep("Rate limit atingido", { requestId, clientIP });
    return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } });
  }

  try {
    logStep("Início", { requestId, clientIP });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Usuário não autenticado");

    // Ler o body antes de qualquer operação async para não perder o stream
    const body = await req.json().catch(() => ({}));
    const rawPlanId = typeof body?.planId === "string" ? body.planId : "";
    const rawOferta = body?.oferta;
    const ofertaSanitizada: OfertaId = isValidOferta(rawOferta) ? rawOferta : "padrao";
    const ofertaFoiSanitizada = rawOferta !== undefined && rawOferta !== ofertaSanitizada;

    logStep("Payload recebido", {
      requestId,
      planId: rawPlanId,
      ofertaRecebida: rawOferta ?? null,
      ofertaUsada: ofertaSanitizada,
      ofertaFoiSanitizada,
    });

    // Criar client com Authorization header no global para que getUser() funcione corretamente
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) throw new Error("Usuário não autenticado ou sem e-mail");
    logStep("Usuário autenticado", { requestId, userId: user.id, email: user.email });

    const priceId = PRICE_IDS[rawPlanId];
    if (!priceId) {
      logStep("Plano inválido — abortando", { requestId, planId: rawPlanId });
      throw new Error(`Plano inválido: ${rawPlanId}`);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Reusar customer existente se possível
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;
    logStep("Customer Stripe resolvido", { requestId, customerId: customerId ?? "novo" });

    const origin = req.headers.get("origin") || "https://geogestor.lovable.app";
    const metadata = {
      plano: rawPlanId,
      oferta: ofertaSanitizada,
      user_id: user.id,
      request_id: requestId,
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/checkout-sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout-cancelado`,
      metadata,
      subscription_data: { metadata },
    });

    // Confirmação pós-criação: relê metadados retornados pelo Stripe para garantir
    // que chegaram corretamente (não confiamos só no payload enviado).
    logStep("Sessão Stripe criada", {
      requestId,
      sessionId: session.id,
      priceId,
      metadataEnviado: metadata,
      metadataRetornadoPeloStripe: session.metadata,
      subscriptionMetadataRetornado: session.subscription_data?.metadata ?? null,
    });

    const metadadosOk =
      session.metadata?.plano === metadata.plano &&
      session.metadata?.oferta === metadata.oferta;
    if (!metadadosOk) {
      logStep("ALERTA: metadados retornados pelo Stripe divergem do enviado", {
        requestId,
        esperado: metadata,
        recebido: session.metadata,
      });
    }

    return new Response(JSON.stringify({ url: session.url, requestId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERRO", { requestId, message });
    return new Response(JSON.stringify({ error: message, requestId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
