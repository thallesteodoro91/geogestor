
-- 1. Deterministic tenant lookup
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = _user_id
  ORDER BY joined_at ASC, tenant_id ASC
  LIMIT 1
$$;

-- 2. tenant_invites: scope UPDATE to pending, non-expired
DROP POLICY IF EXISTS "Users can accept own invites" ON public.tenant_invites;
CREATE POLICY "Users can accept own invites" ON public.tenant_invites
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(auth.email()) AND accepted_at IS NULL AND expires_at > now())
  WITH CHECK (lower(email) = lower(auth.email()));

-- 3. empresa-assets: require tenant_id prefix in path
DROP POLICY IF EXISTS "Authenticated users can upload to empresa-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update empresa-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from empresa-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view empresa-assets" ON storage.objects;

CREATE POLICY "empresa-assets read own tenant" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'empresa-assets' AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);
CREATE POLICY "empresa-assets upload own tenant" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'empresa-assets'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'user'::app_role))
  );
CREATE POLICY "empresa-assets update own tenant" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'empresa-assets' AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);
CREATE POLICY "empresa-assets delete own tenant" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'empresa-assets' AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);

-- 4. servico-anexos: require tenant_id prefix in path
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own tenant attachments" ON storage.objects;

CREATE POLICY "servico-anexos read own tenant" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'servico-anexos' AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);
CREATE POLICY "servico-anexos upload own tenant" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'servico-anexos' AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);
CREATE POLICY "servico-anexos delete own tenant" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'servico-anexos' AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);

-- 5. Avatars: remove broad listing policy (public URLs still resolve via getPublicUrl on public bucket)
DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;
