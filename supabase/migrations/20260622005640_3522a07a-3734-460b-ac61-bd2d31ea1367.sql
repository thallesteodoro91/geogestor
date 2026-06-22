
-- 1) Atualiza RPC get_financial_dashboard_metrics: realizado vs pipeline
CREATE OR REPLACE FUNCTION public.get_financial_dashboard_metrics(
  p_data_inicio date DEFAULT NULL::date,
  p_data_fim date DEFAULT NULL::date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_result JSON;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  v_data_inicio := COALESCE(p_data_inicio, date_trunc('year', CURRENT_DATE)::DATE);
  v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);

  SELECT json_build_object(
    -- Receita REALIZADA (não pipeline): prioriza valor_faturado/receita_realizada,
    -- e só considera receita_esperada quando orcamento_convertido = true.
    'receita_total', COALESCE((
      SELECT SUM(COALESCE(valor_faturado, receita_realizada,
                          CASE WHEN orcamento_convertido THEN receita_esperada ELSE 0 END))
      FROM fato_orcamento
      WHERE tenant_id = v_tenant_id
        AND data_orcamento BETWEEN v_data_inicio AND v_data_fim
    ), 0),

    -- Pipeline = orçamentos abertos ainda não convertidos
    'receita_pipeline', COALESCE((
      SELECT SUM(receita_esperada)
      FROM fato_orcamento
      WHERE tenant_id = v_tenant_id
        AND data_orcamento BETWEEN v_data_inicio AND v_data_fim
        AND COALESCE(orcamento_convertido, false) = false
    ), 0),

    'total_impostos', COALESCE((
      SELECT SUM(CASE WHEN incluir_imposto THEN COALESCE(valor_imposto, 0) ELSE 0 END)
      FROM fato_orcamento
      WHERE tenant_id = v_tenant_id
        AND data_orcamento BETWEEN v_data_inicio AND v_data_fim
        AND (orcamento_convertido = true OR valor_faturado IS NOT NULL OR receita_realizada IS NOT NULL)
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

    -- Lucro por Cliente: usa receita realizada - custos reais agregados
    'lucro_por_cliente', COALESCE((
      SELECT json_agg(row_to_json(lpc))
      FROM (
        SELECT
          CASE WHEN LENGTH(c.nome) > 15 THEN SUBSTRING(c.nome, 1, 12) || '...' ELSE c.nome END AS cliente,
          (
            COALESCE(SUM(COALESCE(o.valor_faturado, o.receita_realizada,
                                  CASE WHEN o.orcamento_convertido THEN o.receita_esperada ELSE 0 END)), 0)
            - COALESCE((
                SELECT SUM(s.custo_servico)
                FROM fato_servico s
                WHERE s.tenant_id = v_tenant_id
                  AND s.id_cliente = c.id_cliente
                  AND (s.data_do_servico_inicio IS NULL OR s.data_do_servico_inicio BETWEEN v_data_inicio AND v_data_fim)
              ), 0)
          ) AS lucro
        FROM fato_orcamento o
        JOIN dim_cliente c ON o.id_cliente = c.id_cliente
        WHERE o.tenant_id = v_tenant_id
          AND o.id_cliente IS NOT NULL
          AND o.data_orcamento BETWEEN v_data_inicio AND v_data_fim
        GROUP BY c.id_cliente, c.nome
        ORDER BY 2 DESC
        LIMIT 6
      ) lpc
    ), '[]'::json),

    'margem_por_servico', COALESCE((
      SELECT json_agg(row_to_json(mps))
      FROM (
        SELECT
          CASE WHEN LENGTH(s.nome_do_servico) > 18 THEN SUBSTRING(s.nome_do_servico, 1, 15) || '...' ELSE s.nome_do_servico END AS servico,
          CASE WHEN SUM(s.receita_servico) > 0
            THEN ROUND(((SUM(s.receita_servico) - SUM(COALESCE(s.custo_servico, 0))) / SUM(s.receita_servico) * 100)::NUMERIC, 2)
            ELSE 0 END AS margem,
          COALESCE(SUM(s.receita_servico), 0) AS receita
        FROM fato_servico s
        WHERE s.tenant_id = v_tenant_id
          AND (s.data_do_servico_inicio IS NULL OR s.data_do_servico_inicio <= v_data_fim)
        GROUP BY s.nome_do_servico
        ORDER BY SUM(s.receita_servico) DESC
        LIMIT 8
      ) mps
    ), '[]'::json),

    'custos_por_categoria', COALESCE((
      SELECT json_agg(row_to_json(cpc))
      FROM (
        SELECT
          COALESCE(t.categoria, 'Sem categoria') AS name,
          SUM(d.valor_da_despesa) AS value,
          COALESCE(t.classificacao, 'FIXA') AS tipo
        FROM fato_despesas d
        LEFT JOIN dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
        WHERE d.tenant_id = v_tenant_id
          AND d.data_da_despesa BETWEEN v_data_inicio AND v_data_fim
        GROUP BY t.categoria, t.classificacao
        ORDER BY SUM(d.valor_da_despesa) DESC
      ) cpc
    ), '[]'::json),

    'periodo', json_build_object('data_inicio', v_data_inicio, 'data_fim', v_data_fim)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 2) Enforcement server-side: limites de plano em dim_cliente e dim_propriedade
CREATE OR REPLACE FUNCTION public.enforce_plan_resource_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max integer;
  v_current integer;
  v_resource text;
BEGIN
  -- service_role bypassa (importações administrativas, edge functions)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'dim_cliente' THEN
    v_resource := 'clientes';
    SELECT sp.max_clients INTO v_max
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON sp.id = ts.plan_id
    WHERE ts.tenant_id = NEW.tenant_id
      AND ts.status IN ('active', 'trialing')
    ORDER BY ts.current_period_end DESC NULLS LAST
    LIMIT 1;

    IF v_max IS NULL THEN
      RETURN NEW; -- sem plano ativo: deixa outras regras tratarem
    END IF;

    SELECT COUNT(*) INTO v_current FROM dim_cliente WHERE tenant_id = NEW.tenant_id;
    IF v_current >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded:clientes (atual=%, max=%)', v_current, v_max
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF TG_TABLE_NAME = 'dim_propriedade' THEN
    v_resource := 'propriedades';
    SELECT sp.max_properties INTO v_max
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON sp.id = ts.plan_id
    WHERE ts.tenant_id = NEW.tenant_id
      AND ts.status IN ('active', 'trialing')
    ORDER BY ts.current_period_end DESC NULLS LAST
    LIMIT 1;

    IF v_max IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_current FROM dim_propriedade WHERE tenant_id = NEW.tenant_id;
    IF v_current >= v_max THEN
      RAISE EXCEPTION 'plan_limit_exceeded:propriedades (atual=%, max=%)', v_current, v_max
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_plan_limit_cliente ON public.dim_cliente;
CREATE TRIGGER trg_enforce_plan_limit_cliente
  BEFORE INSERT ON public.dim_cliente
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_resource_limit();

DROP TRIGGER IF EXISTS trg_enforce_plan_limit_propriedade ON public.dim_propriedade;
CREATE TRIGGER trg_enforce_plan_limit_propriedade
  BEFORE INSERT ON public.dim_propriedade
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_resource_limit();
