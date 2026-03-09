

## Plan: Unify PDF Export with Complete pdf-lib Generator

### What changes

**Remove** the "Exportar PDF" button (`window.print()`) and keep only "Baixar PDF", but enhance the `pdfReportGenerator.ts` to include all missing content from `PrintableReport.tsx`.

### Missing content to add to pdf-lib generator

The current `pdfReportGenerator.ts` is missing these sections compared to `PrintableReport.tsx`:

1. **Dados Semanais (Entradas vs Saidas chart)** — draw as horizontal bar pairs per week
2. **Clientes Novos table** — nome, data_cadastro, telefone, email
3. **Orcamentos Pendentes table** — codigo, cliente, valor, data_faturamento
4. **KPIs extras** — Margem de Lucro, Taxa de Conversao
5. **Historico 12 meses** — mini sparkline as simple bar chart
6. **AI Insights section** — full insight cards (tipo, titulo, descricao, acao)
7. **Multi-page support** — auto page-break when y < threshold, with footer on each page

### Technical approach

**File 1: `src/lib/pdfReportGenerator.ts`** — Major rewrite:
- Expand `ReportData` interface to include `dadosSemanais`, `clientesNovos`, `historico12Meses`, and full `aiInsights` (not just action strings)
- Add helper `ensureSpace(needed)` that creates new page when y is too low, drawing footer on old page
- Add sections in order: Header, TOC, Health Status, KPI Band (5 KPIs), Weekly Chart (bar pairs), Revenue by Category (bar chart), Top Clients, 12-Month Sparkline, Services & Costs Table, New Clients Table, Pending Quotes Table, AI Insights (full), Action Plan
- Draw "charts" as simple geometric shapes (bars, lines) — no images needed
- Footer with page numbering on every page

**File 2: `src/pages/RelatorioExecutivo.tsx`**:
- Remove the "Exportar PDF" `window.print()` button
- Remove `PrintableReport` import and component (no longer needed)
- Update `handleDownloadPDF` to pass the new data fields: `dadosSemanais`, `clientesNovos` (from `data.clientes`), `historico12Meses`, and full `aiInsights`
- Clean up unused imports (`Printer`)

**File 3: `src/components/relatorio/PrintableReport.tsx`** — Can be kept as-is (print CSS still works if user does Ctrl+P) or removed entirely. Will remove the explicit button but keep the component for browser print fallback.

### Section layout in the PDF

```text
PAGE 1:
  Header (SkyGeo + metadata)
  Title + Period
  TOC bar
  Health Status indicator
  KPI Band (5 values: Faturamento, Gasto, Lucro, Margem, Conversao)
  Weekly Entries vs Exits (bar chart)
  Revenue by Category (horizontal bars)

PAGE 2 (auto-break):
  Top Clients ranking
  12-Month Revenue Trend (mini bars)
  Services & Costs table
  New Clients table

PAGE 3 (if needed):
  Pending Quotes table
  AI Insights (title + description)
  Action Plan
  Footer with generation timestamp
```

### Impact
- Users get a single, consistent "Baixar PDF" button
- PDF contains all report data including charts drawn as geometric shapes
- No dependency on browser print dialog

