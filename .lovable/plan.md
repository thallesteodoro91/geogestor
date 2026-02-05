
# Plano: Corrigir Cores dos Tooltips para Corresponder às Barras

## Problema
O tooltip exibe um indicador de cor lateral (`bg-primary`) fixo em roxo, independentemente da cor real da barra/série do gráfico.

## Solução

### 1. Modificar `src/components/charts/RichTooltip.tsx`
Alterar a barra lateral para usar a cor da primeira série do payload:

**Linha 79-83 - Alterar de:**
```tsx
<div 
  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-primary"
  aria-hidden="true"
/>
```

**Para:**
```tsx
<div 
  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
  style={{ backgroundColor: getSeriesColor(payload[0]) }}
  aria-hidden="true"
/>
```

### 2. Modificar `src/components/charts/SalesFunnelChart.tsx`
Atualizar o `CustomTooltip` para incluir um indicador de cor que corresponda à cor da etapa do funil:

**Adicionar indicador colorido ao tooltip:**
```tsx
<div className="flex items-center gap-2 mb-2">
  <span 
    className="w-3 h-3 rounded-full shrink-0"
    style={{ backgroundColor: data.fill }}
  />
  <p className="font-semibold text-foreground">{data.name}</p>
</div>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/charts/RichTooltip.tsx` | Barra lateral dinâmica |
| `src/components/charts/SalesFunnelChart.tsx` | Indicador de cor no tooltip do funil |

---

## Resultado Esperado
- **RichTooltip**: A barra lateral esquerda terá a cor da primeira série (azul para receita, verde para lucro, etc.)
- **SalesFunnelChart**: O tooltip exibirá um círculo colorido ao lado do nome da etapa, com a cor correspondente (azul, teal ou verde)
