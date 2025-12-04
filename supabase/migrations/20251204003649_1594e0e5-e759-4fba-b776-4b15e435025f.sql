
-- Permitir que usuários autenticados criem tenants
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir que usuários se adicionem como membros do tenant que criaram
CREATE POLICY "Users can add themselves to new tenant"
ON public.tenant_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Permitir que usuários criem assinaturas para tenants onde são admin
CREATE POLICY "Users can create tenant subscriptions"
ON public.tenant_subscriptions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = tenant_subscriptions.tenant_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);
