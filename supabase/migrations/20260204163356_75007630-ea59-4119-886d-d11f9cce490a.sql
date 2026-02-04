-- =====================================================
-- AUDITORIA E CORREÇÃO DE SEGURANÇA RLS
-- Migração para fortalecer políticas de segurança
-- =====================================================

-- 1. GARANTIR RLS ATIVO EM TODAS AS TABELAS
-- (Já está ativo, mas confirmar para segurança)
ALTER TABLE public.cliente_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_categoria_despesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_categoria_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_categoria_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_propriedade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_tipodespesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_tiposervico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fato_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propriedade_geometria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. FORTALECER POLÍTICA DE INSERT EM TENANTS
-- Apenas usuários sem tenant podem criar um novo
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.tenants;

CREATE POLICY "Allow authenticated insert without existing tenant"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 3. ADICIONAR POLÍTICAS DE UPDATE/DELETE EM TENANT_MEMBERS
-- Administradores podem gerenciar membros do seu tenant
-- =====================================================

-- Política de UPDATE para admins
CREATE POLICY "Admins can update tenant members"
ON public.tenant_members
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Política de DELETE para admins (não pode remover a si mesmo)
CREATE POLICY "Admins can delete tenant members except self"
ON public.tenant_members
FOR DELETE
TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
  AND user_id != auth.uid()
);

-- =====================================================
-- 4. CONVERTER VIEWS PARA SECURITY INVOKER
-- Garante que views executem com privilégios do usuário chamador
-- =====================================================

-- Recriar vw_alertas_financeiros com SECURITY INVOKER
DROP VIEW IF EXISTS public.vw_alertas_financeiros;

CREATE VIEW public.vw_alertas_financeiros
WITH (security_invoker = true)
AS
SELECT 
  o.id_orcamento,
  o.codigo_orcamento,
  c.nome as cliente_nome,
  p.nome_da_propriedade as propriedade_nome,
  o.receita_esperada,
  o.data_do_faturamento,
  o.situacao_do_pagamento,
  o.tenant_id,
  CASE 
    WHEN o.data_do_faturamento < CURRENT_DATE AND o.situacao_do_pagamento = 'Pendente' THEN 'vencido'
    WHEN o.data_do_faturamento <= CURRENT_DATE + INTERVAL '3 days' AND o.situacao_do_pagamento = 'Pendente' THEN 'proximo'
    ELSE 'ok'
  END as status_alerta
FROM public.fato_orcamento o
LEFT JOIN public.dim_cliente c ON o.id_cliente = c.id_cliente
LEFT JOIN public.dim_propriedade p ON o.id_propriedade = p.id_propriedade
WHERE o.tenant_id = get_user_tenant_id(auth.uid())
  AND o.situacao_do_pagamento = 'Pendente'
  AND o.data_do_faturamento IS NOT NULL;

-- Recriar vw_kpis_financeiros com SECURITY INVOKER
DROP VIEW IF EXISTS public.vw_kpis_financeiros;

CREATE VIEW public.vw_kpis_financeiros
WITH (security_invoker = true)
AS
WITH tenant_data AS (
  SELECT get_user_tenant_id(auth.uid()) as tid
),
receitas AS (
  SELECT 
    COALESCE(SUM(receita_esperada), 0) as receita_total,
    COALESCE(SUM(receita_realizada), 0) as receita_realizada_total,
    COALESCE(SUM(valor_faturado), 0) as valor_faturado_total,
    COALESCE(SUM(CASE WHEN incluir_imposto THEN COALESCE(valor_imposto, 0) ELSE 0 END), 0) as total_impostos,
    COALESCE(SUM(lucro_esperado), 0) as lucro_esperado_total,
    COALESCE(SUM(margem_esperada), 0) as margem_esperada_total,
    COUNT(*) as total_orcamentos,
    COUNT(CASE WHEN orcamento_convertido = true THEN 1 END) as orcamentos_convertidos
  FROM public.fato_orcamento, tenant_data
  WHERE tenant_id = tid
),
despesas AS (
  SELECT 
    COALESCE(SUM(d.valor_da_despesa), 0) as total_despesas,
    COALESCE(SUM(CASE WHEN t.classificacao = 'VARIAVEL' THEN d.valor_da_despesa ELSE 0 END), 0) as custos_variaveis_reais,
    COALESCE(SUM(CASE WHEN t.classificacao = 'FIXA' OR t.classificacao IS NULL THEN d.valor_da_despesa ELSE 0 END), 0) as despesas_fixas_reais
  FROM public.fato_despesas d
  LEFT JOIN public.dim_tipodespesa t ON d.id_tipodespesa = t.id_tipodespesa
  CROSS JOIN tenant_data
  WHERE d.tenant_id = tid
),
servicos AS (
  SELECT 
    COUNT(*) as total_servicos,
    COUNT(CASE WHEN situacao_do_servico = 'Concluído' THEN 1 END) as servicos_concluidos
  FROM public.fato_servico, tenant_data
  WHERE tenant_id = tid
),
clientes AS (
  SELECT COUNT(*) as total_clientes
  FROM public.dim_cliente, tenant_data
  WHERE tenant_id = tid
)
SELECT 
  r.receita_total,
  r.receita_realizada_total,
  r.valor_faturado_total,
  r.total_impostos,
  (r.receita_total - r.total_impostos) as receita_liquida,
  (r.receita_total - d.custos_variaveis_reais) as lucro_bruto,
  (r.receita_total - d.total_despesas) as lucro_liquido,
  CASE WHEN r.receita_total > 0 THEN ((r.receita_total - d.custos_variaveis_reais) / r.receita_total * 100) ELSE 0 END as margem_bruta_percent,
  CASE WHEN r.receita_total > 0 THEN ((r.receita_total - d.total_despesas) / r.receita_total * 100) ELSE 0 END as margem_liquida_percent,
  CASE WHEN r.receita_total > 0 THEN ((r.receita_total - d.custos_variaveis_reais) / r.receita_total * 100) ELSE 0 END as margem_contribuicao_percent,
  CASE WHEN (r.receita_total - d.custos_variaveis_reais) > 0 
    THEN (d.despesas_fixas_reais / ((r.receita_total - d.custos_variaveis_reais) / r.receita_total)) 
    ELSE 0 
  END as ponto_equilibrio_receita,
  d.total_despesas,
  (d.custos_variaveis_reais + d.despesas_fixas_reais) as custo_total,
  d.custos_variaveis_reais,
  d.despesas_fixas_reais,
  s.total_servicos,
  s.servicos_concluidos,
  c.total_clientes,
  r.total_orcamentos,
  CASE WHEN r.total_orcamentos > 0 THEN (r.orcamentos_convertidos::numeric / r.total_orcamentos * 100) ELSE 0 END as taxa_conversao_percent,
  CASE WHEN s.total_servicos > 0 THEN (r.receita_total / s.total_servicos) ELSE 0 END as ticket_medio,
  CASE WHEN r.lucro_esperado_total > 0 
    THEN (((r.receita_total - d.total_despesas) - r.lucro_esperado_total) / r.lucro_esperado_total * 100) 
    ELSE 0 
  END as desvio_orcamentario_percent
FROM receitas r
CROSS JOIN despesas d
CROSS JOIN servicos s
CROSS JOIN clientes c;

-- =====================================================
-- 5. NOTIFICAR POSTGREST PARA RECARREGAR SCHEMA
-- =====================================================
NOTIFY pgrst, 'reload schema';