
# Plano: Criar RevenueTrendChart.tsx

## Objetivo
Criar um novo componente de gráfico combinado que mostra a evolução da Receita Bruta (barras) e Lucro Líquido (linha) ao longo dos últimos 12 meses, com seletor de ano dinâmico.

## Arquitetura

### 1. Hook de Dados: Atualizar `useChartData.ts`

Adicionar nova função `useRevenueTrendChartData(year)` que retorna:
```typescript
interface RevenueTrendData {
  month: string;
  receitaBruta: number;
  lucroLiquido: number;
  variacaoPercent: number; // (lucroLiquido / receitaBruta) * 100
}
```

A lógica será similar ao `useProfitMarginChartData`, calculando:
- Receita Bruta = soma de `receita_esperada` por mês
- Lucro Líquido = Receita - Impostos - Custos Variáveis - Despesas Fixas

### 2. Componente: `RevenueTrendChart.tsx`

Estrutura do componente:
- Card com título "Evolução Receita e Lucro"
- Seletor de ano (usando `useAvailableYears`)
- `ComposedChart` do Recharts com:
  - `Bar` para Receita Bruta (cor primária com gradiente)
  - `Line` tipo `monotone` para Lucro Líquido (cor verde/dourada)
  - `CartesianGrid`, `XAxis`, `YAxis`, `Legend`
  - `RichTooltip` customizado mostrando ambos valores e variação %

### 3. Integração: `DashboardFinanceiro.tsx`

Inserir o gráfico logo abaixo da seção de KPIs com largura total (`col-span-4` ou seção dedicada).

---

## Detalhes Técnicos

### Hook: `useRevenueTrendChartData`

```typescript
// Buscar dados de fato_orcamento e fato_despesas
// Agrupar por mês
// Calcular:
//   receitaBruta = soma receita_esperada
//   lucroLiquido = receitaBruta - impostos - custosVariaveis - despesasFixas
//   variacaoPercent = (lucroLiquido / receitaBruta) * 100
```

### Componente Visual

| Elemento | Configuração |
|----------|-------------|
| Bar (Receita Bruta) | `fill="hsl(var(--chart-primary))"`, radius superior |
| Line (Lucro Líquido) | `stroke="hsl(var(--chart-positive))"`, strokeWidth=3, dot com r=5 |
| Tooltip | RichTooltip com `showDifference`, `differenceLabel="Margem"` |
| Eixo Y | Formatação `R$ Xk` |
| Eixo X | Meses (Jan, Fev, Mar...) |

### Layout no Dashboard

```text
┌─────────────────────────────────────────────────────────────┐
│  [KPIs - 4 cards em grid]                                   │
├─────────────────────────────────────────────────────────────┤
│  [RevenueTrendChart - LARGURA TOTAL]                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Evolução Receita e Lucro              [Seletor Ano ▼]  ││
│  │                                                         ││
│  │  █ █ █ █ █ █ █ █ █ █ █ █   ← Barras Receita Bruta     ││
│  │  ─────────────────────────  ← Linha Lucro Líquido      ││
│  │                                                         ││
│  │  Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez       ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [Resumo Executivo]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useChartData.ts` | Adicionar `useRevenueTrendChartData` |
| `src/components/charts/RevenueTrendChart.tsx` | Criar componente |
| `src/pages/DashboardFinanceiro.tsx` | Importar e posicionar o gráfico |

## Fluxo de Execução

```text
1. Usuário acessa Dashboard Financeiro
           │
           ▼
2. useRevenueTrendChartData(ano) busca dados
   - fato_orcamento: receita_esperada, impostos
   - fato_despesas: classificação VARIAVEL/FIXA
           │
           ▼
3. Processa dados por mês:
   - receitaBruta = Σ receita_esperada
   - lucroLiquido = receitaBruta - impostos - custos - despesas
   - variacaoPercent = (lucroLiquido / receitaBruta) × 100
           │
           ▼
4. Renderiza ComposedChart com:
   - Barras para Receita Bruta
   - Linha para Lucro Líquido
   - Tooltip mostrando ambos + variação %
           │
           ▼
5. Usuário pode mudar ano via Select
   → Hook recarrega dados automaticamente
```

## Tooltip Customizado

O `RichTooltip` existente já suporta múltiplas séries. Será usado com:
- `format="currency"` para valores em R$
- `showDifference={true}` para calcular e mostrar a diferença
- `differenceLabel="Margem"` para indicar o percentual de lucro

A variação percentual será calculada nos dados e exibida no tooltip como contexto adicional.
