import { useQuery } from "@tanstack/react-query";
import { fetchKPIs, getDefaultKPIs } from "@/services/kpi.service";
import { useAuth } from "@/hooks/useAuth";

export function useKPIs() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['kpis', user?.id],
    queryFn: fetchKPIs,
    // KPI é caro (calcular_kpis_v2). Cache longo + sem refetch on focus.
    // Invalidação explícita acontece via invalidateDashboardAndKpis após mutações.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!user,
  });

}