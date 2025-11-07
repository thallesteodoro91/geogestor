-- Fix search_path for handle_new_user function (from recent migration)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix search_path for calcular_kpis function
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  LEFT JOIN public.fato_despesas d ON true
  LEFT JOIN public.fato_servico s ON e.id_empresa = s.id_empresa
  LEFT JOIN public.fato_orcamento o ON true;
END;
$$;