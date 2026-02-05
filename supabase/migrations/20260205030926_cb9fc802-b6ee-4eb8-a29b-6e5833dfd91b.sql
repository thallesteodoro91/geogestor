-- Tabela para rastrear quando alertas de vencimento foram descartados
CREATE TABLE IF NOT EXISTS public.notificacao_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  id_referencia uuid NOT NULL,
  tipo varchar(50) NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, id_referencia, tipo)
);

-- Enable RLS
ALTER TABLE public.notificacao_dismissals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own dismissals"
  ON public.notificacao_dismissals FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own dismissals"
  ON public.notificacao_dismissals FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own dismissals"
  ON public.notificacao_dismissals FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete own dismissals"
  ON public.notificacao_dismissals FOR DELETE
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Atualizar função verificar_pagamentos_pendentes para respeitar intervalo de 3 dias
CREATE OR REPLACE FUNCTION public.verificar_pagamentos_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := get_user_tenant_id(auth.uid());
  
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- Alert for upcoming payments (3 days in advance) - mantém lógica diária
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

  -- Alert for OVERDUE payments - só criar se:
  -- 1. Não existe notificação nos últimos 3 dias
  -- 2. Não foi descartado nos últimos 3 dias
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
    -- Não existe notificação vencido nos últimos 3 dias
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.id_referencia = o.id_orcamento
        AND n.tenant_id = v_tenant_id
        AND n.tipo = 'vencido'
        AND n.created_at >= CURRENT_TIMESTAMP - INTERVAL '3 days'
    )
    -- Não foi descartado nos últimos 3 dias
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacao_dismissals d
      WHERE d.id_referencia = o.id_orcamento
        AND d.tenant_id = v_tenant_id
        AND d.tipo = 'vencido'
        AND d.dismissed_at >= CURRENT_TIMESTAMP - INTERVAL '3 days'
    );
END;
$$;