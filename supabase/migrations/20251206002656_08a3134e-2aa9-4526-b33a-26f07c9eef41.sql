
-- =====================================================
-- ATUALIZAÇÃO DE POLÍTICAS RLS COM ISOLAMENTO POR TENANT
-- =====================================================

-- dim_cliente: Remover políticas antigas e criar novas com tenant_id
DROP POLICY IF EXISTS "Authenticated users can read dim_cliente" ON public.dim_cliente;
DROP POLICY IF EXISTS "Authenticated users can insert dim_cliente" ON public.dim_cliente;
DROP POLICY IF EXISTS "Authenticated users can update dim_cliente" ON public.dim_cliente;
DROP POLICY IF EXISTS "Authenticated users can delete dim_cliente" ON public.dim_cliente;

CREATE POLICY "Users can read own tenant clients"
ON public.dim_cliente FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant clients"
ON public.dim_cliente FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant clients"
ON public.dim_cliente FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete own tenant clients"
ON public.dim_cliente FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- dim_propriedade: Remover políticas antigas e criar novas com tenant_id
DROP POLICY IF EXISTS "Authenticated users can read dim_propriedade" ON public.dim_propriedade;
DROP POLICY IF EXISTS "Authenticated users can insert dim_propriedade" ON public.dim_propriedade;
DROP POLICY IF EXISTS "Authenticated users can update dim_propriedade" ON public.dim_propriedade;
DROP POLICY IF EXISTS "Authenticated users can delete dim_propriedade" ON public.dim_propriedade;

CREATE POLICY "Users can read own tenant properties"
ON public.dim_propriedade FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant properties"
ON public.dim_propriedade FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant properties"
ON public.dim_propriedade FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete own tenant properties"
ON public.dim_propriedade FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- dim_empresa: Remover políticas antigas e criar novas com tenant_id
DROP POLICY IF EXISTS "Authenticated users can read dim_empresa" ON public.dim_empresa;
DROP POLICY IF EXISTS "Authenticated users can insert dim_empresa" ON public.dim_empresa;
DROP POLICY IF EXISTS "Authenticated users can update dim_empresa" ON public.dim_empresa;
DROP POLICY IF EXISTS "Admins can delete dim_empresa" ON public.dim_empresa;

CREATE POLICY "Users can read own tenant companies"
ON public.dim_empresa FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant companies"
ON public.dim_empresa FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant companies"
ON public.dim_empresa FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete own tenant companies"
ON public.dim_empresa FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- dim_tipodespesa: Remover políticas antigas e criar novas com tenant_id
DROP POLICY IF EXISTS "Authenticated users can read dim_tipodespesa" ON public.dim_tipodespesa;
DROP POLICY IF EXISTS "Authenticated users can insert dim_tipodespesa" ON public.dim_tipodespesa;
DROP POLICY IF EXISTS "Authenticated users can update dim_tipodespesa" ON public.dim_tipodespesa;
DROP POLICY IF EXISTS "Authenticated users can delete dim_tipodespesa" ON public.dim_tipodespesa;

CREATE POLICY "Users can read own tenant expense types"
ON public.dim_tipodespesa FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant expense types"
ON public.dim_tipodespesa FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant expense types"
ON public.dim_tipodespesa FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete own tenant expense types"
ON public.dim_tipodespesa FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- fato_servico: Remover políticas antigas e criar novas com tenant_id
DROP POLICY IF EXISTS "Authenticated users can read fato_servico" ON public.fato_servico;
DROP POLICY IF EXISTS "Authenticated users can insert fato_servico" ON public.fato_servico;
DROP POLICY IF EXISTS "Authenticated users can update fato_servico" ON public.fato_servico;
DROP POLICY IF EXISTS "Admins can delete fato_servico" ON public.fato_servico;

CREATE POLICY "Users can read own tenant services"
ON public.fato_servico FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant services"
ON public.fato_servico FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant services"
ON public.fato_servico FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete own tenant services"
ON public.fato_servico FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- fato_orcamento: Remover políticas antigas e criar novas com tenant_id
DROP POLICY IF EXISTS "Authenticated users can read fato_orcamento" ON public.fato_orcamento;
DROP POLICY IF EXISTS "Authenticated users can insert fato_orcamento" ON public.fato_orcamento;
DROP POLICY IF EXISTS "Authenticated users can update fato_orcamento" ON public.fato_orcamento;
DROP POLICY IF EXISTS "Admins can delete fato_orcamento" ON public.fato_orcamento;

CREATE POLICY "Users can read own tenant budgets"
ON public.fato_orcamento FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant budgets"
ON public.fato_orcamento FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant budgets"
ON public.fato_orcamento FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete own tenant budgets"
ON public.fato_orcamento FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- fato_despesas: Remover políticas antigas e criar novas com tenant_id
DROP POLICY IF EXISTS "Authenticated users can read fato_despesas" ON public.fato_despesas;
DROP POLICY IF EXISTS "Authenticated users can insert fato_despesas" ON public.fato_despesas;
DROP POLICY IF EXISTS "Authenticated users can update fato_despesas" ON public.fato_despesas;
DROP POLICY IF EXISTS "Admins can delete fato_despesas" ON public.fato_despesas;

CREATE POLICY "Users can read own tenant expenses"
ON public.fato_despesas FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant expenses"
ON public.fato_despesas FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant expenses"
ON public.fato_despesas FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can delete own tenant expenses"
ON public.fato_despesas FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- notificacoes: Remover políticas antigas e criar novas com tenant_id
DROP POLICY IF EXISTS "Authenticated users can read notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Authenticated users can insert notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Authenticated users can update notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Authenticated users can delete notificacoes" ON public.notificacoes;

CREATE POLICY "Users can read own tenant notifications"
ON public.notificacoes FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert own tenant notifications"
ON public.notificacoes FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can update own tenant notifications"
ON public.notificacoes FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete own tenant notifications"
ON public.notificacoes FOR DELETE
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));
