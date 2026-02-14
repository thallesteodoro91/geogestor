

## Filtro de Ano e Mes para o Funil de Vendas

---

### O que muda

Adicionar seletores de **ano** e **mes** no header do card do Funil de Vendas, permitindo filtrar os orcamentos por periodo. Quando nenhum mes e selecionado, mostra o ano inteiro. A query no banco passa a filtrar por `data_orcamento` dentro do periodo escolhido.

---

### Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/hooks/useSalesFunnel.ts` | Aceitar parametros `ano` e `mes`, filtrar query por `data_orcamento` |
| `src/components/charts/SalesFunnelChart.tsx` | Adicionar seletores de ano/mes no header do card |

---

### Detalhes tecnicos

#### 1. Hook `useSalesFunnel.ts`

- Adicionar parametros opcionais `ano?: number` e `mes?: number | null`
- Incluir na `queryKey`: `["sales-funnel", ano, mes]`
- Adicionar filtros na query:
  - Se `ano` e `mes` definidos: filtrar `data_orcamento` entre primeiro e ultimo dia do mes
  - Se so `ano` definido: filtrar `data_orcamento` entre 1/jan e 31/dez do ano
- Usar `useAvailableYears` como referencia para o padrao de filtragem por data

#### 2. Componente `SalesFunnelChart.tsx`

- Adicionar estado local `selectedYear` (default: ano atual) e `selectedMonth` (default: `null` = todos)
- No `CardHeader`, ao lado do titulo, colocar dois `<Select>` compactos:
  - **Ano**: lista de anos com dados (usar `useAvailableYears`)
  - **Mes**: "Todos" + Jan a Dez (1-12), com nomes abreviados
- Passar `selectedYear` e `selectedMonth` para `useSalesFunnel(selectedYear, selectedMonth)`
- Na `CardDescription`, indicar o periodo filtrado (ex: "Mar 2025" ou "2025")

