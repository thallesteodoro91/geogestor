## Plano: Design System com Componentes Reutilizáveis e Regras de Priorização

### Problema

Cada página reimplementa os mesmos padrões (header, filtros, KPIs, tabela com paginação, empty states) com variações inconsistentes: espaçamentos diferentes, headers com/sem ícone, filtros em `Card` ou soltos, KPIs com `KPICard` ou mini-cards manuais. Isso gera ~200 linhas repetidas por página.

### Solução: 4 Componentes de Layout Reutilizáveis

---

#### 1. `PageHeader` — Cabeçalho padronizado

```tsx
// src/components/layout/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode; // Botões CTA
}
```

Substitui os blocos `<div className="flex flex-col sm:flex-row...">` que se repetem em todas as 6 páginas. Garante: título `text-3xl font-heading font-bold`, subtítulo `text-muted-foreground`, actions alinhados à direita com responsive collapse.

**Páginas afetadas:** Clientes, Serviços, Orçamentos, Despesas, Cadastros, Calendário.

---

#### 2. `FilterBar` — Barra de filtros consistente

```tsx
// src/components/layout/FilterBar.tsx
interface FilterBarProps {
  children: ReactNode; // Slots para Input, Select, DatePickers
  className?: string;
}
```

Wrapper que padroniza `flex flex-wrap items-center gap-3` dentro de um `Card` com `CardContent`. Inclui o ícone de Search no Input automaticamente quando passado como children.

**Páginas afetadas:** Todas as 6 (atualmente cada uma monta filtros de forma diferente).

---

#### 3. `ContextualKPIs` — Mini-KPIs operacionais

```tsx
// src/components/layout/ContextualKPIs.tsx
interface ContextualKPI {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string; // classe Tailwind como "text-primary" ou hex
}
interface ContextualKPIsProps {
  items: ContextualKPI[];
  columns?: 2 | 3 | 4; // default 3
}
```

Substitui os mini-cards manuais do Calendário e do Dashboard 360 (Pulso Operacional). Renderiza cards compactos em grid. Usado para KPIs contextuais de execução (não analíticos).

**Páginas afetadas:** Calendário (3 cards manuais), GestaoEmpresa (4 cards do Pulso Operacional).

---

#### 4. `PageContent` — Container de conteúdo com Card

```tsx
// src/components/layout/PageContent.tsx
interface PageContentProps {
  title?: string;
  children: ReactNode;
}
```

Wrapper `Card > CardHeader > CardContent` padronizado que todas as tabelas usam. Elimina repetição de `<Card><CardHeader><CardTitle>Lista de X</CardTitle></CardHeader><CardContent>`.

**Páginas afetadas:** Clientes, Serviços, Despesas.

---

### Regras de Priorização por Tipo de Tela

| Tipo de Tela | Hierarquia Visual (topo → base) |
|---|---|
| **Hub Analítico** (Dashboard 360, Dash Financeiro) | Alertas → KPIs → Insights IA → Gráficos → Narrativas |
| **Execução com lista** (Clientes, Serviços, Despesas) | Header+CTA → KPIs contextuais (max 3) → Filtros → Tabela+Paginação |
| **Execução comercial** (Orçamentos) | Header+CTA → KPIs (max 2) → Filtros com período → Tabela |
| **Agenda** (Calendário) | Header+CTA → KPIs operacionais (max 3) → Filtros → Tabs de visualização |
| **Configuração** (Cadastros) | Header → Tabs de entidades → Tabela por tab |

**Regra geral:** Páginas de execução nunca têm mais de 3 KPIs contextuais. Gráficos e insights IA ficam exclusivamente nos hubs analíticos.

---

### Refactor das 6 Páginas

Cada página será simplificada usando os novos componentes:

**Clientes.tsx** (~280 → ~200 linhas)
- `PageHeader` + `PageContent` com `FilterBar` dentro

**Servicos.tsx** (~420 → ~300 linhas)
- `PageHeader` + KPIs com `KPICard` existente + `PageContent` com `FilterBar`

**Despesas.tsx** (~416 → ~300 linhas)
- `PageHeader` + KPI único + `PageContent` com `FilterBar`

**ServicosOrcamentos.tsx** (~568 → ~450 linhas)
- `PageHeader` + 2 KPIs + `FilterBar` + Tabela

**Calendario.tsx** (~190 → ~150 linhas)
- `PageHeader` + `ContextualKPIs` + `FilterBar` (dentro de Card) + Tabs

**GestaoEmpresa.tsx** (~307 → ~270 linhas)
- Pulso Operacional usa `ContextualKPIs` em vez de 4 cards manuais

---

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/layout/PageHeader.tsx` |
| Criar | `src/components/layout/FilterBar.tsx` |
| Criar | `src/components/layout/ContextualKPIs.tsx` |
| Criar | `src/components/layout/PageContent.tsx` |
| Editar | `src/pages/Clientes.tsx` |
| Editar | `src/pages/Servicos.tsx` |
| Editar | `src/pages/Despesas.tsx` |
| Editar | `src/pages/ServicosOrcamentos.tsx` |
| Editar | `src/pages/Calendario.tsx` |
| Editar | `src/pages/GestaoEmpresa.tsx` |
| Editar | `src/pages/Cadastros.tsx` |

Nenhuma migração de banco necessária.