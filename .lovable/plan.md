

# Plano: Refinamento da Paleta de Cores dos Gráficos

## Objetivo

Atualizar a paleta de cores dos gráficos para tons mais sofisticados e modernos, seguindo as especificações:

| Função Semântica | Cor Atual | Nova Cor |
|------------------|-----------|----------|
| Positivo/Lucro | `hsl(142, 76%, 36%)` (Verde padrão) | **Emerald-500** `hsl(160, 84%, 39%)` |
| Negativo/Despesa | `hsl(0, 84%, 60%)` (Vermelho puro) | **Rose-500** `hsl(350, 89%, 60%)` |
| Primário/Receita | `hsl(262, 83%, 58%)` (Roxo) | **Indigo-500** `hsl(239, 84%, 67%)` |

## Conversão das Cores para HSL

| Cor Tailwind | Hex | HSL |
|--------------|-----|-----|
| Emerald-500 | #10b981 | `160 84% 39%` |
| Rose-500 | #f43f5e | `350 89% 60%` |
| Indigo-500 | #6366f1 | `239 84% 67%` |

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/index.css` | Atualizar variáveis CSS semânticas (--chart-positive, --chart-negative, --chart-primary) e shadows |
| `src/components/charts/RevenueChart.tsx` | Atualizar cores hardcoded nos gradientes e linhas |
| `src/components/charts/ProfitMarginChart.tsx` | Atualizar cores hardcoded nas linhas |
| `src/components/charts/WaterfallChart.tsx` | Atualizar cores hardcoded nas células |
| `src/pages/DashboardFinanceiro.tsx` | Atualizar cores da paleta no gráfico de Lucro por Cliente |
| `src/pages/Despesas.tsx` | Atualizar paleta TREEMAP_COLORS |
| `src/pages/Operacional.tsx` | Atualizar cores hardcoded no gráfico de barras |

## Detalhes das Alterações

### 1. src/index.css

**Light Mode (linhas 53-59):**
```css
/* Semantic Chart Tokens - Refined Palette */
--chart-primary: 239 84% 67%;      /* Indigo-500 */
--chart-secondary: 189 94% 43%;    /* Cyan (mantém) */
--chart-positive: 160 84% 39%;     /* Emerald-500 */
--chart-negative: 350 89% 60%;     /* Rose-500 */
--chart-warning: 38 92% 50%;       /* Mantém */
--chart-neutral: 215 16% 47%;      /* Mantém */
```

**Dark Mode (linhas 145-151):**
```css
/* Semantic Chart Tokens - Refined Palette */
--chart-primary: 239 84% 72%;      /* Indigo-400 (mais claro) */
--chart-secondary: 189 94% 43%;    /* Cyan (mantém) */
--chart-positive: 160 84% 45%;     /* Emerald-400 */
--chart-negative: 350 89% 65%;     /* Rose-400 */
--chart-warning: 38 92% 50%;       /* Mantém */
--chart-neutral: 0 0% 63.9%;       /* Mantém */
```

**Shadows (linhas 90-91 e 166-167):**
```css
--shadow-glow-positive: 0 0 30px hsl(160 84% 39% / 0.2);
--shadow-glow-negative: 0 0 30px hsl(350 89% 60% / 0.2);
```

### 2. src/components/charts/RevenueChart.tsx

Substituir todas as ocorrências:
- `hsl(142, 76%, 36%)` → `hsl(var(--chart-positive))`
- `hsl(0, 72%, 51%)` → `hsl(var(--chart-negative))`

### 3. src/components/charts/ProfitMarginChart.tsx

Substituir:
- `hsl(142, 76%, 36%)` → `hsl(var(--chart-positive))`

### 4. src/components/charts/WaterfallChart.tsx

Substituir na linha 57:
- `hsl(142, 76%, 56%)` → `hsl(var(--chart-positive))`
- `hsl(0, 72%, 51%)` → `hsl(var(--chart-negative))`
- `hsl(262, 83%, 65%)` → `hsl(var(--chart-primary))`

### 5. src/pages/DashboardFinanceiro.tsx

Atualizar paleta de cores para o gráfico "Lucro por Cliente" usando as variáveis CSS.

### 6. src/pages/Despesas.tsx

Atualizar TREEMAP_COLORS com as novas cores.

### 7. src/pages/Operacional.tsx

Atualizar a cor do lucro:
- `hsl(142, 76%, 36%)` → `hsl(var(--chart-positive))`

## Benefícios

1. **Consistência**: Cores definidas centralmente via variáveis CSS
2. **Manutenibilidade**: Alterações futuras em um único local
3. **Sofisticação visual**: Tons mais modernos e elegantes
4. **Suporte a temas**: Cores adaptadas automaticamente para Light/Dark mode
5. **Acessibilidade**: Emerald e Rose mantêm bom contraste

## Impacto Visual

A mudança será refletida automaticamente em todos os gráficos que já utilizam as variáveis CSS (`--chart-positive`, `--chart-negative`, `--chart-primary`). Gráficos com cores hardcoded serão atualizados para usar as variáveis, garantindo consistência futura.

