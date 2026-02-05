/**
 * Hook para buscar dados do funil de vendas
 * Agrega orçamentos por situação e calcula taxas de conversão
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/services/supabase.service";

export interface FunnelStage {
  name: string;
  value: number;
  percentage: number;
  conversionRate: number | null;
  fill: string;
}

export interface SalesFunnelData {
  stages: FunnelStage[];
  total: number;
  pendentes: number;
  aprovados: number;
}

export function useSalesFunnel() {
  return useQuery({
    queryKey: ["sales-funnel"],
    queryFn: async (): Promise<SalesFunnelData> => {
      const tenantId = await getCurrentTenantId();
      
      if (!tenantId) {
        return { stages: [], total: 0, pendentes: 0, aprovados: 0 };
      }

      const { data, error } = await supabase
        .from("fato_orcamento")
        .select("situacao")
        .eq("tenant_id", tenantId);

      if (error) {
        console.error("Erro ao buscar dados do funil:", error);
        throw error;
      }

      // Contagem por situação
      const total = data?.length || 0;
      const pendentes = data?.filter(o => o.situacao === "Pendente").length || 0;
      const aprovados = data?.filter(o => o.situacao === "Aprovado").length || 0;
      
      // Ativos = Pendentes + Aprovados (excluindo cancelados)
      const ativos = pendentes + aprovados;

      // Taxas de conversão
      const taxaAtivos = total > 0 ? (ativos / total) * 100 : 0;
      const taxaAprovados = ativos > 0 ? (aprovados / ativos) * 100 : 0;

      // Cores do gradiente (azul → teal → verde)
      const colors = {
        top: "hsl(217, 91%, 60%)",    // Azul
        middle: "hsl(173, 80%, 45%)", // Teal
        bottom: "hsl(142, 76%, 36%)", // Verde
      };

      const stages: FunnelStage[] = [
        {
          name: "Total de Orçamentos",
          value: total,
          percentage: 100,
          conversionRate: taxaAtivos,
          fill: colors.top,
        },
        {
          name: "Em Negociação",
          value: ativos,
          percentage: total > 0 ? (ativos / total) * 100 : 0,
          conversionRate: taxaAprovados,
          fill: colors.middle,
        },
        {
          name: "Aprovados",
          value: aprovados,
          percentage: total > 0 ? (aprovados / total) * 100 : 0,
          conversionRate: null,
          fill: colors.bottom,
        },
      ];

      return { stages, total, pendentes, aprovados };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
