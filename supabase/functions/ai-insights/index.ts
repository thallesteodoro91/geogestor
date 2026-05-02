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
const rateLimiter = new RateLimiter(10, 60_000);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(clientIP)) {
    return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Fetch KPI data using the user's context (RLS-aware)
    const { data: kpiData, error: kpiError } = await supabase.rpc("calcular_kpis_v2");
    if (kpiError) throw kpiError;

    const kpis = kpiData?.[0];
    if (!kpis) {
      return new Response(JSON.stringify({ insights: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch monthly data for trend analysis
    const currentYear = new Date().getFullYear();
    const { data: monthlyData } = await supabase.rpc("get_monthly_financial_data", { p_year: currentYear });

    // Build a prompt with the KPI data
    const prompt = `Você é um consultor financeiro especializado em empresas de serviços rurais e topografia.
Analise os seguintes KPIs e dados mensais e gere exatamente 3 a 5 insights acionáveis em português brasileiro.

KPIs atuais:
- Receita total: R$ ${kpis.receita_total?.toFixed(2) || "0"}
- Lucro bruto: R$ ${kpis.lucro_bruto?.toFixed(2) || "0"}
- Lucro líquido: R$ ${kpis.lucro_liquido?.toFixed(2) || "0"}
- Margem bruta: ${kpis.margem_bruta_percent?.toFixed(1) || "0"}%
- Margem líquida: ${kpis.margem_liquida_percent?.toFixed(1) || "0"}%
- Total despesas: R$ ${kpis.total_despesas?.toFixed(2) || "0"}
- Custos variáveis: R$ ${kpis.custos_variaveis_reais?.toFixed(2) || "0"}
- Despesas fixas: R$ ${kpis.despesas_fixas_reais?.toFixed(2) || "0"}
- Taxa de conversão: ${kpis.taxa_conversao_percent?.toFixed(1) || "0"}%
- Ticket médio: R$ ${kpis.ticket_medio?.toFixed(2) || "0"}
- Total serviços: ${kpis.total_servicos || 0}
- Serviços concluídos: ${kpis.servicos_concluidos || 0}
- Desvio orçamentário: ${kpis.desvio_orcamentario_percent?.toFixed(1) || "0"}%

Dados mensais (${currentYear}):
${JSON.stringify(monthlyData || [])}

Para cada insight, retorne um JSON com:
- "tipo": "positivo" | "negativo" | "neutro"
- "titulo": título curto (máx 60 caracteres)
- "descricao": explicação com números concretos (máx 200 caracteres)
- "acao": sugestão acionável específica (máx 150 caracteres)

Retorne APENAS um array JSON válido, sem markdown, sem explicação adicional.`;

    // Call Lovable AI (Gemini)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[AI-INSIGHTS] AI API error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "RATE_LIMITED",
            message: "Muitas requisições. Tente novamente em instantes.",
            insights: [],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (aiResponse.status === 402) {
        // Try to extract credit info from headers/body when the gateway provides it
        const remainingHeader =
          aiResponse.headers.get("x-credits-remaining") ??
          aiResponse.headers.get("x-ratelimit-remaining-credits");
        const requiredHeader =
          aiResponse.headers.get("x-credits-required") ??
          aiResponse.headers.get("x-ratelimit-required-credits");

        let creditsRemaining: number | undefined =
          remainingHeader !== null && !Number.isNaN(Number(remainingHeader))
            ? Number(remainingHeader)
            : undefined;
        let creditsRequired: number | undefined =
          requiredHeader !== null && !Number.isNaN(Number(requiredHeader))
            ? Number(requiredHeader)
            : undefined;

        try {
          const parsed = JSON.parse(errText);
          if (typeof parsed?.credits_remaining === "number") creditsRemaining = parsed.credits_remaining;
          if (typeof parsed?.credits_required === "number") creditsRequired = parsed.credits_required;
          if (typeof parsed?.error?.credits_remaining === "number") creditsRemaining = parsed.error.credits_remaining;
          if (typeof parsed?.error?.credits_required === "number") creditsRequired = parsed.error.credits_required;
        } catch {
          // body wasn't JSON — ignore
        }

        return new Response(
          JSON.stringify({
            error: "PAYMENT_REQUIRED",
            message: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage.",
            creditsRemaining,
            creditsRequired,
            insights: [],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          error: "AI_SERVICE_ERROR",
          message: "Não foi possível gerar insights no momento.",
          insights: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "[]";
    
    // Parse AI response - handle potential markdown wrapping
    let insights;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      insights = JSON.parse(cleanContent);
    } catch {
      console.error("[AI-INSIGHTS] Failed to parse AI response:", content);
      insights = [];
    }

    return new Response(JSON.stringify({ insights, kpis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[AI-INSIGHTS] ERROR:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
