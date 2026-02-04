

# Plano: Criar ServiceEfficiencyMatrix.tsx

## Objetivo
Substituir o gráfico de barras "Margem por Serviço" por um ScatterChart estratégico que posiciona cada tipo de serviço em uma matriz de 4 quadrantes baseada em Receita Total (eixo X) vs Margem de Lucro % (eixo Y).

## Conceito da Matriz de Eficiência

```text
     Margem Alta
         │
    Q2   │   Q1
  "Nicho │ "Estrelas"
   Rico" │ Alta receita
         │ Alta margem
─────────┼─────────── Receita
    Q3   │   Q4
 "Rever" │ "Volume"
  Baixa  │ Alta receita
 ambos   │ Baixa margem
         │
     Margem Baixa
```

**Interpretação dos Quadrantes:**
- **Q1 (Superior Direito)**: Serviços "Estrela" - Alta receita + Alta margem = Prioridade máxima
- **Q2 (Superior Esquerdo)**: Serviços "Nicho" - Baixa receita + Alta margem = Explorar crescimento
- **Q3 (Inferior Esquerdo)**: Serviços "Rever" - Baixa receita + Baixa margem = Avaliar descontinuação
- **Q4 (Inferior Direito)**: Serviços "Volume" - Alta receita + Baixa margem = Otimizar custos

## Arquitetura

### 1. Atualizar Hook: `useDashboardMetrics.ts`

Expandir o tipo para incluir receita junto com margem:

```typescript
// Antes:
margem_por_servico: { servico: string; margem: number }[];

// Depois:
margem_por_servico: { 
  servico: string; 
  margem: number;
  receita: number;  // NOVO
}[];
```

### 2. Atualizar RPC: `get_financial_dashboard_metrics`

Modificar a query de `margem_por_servico` para incluir a receita total:

```sql
SELECT 
  servico,
  margem,
  SUM(s.receita_servico) AS receita  -- NOVO
FROM fato_servico s
...
```

### 3. Novo Componente: `ServiceEfficiencyMatrix.tsx`

Estrutura:
- Card com título "Matriz de Eficiência de Serviços"
- ScatterChart do Recharts com:
  - XAxis: Receita Total (type="number", formatado em R$)
  - YAxis: Margem de Lucro % (type="number", 0-100%)
  - ReferenceLine horizontal no meio do range de margem
  - ReferenceLine vertical no meio do range de receita
  - Scatter com pontos coloridos por quadrante
  - Tooltip customizado mostrando nome, receita e margem

### 4. Integração: `DashboardFinanceiro.tsx`

Substituir o Card de "Margem por Serviço" pelo novo `ServiceEfficiencyMatrix`.

---

## Detalhes Técnicos

### Componente ServiceEfficiencyMatrix

```typescript
interface ServicePoint {
  servico: string;
  receita: number;
  margem: number;
}

// Cores por quadrante
const getQuadrantColor = (receita: number, margem: number, medReceita: number, medMargem: number) => {
  if (receita >= medReceita && margem >= medMargem) return "hsl(var(--chart-positive))";  // Q1 Estrela
  if (receita < medReceita && margem >= medMargem) return "hsl(var(--chart-primary))";    // Q2 Nicho
  if (receita < medReceita && margem < medMargem) return "hsl(var(--chart-negative))";    // Q3 Rever
  return "hsl(var(--chart-warning))";                                                      // Q4 Volume
};
```

### Tooltip Customizado

```text
┌────────────────────────────────┐
│ Georreferenciamento            │
├────────────────────────────────┤
│ Receita: R$ 85.000,00          │
│ Margem:  42.5%                 │
│ Quadrante: Estrela             │
└────────────────────────────────┘
```

### Layout Visual

```text
┌─────────────────────────────────────────────────────────────┐
│  Matriz de Eficiência de Serviços                           │
│  Posicionamento estratégico: Receita vs Rentabilidade       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  100% ─┬────────────────────────────────────────────        │
│        │       ●Desmembr.    │     ●Georref.                │
│   M    │    (Nicho)          │    (Estrela)                 │
│   a 50%├─────────────────────┼──────────────────            │
│   r    │       ●Planta       │     ●Levant.                 │
│   g    │     (Rever)         │    (Volume)                  │
│   e    │                     │                              │
│   m  0%└────────────────────────────────────────────        │
│         R$0        R$50k        R$100k       R$150k         │
│                      Receita Total                          │
│                                                             │
│  ● Estrela  ● Nicho  ● Volume  ● Rever                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/` | Atualizar RPC para incluir receita |
| `src/hooks/useDashboardMetrics.ts` | Expandir tipo do retorno |
| `src/components/charts/ServiceEfficiencyMatrix.tsx` | **Criar** componente |
| `src/pages/DashboardFinanceiro.tsx` | Substituir gráfico de barras |

## Migração SQL

```sql
-- Atualizar função para incluir receita no margem_por_servico
CREATE OR REPLACE FUNCTION get_financial_dashboard_metrics(...)
...
  'margem_por_servico', COALESCE((
    SELECT json_agg(row_to_json(mps))
    FROM (
      SELECT 
        ... AS servico,
        ... AS margem,
        SUM(s.receita_servico) AS receita  -- NOVO
      FROM fato_servico s
      ...
    ) mps
  ), '[]'::json),
...
```

## Fluxo de Execução

```text
1. Dashboard carrega → useDashboardMetrics()
           │
           ▼
2. RPC retorna margem_por_servico com receita
           │
           ▼
3. ServiceEfficiencyMatrix recebe dados:
   [{ servico: "Georref", receita: 85000, margem: 42.5 }, ...]
           │
           ▼
4. Calcular medianas:
   - medReceita = mediana das receitas
   - medMargem = mediana das margens
           │
           ▼
5. Renderizar ScatterChart:
   - Pontos posicionados por (receita, margem)
   - Cores por quadrante
   - ReferenceLines nos pontos médios
           │
           ▼
6. Tooltip mostra detalhes do serviço ao hover
```

## Benefícios Estratégicos

1. **Visão 2D**: Combina duas métricas importantes em uma única visualização
2. **Tomada de Decisão**: Identifica claramente quais serviços priorizar
3. **Ação Imediata**: Quadrantes indicam estratégias específicas (crescer, otimizar, revisar)
4. **Comparação Visual**: Fácil comparar todos os serviços simultaneamente

