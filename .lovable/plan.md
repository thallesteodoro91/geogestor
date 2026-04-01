

## Plano: Transformação UX do SkyGeo — Onboarding, Empty States, Dashboard 360 e Integração IA

### Escopo Total: 7 frentes de trabalho

---

### PRIORIDADE ALTA

#### 1. Onboarding Guiado (novo sistema)

**Novos arquivos:**
- `src/components/onboarding/OnboardingChecklist.tsx` — Componente flutuante com checklist de progresso
- `src/components/onboarding/OnboardingTooltip.tsx` — Tooltip contextual para primeiras interações
- `src/hooks/useOnboarding.ts` — Hook que gerencia estado do onboarding (persiste no `tenant.settings`)

**Checklist de 5 passos:**
1. "Configure sua empresa" → `/configuracoes`
2. "Cadastre seu primeiro cliente" → `/cadastros`
3. "Crie um serviço" → `/servicos`
4. "Gere um orçamento" → `/servicos-orcamentos`
5. "Analise seus resultados" → `/` (dashboard)

**Lógica:** Consulta tabelas reais (`dim_cliente`, `fato_servico`, `fato_orcamento`) para verificar progresso automaticamente. Salva `onboarding_completed: true` em `tenant.settings` quando finalizado.

**UI:** Card fixo no canto inferior direito (dismissível), com barra de progresso, aparece apenas para tenants novos (< 7 dias ou sem `onboarding_completed`).

**Microcopy exemplos:**
- "Bem-vindo ao SkyGeo! 🎯 Complete estes passos para começar a gerir sua empresa."
- "Passo 2 de 5 — Cadastre seu primeiro cliente para organizar projetos e orçamentos"

---

#### 2. Empty States Acionáveis

**Novo componente:** `src/components/ui/empty-state.tsx`

```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  tip?: string;
}
```

**Páginas a atualizar (6):**

| Página | Mensagem atual | Nova mensagem | CTA |
|--------|---------------|---------------|-----|
| Serviços | "Nenhum serviço" | "Registre seu primeiro serviço para acompanhar prazos, equipe e progresso" | "+ Criar Serviço" |
| Orçamentos | "Nenhum orçamento" | "Crie orçamentos profissionais em PDF e acompanhe aprovações" | "+ Novo Orçamento" |
| Despesas | "Nenhuma despesa" | "Controle despesas para ter uma visão real da sua margem de lucro" | "+ Registrar Despesa" |
| Clientes | "Nenhum cliente" | "Cadastre seus clientes para organizar projetos e faturamento" | "+ Novo Cliente" |
| Calendário | (vazio) | "Organize sua agenda com compromissos e prazos de serviços" | "+ Novo Compromisso" |
| Dashboard/gráficos | "Sem dados no período" | "Cadastre serviços e orçamentos para ver suas análises aqui" | "Começar →" |

**Cada empty state inclui:** ícone ilustrativo grande, descrição do valor da funcionalidade, CTA primário, dica sutil ("💡 Dica: Você pode importar dados via CSV em Configurações").

---

#### 3. Dashboard 360 Redesenhado

**Arquivo:** `src/pages/GestaoEmpresa.tsx` — Reestruturação completa

**Nova estrutura:**

```text
┌─────────────────────────────────────────────┐
│ Bom dia, [Nome]! Aqui está o resumo da sua  │
│ empresa.                    [Filtros período]│
├─────────────────────────────────────────────┤
│ [ONBOARDING CHECKLIST - se não completo]     │
├─────────────────────────────────────────────┤
│ 🔴 ALERTAS CRÍTICOS (se houver)              │
│ "3 orçamentos vencidos" | "Margem negativa"  │
├────────┬────────┬────────┬──────────────────┤
│Receita │Lucro   │Margem  │Pipeline          │
│Total   │Líquido │Líquida │(orç. pendentes)  │
├────────┴────────┴────────┴──────────────────┤
│ 📋 PRÓXIMAS AÇÕES RECOMENDADAS               │
│ "Aprovar 3 orçamentos" | "2 serviços atrasados"│
├─────────────────┬───────────────────────────┤
│ Receita Mensal  │ Resumo IA (GeoBot mini)   │
│ [gráfico]       │ "Sua receita cresceu 12%" │
│                 │ [Aprofundar com GeoBot →]  │
├─────────────────┴───────────────────────────┤
│ Custos vs Receita │ Alertas Financeiros      │
└─────────────────────────────────────────────┘
```

**Novos elementos:**
- **Saudação personalizada** com nome do usuário (de `profiles.full_name`)
- **Seção "Alertas Críticos"** — novo componente `CriticalAlerts.tsx` que consolida: orçamentos vencidos, serviços atrasados, margem negativa
- **Seção "Próximas Ações"** — novo componente `NextActions.tsx` com queries que identificam: orçamentos pendentes de aprovação, serviços sem progresso, pagamentos a receber
- **Mini GeoBot** — resumo de 2-3 linhas gerado por IA com botão "Aprofundar" que leva a `/geobot`
- **Pipeline card** — novo KPI mostrando valor total de orçamentos pendentes

---

### PRIORIDADE MÉDIA

#### 4. Insights Acionáveis nos Dashboards

**Modificar:** `src/components/dashboard/StoryCard.tsx` para incluir botão de ação

```tsx
// Adicionar prop actionLabel + actionHref
<StoryCard
  title="Margem Líquida"
  insight="Margem de 8.5% — abaixo do ideal de 15%"
  actionLabel="Ver despesas"
  actionHref="/despesas"
/>
```

**Modificar:** `src/pages/DashboardFinanceiro.tsx` — Adicionar botões "Analisar com IA" nos cards de gráfico que abrem GeoBot com contexto pré-preenchido.

**Novo componente:** `src/components/dashboard/ActionableInsight.tsx`
- Exibe recomendação com badge de prioridade (🔴 urgente, 🟡 atenção, 🟢 positivo)
- Inclui CTA: "Revisar custos →", "Ver orçamentos →"

---

#### 5. Reestruturação da Navegação

**Arquivo:** `src/components/layout/Sidebar.tsx`

**Mudança na estrutura de seções:**

| Atual | Novo |
|-------|------|
| Visão (3 itens) | **Visão Geral** (Dashboard 360, Dashboard Financeiro) |
| Inteligência (3 itens) | **Financeiro** (Orçamentos, Despesas) |
| Operações (3 itens) | **Operação** (Serviços, Calendário) |
| Base de Dados (4 itens) | **Clientes** (Clientes e Projetos, Cadastros) |
| | **Inteligência** (GeoBot, Relatório Executivo, Alertas) |
| | **Configurações** (Configurações, Ajuda, Auditoria) |

**Detalhes:**
- Remover "Operacional" como página separada (integrar KPIs no Dashboard 360)
- Mover "Calendário" para Operação (faz mais sentido junto com Serviços)
- Agrupar Configurações com Ajuda e Auditoria no final

---

#### 6. Integração do GeoBot

**Modificações em 3 lugares:**

1. **`src/pages/GestaoEmpresa.tsx`** — Adicionar card "Resumo IA" que chama a edge function `ai-insights` e mostra 2-3 bullets com link "Conversar com GeoBot →"

2. **`src/pages/DashboardFinanceiro.tsx`** — Adicionar botão "🤖 Analisar com IA" em cada card de gráfico. Ao clicar, navega para `/geobot?context=margem` (GeoBot abre com prompt pré-preenchido)

3. **`src/pages/GeoBot.tsx`** — Ler query param `context` para pré-carregar pergunta contextual:
   - `?context=margem` → "Analise minhas margens e sugira otimizações"
   - `?context=despesas` → "Quais despesas estão impactando mais o lucro?"
   - `?context=conversao` → "Como melhorar a taxa de conversão de orçamentos?"

---

### PRIORIDADE BAIXA

#### 7. Fluxo Principal Guiado

**Novo componente:** `src/components/onboarding/FlowGuide.tsx`

Após o onboarding, exibir um banner sutil no dashboard:
"📍 Fluxo recomendado: Cadastrar Cliente → Criar Serviço → Gerar Orçamento → Acompanhar → Analisar"

Cada etapa é um link clicável. Etapas concluídas ficam com checkmark. O banner desaparece quando o usuário fecha ou completa o fluxo.

---

### Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/onboarding/OnboardingChecklist.tsx` |
| Criar | `src/components/onboarding/OnboardingTooltip.tsx` |
| Criar | `src/hooks/useOnboarding.ts` |
| Criar | `src/components/ui/empty-state.tsx` |
| Criar | `src/components/dashboard/CriticalAlerts.tsx` |
| Criar | `src/components/dashboard/NextActions.tsx` |
| Criar | `src/components/dashboard/ActionableInsight.tsx` |
| Criar | `src/components/onboarding/FlowGuide.tsx` |
| Editar | `src/pages/GestaoEmpresa.tsx` (dashboard 360 redesign) |
| Editar | `src/pages/Servicos.tsx` (empty state) |
| Editar | `src/pages/ServicosOrcamentos.tsx` (empty state) |
| Editar | `src/pages/Despesas.tsx` (empty state) |
| Editar | `src/pages/Clientes.tsx` (empty state) |
| Editar | `src/pages/Calendario.tsx` (empty state) |
| Editar | `src/components/layout/Sidebar.tsx` (nova navegação) |
| Editar | `src/components/dashboard/StoryCard.tsx` (ações) |
| Editar | `src/pages/DashboardFinanceiro.tsx` (botões IA) |
| Editar | `src/pages/GeoBot.tsx` (contexto via query params) |
| Editar | `src/components/layout/AppLayout.tsx` (slot para onboarding) |

**Nenhuma migração de banco necessária** — usa `tenant.settings` para persistir estado do onboarding.

