import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/services/supabase.service";

/**
 * Hook para obter contagens de recursos do tenant atual
 * Inclui filtro explícito de tenant_id para segurança
 */
export function useResourceCounts() {
  const { data: counts, isLoading, refetch } = useQuery({
    queryKey: ['resource-counts'],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      
      if (!tenantId) {
        return { clients: 0, properties: 0, users: 0 };
      }

      // Queries com filtro explícito de tenant_id para garantir isolamento
      const [clientsResult, propertiesResult, usersResult, pendingInvitesResult] = await Promise.all([
        supabase
          .from('dim_cliente')
          .select('id_cliente', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from('dim_propriedade')
          .select('id_propriedade', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from('tenant_members')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from('tenant_invites')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString()),
      ]);

      return {
        clients: clientsResult.count || 0,
        properties: propertiesResult.count || 0,
        // Usuários = membros ativos + convites pendentes
        users: (usersResult.count || 0) + (pendingInvitesResult.count || 0),
      };
    },
    staleTime: 30000, // 30 segundos
  });

  return {
    clientsCount: counts?.clients || 0,
    propertiesCount: counts?.properties || 0,
    usersCount: counts?.users || 1,
    isLoading,
    refetch,
  };
}
