

## Plano: Remover cinza do gráfico + Padronizar tabelas

### 1. Gráfico "Entradas vs Saídas" — Realce colorido suave no hover

**Arquivo:** `src/pages/RelatorioExecutivo.tsx`, linha 224

Substituir o cursor atual por um realce colorido suave, igual ao padrão do Dashboard Financeiro (linha 215 de `DashboardFinanceiro.tsx`):

```tsx
// De:
cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}

// Para:
cursor={{ fill: 'hsl(var(--primary) / 0.08)', radius: 4 }}
```

Isso aplica um preenchimento suave roxo/azul transparente em vez do cinza sólido padrão do Recharts.

### 2. Tabelas — Adicionar wrapper `rounded-lg border` 

As 3 tabelas do relatório (Novos Clientes, Serviços com Maior Custo, Orçamentos Pendentes) estão sem o container com borda arredondada. Outras telas como `AuditLogs.tsx` e `ServicosOrcamentos.tsx` usam `<div className="rounded-lg border">` ou `<div className="rounded-md border">` ao redor da `<Table>`.

**Arquivo:** `src/pages/RelatorioExecutivo.tsx`

Envolver cada `<Table>` com `<div className="rounded-lg border bg-card">`:

- Linha 283 (Novos Clientes)
- Linha 317 (Serviços com Maior Custo)  
- Linha 353 (Orçamentos Pendentes)

Exemplo da mudança:
```tsx
// De:
<Table>
  ...
</Table>

// Para:
<div className="rounded-lg border bg-card">
  <Table>
    ...
  </Table>
</div>
```

### Resultado
- Hover no gráfico mostra realce suave colorido (sem cinza)
- Tabelas com bordas arredondadas, consistentes com o resto da aplicação

