import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
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
      console.error("[AI-INSIGHTS] AI API error:", errText);
      throw new Error(`AI API error: ${aiResponse.status}`);
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
