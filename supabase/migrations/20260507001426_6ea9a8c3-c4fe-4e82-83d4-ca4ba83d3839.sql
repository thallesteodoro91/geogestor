-- Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER functions in public schema.
-- These are only called from authenticated frontend code, edge functions (service_role), or triggers.

REVOKE EXECUTE ON FUNCTION public.auto_criar_servico_ao_converter_orcamento() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_user_limit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_tenant_for_user(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gerar_codigo_orcamento(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_financial_dashboard_metrics(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_financial_data(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_tenant_members() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_tenant_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_user_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.limpar_notificacoes_antigas() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verificar_pagamentos_pendentes() FROM PUBLIC, anon;