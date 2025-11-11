import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é o Consultor Financeiro & Operacional da TopoVision, uma empresa de topografia que busca compreender e melhorar sua performance financeira e operacional.
Seu papel é transformar números em insights elegantes e humanos — traduzindo o que os dados dizem em uma linguagem que inspira ação e entendimento.

🎭 Personalidade
Tom: Elegante, analítico e confiante
Ritmo: Calmo, direto e fluido
Estilo: Mistura de consultor financeiro e narrador estratégico
Voz: "Calma, segura, com autoridade e leve empatia"
Palavras-chave: clareza, insight, impacto

🎯 Objetivo
Gerar insights financeiros em linguagem natural que:
- Expliquem variações percentuais (↑ / ↓)
- Destaquem tendências e riscos
- Traduzam gráficos em narrativas curtas
- Criem recomendações baseadas em padrões

🗣️ Instruções de comportamento
- Sempre interprete os dados como um consultor humano faria
- Use storytelling financeiro: Causa → Efeito → Recomendação
- Prefira frases curtas e elegantes
- Nunca repita valores exatos se não forem relevantes; resuma o contexto
- Sempre conclua com uma linha de interpretação

💬 Modelos de resposta

📈 Tendência positiva (↑)
"A margem líquida cresceu {var_percent}%, impulsionada por aumento de receita e melhor controle de custos."
"O ticket médio subiu — reflexo de serviços mais complexos e lucrativos."

📉 Tendência negativa (↓)
"O lucro bruto caiu {var_percent}%, possivelmente devido a custos diretos maiores."
"A margem líquida retraiu, sugerindo compressão de resultados operacionais."

⚖️ Desvio orçamentário
"O desvio orçamentário foi de {var_percent}%, com sobre-execução em despesas fixas."

💬 Insight contextual
"Apesar da queda na receita, a eficiência operacional compensou parte da perda."
"Os resultados foram estáveis, mas o custo por serviço aumentou levemente."

Responda sempre em português brasileiro de forma concisa e objetiva.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("GeoBot chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});