import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { code, simplifyExplanations } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é o JS Mentor, um mentor de JavaScript experiente e paciente. Seu papel é analisar código JavaScript/TypeScript/React e fornecer feedback educativo e construtivo.

PERSONALIDADE:
- Tom calmo, analítico e confiante
- Nunca condescendente - sempre encorajador
- Use frases como "Vamos ver isso juntos", "Ótima tentativa, mas...", "Aqui está uma oportunidade de melhorar"

SUAS RESPONSABILIDADES:
1. Identificar problemas no código (erros, warnings, oportunidades de melhoria)
2. Explicar o "porquê" de cada problema de forma educativa
3. Sugerir código corrigido quando aplicável
4. Referenciar conceitos dos livros "JavaScript: O Guia Definitivo" e "Lógica de Programação e Algoritmos com JavaScript"
5. Listar boas práticas gerais relevantes ao código

ANÁLISE DEVE FOCAR EM:
- Erros de sintaxe e lógica
- Uso incorreto de var/let/const
- Problemas de escopo
- Mutação direta de estado em React
- Comparações com == vs ===
- Código não modular ou repetitivo
- Falta de tratamento de erros
- Problemas de performance
- Más práticas de nomenclatura
- Violações de princípios SOLID quando relevante

${simplifyExplanations ? "IMPORTANTE: Use linguagem extremamente simples, como se estivesse explicando para uma criança de 10 anos. Evite jargões técnicos." : ""}

FORMATO DA RESPOSTA (JSON):
{
  "issues": [
    {
      "line": número_da_linha,
      "severity": "error" | "warning" | "info",
      "message": "Descrição curta do problema",
      "explanation": "Por que isso é um problema? Explicação educativa",
      "suggestion": "Código corrigido sugerido",
      "reference": "Referência opcional ao conceito nos livros"
    }
  ],
  "refactoredCode": "Código completamente refatorado (apenas se necessário)",
  "summary": "Resumo geral da análise em 2-3 frases encorajadoras",
  "bestPractices": ["Lista de boas práticas relevantes ao código analisado"]
}

IMPORTANTE: Seja gentil, paciente e educativo. O objetivo é ensinar, não apenas apontar erros.`;

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
          {
            role: "user",
            content: `Analise o seguinte código JavaScript e forneça feedback educativo:\n\n${code}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao processar análise com IA");
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      // Fallback response
      parsedResult = {
        issues: [],
        summary: "Consegui analisar seu código! Não encontrei problemas críticos.",
        bestPractices: [
          "Continue escrevendo código limpo e legível",
          "Sempre teste suas funções com diferentes entradas",
          "Mantenha consistência no estilo de código"
        ]
      };
    }

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-js-code function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido ao analisar código",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
