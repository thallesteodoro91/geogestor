import { useQuery } from "@tanstack/react-query";
import { fetchKPIs, getDefaultKPIs } from "@/services/kpi.service";
import { useAuth } from "@/hooks/useAuth";

export function useKPIs() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['kpis', user?.id],
    queryFn: fetchKPIs,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    enabled: !!user, // Só busca KPIs se usuário estiver autenticado
  });
}