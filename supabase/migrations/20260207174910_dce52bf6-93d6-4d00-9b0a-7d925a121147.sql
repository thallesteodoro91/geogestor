
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
