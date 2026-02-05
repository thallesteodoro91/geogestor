
# Plano: Corrigir Erro de RLS na Criação de Novo Tenant

## Problema Identificado

O erro `"new row violates row-level security policy for table 'tenants'"` ocorre quando um novo usuário (especialmente via Google OAuth) tenta criar um tenant automaticamente. 

**Causa Raiz:**
A política de INSERT na tabela `tenants` verifica se o usuário NÃO existe em `tenant_members`. Porém, há um problema de **avaliação circular das políticas RLS**:
- Para inserir em `tenants`, precisa consultar `tenant_members`
- A tabela `tenant_members` também tem RLS ativada
- Isso pode causar comportamento inesperado dependendo da ordem de avaliação

## Solução

Criar uma **função SECURITY DEFINER** que executa toda a criação do tenant de forma atômica, contornando as limitações de RLS durante o onboarding.

### Etapa 1: Criar função `create_tenant_for_user`

```sql
CREATE OR REPLACE FUNCTION public.create_tenant_for_user(
  p_user_id UUID,
  p_company_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_slug TEXT;
  v_trial_plan_id UUID;
  v_trial_end TIMESTAMPTZ;
BEGIN
  -- Verificar se usuário já tem tenant
  IF EXISTS (SELECT 1 FROM tenant_members WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  -- Gerar slug único
  v_slug := lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 8);

  -- Criar tenant
  INSERT INTO tenants (name, slug)
  VALUES (p_company_name, v_slug)
  RETURNING id INTO v_tenant_id;

  -- Adicionar usuário como admin
  INSERT INTO tenant_members (tenant_id, user_id, role)
  VALUES (v_tenant_id, p_user_id, 'admin');

  -- Buscar plano trial
  SELECT id INTO v_trial_plan_id
  FROM subscription_plans
  WHERE slug = 'trial'
  LIMIT 1;

  IF v_trial_plan_id IS NOT NULL THEN
    v_trial_end := NOW() + INTERVAL '7 days';
    
    INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
    VALUES (v_tenant_id, v_trial_plan_id, 'trialing', NOW(), v_trial_end);
  END IF;

  -- Criar empresa
  INSERT INTO dim_empresa (nome, tenant_id)
  VALUES (p_company_name, v_tenant_id);

  RETURN jsonb_build_object(
    'id', v_tenant_id,
    'name', p_company_name,
    'slug', v_slug
  );
END;
$$;
```

### Etapa 2: Atualizar `tenant.service.ts`

```typescript
export async function createTenant(userId: string, companyName: string) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Sessão não encontrada.');
  }

  // Usar função RPC ao invés de INSERT direto
  const { data, error } = await supabase.rpc('create_tenant_for_user', {
    p_user_id: userId,
    p_company_name: companyName.trim()
  });

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    logo_url: null,
    settings: {}
  };
}
```

### Etapa 3: Atualizar `TenantContext.tsx`

O contexto já chama `createTenant()`, então a mudança será transparente após a atualização do service.

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | Criar | Função `create_tenant_for_user` SECURITY DEFINER |
| `src/services/tenant.service.ts` | Modificar | Usar `supabase.rpc()` em vez de INSERT direto |

---

## Benefícios

1. **Atômico**: Toda a criação acontece em uma transação
2. **Seguro**: SECURITY DEFINER contorna RLS apenas para esta operação específica
3. **Robusto**: Elimina problemas de timing/race conditions
4. **Compatível**: Funciona com qualquer método de autenticação (email, Google, etc.)
