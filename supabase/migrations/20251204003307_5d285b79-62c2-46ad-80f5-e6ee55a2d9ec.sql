
-- =============================================
-- FASE 1: FUNDAÇÃO MULTI-TENANCY
-- =============================================

-- 1. Criar tabela de Tenants (Empresas/Organizações)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar tabela de Membros do Tenant
CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- 3. Criar tabela de Planos de Assinatura
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'month',
  features JSONB DEFAULT '{}',
  max_users INTEGER DEFAULT 5,
  max_properties INTEGER DEFAULT 50,
  max_clients INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Criar tabela de Assinaturas Ativas
CREATE TABLE public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Adicionar tenant_id nas tabelas existentes
ALTER TABLE public.dim_cliente ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.dim_propriedade ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.dim_empresa ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.dim_tipodespesa ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.fato_servico ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.fato_orcamento ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.fato_despesas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON public.tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_cliente_tenant ON public.dim_cliente(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_propriedade_tenant ON public.dim_propriedade(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dim_empresa_tenant ON public.dim_empresa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fato_servico_tenant ON public.fato_servico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fato_orcamento_tenant ON public.fato_orcamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fato_despesas_tenant ON public.fato_despesas(tenant_id);

-- 7. Criar função para obter tenant_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id 
  FROM public.tenant_members 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- 8. Habilitar RLS nas novas tabelas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- 9. Políticas RLS para tenants
CREATE POLICY "Users can view their own tenant"
ON public.tenants FOR SELECT
TO authenticated
USING (id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can update their tenant"
ON public.tenants FOR UPDATE
TO authenticated
USING (id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- 10. Políticas RLS para tenant_members
CREATE POLICY "Users can view members of their tenant"
ON public.tenant_members FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage tenant members"
ON public.tenant_members FOR ALL
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- 11. Políticas RLS para subscription_plans (público para leitura)
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans FOR SELECT
TO authenticated
USING (is_active = true);

-- 12. Políticas RLS para tenant_subscriptions
CREATE POLICY "Users can view their tenant subscription"
ON public.tenant_subscriptions FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can manage tenant subscription"
ON public.tenant_subscriptions FOR ALL
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- 13. Inserir planos padrão
INSERT INTO public.subscription_plans (name, slug, price_cents, interval, max_users, max_properties, max_clients, features) VALUES
('Trial', 'trial', 0, 'month', 2, 10, 20, '{"basic_reports": true, "email_support": false}'),
('Starter', 'starter', 9900, 'month', 3, 25, 50, '{"basic_reports": true, "email_support": true}'),
('Professional', 'professional', 19900, 'month', 10, 100, 200, '{"basic_reports": true, "advanced_reports": true, "email_support": true, "priority_support": true}'),
('Enterprise', 'enterprise', 49900, 'month', 50, 500, 1000, '{"basic_reports": true, "advanced_reports": true, "email_support": true, "priority_support": true, "api_access": true, "custom_integrations": true}');

-- 14. Trigger para atualizar updated_at em tenants
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Trigger para atualizar updated_at em tenant_subscriptions
CREATE TRIGGER update_tenant_subscriptions_updated_at
BEFORE UPDATE ON public.tenant_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
