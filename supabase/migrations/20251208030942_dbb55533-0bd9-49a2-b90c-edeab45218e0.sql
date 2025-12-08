
-- Atualizar políticas RLS para validar NULL explicitamente
-- Isso previne exposição de dados quando get_user_tenant_id() retorna NULL

-- =====================
-- dim_cliente
-- =====================
DROP POLICY IF EXISTS "Users can read own tenant clients" ON public.dim_cliente;
CREATE POLICY "Users can read own tenant clients" ON public.dim_cliente
FOR SELECT USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own tenant clients" ON public.dim_cliente;
CREATE POLICY "Users can insert own tenant clients" ON public.dim_cliente
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own tenant clients" ON public.dim_cliente;
CREATE POLICY "Users can update own tenant clients" ON public.dim_cliente
FOR UPDATE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own tenant clients" ON public.dim_cliente;
CREATE POLICY "Users can delete own tenant clients" ON public.dim_cliente
FOR DELETE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- =====================
-- dim_propriedade
-- =====================
DROP POLICY IF EXISTS "Users can read own tenant properties" ON public.dim_propriedade;
CREATE POLICY "Users can read own tenant properties" ON public.dim_propriedade
FOR SELECT USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own tenant properties" ON public.dim_propriedade;
CREATE POLICY "Users can insert own tenant properties" ON public.dim_propriedade
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own tenant properties" ON public.dim_propriedade;
CREATE POLICY "Users can update own tenant properties" ON public.dim_propriedade
FOR UPDATE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own tenant properties" ON public.dim_propriedade;
CREATE POLICY "Users can delete own tenant properties" ON public.dim_propriedade
FOR DELETE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- =====================
-- dim_empresa
-- =====================
DROP POLICY IF EXISTS "Users can read own tenant companies" ON public.dim_empresa;
CREATE POLICY "Users can read own tenant companies" ON public.dim_empresa
FOR SELECT USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own tenant companies" ON public.dim_empresa;
CREATE POLICY "Users can insert own tenant companies" ON public.dim_empresa
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own tenant companies" ON public.dim_empresa;
CREATE POLICY "Users can update own tenant companies" ON public.dim_empresa
FOR UPDATE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete own tenant companies" ON public.dim_empresa;
CREATE POLICY "Admins can delete own tenant companies" ON public.dim_empresa
FOR DELETE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);

-- =====================
-- dim_tipodespesa
-- =====================
DROP POLICY IF EXISTS "Users can read own tenant expense types" ON public.dim_tipodespesa;
CREATE POLICY "Users can read own tenant expense types" ON public.dim_tipodespesa
FOR SELECT USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own tenant expense types" ON public.dim_tipodespesa;
CREATE POLICY "Users can insert own tenant expense types" ON public.dim_tipodespesa
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own tenant expense types" ON public.dim_tipodespesa;
CREATE POLICY "Users can update own tenant expense types" ON public.dim_tipodespesa
FOR UPDATE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own tenant expense types" ON public.dim_tipodespesa;
CREATE POLICY "Users can delete own tenant expense types" ON public.dim_tipodespesa
FOR DELETE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- =====================
-- fato_servico
-- =====================
DROP POLICY IF EXISTS "Users can read own tenant services" ON public.fato_servico;
CREATE POLICY "Users can read own tenant services" ON public.fato_servico
FOR SELECT USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own tenant services" ON public.fato_servico;
CREATE POLICY "Users can insert own tenant services" ON public.fato_servico
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own tenant services" ON public.fato_servico;
CREATE POLICY "Users can update own tenant services" ON public.fato_servico
FOR UPDATE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete own tenant services" ON public.fato_servico;
CREATE POLICY "Admins can delete own tenant services" ON public.fato_servico
FOR DELETE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);

-- =====================
-- fato_orcamento
-- =====================
DROP POLICY IF EXISTS "Users can read own tenant budgets" ON public.fato_orcamento;
CREATE POLICY "Users can read own tenant budgets" ON public.fato_orcamento
FOR SELECT USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own tenant budgets" ON public.fato_orcamento;
CREATE POLICY "Users can insert own tenant budgets" ON public.fato_orcamento
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own tenant budgets" ON public.fato_orcamento;
CREATE POLICY "Users can update own tenant budgets" ON public.fato_orcamento
FOR UPDATE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete own tenant budgets" ON public.fato_orcamento;
CREATE POLICY "Admins can delete own tenant budgets" ON public.fato_orcamento
FOR DELETE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);

-- =====================
-- fato_despesas
-- =====================
DROP POLICY IF EXISTS "Users can read own tenant expenses" ON public.fato_despesas;
CREATE POLICY "Users can read own tenant expenses" ON public.fato_despesas
FOR SELECT USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own tenant expenses" ON public.fato_despesas;
CREATE POLICY "Users can insert own tenant expenses" ON public.fato_despesas
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own tenant expenses" ON public.fato_despesas;
CREATE POLICY "Users can update own tenant expenses" ON public.fato_despesas
FOR UPDATE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete own tenant expenses" ON public.fato_despesas;
CREATE POLICY "Admins can delete own tenant expenses" ON public.fato_despesas
FOR DELETE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin')
);

-- =====================
-- notificacoes
-- =====================
DROP POLICY IF EXISTS "Users can read own tenant notifications" ON public.notificacoes;
CREATE POLICY "Users can read own tenant notifications" ON public.notificacoes
FOR SELECT USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own tenant notifications" ON public.notificacoes;
CREATE POLICY "Users can insert own tenant notifications" ON public.notificacoes
FOR INSERT WITH CHECK (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can update own tenant notifications" ON public.notificacoes;
CREATE POLICY "Users can update own tenant notifications" ON public.notificacoes
FOR UPDATE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own tenant notifications" ON public.notificacoes;
CREATE POLICY "Users can delete own tenant notifications" ON public.notificacoes
FOR DELETE USING (
  tenant_id IS NOT NULL 
  AND get_user_tenant_id(auth.uid()) IS NOT NULL
  AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';
