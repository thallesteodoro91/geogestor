

## Plan: Improve PDF Export Based on "Storytelling com Dados" Principles

### Reference: Key Principles from the Book (Cole Nussbaumer Knaflic)

1. **Remove clutter** — eliminate visual noise, reduce cognitive load
2. **Focus attention** — use preattentive attributes (color, size, bold) strategically
3. **Tell a story** — narrative arc with context → what → so what → now what
4. **Choose the right visual** — simpler is better; avoid pie charts when possible
5. **Think like a designer** — white space, alignment, visual hierarchy

### Current Issues Identified

- **Pie/Donut chart** for categories violates the book's recommendation (hard to compare slices); a horizontal bar chart is more effective
- **Bar chart** lacks annotations — the book emphasizes labeling data directly instead of relying on axes
- **Tables** don't highlight the key insight (e.g., negative margins aren't visually prominent enough)
- **No narrative flow** — sections are just placed sequentially without a "so what?" connecting thread
- **KPI band** could benefit from sparkline context or trend indicators beyond just % variation
- **Color usage** is mostly monochromatic which is good, but misses strategic use of a single accent color to draw attention to what matters
- **Footer insights** are buried — the "Próximos Passos" should be more prominent as the actionable takeaway

### Proposed Improvements (File: `src/components/relatorio/PrintableReport.tsx`)

**1. Replace Donut Chart with Horizontal Bar Chart**
- Replace `PieChart` with a simple horizontal `BarChart` for "Receita por Tipo de Serviço"
- Direct data labels on bars (no legend needed) — reduces clutter per the book
- Sorted descending by value for easy scanning

**2. Add Direct Data Labels to Weekly Bar Chart**
- Add value labels on top of bars instead of requiring tooltip/axis reading
- Remove Y-axis grid lines (reduce clutter)
- Keep only essential axis markings

**3. Enhance Table Visual Hierarchy**
- Add conditional row highlighting for negative margins (subtle red background)
- Bold the most important column (margin) to direct attention
- Add a small summary row at the bottom of cost table (total/average)

**4. Strengthen Narrative Structure**
- Add a "Destaques do Período" callout box between KPIs and charts with 2-3 bullet points summarizing the key story (e.g., "Faturamento cresceu 15%, mas despesas cresceram 20%")
- This bridges context → data → insight per the book's story arc

**5. Promote "Insights do Gestor" to a Dedicated Section**
- Move from footer to a prominent bordered section before the footer
- Style as numbered action items with priority indicators
- This is the "now what?" — the most actionable part of the report

**6. Add Strategic Color Accents**
- Use a single accent color (the existing SkyGeo blue) for positive highlights
- Use red ONLY for items needing attention (negative margins, losses)
- Remove unnecessary color from non-critical elements

**7. Improve White Space and Typography**
- Increase section spacing from 28px to 36px
- Add a brief one-line context sentence below each SectionTitle explaining what the reader should look for
- Slightly larger font for KPI values (22px → 24px) for better scanability

### Files Changed

- `src/components/relatorio/PrintableReport.tsx` — All 7 improvements above

### No Database Changes Required

