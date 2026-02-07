
# Mover Agregacao de Graficos do Frontend para o Backend

## Analise da Situacao Atual

O `DashboardFinanceiro.tsx` ja usa a RPC `get_financial_dashboard_metrics` para KPIs e dados agregados -- isso ja esta otimizado. O problema real de performance esta no arquivo `src/hooks/useChartData.ts`, que contem 3 hooks que buscam **todas as linhas** de `fato_orcamento` e `fato_despesas` e fazem agregacao mensal no JavaScript:

- `useRevenueChartData` -- usado por `RevenueChart.tsx`
- `useProfitMarginChartData` -- usado por `ProfitMarginChart.tsx`
- `useRevenueTrendChartData` -- usado por `RevenueTrendChart.tsx` (dentro do DashboardFinanceiro)

Cada hook faz 2 queries separadas (orcamentos + despesas), baixa potencialmente milhares de linhas, e agrega com `.forEach()` / `.reduce()` no cliente.

## Plano de Implementacao

### 1. Migration SQL -- Criar RPC `get_monthly_financial_data`

Uma unica funcao RPC que retorna dados mensais agregados, substituindo os 3 hooks com uma fonte de dados unificada.

```sql
CREATE OR REPLACE FUNCTION public.get_monthly_financial_data(p_year integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSON;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());

  SELECT json_agg(row_to_json(monthly))
  INTO v_result
  FROM (
    SELECT
      m.mes,
      COALESCE(orc.receita, 0) AS receita,
      COALESCE(orc.impostos, 0) AS impostos,
      COALESCE(desp.custos_variaveis, 0) AS custos_variaveis,
      COALESCE(desp.despesas_fixas, 0) AS despesas_fixas,
      COALESCE(desp.total_despesas, 0) AS total_despesas
    FROM generate_series(1, 12) AS m(mes)
    LEFT JOIN (
      SELECT
        EXTRACT(MONTH FROM data_orcamento)::int AS mes,
        SUM(receita_esperada) AS receita,
        SUM(CASE WHEN incluir_imposto THEN COALESCE(valor_imposto, 0) ELSE 0 END) AS impostos
      FROM fato_orcamento
      WHERE tenant_id = v_tenant_id
        AND EXTRACT(YEAR FROM data_orcamento) = p_year
      GROUP BY 1
    ) orc ON orc.mes = m.mes
    LEFT JOIN (
      SELECT
        EXTRACT(MONTH FROM d.data_da_despesa)::int AS mes,
        SUM(CASE WHEN t.classificacao = 'VARIAVEL' THEN d.valor_da_despesa ELSE 0 END) AS custos_variaveis,
        SUM(CASE WHEN t.classificacao != 'VARIAVEL' OR t.classificacao IS NULL THEN d.valor_da_despesa ELSE 0 END) AS despesas_fixas,
        SUM(d.valor_da_despesa) AS total_despesas
      FROM fato_despesas d
      LEFT JOIN dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
      WHERE d.tenant_id = v_tenant_id
        AND EXTRACT(YEAR FROM d.data_da_despesa) = p_year
      GROUP BY 1
    ) desp ON desp.mes = m.mes
    ORDER BY m.mes
  ) monthly;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
```

**Por que uma unica RPC em vez de 3:**
- Os 3 hooks buscam exatamente as mesmas tabelas (`fato_orcamento` + `fato_despesas`) para o mesmo ano
- Uma unica chamada retorna todos os campos necessarios (receita, impostos, custos variaveis, despesas fixas)
- O frontend deriva as 3 visualizacoes diferentes a partir dos mesmos dados base

### 2. Frontend -- Refatorar `src/hooks/useChartData.ts`

Substituir as 3 implementacoes que buscam linhas cruas por uma unica query RPC compartilhada:

- Criar um hook interno `useMonthlyFinancialData(year)` que chama `supabase.rpc('get_monthly_financial_data', { p_year })`
- `useRevenueChartData` -- usa os dados para retornar `{ month, receita, despesa }`
- `useProfitMarginChartData` -- calcula margens bruta/liquida a partir dos dados agregados
- `useRevenueTrendChartData` -- calcula receita bruta, lucro liquido e margem %

Cada hook mantem a mesma interface de retorno para nao quebrar os componentes que os consomem (`RevenueChart`, `ProfitMarginChart`, `RevenueTrendChart`).

### 3. Frontend -- Adicionar funcao ao service `src/modules/finance/services/kpi.service.ts`

Adicionar `fetchMonthlyFinancialData(year: number)` que encapsula a chamada RPC.

### Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | Criar RPC `get_monthly_financial_data` |
| `src/modules/finance/services/kpi.service.ts` | Adicionar `fetchMonthlyFinancialData()` |
| `src/hooks/useChartData.ts` | Substituir 3 queries cruas por 1 chamada RPC compartilhada |

### Resultado

- **Antes:** 6 queries ao banco (2 por hook x 3 hooks) baixando todas as linhas, agregacao no JS
- **Depois:** 1 query RPC retornando 12 objetos (um por mes), ~1KB de JSON
- Componentes `RevenueChart`, `ProfitMarginChart`, `RevenueTrendChart` e `DashboardFinanceiro` continuam funcionando sem alteracao
