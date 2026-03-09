
## Análise do Problema

O PDF está cortando páginas porque o gerador atual (`captureReportAsPDF`) captura **todo o relatório como uma única imagem** e depois faz slicing arbitrário a cada 297mm. Isso resulta em:

1. **Corte de seções no meio** — tabelas, gráficos e textos divididos entre páginas
2. **Barras cortadas** — o gráfico semanal aparece parcialmente
3. **Formatação quebrada** — elementos ficam sem contexto visual

### Causa Raiz (linhas 49-62 de pdfReportGenerator.ts)

```typescript
// PROBLEMA: slicing fixo ignora limites de seções
while (heightLeft > 0) {
  position -= pdfHeight;  // Corta a cada 297mm arbitrariamente
  pdf.addPage();
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;
}
```

---

## Solução: Section-Based Capture

Implementar captura **seção por seção** usando `data-pdf-section` no DOM. Cada seção é capturada individualmente e posicionada na página com verificação de espaço disponível.

### Mudanças Técnicas

**1. `src/lib/pdfReportGenerator.ts`** — Reescrever para section-based:
- Buscar elementos com `[data-pdf-section]` no container
- Capturar cada seção via `html2canvas` individualmente
- Verificar se cabe na página atual; se não, criar nova página
- Adicionar margem consistente (15mm) em todas as páginas
- Manter gap de 4mm entre seções

**2. `src/components/relatorio/PrintableReport.tsx`** — Adicionar marcadores:
- Envolver cada seção lógica com `data-pdf-section`
- Seções: Header, Health Status, KPI Band, 12 Meses, Destaques, Sumário, Charts, Top Clientes, Tabelas (cada uma), Insights, Footer

### Fluxo de Captura

```text
┌─────────────────────────────────────────┐
│ Para cada [data-pdf-section]:           │
│  1. html2canvas(section, scale: 2)      │
│  2. Calcular altura em mm               │
│  3. if (não cabe) → pdf.addPage()       │
│  4. pdf.addImage(currentY)              │
│  5. currentY += heightMM + gap          │
└─────────────────────────────────────────┘
```

### Código do Gerador (simplificado)

```typescript
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 15;
const CONTENT_WIDTH_MM = 180; // 210 - 2*15
const CONTENT_HEIGHT_MM = 267; // 297 - 2*15
const SECTION_GAP_MM = 4;

const sections = Array.from(element.querySelectorAll('[data-pdf-section]'));
let currentY = MARGIN_MM;

for (const section of sections) {
  const canvas = await html2canvas(section, { scale: 2, ... });
  const heightMM = (canvas.height / 2) * (CONTENT_WIDTH_MM / (canvas.width / 2));
  
  if (currentY + heightMM > A4_HEIGHT_MM - MARGIN_MM && currentY > MARGIN_MM) {
    pdf.addPage();
    currentY = MARGIN_MM;
  }
  
  pdf.addImage(canvas.toDataURL(), 'PNG', MARGIN_MM, currentY, CONTENT_WIDTH_MM, heightMM);
  currentY += heightMM + SECTION_GAP_MM;
}
```

### Seções a Marcar no PrintableReport

| Seção | Atributo |
|-------|----------|
| Header + Título | `data-pdf-section="header"` |
| Health Status | `data-pdf-section="health"` |
| KPI Band | `data-pdf-section="kpis"` |
| Tendência 12 Meses | `data-pdf-section="trend"` |
| Destaques do Período | `data-pdf-section="highlights"` |
| Sumário Executivo | `data-pdf-section="summary"` |
| Entradas vs Saídas | `data-pdf-section="weekly-chart"` |
| Receita por Categoria | `data-pdf-section="category-chart"` |
| Top Clientes | `data-pdf-section="top-clients"` |
| Novos Clientes (tabela) | `data-pdf-section="new-clients"` |
| Serviços com Custo (tabela) | `data-pdf-section="services"` |
| Orçamentos Pendentes (tabela) | `data-pdf-section="pending"` |
| Plano de Ação | `data-pdf-section="action-plan"` |
| Footer | `data-pdf-section="footer"` |

---

## Arquivos a Editar

1. **`src/lib/pdfReportGenerator.ts`** — Lógica section-based
2. **`src/components/relatorio/PrintableReport.tsx`** — Adicionar `data-pdf-section` em cada seção

## Resultado Esperado

- Páginas com quebras inteligentes (nunca corta seções)
- Margens consistentes de 15mm
- Gráficos e tabelas sempre completos
- Layout profissional multi-página
