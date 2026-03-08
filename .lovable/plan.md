

## Plan: Restore KPICard hover animations and per-icon colors

### What changed and needs to be restored

The KPICard currently has a generic `hover:shadow-md` and all icons use `text-muted-foreground`. The user wants:

1. **Hover glow based on changeType**: Green glow for positive, red glow for negative (using existing `interactive-lift-positive` / `interactive-lift-negative` utility classes from `index.css`)
2. **Individual icon colors**: Each icon should have a color that reflects its meaning (e.g., green for revenue, red for expenses, blue for margin)

### Changes

**File: `src/components/dashboard/KPICard.tsx`**

- Add an optional `iconColor` prop (string for Tailwind class like `"text-emerald-500"`)
- Replace the static `hover:shadow-md` with conditional classes:
  - `changeType === "positive"` → `interactive-lift-positive` (green glow on hover)
  - `changeType === "negative"` → `interactive-lift-negative` (red glow on hover)
  - `changeType === "neutral"` → `interactive-lift` (default purple glow)
- Replace `text-muted-foreground` on the icon with the `iconColor` prop, falling back to `text-muted-foreground`
- Apply matching tinted background to icon container (e.g., `bg-emerald-500/10` for green icons)

**File: `src/pages/Dashboard.tsx`**

- Pass `iconColor` to each KPICard with contextual colors:
  - Receita Total → `"text-indigo-500"` (primary/revenue)
  - Lucro Líquido → `"text-emerald-500"` (positive/profit)
  - Margem Líquida → `"text-cyan-500"` (accent)
  - Total de Despesas → `"text-rose-500"` (negative/expense)
  - Margem Bruta → `"text-violet-500"`
  - Taxa Conversão → `"text-amber-500"`
  - Ticket Médio → `"text-blue-500"`
  - Lucro Bruto → `"text-green-500"`
  - Serviços → `"text-slate-500"`
  - Concluídos → `"text-teal-500"`

