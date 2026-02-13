/**
 * Hook para buscar dados do funil de vendas
 * Agrega orçamentos por situação real do banco e calcula taxas de conversão
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
  emAnalise: number;
  emNegociacao: number;
  aprovados: number;
  recusados: number;
}

export function useSalesFunnel() {
  return useQuery({
    queryKey: ["sales-funnel"],
    queryFn: async (): Promise<SalesFunnelData> => {
      const tenantId = await getCurrentTenantId();
      
      if (!tenantId) {
        return { stages: [], total: 0, emAnalise: 0, emNegociacao: 0, aprovados: 0, recusados: 0 };
      }

      const { data, error } = await supabase
        .from("fato_orcamento")
        .select("situacao")
        .eq("tenant_id", tenantId);

      if (error) {
        console.error("Erro ao buscar dados do funil:", error);
        throw error;
      }

      const total = data?.length || 0;
      const emAnalise = data?.filter(o => o.situacao === "Em Analise").length || 0;
      const emNegociacao = data?.filter(o => o.situacao === "Em Negociacao").length || 0;
      const aprovados = data?.filter(o => o.situacao === "Aprovado").length || 0;
      const recusados = data?.filter(o => o.situacao === "Recusado").length || 0;

      // Ativos = todos exceto recusados
      const ativos = total - recusados;

      // Taxas de conversão entre etapas
      const taxaAnalise = total > 0 ? (ativos / total) * 100 : 0;
      const taxaNegociacao = ativos > 0 ? (emNegociacao / ativos) * 100 : 0;
      const taxaAprovados = (emAnalise + emNegociacao) > 0 ? (aprovados / (emAnalise + emNegociacao + aprovados)) * 100 : 0;

      const colors = {
        total: "hsl(239, 84%, 67%)",     // Indigo
        analise: "hsl(217, 91%, 60%)",    // Blue
        negociacao: "hsl(173, 80%, 45%)", // Teal
        aprovados: "hsl(142, 76%, 36%)",  // Green
      };

      const stages: FunnelStage[] = [
        {
          name: "Total de Orçamentos",
          value: total,
          percentage: 100,
          conversionRate: taxaAnalise,
          fill: colors.total,
        },
        {
          name: "Em Análise",
          value: emAnalise,
          percentage: total > 0 ? (emAnalise / total) * 100 : 0,
          conversionRate: taxaNegociacao,
          fill: colors.analise,
        },
        {
          name: "Em Negociação",
          value: emNegociacao,
          percentage: total > 0 ? (emNegociacao / total) * 100 : 0,
          conversionRate: taxaAprovados,
          fill: colors.negociacao,
        },
        {
          name: "Aprovados",
          value: aprovados,
          percentage: total > 0 ? (aprovados / total) * 100 : 0,
          conversionRate: null,
          fill: colors.aprovados,
        },
      ];

      return { stages, total, emAnalise, emNegociacao, aprovados, recusados };
    },
    staleTime: 1000 * 60 * 5,
  });
}
