

## Objetivo
Substituir o efeito da "caixa cinza" no gráfico "Entradas vs Saídas" por uma linha tracejada vertical, padronizando o visual com os outros gráficos da aplicação.

## Análise Técnica

**Problema Identificado:**
- Linha 224 de `RelatorioExecutivo.tsx`: `cursor={false}` remove completamente o cursor
- Sem cursor, não há feedback visual ao passar o mouse, mas anteriormente havia uma caixa cinza indesejada
- Outros gráficos (RevenueTrendChart, ProfitMarginChart) usam linha tracejada sutil

**Padrão Correto (já usado em outros gráficos):**
```tsx
cursor={{ 
  stroke: 'hsl(var(--muted-foreground))', 
  strokeWidth: 1, 
  strokeDasharray: '3 3' 
}}
```

## Mudança Necessária

**Arquivo:** `src/pages/RelatorioExecutivo.tsx`

**Linha 224 - Atualizar cursor do Tooltip:**
```tsx
// ❌ Antes
<Tooltip 
  content={<RichTooltip format="currency" />}
  cursor={false}
/>

// ✅ Depois
<Tooltip 
  content={<RichTooltip format="currency" />}
  cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
/>
```

## Resultado Esperado
- Linha vertical tracejada aparece ao passar o mouse no gráfico "Entradas vs Saídas"
- Visual consistente com RevenueTrendChart e ProfitMarginChart
- Remove definitivamente a "caixa cinza"
- Mantém feedback visual para o usuário

