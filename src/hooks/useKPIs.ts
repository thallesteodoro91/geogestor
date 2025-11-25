import { useQuery } from "@tanstack/react-query";
import { fetchKPIs, getDefaultKPIs } from "@/services/kpi.service";

export function useKPIs() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: fetchKPIs,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}