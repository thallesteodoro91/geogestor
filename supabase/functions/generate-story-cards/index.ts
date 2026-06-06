import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Rate limiter (5 req/min por IP) ---
class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private max: number, private windowMs: number) {}
  limited(ip: string): boolean {
    const now = Date.now();
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    const entry = this.hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }
    entry.count++;
    return entry.count > this.max;
  }
}
const limiter = new RateLimiter(5, 60_000);

interface KpiSnapshot {
  receita_total: number;
  lucro_liquido: number;
  lucro_bruto: number;
  total_despesas: number;
  margem_liquida_percent: number;
  margem_bruta_percent: number;
  taxa_conversao_percent: number;
  ticket_medio: number;
  total_servicos: number;
  servicos_concluidos: number;
}

interface RequestBody {
  current: KpiSnapshot;
  previous: KpiSnapshot;
  variations: Partial<KpiSnapshot>;
  monthlyTrend?: Array<{ month: string; receita: number; despesa: number }>;
}

function validate(body: any): RequestBody {
  if (!body || typeof body !== "object") throw new Error("Invalid body");
  if (!body.current || !body.variations) throw new Error("current and variations required");
  return body as RequestBody;
}

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function buildPrompt(body: RequestBody): string {
  const { current, previous, variations, monthlyTrend } = body;
  const trendStr = (monthlyTrend ?? [])
    .filter((m) => m.receita > 0 || m.despesa > 0)
    .slice(-6)
    .map((m) => `${m.month}: receita ${brl(m.receita)}, despesa ${brl(m.despesa)}`)
    .join("\n");

  return `Você é um analista financeiro sênior de uma empresa de topografia e geoprocessamento. Gere 3 a 5 Story Cards curtos, em português do Brasil, explicando os KPIs abaixo em linguagem natural, executiva e acionável.

KPIs DO PERÍODO ATUAL (últimos 6 meses):
- Receita total: ${brl(current.receita_total)}
- Lucro líquido: ${brl(current.lucro_liquido)} (margem ${current.margem_liquida_percent.toFixed(1)}%)
- Lucro bruto: ${brl(current.lucro_bruto)} (margem ${current.margem_bruta_percent.toFixed(1)}%)
- Total de despesas: ${brl(current.total_despesas)}
- Ticket médio: ${brl(current.ticket_medio)}
- Taxa de conversão: ${current.taxa_conversao_percent.toFixed(1)}%
- Serviços: ${current.total_servicos} (${current.servicos_concluidos} concluídos)

PERÍODO ANTERIOR (6 meses antes):
- Receita: ${brl(previous.receita_total)} | Lucro líquido: ${brl(previous.lucro_liquido)} | Despesas: ${brl(previous.total_despesas)} | Margem líquida: ${previous.margem_liquida_percent.toFixed(1)}%

VARIAÇÕES (% atual vs anterior):
- Receita: ${(variations.receita_total ?? 0).toFixed(1)}%
- Lucro líquido: ${(variations.lucro_liquido ?? 0).toFixed(1)}%
- Margem líquida: ${(variations.margem_liquida_percent ?? 0).toFixed(1)} p.p.
- Despesas: ${(variations.total_despesas ?? 0).toFixed(1)}%
- Ticket médio: ${(variations.ticket_medio ?? 0).toFixed(1)}%
- Conversão: ${(variations.taxa_conversao_percent ?? 0).toFixed(1)} p.p.

${trendStr ? `EVOLUÇÃO MENSAL (últimos meses):\n${trendStr}` : ""}

Diretrizes:
- Cada card deve focar em UM tema (variação MoM, tendência de 3-6 meses, ou alerta/recomendação).
- Sempre cite números concretos e percentuais. Nada genérico.
- Tom executivo, direto, sem floreio. Máximo 2 frases por insight.
- "category": "financial" (receita/lucro/margem), "operational" (serviços/conversão), "strategic" (despesas, tendências).
- "trend": "up" (positivo), "down" (negativo), "alert" (precisa atenção), "neutral".
- "action" só quando houver recomendação concreta (uma frase).
- Misture os tipos: 1 variação MoM, 1 tendência, 1-2 alertas/recomendações.`;
}

const responseSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          insight: { type: "string" },
          category: { type: "string", enum: ["financial", "operational", "strategic"] },
          trend: { type: "string", enum: ["up", "down", "alert", "neutral"] },
          kind: { type: "string", enum: ["variation", "trend", "alert"] },
          action: { type: "string" },
        },
        required: ["title", "insight", "category", "trend", "kind"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (limiter.limited(ip)) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = validate(await req.json());
    const prompt = buildPrompt(body);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um analista financeiro sênior. Responda APENAS com JSON válido seguindo o schema fornecido.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "render_story_cards",
              description: "Renderiza os story cards explicando os KPIs",
              parameters: responseSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "render_story_cards" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "ai_rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "ai_credits_exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "ai_error", detail: txt }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      console.error("AI response missing tool_call", JSON.stringify(aiJson));
      return new Response(JSON.stringify({ error: "ai_no_output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = typeof args === "string" ? JSON.parse(args) : args;

    return new Response(
      JSON.stringify({ cards: parsed.cards ?? [], generated_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-story-cards error", err);
    return new Response(
      JSON.stringify({ error: "internal_error", message: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
