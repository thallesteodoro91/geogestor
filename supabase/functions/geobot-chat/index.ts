import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// --- Rate Limiter ---
class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  constructor(private maxRequests: number, private windowMs: number) {}

  isRateLimited(ip: string): boolean {
    const now = Date.now();
    // Cleanup expired entries
    for (const [key, val] of this.requests) {
      if (val.resetAt <= now) this.requests.delete(key);
    }
    const entry = this.requests.get(ip);
    if (!entry) {
      this.requests.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    if (entry.resetAt <= now) {
      this.requests.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    entry.count++;
    return entry.count > this.maxRequests;
  }
}

const rateLimiter = new RateLimiter(20, 60_000);

// Tipos de validação
interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
}

function validateChatRequest(body: any): ChatRequest {
  if (!body || typeof body !== 'object') throw new Error('Invalid request body');
  if (!Array.isArray(body.messages)) throw new Error('Messages must be an array');
  if (body.messages.length === 0) throw new Error('Messages array cannot be empty');
  for (const msg of body.messages) {
    if (!msg.role || !msg.content) throw new Error('Each message must have role and content');
    if (typeof msg.role !== 'string' || typeof msg.content !== 'string') throw new Error('Role and content must be strings');
  }
  return body as ChatRequest;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const startTime = Date.now();

  console.log(JSON.stringify({ timestamp: new Date().toISOString(), method: req.method, url: req.url }));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimiter.isRateLimited(clientIP)) {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), event: "rate_limited", ip: clientIP, function: "geobot-chat" }));
    return new Response(
      JSON.stringify({ error: "Muitas requisições. Tente novamente em breve." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const body = await req.json();
    const { messages } = validateChatRequest(body);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é o Consultor Financeiro & Operacional do GeoGestor, plataforma de gestão para empresas de topografia que buscam compreender e melhorar sua performance financeira e operacional.
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
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), error: e instanceof Error ? e.message : "Unknown error", stack: e instanceof Error ? e.stack : undefined, duration_ms: duration }));
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
