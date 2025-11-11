-- ================================================
-- Etapa 1: Views e Funções para KPIs Financeiros (corrigido)
-- ================================================

-- Criar view para KPIs consolidados com todos os campos calculados
CREATE OR REPLACE VIEW public.vw_kpis_financeiros AS
SELECT 
  -- Receitas
  COALESCE(SUM(o.receita_esperada), 0) as receita_total,
  COALESCE(SUM(o.receita_realizada), 0) as receita_realizada_total,
  COALESCE(SUM(o.valor_faturado), 0) as valor_faturado_total,
  
  -- Custos e Despesas
  COALESCE(SUM(d.valor_da_despesa), 0) as total_despesas,
  COALESCE(SUM(e.custo), 0) as custo_total,
  COALESCE(SUM(e.custos_variaveis), 0) as custos_variaveis_total,
  COALESCE(SUM(e.despesas), 0) as despesas_fixas_total,
  
  -- Lucros
  COALESCE(SUM(e.lucro_bruto), 0) as lucro_bruto,
  COALESCE(SUM(e.lucro_liquido), 0) as lucro_liquido,
  
  -- Margens (médias ponderadas)
  CASE 
    WHEN SUM(o.receita_esperada) > 0 
    THEN (SUM(e.lucro_bruto) / SUM(o.receita_esperada) * 100)
    ELSE 0
  END as margem_bruta_percent,
  
  CASE 
    WHEN SUM(o.receita_esperada) > 0 
    THEN (SUM(e.lucro_liquido) / SUM(o.receita_esperada) * 100)
    ELSE 0
  END as margem_liquida_percent,
  
  CASE 
    WHEN SUM(o.receita_esperada) > 0 
    THEN ((SUM(o.receita_esperada) - SUM(e.custos_variaveis)) / SUM(o.receita_esperada) * 100)
    ELSE 0
  END as margem_contribuicao_percent,
  
  -- Ponto de Equilíbrio
  CASE 
    WHEN (SUM(o.receita_esperada) - SUM(e.custos_variaveis)) > 0 
    THEN (SUM(e.despesas) / ((SUM(o.receita_esperada) - SUM(e.custos_variaveis)) / SUM(o.receita_esperada)))
    ELSE 0
  END as ponto_equilibrio_receita,
  
  -- Métricas Operacionais
  COUNT(DISTINCT s.id_servico) as total_servicos,
  COUNT(DISTINCT CASE WHEN s.situacao_do_servico = 'Concluído' THEN s.id_servico END) as servicos_concluidos,
  COUNT(DISTINCT c.id_cliente) as total_clientes,
  COUNT(DISTINCT o.id_orcamento) as total_orcamentos,
  
  -- Taxa de Conversão
  CASE 
    WHEN COUNT(o.id_orcamento) > 0 
    THEN (COUNT(CASE WHEN o.orcamento_convertido = true THEN 1 END)::NUMERIC / COUNT(o.id_orcamento) * 100)
    ELSE 0
  END as taxa_conversao_percent,
  
  -- Ticket Médio
  CASE 
    WHEN COUNT(DISTINCT s.id_servico) > 0 
    THEN (SUM(o.receita_esperada) / COUNT(DISTINCT s.id_servico))
    ELSE 0
  END as ticket_medio,
  
  -- Desvio Orçamentário
  CASE 
    WHEN SUM(o.receita_esperada) > 0 
    THEN ((SUM(o.receita_realizada) - SUM(o.receita_esperada)) / SUM(o.receita_esperada) * 100)
    ELSE 0
  END as desvio_orcamentario_percent

FROM public.dim_empresa e
LEFT JOIN public.fato_orcamento o ON true
LEFT JOIN public.fato_servico s ON o.id_servico = s.id_servico
LEFT JOIN public.fato_despesas d ON s.id_servico = d.id_servico
LEFT JOIN public.dim_cliente c ON o.id_cliente = c.id_cliente;

-- Criar função atualizada para calcular KPIs
CREATE OR REPLACE FUNCTION public.calcular_kpis_v2()
RETURNS TABLE(
  receita_total NUMERIC,
  receita_realizada_total NUMERIC,
  valor_faturado_total NUMERIC,
  lucro_bruto NUMERIC,
  lucro_liquido NUMERIC,
  margem_bruta_percent NUMERIC,
  margem_liquida_percent NUMERIC,
  margem_contribuicao_percent NUMERIC,
  ponto_equilibrio_receita NUMERIC,
  total_despesas NUMERIC,
  custo_total NUMERIC,
  total_servicos BIGINT,
  servicos_concluidos BIGINT,
  total_clientes BIGINT,
  total_orcamentos BIGINT,
  taxa_conversao_percent NUMERIC,
  ticket_medio NUMERIC,
  desvio_orcamentario_percent NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    receita_total,
    receita_realizada_total,
    valor_faturado_total,
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

-- Conceder permissões
GRANT SELECT ON public.vw_kpis_financeiros TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_kpis_v2() TO authenticated;