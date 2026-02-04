

# Plano: Criar ExpenseTreemap.tsx

## Objetivo
Criar uma visualização hierárquica de custos usando `<Treemap>` do Recharts, com dois níveis de hierarquia (Tipo → Categoria) e cores diferenciadas para custos Fixos (tons de azul) e Variáveis (tons de laranja).

## Estrutura de Dados Hierárquica

```text
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOS TOTAIS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────── FIXOS (Azul) ───────────┐ ┌── VARIÁVEIS ──┐   │
│  │                                    │ │   (Laranja)   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ │ │ ┌──────────┐  │   │
│  │  │Pessoal │ │Administ│ │Tecnol. │ │ │ │Operacion.│  │   │
│  │  │R$ 25k  │ │R$ 15k  │ │R$ 8k   │ │ │ │R$ 18k    │  │   │
│  │  └────────┘ └────────┘ └────────┘ │ │ └──────────┘  │   │
│  │  ┌────────┐ ┌────────┐            │ │ ┌──────────┐  │   │
│  │  │Market. │ │Finance.│            │ │ │Viagens   │  │   │
│  │  │R$ 5k   │ │R$ 3k   │            │ │ │R$ 4k     │  │   │
│  │  └────────┘ └────────┘            │ │ └──────────┘  │   │
│  └────────────────────────────────────┘ └──────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Arquitetura

### 1. Atualizar RPC: `get_financial_dashboard_metrics`

Modificar `custos_por_categoria` para incluir classificação:

```sql
-- ANTES:
'custos_por_categoria', COALESCE((
  SELECT json_agg(row_to_json(cpc))
  FROM (
    SELECT 
      COALESCE(t.categoria, 'Sem categoria') AS name,
      SUM(d.valor_da_despesa) AS value
    FROM fato_despesas d
    LEFT JOIN dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
    ...
  ) cpc
), '[]'::json)

-- DEPOIS:
'custos_por_categoria', COALESCE((
  SELECT json_agg(row_to_json(cpc))
  FROM (
    SELECT 
      COALESCE(t.categoria, 'Sem categoria') AS name,
      SUM(d.valor_da_despesa) AS value,
      COALESCE(t.classificacao, 'FIXA') AS tipo  -- NOVO
    FROM fato_despesas d
    LEFT JOIN dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
    ...
    GROUP BY t.categoria, t.classificacao  -- Alterado
    ...
  ) cpc
), '[]'::json)
```

### 2. Atualizar Hook: `useDashboardMetrics.ts`

```typescript
// ANTES:
custos_por_categoria: { name: string; value: number }[];

// DEPOIS:
custos_por_categoria: { 
  name: string; 
  value: number; 
  tipo: 'FIXA' | 'VARIAVEL';  // NOVO
}[];
```

### 3. Novo Componente: `src/components/charts/ExpenseTreemap.tsx`

**Estrutura do componente:**
- Card com título "Custos por Categoria"
- `<Treemap>` do Recharts com dados hierárquicos
- Tooltip customizado mostrando: Categoria, Valor, Tipo e % do total
- Legenda: "Custos Fixos" (azul) e "Custos Variáveis" (laranja)

**Cores por tipo:**
```typescript
const FIXED_COLORS = [
  "hsl(217, 91%, 60%)",  // blue-500
  "hsl(217, 91%, 50%)",  // blue-600
  "hsl(217, 91%, 40%)",  // blue-700
  "hsl(217, 91%, 70%)",  // blue-400
];

const VARIABLE_COLORS = [
  "hsl(25, 95%, 53%)",   // orange-500
  "hsl(25, 95%, 43%)",   // orange-600
  "hsl(25, 95%, 63%)",   // orange-400
  "hsl(33, 95%, 53%)",   // amber-500
];
```

**Lógica de ocultação de texto:**
```typescript
// Ocultar texto se retângulo for pequeno demais
const showText = width > 60 && height > 40;
const showValue = width > 80 && height > 50;
```

**Transformação de dados:**
```typescript
// Entrada: [{ name: "Pessoal", value: 25000, tipo: "FIXA" }, ...]
// Saída para Treemap: estrutura plana com cores por tipo
const treemapData = data.map((item, index) => ({
  name: item.name,
  size: item.value,
  fill: item.tipo === 'FIXA' 
    ? FIXED_COLORS[index % FIXED_COLORS.length]
    : VARIABLE_COLORS[index % VARIABLE_COLORS.length],
  tipo: item.tipo,
  percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0",
}));
```

### 4. Integração: `DashboardFinanceiro.tsx`

O componente será adicionado como um novo Card na seção de gráficos, possivelmente substituindo ou complementando uma visualização existente.

**Import:**
```typescript
import { ExpenseTreemap } from "@/components/charts/ExpenseTreemap";
```

**Uso:**
```typescript
<ExpenseTreemap 
  data={metrics?.custos_por_categoria || []} 
  isLoading={isLoading} 
/>
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/` | Atualizar RPC para incluir `tipo` |
| `src/hooks/useDashboardMetrics.ts` | Expandir tipo de `custos_por_categoria` |
| `src/components/charts/ExpenseTreemap.tsx` | **Criar** componente |
| `src/pages/DashboardFinanceiro.tsx` | Adicionar ExpenseTreemap na grid |

---

## Detalhes do Componente ExpenseTreemap

### Props Interface
```typescript
interface ExpenseCategory {
  name: string;
  value: number;
  tipo: 'FIXA' | 'VARIAVEL';
}

interface ExpenseTreemapProps {
  data: ExpenseCategory[];
  isLoading?: boolean;
}
```

### Tooltip Customizado
```text
┌────────────────────────────────────┐
│  ■ Pessoal                         │
├────────────────────────────────────┤
│  Valor:     R$ 25.000,00           │
│  Tipo:      Custo Fixo             │
│  Proporção: 35.2%                  │
└────────────────────────────────────┘
```

### CustomTreemapContent
```typescript
const CustomTreemapContent = (props) => {
  const { x, y, width, height, name, fill, tipo, size } = props;
  
  // Ocultar texto em retângulos pequenos
  const showName = width > 60 && height > 40;
  const showValue = width > 80 && height > 50;
  
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />
      {showName && (
        <text x={x + width/2} y={y + height/2 - 8} textAnchor="middle" fill="white">
          {name}
        </text>
      )}
      {showValue && (
        <text x={x + width/2} y={y + height/2 + 10} textAnchor="middle" fill="white">
          R$ {formatValue(size)}
        </text>
      )}
    </g>
  );
};
```

### Legenda
```typescript
const legend = [
  { label: "Custos Fixos", color: "hsl(217, 91%, 60%)" },
  { label: "Custos Variáveis", color: "hsl(25, 95%, 53%)" },
];
```

---

## Fluxo de Execução

```text
1. Dashboard carrega → useDashboardMetrics()
           │
           ▼
2. RPC retorna custos_por_categoria com tipo:
   [{ name: "Pessoal", value: 25000, tipo: "FIXA" }, 
    { name: "Operacional", value: 18000, tipo: "VARIAVEL" }, ...]
           │
           ▼
3. ExpenseTreemap recebe dados e processa:
   a) Calcula total para percentuais
   b) Atribui cores baseado no tipo
   c) Formata dados para Recharts Treemap
           │
           ▼
4. Renderizar Treemap:
   - Retângulos proporcionais ao valor
   - Cores: Fixo = Azul, Variável = Laranja
   - Texto visível apenas em áreas grandes
           │
           ▼
5. Tooltip mostra detalhes ao hover
```

---

## Comparação Visual

```text
ANTES (Conceitual - não existia no Dashboard)
┌───────────────────────────────┐
│  Custos por Categoria         │
│  (Não implementado)           │
└───────────────────────────────┘

DEPOIS
┌───────────────────────────────────────────────────────────┐
│  Custos por Categoria                                     │
│  Hierarquia: Fixos vs Variáveis por categoria             │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌───────────────────────────┬───────────────────────┐   │
│  │       Pessoal             │    Operacional        │   │
│  │       R$ 25.000           │    R$ 18.000          │   │
│  │       (Fixo - Azul)       │    (Variável - Laran) │   │
│  ├──────────────┬────────────┼───────────────────────┤   │
│  │  Administrat │  Tecnol.   │     Viagens           │   │
│  │  R$ 15.000   │  R$ 8.000  │     R$ 4.000          │   │
│  └──────────────┴────────────┴───────────────────────┘   │
│                                                           │
│  ● Custos Fixos    ● Custos Variáveis                    │
└───────────────────────────────────────────────────────────┘
```

---

## Benefícios

1. **Hierarquia Visual**: Mostra claramente a proporção de cada categoria
2. **Distinção Tipo**: Cores diferentes facilitam identificar custos fixos vs variáveis
3. **Clean Design**: Texto oculto em áreas pequenas evita poluição visual
4. **Interatividade**: Tooltip rico com detalhes completos
5. **Consistência**: Segue padrões de componentes existentes (ServiceEfficiencyMatrix)

