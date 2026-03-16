

## Plano: Adicionar ícone de informação com tooltip nos KPICards

### O que será feito

Adicionar um pequeno ícone de informação (ℹ️) ao lado do título de cada KPI Card. Ao passar o mouse, uma tooltip aparece mostrando:
- **Descrição** do que o KPI representa
- **Fórmula/Cálculo** utilizado para chegar ao valor

A informação de variação (comparação dos últimos meses) será mantida intacta.

### Alterações

**1. `src/components/dashboard/KPICard.tsx`**
- Adicionar props opcionais `description?: string` e `calculation?: string`
- Renderizar um ícone `Info` (lucide) ao lado do título
- Ao hover, exibir tooltip com descrição e fórmula
- Manter todo o comportamento existente de variação inalterado

**2. Páginas que usam KPICard** (adicionar `description` e `calculation` em cada uso):
- `src/pages/Dashboard.tsx` — 10 KPIs (Receita Total, Lucro Líquido, Margem Líquida, Despesas, Margem Bruta, Taxa Conversão, Ticket Médio, Lucro Bruto, Serviços, Concluídos)
- `src/pages/GestaoEmpresa.tsx` — 8 KPIs
- `src/pages/DashboardFinanceiro.tsx` — KPIs financeiros
- `src/pages/Operacional.tsx` — 3 KPIs (Tempo Médio, Produtividade, Ticket Médio)
- `src/pages/Despesas.tsx` — KPIs de despesas
- `src/pages/Clientes.tsx` — KPIs de clientes
- `src/pages/ServicosOrcamentos.tsx` — KPIs de orçamentos

### Exemplo de descrições e cálculos

| KPI | Descrição | Cálculo |
|-----|-----------|---------|
| Receita Total | Soma de toda receita gerada no período | Σ receita de serviços + orçamentos |
| Lucro Líquido | Resultado final após todas as deduções | Receita - Impostos - Custos - Despesas |
| Margem Líquida | Percentual de lucro sobre a receita | (Lucro Líquido / Receita Líquida) × 100 |
| Total Despesas | Soma de todas as despesas operacionais | Σ despesas fixas + variáveis |
| Margem Bruta | Rentabilidade antes das despesas fixas | (Receita - Custos Variáveis) / Receita × 100 |
| Taxa Conversão | Percentual de orçamentos convertidos | (Orçamentos aprovados / Total) × 100 |
| Ticket Médio | Valor médio por serviço | Receita Total / Nº de Serviços |

### Visual

```text
┌─────────────────────────────┐
│ [💰]  Receita Total  [ℹ️]   │
│       R$ 150.000,00         │
│       ▲ +12,3%              │
└─────────────────────────────┘
         ↓ hover no ℹ️
┌─────────────────────────────┐
│ Soma de toda receita gerada │
│ no período selecionado.     │
│                             │
│ Cálculo: Σ receita de       │
│ serviços + orçamentos       │
└─────────────────────────────┘
```

