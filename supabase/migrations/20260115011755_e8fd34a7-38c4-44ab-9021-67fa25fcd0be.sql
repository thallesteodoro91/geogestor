-- RPC para métricas agregadas do Dashboard Financeiro
-- Move processamento pesado (SUM, COUNT, GROUP BY) do cliente para o servidor

CREATE OR REPLACE FUNCTION public.get_financial_dashboard_metrics(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_result JSON;
BEGIN
  -- Get tenant_id from authenticated user
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  -- Default date range: current year if not provided
  v_data_inicio := COALESCE(p_data_inicio, date_trunc('year', CURRENT_DATE)::DATE);
  v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);
  
  -- Build aggregated metrics in a single query
  SELECT json_build_object(
    -- KPIs principais
    'receita_total', COALESCE((
      SELECT SUM(receita_esperada)
      FROM fato_orcamento
      WHERE tenant_id = v_tenant_id
        AND data_orcamento BETWEEN v_data_inicio AND v_data_fim
    ), 0),
    
    'total_impostos', COALESCE((
      SELECT SUM(CASE WHEN incluir_imposto THEN COALESCE(valor_imposto, 0) ELSE 0 END)
      FROM fato_orcamento
      WHERE tenant_id = v_tenant_id
        AND data_orcamento BETWEEN v_data_inicio AND v_data_fim
    ), 0),
    
    'total_despesas', COALESCE((
      SELECT SUM(valor_da_despesa)
      FROM fato_despesas
      WHERE tenant_id = v_tenant_id
        AND data_da_despesa BETWEEN v_data_inicio AND v_data_fim
    ), 0),
    
    'custos_variaveis', COALESCE((
      SELECT SUM(d.valor_da_despesa)
      FROM fato_despesas d
      LEFT JOIN dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
      WHERE d.tenant_id = v_tenant_id
        AND d.data_da_despesa BETWEEN v_data_inicio AND v_data_fim
        AND t.classificacao = 'VARIAVEL'
    ), 0),
    
    'despesas_fixas', COALESCE((
      SELECT SUM(d.valor_da_despesa)
      FROM fato_despesas d
      LEFT JOIN dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
      WHERE d.tenant_id = v_tenant_id
        AND d.data_da_despesa BETWEEN v_data_inicio AND v_data_fim
        AND (t.classificacao = 'FIXA' OR t.classificacao IS NULL)
    ), 0),
    
    'total_orcamentos', COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM fato_orcamento
      WHERE tenant_id = v_tenant_id
        AND data_orcamento BETWEEN v_data_inicio AND v_data_fim
    ), 0),
    
    -- Lucro por Cliente (Top 6 agregado no servidor)
    'lucro_por_cliente', COALESCE((
      SELECT json_agg(row_to_json(lpc))
      FROM (
        SELECT 
          CASE 
            WHEN LENGTH(c.nome) > 15 THEN SUBSTRING(c.nome, 1, 12) || '...'
            ELSE c.nome 
          END AS cliente,
          SUM(o.lucro_esperado) AS lucro
        FROM fato_orcamento o
        JOIN dim_cliente c ON o.id_cliente = c.id_cliente
        WHERE o.tenant_id = v_tenant_id
          AND o.id_cliente IS NOT NULL
          AND o.data_orcamento BETWEEN v_data_inicio AND v_data_fim
        GROUP BY c.nome
        ORDER BY SUM(o.lucro_esperado) DESC
        LIMIT 6
      ) lpc
    ), '[]'::json),
    
    -- Margem por Serviço (Top 6 agregado no servidor)
    'margem_por_servico', COALESCE((
      SELECT json_agg(row_to_json(mps))
      FROM (
        SELECT 
          CASE 
            WHEN LENGTH(s.nome_do_servico) > 18 THEN SUBSTRING(s.nome_do_servico, 1, 15) || '...'
            ELSE s.nome_do_servico 
          END AS servico,
          CASE 
            WHEN SUM(s.receita_servico) > 0 
            THEN ROUND(((SUM(s.receita_servico) - SUM(s.custo_servico)) / SUM(s.receita_servico) * 100)::NUMERIC, 2)
            ELSE 0 
          END AS margem
        FROM fato_servico s
        WHERE s.tenant_id = v_tenant_id
          AND (s.data_do_servico_inicio IS NULL OR s.data_do_servico_inicio <= v_data_fim)
        GROUP BY s.nome_do_servico
        ORDER BY SUM(s.receita_servico) DESC
        LIMIT 6
      ) mps
    ), '[]'::json),
    
    -- Custos por Categoria (agregado no servidor)
    'custos_por_categoria', COALESCE((
      SELECT json_agg(row_to_json(cpc))
      FROM (
        SELECT 
          COALESCE(t.categoria, 'Sem categoria') AS name,
          SUM(d.valor_da_despesa) AS value
        FROM fato_despesas d
        LEFT JOIN dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
        WHERE d.tenant_id = v_tenant_id
          AND d.data_da_despesa BETWEEN v_data_inicio AND v_data_fim
        GROUP BY t.categoria
        ORDER BY SUM(d.valor_da_despesa) DESC
      ) cpc
    ), '[]'::json),
    
    -- Período consultado
    'periodo', json_build_object(
      'data_inicio', v_data_inicio,
      'data_fim', v_data_fim
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.get_financial_dashboard_metrics IS 
'RPC para obter métricas agregadas do Dashboard Financeiro. 
Move processamento de SUM/COUNT/GROUP BY do cliente para o servidor PostgreSQL,
otimizando performance especialmente para grandes volumes de dados.';