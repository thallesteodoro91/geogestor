-- Add tenant ownership validation to gerar_codigo_orcamento function
CREATE OR REPLACE FUNCTION public.gerar_codigo_orcamento(p_cliente_nome text, p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_iniciais text;
  v_partes text[];
  v_ultimo_numero integer;
  v_novo_codigo text;
  v_caller_tenant_id uuid;
BEGIN
  -- Validate tenant ownership: ensure caller belongs to the requested tenant
  v_caller_tenant_id := get_user_tenant_id(auth.uid());
  IF v_caller_tenant_id IS NULL OR v_caller_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch: unauthorized access to generate budget code for this tenant';
  END IF;

  -- Extrair iniciais do nome (primeira letra do primeiro nome + primeira letra do último nome)
  v_partes := string_to_array(trim(p_cliente_nome), ' ');
  
  IF array_length(v_partes, 1) >= 2 THEN
    v_iniciais := upper(left(v_partes[1], 1) || left(v_partes[array_length(v_partes, 1)], 1));
  ELSIF array_length(v_partes, 1) = 1 THEN
    v_iniciais := upper(left(v_partes[1], 2));
  ELSE
    v_iniciais := 'XX';
  END IF;
  
  -- Buscar o maior número usado para essas iniciais no tenant
  SELECT COALESCE(MAX(CAST(right(codigo_orcamento, 3) AS integer)), 0)
  INTO v_ultimo_numero
  FROM public.fato_orcamento
  WHERE tenant_id = p_tenant_id
    AND codigo_orcamento LIKE v_iniciais || '%'
    AND length(codigo_orcamento) = 5
    AND right(codigo_orcamento, 3) ~ '^\d{3}$';
  
  -- Gerar novo código
  v_novo_codigo := v_iniciais || lpad((v_ultimo_numero + 1)::text, 3, '0');
  
  RETURN v_novo_codigo;
END;
$function$;

-- Add tenant ownership validation to check_user_limit function
CREATE OR REPLACE FUNCTION public.check_user_limit(p_tenant_id uuid)
 RETURNS TABLE(current_users integer, max_users integer, can_invite boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_users INTEGER;
  v_max_users INTEGER;
  v_caller_tenant_id uuid;
BEGIN
  -- Validate tenant ownership: ensure caller belongs to the requested tenant
  v_caller_tenant_id := get_user_tenant_id(auth.uid());
  IF v_caller_tenant_id IS NULL OR v_caller_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch: unauthorized access to check user limits for this tenant';
  END IF;

  -- Contar usuários atuais + convites pendentes
  SELECT COUNT(*)::INTEGER INTO v_current_users
  FROM (
    SELECT user_id FROM tenant_members WHERE tenant_id = p_tenant_id
    UNION
    SELECT NULL FROM tenant_invites WHERE tenant_id = p_tenant_id AND accepted_at IS NULL AND expires_at > now()
  ) combined;
  
  -- Buscar limite do plano
  SELECT sp.max_users INTO v_max_users
  FROM tenant_subscriptions ts
  JOIN subscription_plans sp ON ts.plan_id = sp.id
  WHERE ts.tenant_id = p_tenant_id
  AND ts.status IN ('active', 'trialing')
  LIMIT 1;
  
  IF v_max_users IS NULL THEN
    v_max_users := 1;
  END IF;
  
  RETURN QUERY SELECT 
    v_current_users,
    v_max_users,
    (v_current_users < v_max_users);
END;
$function$;