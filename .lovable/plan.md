

User wants an "Insights Engine" that turns raw data into prioritized, human-language actions on the dashboard. Let me check what exists already.

Existing relevant components I already know:
- `AIInsightsCard.tsx` — calls `ai-insights` edge function (LLM-based, slow, generic)
- `CriticalAlerts.tsx` — already shows overdue payments, delayed services, negative margin
- `NextActions.tsx` — already shows "Aprovar X orçamentos", "Atualizar X serviços", "Cobrar X pagamentos"
- `ActionableInsight.tsx` — card component with priority badge + CTA (perfect base)
- `GestaoEmpresa.tsx` — main dashboard (where insights should go on top)
- `StoryCard.tsx` — narrative card
- `useKPIs`, `useKPIVariation`, `useDashboardMetrics` — data sources

So a lot exists but it's scattered, not prioritized, and the AI card is slow/generic. The plan is to build a deterministic rule-based insights engine (fast, no LLM) that consolidates everything into ONE prioritized "What to do today" hub at the top of the dashboard.

Plan should be concise.

## Plano: Motor de Insights Acionáveis (O que fazer hoje)

### Diagnóstico
Já existem peças soltas no dashboard (`AIInsightsCard`, `CriticalAlerts`, `NextActions`, `ActionableInsight`), mas:
- estão espalhadas e competem por atenção
- `AIInsightsCard` depende de LLM (lento, genérico, custo)
- nenhuma é **priorizada por impacto financeiro**
- linguagem ainda é técnica em vários pontos ("Margem negativa", "Taxa de conversão")

### O que vou construir

**1. Hook `useActionableInsights`** (novo, determinístico, sem LLM)
Roda em paralelo várias queries leves e gera array de insights tipados:

```ts
type Insight = {
  id: string;
  severity: "urgent" | "opportunity" | "attention";
  title: string;          // linguagem humana, sem jargão
  explanation: string;    // 1 frase: o que e por quê
  impact: string;         // "R$ 12.500 em risco" / "R$ 8.300 a receber"
  impactValue: number;    // p/ ordenação
  ctaLabel: string;
  ctaHref: string;
  icon: LucideIcon;
}
```

**Regras detectadas (todas com query SQL simples):**

| Tipo | Regra | Mensagem (exemplo) |
|---|---|---|
| 🔴 Urgente | Pagamentos vencidos | "3 pagamentos atrasados — R$ 12.500 a receber" |
| 🔴 Urgente | Serviço com prejuízo (custo > receita) | "O serviço X está dando prejuízo de R$ 2.300" |
| 🔴 Urgente | Lucro caiu >20% vs mês anterior | "Seu lucro caiu 28% este mês" |
| 🟡 Atenção | Orçamentos pendentes >7 dias | "5 orçamentos esperando resposta há mais de 1 semana" |
| 🟡 Atenção | Serviços atrasados (data_fim passou, status ≠ Concluído) | "2 projetos passaram do prazo" |
| 🟡 Atenção | Clientes sem projeto há >90 dias | "12 clientes sem nenhum projeto ativo" |
| 🟡 Atenção | Custos subiram >15% vs mês anterior | "Suas despesas subiram 22% este mês" |
| 🟢 Oportunidade | Top 3 clientes por receita | "João Silva é seu cliente mais rentável (R$ 45k)" |
| 🟢 Oportunidade | Serviço mais lucrativo do mês | "Topografia gerou R$ 18k este mês — foque aqui" |
| 🟢 Oportunidade | Crescimento de receita >10% | "Sua receita cresceu 18% — ótimo momento" |

**Ordenação:** urgentes primeiro (por valor R$ desc), depois atenção (por impactValue desc), depois oportunidades (top 2). Limitar a **5–7 insights** no total para não poluir.

**2. Componente `TodayActionsHub.tsx`** (novo)
Bloco principal no topo do dashboard, substitui visualmente `CriticalAlerts` + `NextActions` + `AIInsightsCard`:

```
┌─────────────────────────────────────────────┐
│ 🎯 O que você deve fazer hoje              │
├─────────────────────────────────────────────┤
│ 🔴 3 pagamentos atrasados                   │
│    R$ 12.500 a receber → [Cobrar agora]    │
│ 🔴 Serviço Topografia X com prejuízo        │
│    -R$ 2.300 → [Revisar custos]            │
│ 🟡 5 orçamentos sem resposta há 7+ dias     │
│    R$ 38.000 em pipeline → [Ver orçamentos]│
│ 🟢 João Silva é seu cliente top do mês     │
│    R$ 45k → [Ver oportunidades]            │
└─────────────────────────────────────────────┘
```

Cada linha usa o `ActionableInsight` já existente (ou um Compact variant) com:
- ícone + cor por severity
- título humano (1 linha)
- linha de impacto em destaque (R$)
- botão CTA que navega direto

**3. Integração no `GestaoEmpresa.tsx`**
- Mover `TodayActionsHub` para **logo abaixo do título** (acima dos KPIs)
- Remover `CriticalAlerts` e `NextActions` do topo (consolidados no hub)
- Manter `AIInsightsCard` mais abaixo como "Análise IA aprofundada" (opcional, secundário)
- Estado vazio: se nenhum insight, mostrar mensagem positiva "Tudo sob controle hoje 👍"

**4. Linguagem humanizada**
Substituir em todo o motor:
- "Margem negativa" → "Está dando prejuízo"
- "Taxa de conversão" → "% de orçamentos aprovados"
- "Inadimplência" → "Pagamentos atrasados"
- "Pipeline" → "em negociação"
- Sempre incluir valor em R$ quando possível

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/hooks/useActionableInsights.ts` | **Novo** — motor de regras com queries Supabase |
| `src/components/dashboard/TodayActionsHub.tsx` | **Novo** — UI do hub priorizado |
| `src/pages/GestaoEmpresa.tsx` | Substituir bloco superior pelo `TodayActionsHub` |

Sem migrações. Sem LLM. Tudo determinístico, rápido (queries paralelas, cache 2min via React Query).

### Princípio de entrega
Ao abrir o dashboard, o usuário vê **no máximo 5 ações** ordenadas por impacto, em linguagem humana, com botão direto — e pensa "agora sei o que fazer".

