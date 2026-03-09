

## Plano: Corrigir símbolo na data do PDF + Revisão UI/UX do relatório impresso

### 1. Corrigir símbolo sobre a data (PrintableReport.tsx, linha 161)

**Causa raiz:** O `textTransform: "capitalize"` aplicado ao `periodoLabel` (ex: "março de 2026") pode gerar artefatos visuais em fontes com fallback durante a renderização de impressão. A solução é remover o `textTransform` e capitalizar manualmente a primeira letra no código JS.

**Alteração em `PrintableReport.tsx` (linhas 157-164):**
```tsx
// Capitalizar manualmente a primeira letra do periodoLabel
const capitalizedPeriodo = periodoLabel.charAt(0).toUpperCase() + periodoLabel.slice(1);

// Na tag <p>, remover textTransform: "capitalize"
<p style={{ fontSize: "13px", color: SKYGEO_BLUE, fontWeight: 600, margin: 0 }}>
  {capitalizedPeriodo}
</p>
```

Isso elimina qualquer artefato de renderização do CSS `textTransform`.

---

### 2. Revisão UI/UX — Melhorias de boas práticas

Após análise do componente `PrintableReport`, as seguintes melhorias são recomendadas:

#### 2a. Espaçamento e hierarquia visual
- **KPI Band (linha 182):** Padding interno de `22px` está adequado; sem alteração necessária.
- **Seções:** O `marginBottom: "36px"` entre seções é consistente e adequado para A4.

#### 2b. Tamanhos de fonte — padronização
Os tamanhos atuais seguem boas práticas para PDF A4:
- Título principal: 28px (bom)
- Subtítulo do relatório: 16px → **Aumentar para 18px** para melhor hierarquia visual com o nome da empresa
- Período: 13px (adequado)
- Texto corpo: 11-12px (bom para impressão)
- Labels/captions: 9-10px (adequado)

**Alteração (linha 158):** `fontSize: "16px"` → `fontSize: "18px"`

#### 2c. Tabelas — espaçamento interno
O `PrintTable` usa `padding: "7px 10px"` nas células (linha 583). Para melhor legibilidade em impressão:
- **Aumentar para `padding: "8px 12px"`** nas células de dados
- **Aumentar para `padding: "10px 12px"`** no header

#### 2d. Paginação — não se aplica
A paginação do componente `RelatorioPaginatedTable` (tela) é corretamente ocultada na impressão via `print:hidden`. O `PrintableReport` renderiza todos os dados sem paginação, o que é o comportamento correto para PDF — todas as linhas devem ser visíveis.

#### 2e. Footer — espaçamento
O footer (linha 451) tem `marginTop: "40px"`. Adicionar `paddingBottom: "8px"` para respiração inferior.

---

### Resumo das alterações

**Arquivo:** `src/components/relatorio/PrintableReport.tsx`
1. Capitalizar `periodoLabel` manualmente em JS (remover `textTransform: "capitalize"`)
2. Título "Relatório de Gestão Financeira": 16px → 18px
3. Células da tabela: padding 7px 10px → 8px 12px; header 8px 10px → 10px 12px
4. Footer: adicionar `paddingBottom: "8px"`

