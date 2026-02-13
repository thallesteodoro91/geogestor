

## Revisao do Funil de Vendas - Estetica e Funcao

---

### BUG CRITICO encontrado

O hook `useSalesFunnel.ts` filtra por `situacao === "Pendente"` e `situacao === "Aprovado"`, mas os dados reais no banco possuem os status: **"Recusado"**, **"Em Negociacao"**, **"Aprovado"** e **"Em Analise"**. Nao existe status "Pendente" nos orcamentos. Isso faz o funil mostrar dados incorretos -- a etapa "Em Negociacao" fica subcontada porque so conta registros com status inexistente.

### Mudancas Planejadas

#### 1. Corrigir logica do hook (`useSalesFunnel.ts`)

Reescrever a logica de agrupamento para usar os status reais do banco:

- **Total**: todos os orcamentos
- **Em Analise**: status "Em Analise"
- **Em Negociacao**: status "Em Negociacao"  
- **Aprovados**: status "Aprovado"
- **Recusados**: status "Recusado" (mostrado como informacao complementar, nao como etapa do funil)

O funil tera 4 etapas progressivas com taxas de conversao entre cada uma:
1. Total de Orcamentos (100%)
2. Em Analise (excluindo recusados)
3. Em Negociacao
4. Aprovados

Adicionar tambem os campos `emAnalise`, `emNegociacao` e `recusados` no retorno do hook para uso no tooltip e descricao.

#### 2. Melhorar estetica do componente (`SalesFunnelChart.tsx`)

- Substituir o FunnelChart do Recharts (que renderiza um grafico SVG generico) por uma visualizacao customizada com barras horizontais decrescentes em formato de funil, similar ao `FunnelChart.tsx` existente mas com melhorias:
  - Barras com largura proporcional e cantos arredondados
  - Gradiente de cores por etapa (Indigo -> Azul -> Teal -> Verde)
  - Setas de conversao entre etapas mostrando a taxa (ex: "73% ->")
  - Valores e percentuais exibidos diretamente nas barras (sem depender de tooltip)
  - Animacao suave de entrada (CSS transition)
- Manter o tooltip customizado para detalhes adicionais ao hover
- Adicionar skeleton loading com pulso animado no estado de carregamento
- Adicionar icone e mensagem mais amigavel no estado vazio

#### 3. Remover componente duplicado (`FunnelChart.tsx`)

O arquivo `src/components/charts/FunnelChart.tsx` nao e usado em nenhum lugar (nao aparece em nenhum import no projeto). Sera removido para limpar o codigo.

#### 4. Atualizar `budgetStatus.ts`

Adicionar os status "Em Analise" e "Em Negociacao" ao `BUDGET_SITUATION` para manter consistencia entre constantes e dados reais. Atualmente so tem "Pendente", "Aprovado" e "Cancelado", mas o banco usa valores diferentes.

---

### Arquivos alterados

| Arquivo | Acao |
|---------|------|
| `src/hooks/useSalesFunnel.ts` | Corrigir status, expandir para 4 etapas |
| `src/components/charts/SalesFunnelChart.tsx` | Redesign visual completo |
| `src/components/charts/FunnelChart.tsx` | Remover (nao utilizado) |
| `src/constants/budgetStatus.ts` | Adicionar status faltantes |

