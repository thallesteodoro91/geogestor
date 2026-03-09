
## Plano: Migrar para html2canvas + jsPDF

### Problema Identificado

1. **Palavras desaparecendo**: O `pdf-lib` usa fontes WinAnsi que não suportam caracteres acentuados (ç, ã, é, etc.) — texto cortado silenciosamente
2. **Barras do gráfico com mesma cor**: O código atual usa `ACCENT_CYAN` fixo para todas as 12 barras (linha 410)
3. **Formatação inconsistente**: Layouts geométricos manuais são frágeis e difíceis de manter

### Solução: html2canvas + jsPDF

Capturar o DOM do relatório como imagem garante:
- ✅ Todos os caracteres (Unicode, acentos, emojis)
- ✅ Cores/gradientes dos gráficos Recharts exatamente como na tela
- ✅ Layout CSS completo preservado
- ✅ Manutenção simplificada (uma fonte de verdade)

---

### Mudanças Técnicas

**1. Instalar dependências**
```bash
npm install jspdf html2canvas
```

**2. `src/lib/pdfReportGenerator.ts`** — Reescrever completamente:
- Exportar função `captureReportAsPDF(elementRef, filename)` que:
  - Usa `html2canvas` com `scale: 2` para alta qualidade
  - Calcula dimensões A4 (210mm × 297mm)
  - Divide em múltiplas páginas automaticamente se conteúdo exceder altura
  - Adiciona cabeçalho/rodapé em cada página (logo SkyGeo, paginação)

**3. `src/pages/RelatorioExecutivo.tsx`**:
- Criar ref para o container do relatório: `const reportRef = useRef<HTMLDivElement>(null)`
- Mover conteúdo do relatório (KPIs, gráficos, tabelas, insights) para um componente printável `<PrintableReportContent>`
- `handleDownloadPDF` chama a nova função passando o ref
- Aplicar cores degradê ao gráfico de 12 meses via gradiente CSS ou cores progressivas no Recharts

**4. Cores do gráfico 12 meses** — Adicionar gradiente:
```tsx
// No BarChart, usar cores progressivas por mês
const GRADIENT_COLORS = [
  "#0891b2", "#06b6d4", "#22d3ee", "#67e8f9", // Q1-Q2 tons cyan
  "#059669", "#10b981", "#34d399", "#6ee7b7", // Q2-Q3 tons green
  "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"  // Q3-Q4 tons purple
];
```

**5. Remover código antigo**:
- Deletar funções `pdf-lib` (drawText, drawRect, generateReportPDF, etc.)
- Manter apenas a nova abordagem html2canvas

---

### Estrutura do PDF Final

```text
PÁGINA 1:
├── Header (SkyGeo + metadados)
├── KPIs (5 cards com variação MoM)
├── Top 3 Clientes
├── Gráfico Semanal (cores verde/vermelho)
└── Gráfico Pizza Categorias

PÁGINA 2 (se necessário):
├── Tendência 12 meses (barras com gradiente)
├── Tabela Serviços & Custos
├── Tabela Novos Clientes
└── Orçamentos Pendentes

PÁGINA 3 (se necessário):
├── Insights IA (cards completos)
└── Rodapé com timestamp
```

---

### Benefícios

| Aspecto | Antes (pdf-lib) | Depois (html2canvas) |
|---------|----------------|---------------------|
| Acentos | ❌ Falha silenciosa | ✅ Preservados |
| Gráficos | Desenho geométrico | ✅ Recharts visual |
| Manutenção | 580+ linhas | ~50 linhas |
| Gradientes | ❌ Cor única | ✅ CSS/Recharts |
| Fidelidade | Aproximada | ✅ Pixel-perfect |

