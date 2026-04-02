

## Plano: Dashboard 360 Definitivo — Redesign Completo da Home

### Diagnóstico da Versão Atual

A home atual já tem bons componentes (OnboardingChecklist, CriticalAlerts, NextActions, KPIs, StoryCards, gráficos), mas sofre de:

1. **Excesso de informação** — 8 KPIs + 4 KPIs estratégicos + 3 abas com gráficos + alertas. Sobrecarga cognitiva.
2. **Falta de hierarquia clara** — KPIs financeiros e estratégicos competem visualmente. O usuário não sabe onde olhar primeiro.
3. **Gráficos ocupam muito espaço** — Tabs com 6 gráficos detalhados pertencem ao Dashboard Financeiro, não à home.
4. **GeoBot isolado** — Apenas um botão "Consultar GeoBot" no header. Sem resumo IA na home.
5. **Sem visão operacional** — A home é 100% financeira. Não mostra serviços em andamento, prazos ou produtividade.
6. **Alertas financeiros no final** — Deviam estar no topo, perto dos CriticalAlerts.

### Nova Estrutura (Topo → Base)

```text
┌─────────────────────────────────────────────────────┐
│ 1. HEADER PERSONALIZADO                              │
│    "Bom dia, João! 👋"                               │
│    "Aqui está o que precisa da sua atenção hoje"     │
│    [Trial Banner se aplicável]                        │
├─────────────────────────────────────────────────────┤
│ 2. ONBOARDING (condicional — se não completou)       │
│    [OnboardingChecklist existente]                    │
│    [FlowGuide existente]                             │
├─────────────────────────────────────────────────────┤
│ 3. 🔴 ALERTAS + AÇÕES (seção unificada)              │
│    ┌─────────────────┬──────────────────────────┐    │
│    │ Alertas Críticos│ Próximas Ações            │    │
│    │ (CriticalAlerts)│ (NextActions)             │    │
│    └─────────────────┴──────────────────────────┘    │
│    Título: "O que precisa da sua atenção"            │
├─────────────────────────────────────────────────────┤
│ 4. KPIs ESSENCIAIS (4 cards — financeiros)           │
│    Receita | Lucro Líquido | Margem | Pipeline       │
│    Cada um com: valor, variação, interpretação       │
├─────────────────────────────────────────────────────┤
│ 5. PULSO OPERACIONAL (novo — 4 mini-cards)           │
│    Serviços Ativos | Concluídos Mês | Taxa Conversão │
│    | Ticket Médio                                    │
│    Menor destaque visual que os KPIs financeiros     │
├─────────────────────────────────────────────────────┤
│ 6. INSIGHTS IA + RESUMO (lado a lado)                │
│    ┌────────────────────┬───────────────────────┐    │
│    │ 🤖 Resumo IA       │ 📊 Receita Mensal     │    │
│    │ 3 insights gerados │ (gráfico compacto)    │    │
│    │ [Aprofundar →]     │                       │    │
│    └────────────────────┴───────────────────────┘    │
├─────────────────────────────────────────────────────┤
│ 7. NARRATIVAS (2 StoryCards — crescimento + margem)  │
│    Análise contextual com CTAs acionáveis            │
├─────────────────────────────────────────────────────┤
│ 8. ALERTAS FINANCEIROS (pagamentos vencidos/prox.)   │
│    [AlertasFinanceiros existente]                     │
└─────────────────────────────────────────────────────┘
```

### Mudanças Detalhadas

**Arquivo: `src/pages/GestaoEmpresa.tsx`** — Reescrita da estrutura

1. **Unificar Alertas + Ações** em uma seção lado a lado com título "O que precisa da sua atenção". Componentes existentes (`CriticalAlerts` + `NextActions`) em grid 2 colunas.

2. **Reduzir KPIs** — Manter apenas 4 financeiros no topo (Receita, Lucro, Margem, Pipeline). Remover os 4 "Planejamento Estratégico" (Margem Contribuição, Ponto Equilíbrio, Desvio Orçamentário, Taxa Conversão) — esses pertencem ao Dashboard Financeiro.

3. **Adicionar "Pulso Operacional"** — Nova seção com 4 mini-KPIs menores (grid de 4, estilo compacto): Serviços Ativos, Concluídos no Mês, Taxa de Conversão, Ticket Médio. Dados já existem em `kpis`.

4. **Remover Tabs com gráficos** — As 3 abas (Visão Geral, Orçamento, Ponto de Equilíbrio) com 6 gráficos pesados saem da home. Manter apenas 1 gráfico compacto de Receita Mensal ao lado dos Insights IA.

5. **Adicionar Insights IA** — Integrar `AIInsightsCard` existente na home, ao lado do gráfico de receita. Layout 2 colunas: IA à esquerda, gráfico à direita.

6. **Manter StoryCards** — Apenas 2 (Crescimento + Margem), sem as abas.

7. **Remover GlobalFilters** — Filtros complexos pertencem ao Dashboard Financeiro. A home mostra dados globais.

8. **Subtítulo do header** — Mudar de "Aqui está o resumo da sua empresa" para "Aqui está o que precisa da sua atenção hoje" (foco em ação).

**Nenhum novo componente necessário** — Todos os blocos já existem. É uma reorganização e simplificação.

### Microcopy

- Header: "Aqui está o que precisa da sua atenção hoje"
- Alertas: "O que precisa da sua atenção"
- KPIs: "Saúde Financeira"
- Pulso: "Pulso Operacional" / "Atividade do mês"
- IA: "Análise Inteligente" / "O GeoBot identificou..."
- Narrativas: "Interpretação dos dados"

### Resumo de Impacto

| Antes | Depois |
|-------|--------|
| 8 KPIs grandes + 4 estratégicos = 12 | 4 grandes + 4 compactos = 8 |
| 3 abas com 6 gráficos | 1 gráfico compacto |
| Sem IA na home | AIInsightsCard integrado |
| Sem visão operacional | Pulso Operacional |
| GlobalFilters na home | Removido (fica no Dash Financeiro) |
| ~490 linhas | ~250 linhas estimadas |

### Arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/pages/GestaoEmpresa.tsx` |

Nenhum novo componente, nenhuma migração de banco.

