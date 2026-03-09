

## Sugestões de Melhoria — Relatório Executivo

Após análise completa dos componentes `PrintableReport.tsx` (616 linhas) e `RelatorioExecutivo.tsx` (427 linhas), segue uma lista priorizada de melhorias divididas em categorias:

---

### 1. PDF: Mini Sparkline de Tendência (12 meses)

Adicionar um pequeno gráfico de linhas (sparkline) na seção de KPIs do PDF mostrando a evolução do faturamento nos últimos 12 meses. Isso dá contexto temporal ao gestor sem ocupar muito espaço.

**Onde:** `PrintableReport.tsx`, após a KPI Band (linha 188)
**Como:** Receber dados históricos (12 meses) como nova prop e renderizar um `<ResponsiveContainer>` com `<LineChart>` minimalista (sem eixos, apenas a linha + área).

---

### 2. PDF: Marca d'água "RASCUNHO" condicional

Quando os dados do período ainda estão incompletos (ex: mês corrente), exibir uma marca d'água diagonal "RASCUNHO" no PDF. Isso evita que relatórios parciais sejam interpretados como finais.

**Onde:** `PrintableReport.tsx`, wrapper principal
**Como:** Prop `isDraft` + `::before` com `position: absolute`, `transform: rotate(-30deg)`, texto em cinza claro com `opacity: 0.08`.

---

### 3. Tela: Comparativo lado a lado (Mês Atual vs Anterior)

Na tela (não PDF), adicionar um toggle "Comparar com mês anterior" que exibe os KPIs lado a lado com setas de variação, em vez de apenas o texto "📈 Variação...". Isso melhora a legibilidade.

**Onde:** `RelatorioExecutivo.tsx`, seção de KPIs (linhas 173-194)
**Como:** Adicionar estado `showComparison` + renderizar KPIs em grid 2 colunas com valores atuais e anteriores.

---

### 4. PDF: Índice / Sumário no Topo

Para relatórios de mais de 2 páginas, adicionar um mini-sumário logo após o header com links âncora internos:
- 1. Sumário Executivo
- 2. Entradas vs Saídas
- 3. Receita por Categoria
- 4. Tabelas Detalhadas
- 5. Plano de Ação

**Onde:** `PrintableReport.tsx`, após o título (linha 164)

---

### 5. Tela + PDF: Top 3 Clientes por Faturamento

Adicionar uma seção mostrando os 3 maiores clientes por valor faturado no período, com percentual do total. Isso é informação de alto valor para gestores.

**Onde:** Nova prop `topClientes` no `PrintableReport`, nova query no `useRelatorioData`
**Como:** Query agrupando `servicos` por cliente, ordenando por soma de valor, limitando a 3.

---

### 6. PDF: Exportar como PDF real (não print do navegador)

Atualmente a exportação depende de `window.print()`, que varia entre navegadores. Migrar para geração de PDF real usando a lib `pdf-lib` (já instalada) ou `html2canvas` + `jsPDF` para resultado consistente.

**Onde:** Novo botão "Baixar PDF" ao lado do "Exportar PDF"
**Impacto:** Resultado idêntico em todos os navegadores, sem depender de configurações de impressão do usuário.

---

### 7. Tela: Estado vazio mais elaborado

Quando não há dados no período selecionado, mostrar um empty state visual com ilustração e sugestão de ação (ex: "Cadastre serviços e despesas para visualizar o relatório").

**Onde:** `RelatorioExecutivo.tsx`, antes da renderização dos KPIs

---

### Prioridade sugerida

| # | Melhoria | Impacto | Esforço |
|---|----------|---------|---------|
| 5 | Top 3 Clientes por Faturamento | Alto | Médio |
| 3 | Comparativo lado a lado | Alto | Baixo |
| 2 | Marca d'água RASCUNHO | Médio | Baixo |
| 4 | Índice/Sumário no PDF | Médio | Baixo |
| 1 | Sparkline 12 meses | Alto | Médio |
| 7 | Empty state elaborado | Baixo | Baixo |
| 6 | PDF real (pdf-lib) | Alto | Alto |

Escolha qual(is) deseja implementar.

