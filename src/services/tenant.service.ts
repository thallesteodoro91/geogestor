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

  // Gerar slug único
  const baseSlug = slugify(companyName);
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

  // Criar tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: companyName,
      slug: uniqueSlug,
    })
    .select()
    .single();

  if (tenantError) throw tenantError;

  // Adicionar usuário como admin do tenant
  const { error: memberError } = await supabase
    .from('tenant_members')
    .insert({
      tenant_id: tenant.id,
      user_id: userId,
      role: 'admin',
    });

  if (memberError) throw memberError;

  // Buscar plano trial
  const { data: trialPlan, error: planError } = await supabase
    .from('subscription_plans')
    .select()
    .eq('slug', 'trial')
    .single();

  if (planError) throw planError;

  // Criar assinatura trial (7 dias)
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);

  const { error: subError } = await supabase
    .from('tenant_subscriptions')
    .insert({
      tenant_id: tenant.id,
      plan_id: trialPlan.id,
      status: 'trialing',
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
    });

  if (subError) throw subError;

  // Criar registro de empresa automaticamente
  const { error: empresaError } = await supabase
    .from('dim_empresa')
    .insert({
      nome: companyName,
      tenant_id: tenant.id,
    });

  if (empresaError) {
    console.error('Erro ao criar empresa:', empresaError);
    // Não throw - empresa pode ser criada depois se necessário
  }

  return tenant;
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
