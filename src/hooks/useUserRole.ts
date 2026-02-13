import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Hook para verificar o role do usuário no tenant atual
 * Usa tenant_members.role como fonte única de verdade
 */
export function useUserRole() {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const { data: role, isLoading } = useQuery({
    queryKey: ['user-role', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user?.id || !tenant?.id) return null;
      const { data, error } = await supabase
        .from('tenant_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role || null;
    },
    enabled: !!user?.id && !!tenant?.id,
    staleTime: 60000,
  });

  return {
    role,
    isAdmin: role === 'admin',
    isLoading,
  };
}
