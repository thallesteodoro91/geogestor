-- First drop the function that depends on the view
DROP FUNCTION IF EXISTS public.calcular_kpis_v2();

-- Drop and recreate the vw_kpis_financeiros view with tax calculations
DROP VIEW IF EXISTS public.vw_kpis_financeiros;

CREATE VIEW public.vw_kpis_financeiros AS
WITH tenant_data AS (
  SELECT get_user_tenant_id(auth.uid()) as tenant_id
),
orcamentos AS (
  SELECT 
    COALESCE(SUM(receita_esperada), 0) as receita_total,
    COALESCE(SUM(receita_realizada), 0) as receita_realizada_total,
    COALESCE(SUM(valor_faturado), 0) as valor_faturado_total,
    COALESCE(SUM(CASE WHEN incluir_imposto = true THEN valor_imposto ELSE 0 END), 0) as total_impostos,
    COALESCE(SUM(lucro_esperado), 0) as lucro_esperado_total,
    COUNT(*) as total_orcamentos,
    COUNT(CASE WHEN orcamento_convertido = true THEN 1 END) as orcamentos_convertidos
  FROM fato_orcamento
  WHERE tenant_id = (SELECT tenant_id FROM tenant_data)
),
despesas AS (
  SELECT 
    COALESCE(SUM(valor_da_despesa), 0) as total_despesas
  FROM fato_despesas
  WHERE tenant_id = (SELECT tenant_id FROM tenant_data)
),
servicos AS (
  SELECT 
    COUNT(*) as total_servicos,
    COUNT(CASE WHEN situacao_do_servico = 'Concluído' THEN 1 END) as servicos_concluidos,
    COALESCE(SUM(custo_servico), 0) as custo_servicos
  FROM fato_servico
  WHERE tenant_id = (SELECT tenant_id FROM tenant_data)
),
clientes AS (
  SELECT COUNT(*) as total_clientes
  FROM dim_cliente
  WHERE tenant_id = (SELECT tenant_id FROM tenant_data)
),
empresa AS (
  SELECT 
    COALESCE(custo, 0) as custo_empresa,
    COALESCE(custos_variaveis, 0) as custos_variaveis,
    COALESCE(despesas, 0) as despesas_fixas
  FROM dim_empresa
  WHERE tenant_id = (SELECT tenant_id FROM tenant_data)
  LIMIT 1
)
SELECT 
  -- Receitas
  o.receita_total,
  o.receita_realizada_total,
  o.valor_faturado_total,
  o.total_impostos,
  (o.receita_total - o.total_impostos) as receita_liquida,
  
  -- Despesas e Custos
  d.total_despesas,
  COALESCE(s.custo_servicos, 0) + COALESCE(e.custo_empresa, 0) as custo_total,
  COALESCE(e.custos_variaveis, 0) as custos_variaveis_total,
  COALESCE(e.despesas_fixas, 0) as despesas_fixas_total,
  
  -- Lucros calculados dinamicamente
  (o.receita_total - o.total_impostos) - (COALESCE(s.custo_servicos, 0) + COALESCE(e.custo_empresa, 0)) as lucro_bruto,
  (o.receita_total - o.total_impostos) - (COALESCE(s.custo_servicos, 0) + COALESCE(e.custo_empresa, 0)) - d.total_despesas as lucro_liquido,
  
  -- Margens calculadas
  CASE 
    WHEN o.receita_total > 0 THEN 
      (((o.receita_total - o.total_impostos) - (COALESCE(s.custo_servicos, 0) + COALESCE(e.custo_empresa, 0))) / o.receita_total) * 100
    ELSE 0
  END as margem_bruta_percent,
  
  CASE 
    WHEN o.receita_total > 0 THEN 
      (((o.receita_total - o.total_impostos) - (COALESCE(s.custo_servicos, 0) + COALESCE(e.custo_empresa, 0)) - d.total_despesas) / o.receita_total) * 100
    ELSE 0
  END as margem_liquida_percent,
  
  -- Margem de Contribuição (Receita Líquida - Custos Variáveis)
  CASE 
    WHEN o.receita_total > 0 THEN 
      (((o.receita_total - o.total_impostos) - COALESCE(e.custos_variaveis, 0)) / o.receita_total) * 100
    ELSE 0
  END as margem_contribuicao_percent,
  
  -- Ponto de Equilíbrio
  CASE 
    WHEN ((o.receita_total - o.total_impostos) - COALESCE(e.custos_variaveis, 0)) > 0 AND o.receita_total > 0 THEN
      (COALESCE(e.despesas_fixas, 0) + d.total_despesas) / 
      (((o.receita_total - o.total_impostos) - COALESCE(e.custos_variaveis, 0)) / o.receita_total)
    ELSE 0
  END as ponto_equilibrio_receita,
  
  -- Contagens
  s.total_servicos,
  s.servicos_concluidos,
  c.total_clientes,
  o.total_orcamentos,
  
  -- Taxa de Conversão
  CASE 
    WHEN o.total_orcamentos > 0 THEN 
      (o.orcamentos_convertidos::numeric / o.total_orcamentos) * 100
    ELSE 0
  END as taxa_conversao_percent,
  
  -- Ticket Médio
  CASE 
    WHEN s.total_servicos > 0 THEN o.receita_total / s.total_servicos
    ELSE 0
  END as ticket_medio,
  
  -- Desvio Orçamentário
  CASE 
    WHEN o.receita_total > 0 THEN 
      ((o.receita_realizada_total - o.receita_total) / o.receita_total) * 100
    ELSE 0
  END as desvio_orcamentario_percent

FROM orcamentos o
CROSS JOIN despesas d
CROSS JOIN servicos s
CROSS JOIN clientes c
LEFT JOIN empresa e ON true;

-- Recreate the calcular_kpis_v2 function with new fields
CREATE OR REPLACE FUNCTION public.calcular_kpis_v2()
RETURNS TABLE(
  receita_total numeric,
  receita_realizada_total numeric,
  valor_faturado_total numeric,
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
    receita_total,
    receita_realizada_total,
    valor_faturado_total,
    total_impostos,
    receita_liquida,
    lucro_bruto,
    lucro_liquido,
    margem_bruta_percent,
    margem_liquida_percent,
    margem_contribuicao_percent,
    ponto_equilibrio_receita,
    total_despesas,
    custo_total,
    total_servicos,
    servicos_concluidos,
    total_clientes,
    total_orcamentos,
    taxa_conversao_percent,
    ticket_medio,
    desvio_orcamentario_percent
  FROM public.vw_kpis_financeiros;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';