
## Análise Comparativa: PDF Gerado via `pdf-lib` vs. Relatório Completo (`PrintableReport.tsx`)

### Resumo da Situação

O **PrintableReport.tsx** (antigo `window.print()`) contém um relatório completo seguindo os princípios de *Storytelling com Dados*. O **pdfReportGenerator.ts** atual está **incompleto** — faltam conteúdos e não segue a estrutura narrativa do livro.

---

### Conteúdo Faltante no PDF Gerado

| Seção | PrintableReport | pdfReportGenerator | Status |
|-------|----------------|-------------------|--------|
| **Variações MoM (Faturamento, Despesa, Lucro)** | ✅ Indicadores sob cada KPI | ❌ Apenas texto opcional | **FALTA** |
| **Sparkline 12 meses** com área gradiente | ✅ AreaChart visual | ✅ Barras simples | Parcial |
| **Métricas secundárias** (Margem + Conversão detalhada) | ✅ Linha adicional | ❌ Só na banda KPI | **FALTA** |
| **Destaques do Período** (bullets narrativos) | ✅ Seção dedicada | ❌ Não existe | **FALTA** |
| **Sumário Executivo narrativo** | ✅ Parágrafo + insights cards | ❌ Só lista de insights | **FALTA** |
| **Subtítulos explicativos** em cada seção | ✅ "Identifique padrões..." | ❌ Títulos secos | **FALTA** |
| **Tabela de Serviços enriquecida** | ✅ Margem Contrib. + Summary row + row highlight | ✅ Parcial (sem highlight visual) | Parcial |
| **Alerta de categorização** | ✅ Card amarelo quando dados não categorizados | ❌ Seção omitida silenciosamente | **FALTA** |
| **Top Clientes** em cards visuais | ✅ Cards com troféu e %  | ✅ Lista simples | Parcial |
| **Plano de Ação** com contexto | ✅ Seção estilizada | ✅ Existe como fallback | OK |

---

### Problemas de Storytelling no PDF Atual

Segundo o livro *Storytelling com Dados*:

1. **Cap. 1 — Contexto**: Cada visualização deve responder "E daí?". O PDF atual tem títulos sem subtítulos explicativos que guiem o leitor.

2. **Cap. 3 — Eliminar clutter**: OK no geral, mas faltam elementos de contexto narrativo (Destaques do Período).

3. **Cap. 4 — Direcionar atenção**: As variações MoM (▲ +5.2%) são essenciais para destacar mudanças — **faltam completamente**.

4. **Cap. 7 — Narrativa**: O Sumário Executivo deveria incluir um parágrafo introdutório sintetizando o período, não apenas bullets.

5. **Hierarchy visual**: Os KPIs mostram valores, mas sem indicadores de variação perdem poder de storytelling.

---

### Plano de Correção

**Arquivo**: `src/lib/pdfReportGenerator.ts`

#### 1. Adicionar Variações MoM aos KPIs
- Expandir `ReportData` para incluir `variacaoDespesa`, `variacaoLucro`
- Desenhar indicadores ▲/▼ sob cada valor na banda de KPIs

#### 2. Adicionar seção "Destaques do Período"
- Gerar bullets narrativos automaticamente (crescimento/retração receita, situação despesas, margem, orçamentos pendentes)
- Posicionar após Health Status, antes da banda de KPIs

#### 3. Adicionar Sumário Executivo Narrativo
- Parágrafo de abertura: "No período de X, a empresa registrou..."
- Seguido dos insight cards com título + descrição + ação

#### 4. Adicionar subtítulos descritivos em cada seção
- "Entradas vs Saídas" → + "Compare entradas e saídas semanais para identificar padrões de fluxo de caixa."
- "Receita por Categoria" → + "Identifique quais categorias de serviço geram mais receita."

#### 5. Adicionar alerta de categorização
- Se todas as categorias são "sem categoria", desenhar box amarelo com aviso

#### 6. Enriquecer tabela de Serviços
- Adicionar coluna "Margem Contrib." (receita - custo)
- Adicionar linha de totais/médias
- Highlight visual em linhas com margem negativa

#### 7. Melhorar Top Clientes
- Adicionar indicador visual de ranking (1º, 2º, 3º)
- Incluir percentual do total

#### 8. Atualizar `RelatorioExecutivo.tsx`
- Passar novos campos: `variacaoDespesa`, `variacaoLucro`, `receitaAnterior`, `despesaAnterior`, `lucroAnterior`

---

### Resultado Esperado

PDF gerado com:
- Narrativa estruturada (Destaques → Sumário → Gráficos → Tabelas → Plano de Ação)
- Indicadores MoM em todos os KPIs principais
- Subtítulos que contextualizam cada seção
- Alertas visuais para dados incompletos
- Tabelas com destaque semântico (cores para positivo/negativo)
