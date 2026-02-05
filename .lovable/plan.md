
# Plano: Funil de Vendas no Dashboard Financeiro

## Objetivo
Criar um gráfico de Funil de Vendas que visualize a conversão de orçamentos, desde o total emitido até os aprovados/concluídos, com taxas de conversão entre etapas.

---

## Componente a Criar

### `src/components/charts/SalesFunnelChart.tsx`

Um novo componente que:
- Busca dados da tabela `fato_orcamento` agrupados pela coluna `situacao`
- Exibe 3 etapas do funil:
  - **Topo**: Total de Orçamentos (todos)
  - **Meio**: Em Negociação/Pendentes
  - **Fundo**: Aprovados
- Mostra taxa de conversão (%) entre cada etapa no Tooltip
- Usa gradiente de cores do azul (topo) ao verde (fundo)

---

## Detalhes Técnicos

### Estrutura de Dados
A tabela `fato_orcamento` possui a coluna `situacao` com valores:
- `Pendente` (em negociação)
- `Aprovado` (convertido)
- `Cancelado`

### Lógica do Funil
```text
Total de Orçamentos → Pendentes + Aprovados → Aprovados
       100%              Taxa 1                Taxa 2
```

### Componente Recharts
Utilizará `FunnelChart` e `Funnel` do Recharts com:
- `LabelList` para exibir valores
- `Tooltip` customizado mostrando:
  - Quantidade da etapa
  - Percentual em relação ao total
  - Taxa de conversão para próxima etapa
- Células com cores em gradiente (azul → verde)

### Cores do Gradiente
- Topo: `hsl(217, 91%, 60%)` (azul)
- Meio: `hsl(173, 80%, 45%)` (teal)
- Fundo: `hsl(142, 76%, 36%)` (verde)

### Hook de Dados
Criará um hook `useSalesFunnel` que:
1. Busca todos os registros de `fato_orcamento` agrupados por `situacao`
2. Calcula contagens: Total, Pendentes, Aprovados
3. Calcula taxas de conversão entre etapas

---

## Integração no Dashboard

### Modificação em `src/pages/DashboardFinanceiro.tsx`
O espaço vazio na seção "Segunda Linha" (grid lg:grid-cols-2) será preenchido com o novo componente:

```text
┌─────────────────────┐  ┌─────────────────────┐
│ Lucro por Cliente   │  │ Funil de Vendas     │  ← NOVO
│   (já existe)       │  │   (será adicionado) │
└─────────────────────┘  └─────────────────────┘
```

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/charts/SalesFunnelChart.tsx` | Criar |
| `src/hooks/useSalesFunnel.ts` | Criar |
| `src/pages/DashboardFinanceiro.tsx` | Modificar |

---

## Tooltip Customizado

Exibirá para cada etapa:
- **Nome da etapa**
- **Quantidade**: Número absoluto de orçamentos
- **% do Total**: Percentual em relação ao total de orçamentos
- **Taxa de Conversão**: Percentual que avançou para a próxima etapa (quando aplicável)

---

## Estilos e Consistência

- Seguirá o padrão visual dos outros gráficos do dashboard
- Usará `Card` com classe `interactive-lift`
- Suportará o modo `density` (compact/normal) do contexto de configurações
- Incluirá estado de loading e tratamento para dados vazios
