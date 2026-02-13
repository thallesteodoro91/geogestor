import { supabase } from "@/integrations/supabase/client";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);
}

export async function createTenant(userId: string, companyName: string) {
  // Verificar se há sessão ativa antes de prosseguir
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Sessão não encontrada. Por favor, faça login novamente.');
  }

  // Usar função RPC SECURITY DEFINER para criar tenant de forma atômica
  // Isso contorna as limitações de RLS durante o onboarding
  const { data, error } = await supabase.rpc('create_tenant_for_user', {
    p_user_id: userId,
    p_company_name: companyName.trim()
  });

  if (error) throw error;

  const tenantId = data as unknown as string;

  return {
    id: tenantId,
    name: companyName.trim(),
    slug: slugify(companyName),
    logo_url: null,
    settings: {}
  };
}

export async function getUserTenant(userId: string) {
  const { data, error } = await supabase
    .from('tenant_members')
    .select(`
      tenant:tenants(*)
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.tenant || null;
}

export async function inviteUserToTenant(tenantId: string, email: string, role: 'admin' | 'user' = 'user') {
  // Por enquanto, apenas cria o registro do convite
  // A lógica completa de convite por email será implementada na Fase 5
  console.log('Invite user:', { tenantId, email, role });
  return { success: true, message: 'Funcionalidade de convite será implementada em breve.' };
}
