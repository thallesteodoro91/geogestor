-- =====================================================
-- REFATORAÇÃO CONTÁBIL: Classificação de Despesas
-- =====================================================

-- 1. Dropar a view existente e função dependente
DROP FUNCTION IF EXISTS public.calcular_kpis_v2();
DROP VIEW IF EXISTS public.vw_kpis_financeiros;

-- 2. Adicionar coluna classificacao em dim_tipodespesa (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dim_tipodespesa' 
    AND column_name = 'classificacao'
  ) THEN
    ALTER TABLE public.dim_tipodespesa 
    ADD COLUMN classificacao TEXT DEFAULT 'FIXA' 
    CHECK (classificacao IN ('FIXA', 'VARIAVEL'));
  END IF;
END $$;

-- 3. Atualizar tipos existentes baseado na categoria (heurística inicial)
UPDATE public.dim_tipodespesa 
SET classificacao = CASE
  WHEN LOWER(categoria) LIKE '%combust%' THEN 'VARIAVEL'
  WHEN LOWER(categoria) LIKE '%material%' THEN 'VARIAVEL'
  WHEN LOWER(categoria) LIKE '%insumo%' THEN 'VARIAVEL'
  WHEN LOWER(categoria) LIKE '%operacion%' THEN 'VARIAVEL'
  WHEN LOWER(categoria) LIKE '%manutenc%' THEN 'VARIAVEL'
  WHEN LOWER(categoria) LIKE '%terceiriz%' THEN 'VARIAVEL'
  WHEN LOWER(categoria) LIKE '%frete%' THEN 'VARIAVEL'
  WHEN LOWER(categoria) LIKE '%transporte%' THEN 'VARIAVEL'
  ELSE 'FIXA'
END;

-- 4. Criar nova view vw_kpis_financeiros com cálculos baseados em dados reais
CREATE VIEW public.vw_kpis_financeiros AS
WITH tenant_data AS (
  SELECT get_user_tenant_id(auth.uid()) as tenant_id
),
orcamentos AS (
  SELECT 
    COALESCE(SUM(receita_esperada), 0) as receita_total,
    COALESCE(SUM(CASE WHEN situacao_do_pagamento = 'Pago' THEN receita_realizada ELSE 0 END), 0) as receita_realizada_total,
    COALESCE(SUM(CASE WHEN situacao_do_pagamento = 'Pago' THEN valor_faturado ELSE 0 END), 0) as valor_faturado_total,
    COALESCE(SUM(CASE WHEN incluir_imposto = true AND situacao_do_pagamento = 'Pago' THEN COALESCE(valor_imposto, 0) ELSE 0 END), 0) as total_impostos,
    COUNT(*) as total_orcamentos,
    COUNT(CASE WHEN orcamento_convertido = true THEN 1 END) as orcamentos_convertidos
  FROM public.fato_orcamento
  WHERE tenant_id = (SELECT tenant_id FROM tenant_data)
),
despesas AS (
  SELECT 
    COALESCE(SUM(fd.valor_da_despesa), 0) as total_despesas,
    COALESCE(SUM(CASE WHEN td.classificacao = 'VARIAVEL' THEN fd.valor_da_despesa ELSE 0 END), 0) as custos_variaveis_reais,
    COALESCE(SUM(CASE WHEN td.classificacao = 'FIXA' THEN fd.valor_da_despesa ELSE 0 END), 0) as despesas_fixas_reais
  FROM public.fato_despesas fd
  LEFT JOIN public.dim_tipodespesa td ON fd.id_tipodespesa = td.id_tipodespesa
  WHERE fd.tenant_id = (SELECT tenant_id FROM tenant_data)
),
servicos AS (
  SELECT 
    COUNT(*) as total_servicos,
    COUNT(CASE WHEN situacao_do_servico = 'Concluído' THEN 1 END) as servicos_concluidos
  FROM public.fato_servico
  WHERE tenant_id = (SELECT tenant_id FROM tenant_data)
),
clientes AS (
  SELECT COUNT(*) as total_clientes
  FROM public.dim_cliente
  WHERE tenant_id = (SELECT tenant_id FROM tenant_data)
)
SELECT
  o.receita_total,
  o.receita_realizada_total,
  o.valor_faturado_total,
  o.total_impostos,
  (o.receita_realizada_total - o.total_impostos) as receita_liquida,
  (o.receita_realizada_total - o.total_impostos - d.custos_variaveis_reais) as lucro_bruto,
  (o.receita_realizada_total - o.total_impostos - d.custos_variaveis_reais - d.despesas_fixas_reais) as lucro_liquido,
  CASE 
    WHEN (o.receita_realizada_total - o.total_impostos) > 0 
    THEN ROUND(((o.receita_realizada_total - o.total_impostos - d.custos_variaveis_reais) / (o.receita_realizada_total - o.total_impostos) * 100)::numeric, 2)
    ELSE 0
  END as margem_bruta_percent,
  CASE 
    WHEN (o.receita_realizada_total - o.total_impostos) > 0 
    THEN ROUND(((o.receita_realizada_total - o.total_impostos - d.custos_variaveis_reais - d.despesas_fixas_reais) / (o.receita_realizada_total - o.total_impostos) * 100)::numeric, 2)
    ELSE 0
  END as margem_liquida_percent,
  CASE 
    WHEN (o.receita_realizada_total - o.total_impostos) > 0 
    THEN ROUND((((o.receita_realizada_total - o.total_impostos) - d.custos_variaveis_reais) / (o.receita_realizada_total - o.total_impostos) * 100)::numeric, 2)
    ELSE 0
  END as margem_contribuicao_percent,
  CASE 
    WHEN ((o.receita_realizada_total - o.total_impostos) - d.custos_variaveis_reais) > 0 AND (o.receita_realizada_total - o.total_impostos) > 0
    THEN ROUND((d.despesas_fixas_reais / (((o.receita_realizada_total - o.total_impostos) - d.custos_variaveis_reais) / (o.receita_realizada_total - o.total_impostos)))::numeric, 2)
    ELSE 0
  END as ponto_equilibrio_receita,
  d.total_despesas,
  (d.custos_variaveis_reais + d.despesas_fixas_reais) as custo_total,
  d.custos_variaveis_reais,
  d.despesas_fixas_reais,
  s.total_servicos,
  s.servicos_concluidos,
  c.total_clientes,
  o.total_orcamentos,
  CASE 
    WHEN o.total_orcamentos > 0 
    THEN ROUND((o.orcamentos_convertidos::numeric / o.total_orcamentos * 100), 2)
    ELSE 0
  END as taxa_conversao_percent,
  CASE 
    WHEN s.servicos_concluidos > 0 
    THEN ROUND((o.receita_realizada_total / s.servicos_concluidos)::numeric, 2)
    ELSE 0
  END as ticket_medio,
  CASE 
    WHEN o.receita_total > 0 
    THEN ROUND(((o.receita_realizada_total - o.receita_total) / o.receita_total * 100)::numeric, 2)
    ELSE 0
  END as desvio_orcamentario_percent
FROM orcamentos o
CROSS JOIN despesas d
CROSS JOIN servicos s
CROSS JOIN clientes c;

-- 5. Criar função calcular_kpis_v2 com novos campos
CREATE FUNCTION public.calcular_kpis_v2()
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
  custos_variaveis_reais numeric,
  despesas_fixas_reais numeric,
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
    custos_variaveis_reais,
    despesas_fixas_reais,
    total_servicos,
    servicos_concluidos,
    total_clientes,
    total_orcamentos,
    taxa_conversao_percent,
    ticket_medio,
    desvio_orcamentario_percent
  FROM public.vw_kpis_financeiros;
$$;

-- 6. Adicionar comentário para documentação
COMMENT ON COLUMN public.dim_tipodespesa.classificacao IS 'Classificação contábil: FIXA (não varia com produção) ou VARIAVEL (varia com produção/vendas)';