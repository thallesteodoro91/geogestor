import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useResourceCounts() {
  const { data: counts, isLoading } = useQuery({
    queryKey: ['resource-counts'],
    queryFn: async () => {
      const [clientsResult, propertiesResult, usersResult] = await Promise.all([
        supabase.from('dim_cliente').select('id_cliente', { count: 'exact', head: true }),
        supabase.from('dim_propriedade').select('id_propriedade', { count: 'exact', head: true }),
        supabase.from('tenant_members').select('id', { count: 'exact', head: true }),
      ]);

      return {
        clients: clientsResult.count || 0,
        properties: propertiesResult.count || 0,
        users: usersResult.count || 0,
      };
    },
  });

  return {
    clientsCount: counts?.clients || 0,
    propertiesCount: counts?.properties || 0,
    usersCount: counts?.users || 1,
    isLoading,
  };
}
