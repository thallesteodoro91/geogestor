-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id_notificacao uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- 'orcamento', 'servico', 'despesa', 'pagamento'
  titulo text NOT NULL,
  mensagem text NOT NULL,
  link text, -- URL para redirecionar quando clicar
  lida boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  id_referencia uuid, -- ID do orçamento, serviço, despesa relacionada
  prioridade text DEFAULT 'normal' -- 'baixa', 'normal', 'alta'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON public.notificacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON public.notificacoes(tipo);

-- Habilitar RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read notificacoes"
  ON public.notificacoes
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Authenticated users can insert notificacoes"
  ON public.notificacoes
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Authenticated users can update notificacoes"
  ON public.notificacoes
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Authenticated users can delete notificacoes"
  ON public.notificacoes
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));

-- Função para criar notificação automática de pagamento pendente
CREATE OR REPLACE FUNCTION public.verificar_pagamentos_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir notificações para pagamentos que vencem em 3 dias ou menos
  INSERT INTO public.notificacoes (tipo, titulo, mensagem, link, prioridade, id_referencia)
  SELECT 
    'pagamento',
    'Pagamento Pendente',
    'Faltam ' || (o.data_do_faturamento - CURRENT_DATE) || ' dias para pagar orçamento #' || SUBSTRING(o.id_orcamento::text, 1, 8),
    '/servicos-orcamentos',
    CASE 
      WHEN (o.data_do_faturamento - CURRENT_DATE) <= 1 THEN 'alta'
      ELSE 'normal'
    END,
    o.id_orcamento
  FROM public.fato_orcamento o
  WHERE o.situacao_do_pagamento = 'Pendente'
    AND o.data_do_faturamento IS NOT NULL
    AND o.data_do_faturamento >= CURRENT_DATE
    AND o.data_do_faturamento <= CURRENT_DATE + INTERVAL '3 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.id_referencia = o.id_orcamento
        AND n.tipo = 'pagamento'
        AND n.created_at::date = CURRENT_DATE
    );
END;
$$;

COMMENT ON TABLE public.notificacoes IS 'Armazena notificações do sistema para alertas e avisos';
COMMENT ON FUNCTION public.verificar_pagamentos_pendentes IS 'Verifica e cria notificações para pagamentos que vencem em até 3 dias';