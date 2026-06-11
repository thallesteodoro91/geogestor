
DROP FUNCTION IF EXISTS public.calcular_kpis_v2();
DROP VIEW IF EXISTS public.vw_kpis_financeiros CASCADE;

CREATE VIEW public.vw_kpis_financeiros
WITH (security_invoker = true)
AS
WITH tenant_data AS (
  SELECT public.get_user_tenant_id(auth.uid()) AS tid
),
receitas AS (
  SELECT
    COALESCE(SUM(COALESCE(NULLIF(o.receita_realizada, 0), NULLIF(o.valor_faturado, 0), 0)), 0)::numeric AS receita_total,
    COALESCE(SUM(o.receita_realizada), 0)::numeric AS receita_realizada_total,
    COALESCE(SUM(o.valor_faturado), 0)::numeric AS valor_faturado_total,
    COALESCE(SUM(CASE WHEN o.incluir_imposto THEN COALESCE(o.valor_imposto, 0) ELSE 0 END), 0)::numeric AS total_impostos,
    COALESCE(SUM(o.lucro_esperado), 0)::numeric AS lucro_esperado_total,
    COALESCE(SUM(
      CASE
        WHEN lower(translate(coalesce(o.situacao,''),
              'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
              'aaaaaeeeeiiiioooooouuuucAAAAAEEEEIIIIOOOOOOUUUUC'))
            IN ('aberto','em aberto','negociacao','em negociacao','pendente','em analise','proposta','enviado','rascunho')
        THEN COALESCE(o.receita_esperada, 0)
        ELSE 0
      END
    ), 0)::numeric AS receita_pipeline,
    COUNT(*) AS total_orcamentos,
    COUNT(*) FILTER (WHERE o.orcamento_convertido = true) AS orcamentos_convertidos
  FROM public.fato_orcamento o, tenant_data
  WHERE o.tenant_id = tenant_data.tid
),
despesas AS (
  SELECT
    COALESCE(SUM(d.valor_da_despesa), 0)::numeric AS total_despesas,
    COALESCE(SUM(CASE WHEN t.classificacao = 'VARIAVEL' THEN d.valor_da_despesa ELSE 0 END), 0)::numeric AS custos_variaveis_reais,
    COALESCE(SUM(CASE WHEN t.classificacao = 'FIXA' OR t.classificacao IS NULL THEN d.valor_da_despesa ELSE 0 END), 0)::numeric AS despesas_fixas_reais
  FROM public.fato_despesas d
  LEFT JOIN public.dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
  CROSS JOIN tenant_data
  WHERE d.tenant_id = tenant_data.tid
),
servicos AS (
  SELECT
    COUNT(*) AS total_servicos,
    COUNT(*) FILTER (WHERE s.situacao_do_servico = 'Concluído') AS servicos_concluidos,
    COALESCE(SUM(s.custo_servico), 0)::numeric AS custo_servico_total
  FROM public.fato_servico s, tenant_data
  WHERE s.tenant_id = tenant_data.tid
),
clientes AS (
  SELECT COUNT(*) AS total_clientes
  FROM public.dim_cliente c, tenant_data
  WHERE c.tenant_id = tenant_data.tid
)
SELECT
  r.receita_total,
  r.receita_realizada_total,
  r.valor_faturado_total,
  r.receita_pipeline,
  r.total_impostos,
  (r.receita_total - r.total_impostos) AS receita_liquida,
  (r.receita_total - s.custo_servico_total - d.custos_variaveis_reais) AS lucro_bruto,
  (r.receita_total - r.total_impostos - s.custo_servico_total - d.total_despesas) AS lucro_liquido,
  CASE WHEN r.receita_total > 0
    THEN (r.receita_total - s.custo_servico_total - d.custos_variaveis_reais) / r.receita_total * 100
    ELSE 0 END AS margem_bruta_percent,
  CASE WHEN r.receita_total > 0
    THEN (r.receita_total - r.total_impostos - s.custo_servico_total - d.total_despesas) / r.receita_total * 100
    ELSE 0 END AS margem_liquida_percent,
  CASE WHEN r.receita_total > 0
    THEN (r.receita_total - s.custo_servico_total - d.custos_variaveis_reais) / r.receita_total * 100
    ELSE 0 END AS margem_contribuicao_percent,
  CASE WHEN (r.receita_total - s.custo_servico_total - d.custos_variaveis_reais) > 0
    THEN d.despesas_fixas_reais / ((r.receita_total - s.custo_servico_total - d.custos_variaveis_reais) / r.receita_total)
    ELSE 0 END AS ponto_equilibrio_receita,
  d.total_despesas,
  (s.custo_servico_total + d.custos_variaveis_reais + d.despesas_fixas_reais) AS custo_total,
  d.custos_variaveis_reais,
  d.despesas_fixas_reais,
  s.custo_servico_total,
  s.total_servicos,
  s.servicos_concluidos,
  c.total_clientes,
  r.total_orcamentos,
  CASE WHEN r.total_orcamentos > 0
    THEN r.orcamentos_convertidos::numeric / r.total_orcamentos::numeric * 100
    ELSE 0 END AS taxa_conversao_percent,
  CASE WHEN s.servicos_concluidos > 0
    THEN r.receita_total / s.servicos_concluidos::numeric
    ELSE 0 END AS ticket_medio,
  CASE WHEN r.lucro_esperado_total > 0
    THEN (r.receita_total - r.total_impostos - s.custo_servico_total - d.total_despesas - r.lucro_esperado_total) / r.lucro_esperado_total * 100
    ELSE 0 END AS desvio_orcamentario_percent
FROM receitas r
CROSS JOIN despesas d
CROSS JOIN servicos s
CROSS JOIN clientes c;

GRANT SELECT ON public.vw_kpis_financeiros TO authenticated;
GRANT SELECT ON public.vw_kpis_financeiros TO service_role;

CREATE FUNCTION public.calcular_kpis_v2()
RETURNS TABLE(
  receita_total numeric,
  receita_realizada_total numeric,
  valor_faturado_total numeric,
  receita_pipeline numeric,
  total_impostos numeric,
  receita_liquida numeric,
  lucro_bruto numeric,
  lucro_liquido numeric,
  margem_bruta_percent numeric,
  margem_liquida_percent numeric,
  margem_contribuicao_percent numeric,
  ponto_equilibrio_receita numeric,
  total_despesas numeric,
  custo_total numeric,
  custos_variaveis_reais numeric,
  despesas_fixas_reais numeric,
  custo_servico_total numeric,
  total_servicos bigint,
  servicos_concluidos bigint,
  total_clientes bigint,
  total_orcamentos bigint,
  taxa_conversao_percent numeric,
  ticket_medio numeric,
  desvio_orcamentario_percent numeric
)
LANGUAGE sql
SET search_path TO 'public'
AS $$
  SELECT
    receita_total, receita_realizada_total, valor_faturado_total, receita_pipeline,
    total_impostos, receita_liquida, lucro_bruto, lucro_liquido,
    margem_bruta_percent, margem_liquida_percent, margem_contribuicao_percent, ponto_equilibrio_receita,
    total_despesas, custo_total, custos_variaveis_reais, despesas_fixas_reais, custo_servico_total,
    total_servicos, servicos_concluidos, total_clientes, total_orcamentos,
    taxa_conversao_percent, ticket_medio, desvio_orcamentario_percent
  FROM public.vw_kpis_financeiros;
$$;
