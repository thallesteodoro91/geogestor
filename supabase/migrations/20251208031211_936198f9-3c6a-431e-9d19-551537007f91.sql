
-- Converter calcular_kpis_v2() para SECURITY INVOKER
-- A view já filtra por tenant, então podemos usar SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.calcular_kpis_v2()
RETURNS TABLE(
  receita_total numeric,
  receita_realizada_total numeric,
  valor_faturado_total numeric,
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
SECURITY INVOKER
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

-- Converter verificar_pagamentos_pendentes() para filtrar por tenant_id
-- Adiciona parâmetro opcional p_tenant_id, se NULL usa o tenant do usuário atual
CREATE OR REPLACE FUNCTION public.verificar_pagamentos_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Obter tenant_id do usuário atual
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  -- Se não tem tenant, não faz nada
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- Inserir notificações para pagamentos que vencem em 3 dias ou menos
  -- Filtrando pelo tenant_id do usuário
  INSERT INTO public.notificacoes (tipo, titulo, mensagem, link, prioridade, id_referencia, tenant_id)
  SELECT 
    'pagamento',
    'Pagamento Pendente',
    'Faltam ' || (o.data_do_faturamento - CURRENT_DATE) || ' dias para pagar orçamento #' || SUBSTRING(o.id_orcamento::text, 1, 8),
    '/servicos-orcamentos',
    CASE 
      WHEN (o.data_do_faturamento - CURRENT_DATE) <= 1 THEN 'alta'
      ELSE 'normal'
    END,
    o.id_orcamento,
    v_tenant_id
  FROM public.fato_orcamento o
  WHERE o.tenant_id = v_tenant_id
    AND o.situacao_do_pagamento = 'Pendente'
    AND o.data_do_faturamento IS NOT NULL
    AND o.data_do_faturamento >= CURRENT_DATE
    AND o.data_do_faturamento <= CURRENT_DATE + INTERVAL '3 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.id_referencia = o.id_orcamento
        AND n.tenant_id = v_tenant_id
        AND n.tipo = 'pagamento'
        AND n.created_at::date = CURRENT_DATE
    );
END;
$$;

-- Também converter calcular_kpis() para SECURITY INVOKER (função legada)
CREATE OR REPLACE FUNCTION public.calcular_kpis()
RETURNS TABLE(
  receita_total numeric,
  lucro_bruto numeric,
  margem_bruta numeric,
  lucro_liquido numeric,
  margem_liquida numeric,
  total_despesas numeric,
  total_servicos bigint,
  servicos_concluidos bigint,
  taxa_conversao numeric,
  ticket_medio numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  IF v_tenant_id IS NULL THEN
    RETURN QUERY SELECT 
      0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
      0::numeric, 0::bigint, 0::bigint, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(e.receita), 0) as receita_total,
    COALESCE(SUM(e.lucro_bruto), 0) as lucro_bruto,
    CASE 
      WHEN SUM(e.receita) > 0 THEN (SUM(e.lucro_bruto) / SUM(e.receita) * 100)
      ELSE 0
    END as margem_bruta,
    COALESCE(SUM(e.lucro_liquido), 0) as lucro_liquido,
    CASE 
      WHEN SUM(e.receita) > 0 THEN (SUM(e.lucro_liquido) / SUM(e.receita) * 100)
      ELSE 0
    END as margem_liquida,
    COALESCE(SUM(d.valor_da_despesa), 0) as total_despesas,
    COALESCE(COUNT(DISTINCT s.id_servico), 0) as total_servicos,
    COALESCE(COUNT(DISTINCT CASE WHEN s.situacao_do_servico = 'Concluído' THEN s.id_servico END), 0) as servicos_concluidos,
    CASE 
      WHEN COUNT(o.id_orcamento) > 0 THEN (COUNT(CASE WHEN o.orcamento_convertido = true THEN 1 END)::NUMERIC / COUNT(o.id_orcamento) * 100)
      ELSE 0
    END as taxa_conversao,
    CASE 
      WHEN COUNT(s.id_servico) > 0 THEN (SUM(e.receita) / COUNT(s.id_servico))
      ELSE 0
    END as ticket_medio
  FROM public.dim_empresa e
  LEFT JOIN public.fato_despesas d ON d.tenant_id = v_tenant_id
  LEFT JOIN public.fato_servico s ON s.tenant_id = v_tenant_id
  LEFT JOIN public.fato_orcamento o ON o.tenant_id = v_tenant_id
  WHERE e.tenant_id = v_tenant_id;
END;
$$;

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';
