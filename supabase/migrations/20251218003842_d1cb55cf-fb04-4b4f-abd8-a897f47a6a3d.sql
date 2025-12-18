-- Drop and recreate the function to include overdue budget alerts
CREATE OR REPLACE FUNCTION public.verificar_pagamentos_pendentes()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- Alert for upcoming payments (3 days in advance)
  INSERT INTO public.notificacoes (tipo, titulo, mensagem, link, prioridade, id_referencia, tenant_id)
  SELECT 
    'pagamento',
    'Pagamento Pendente',
    'Faltam ' || (o.data_do_faturamento - CURRENT_DATE) || ' dias para pagar o orçamento do(a) ' 
      || COALESCE(c.nome, 'Cliente') 
      || CASE WHEN p.nome_da_propriedade IS NOT NULL 
           THEN ', proprietário(a) de ' || p.nome_da_propriedade 
           ELSE '' 
         END || '.',
    '/servicos-orcamentos',
    CASE 
      WHEN (o.data_do_faturamento - CURRENT_DATE) <= 1 THEN 'alta'
      ELSE 'normal'
    END,
    o.id_orcamento,
    v_tenant_id
  FROM public.fato_orcamento o
  LEFT JOIN public.dim_cliente c ON o.id_cliente = c.id_cliente
  LEFT JOIN public.dim_propriedade p ON o.id_propriedade = p.id_propriedade
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

  -- Alert for OVERDUE payments (billing date has passed)
  INSERT INTO public.notificacoes (tipo, titulo, mensagem, link, prioridade, id_referencia, tenant_id)
  SELECT 
    'vencido',
    'Orçamento Vencido',
    'O orçamento do(a) ' 
      || COALESCE(c.nome, 'Cliente') 
      || CASE WHEN p.nome_da_propriedade IS NOT NULL 
           THEN ' (' || p.nome_da_propriedade || ')' 
           ELSE '' 
         END 
      || ' venceu há ' || (CURRENT_DATE - o.data_do_faturamento) || ' dias e ainda não foi pago.',
    '/servicos-orcamentos',
    'alta',
    o.id_orcamento,
    v_tenant_id
  FROM public.fato_orcamento o
  LEFT JOIN public.dim_cliente c ON o.id_cliente = c.id_cliente
  LEFT JOIN public.dim_propriedade p ON o.id_propriedade = p.id_propriedade
  WHERE o.tenant_id = v_tenant_id
    AND o.situacao_do_pagamento = 'Pendente'
    AND o.data_do_faturamento IS NOT NULL
    AND o.data_do_faturamento < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.id_referencia = o.id_orcamento
        AND n.tenant_id = v_tenant_id
        AND n.tipo = 'vencido'
        AND n.created_at::date = CURRENT_DATE
    );
END;
$function$;