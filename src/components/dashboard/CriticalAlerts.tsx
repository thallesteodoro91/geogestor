import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Clock, TrendingDown, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  icon: typeof AlertCircle;
  label: string;
  count: number;
  severity: "critical" | "warning";
  href: string;
}

export function CriticalAlerts() {
  const navigate = useNavigate();

  const { data: alerts = [] } = useQuery({
    queryKey: ["critical-alerts"],
    queryFn: async () => {
      const [orcVencidos, servicosAtrasados, margemRes] = await Promise.all([
        // Orçamentos com pagamento vencido
        supabase
          .from("fato_orcamento")
          .select("id_orcamento", { count: "exact", head: true })
          .eq("situacao_do_pagamento", "Pendente")
          .lt("data_do_faturamento", new Date().toISOString().split("T")[0]),
        // Serviços atrasados (com prazo passado e não concluídos)
        supabase
          .from("fato_servico")
          .select("id_servico", { count: "exact", head: true })
          .lt("data_do_servico_fim", new Date().toISOString().split("T")[0])
          .neq("situacao_do_servico", "Concluído")
          .neq("situacao_do_servico", "Cancelado"),
        // KPI para margem negativa
        supabase.rpc("calcular_kpis_v2"),
      ]);

      const kpis = margemRes.data?.[0];
      const items: Alert[] = [];

      if ((orcVencidos.count || 0) > 0) {
        items.push({
          id: "orc-vencidos",
          icon: FileWarning,
          label: `${orcVencidos.count} orçamento(s) com pagamento vencido`,
          count: orcVencidos.count || 0,
          severity: "critical",
          href: "/servicos-orcamentos",
        });
      }

      if ((servicosAtrasados.count || 0) > 0) {
        items.push({
          id: "serv-atrasados",
          icon: Clock,
          label: `${servicosAtrasados.count} serviço(s) com prazo ultrapassado`,
          count: servicosAtrasados.count || 0,
          severity: "warning",
          href: "/servicos",
        });
      }

      if (kpis && (kpis.margem_liquida_percent || 0) < 0) {
        items.push({
          id: "margem-negativa",
          icon: TrendingDown,
          label: `Margem líquida negativa: ${(kpis.margem_liquida_percent || 0).toFixed(1)}%`,
          count: 1,
          severity: "critical",
          href: "/dashboard-financeiro",
        });
      }

      return items;
    },
    staleTime: 120_000,
  });

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 animate-fade-in">
      {alerts.map((alert) => (
        <button
          key={alert.id}
          onClick={() => navigate(alert.href)}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg p-3 text-left transition-all hover:opacity-80",
            alert.severity === "critical"
              ? "bg-destructive/10 border border-destructive/20 text-destructive"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400"
          )}
        >
          <alert.icon className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium flex-1">{alert.label}</span>
          <span className="text-xs opacity-70">Ver →</span>
        </button>
      ))}
    </div>
  );
}
