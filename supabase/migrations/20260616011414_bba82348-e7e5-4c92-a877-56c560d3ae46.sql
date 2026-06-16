
CREATE OR REPLACE FUNCTION public.get_orcamentos_kpis(
  p_search text DEFAULT NULL,
  p_situacao text DEFAULT NULL,
  p_forma text DEFAULT NULL,
  p_status_orc text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_total bigint;
  v_convertidos bigint;
  v_receita numeric;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('total', 0, 'convertidos', 0, 'receita_esperada', 0, 'taxa_conversao', 0);
  END IF;

  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE o.orcamento_convertido = true)::bigint,
    COALESCE(SUM(o.receita_esperada), 0)
  INTO v_total, v_convertidos, v_receita
  FROM fato_orcamento o
  LEFT JOIN dim_cliente c ON c.id_cliente = o.id_cliente
  LEFT JOIN fato_servico s ON s.id_servico = o.id_servico
  WHERE o.tenant_id = v_tenant_id
    AND (p_situacao IS NULL OR p_situacao = 'todos' OR o.situacao_do_pagamento = p_situacao)
    AND (p_forma IS NULL OR p_forma = 'todos' OR o.forma_de_pagamento = p_forma)
    AND (p_status_orc IS NULL OR p_status_orc = 'todos' OR o.situacao = p_status_orc)
    AND (p_data_inicio IS NULL OR o.data_orcamento >= p_data_inicio)
    AND (p_data_fim IS NULL OR o.data_orcamento <= p_data_fim)
    AND (
      p_search IS NULL OR p_search = ''
      OR c.nome ILIKE '%' || p_search || '%'
      OR s.nome_do_servico ILIKE '%' || p_search || '%'
      OR o.codigo_orcamento ILIKE '%' || p_search || '%'
      OR o.situacao_do_pagamento ILIKE '%' || p_search || '%'
      OR o.forma_de_pagamento ILIKE '%' || p_search || '%'
    );

  RETURN json_build_object(
    'total', COALESCE(v_total, 0),
    'convertidos', COALESCE(v_convertidos, 0),
    'receita_esperada', COALESCE(v_receita, 0),
    'taxa_conversao', CASE WHEN v_total > 0 THEN ROUND((v_convertidos::numeric / v_total) * 100, 2) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_orcamentos_kpis(text, text, text, text, date, date) TO authenticated;
