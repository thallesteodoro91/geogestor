import { useQuery } from "@tanstack/react-query";
import { fetchKPIs, getDefaultKPIs } from "@/services/kpi.service";
import { useAuth } from "@/hooks/useAuth";

export function useKPIs() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['kpis', user?.id],
    queryFn: fetchKPIs,
    // Fase 7: sem polling. Cache invalidado via invalidateDashboardAndKpis após mutações.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!user,
  });
}