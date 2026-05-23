import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  secondaryHref?: string;
  actionType: "import" | "create" | "view";
  completed: boolean;
  icon: string;
}

export function useOnboarding() {
  const { tenant } = useTenant();
  const { user } = useAuth();

  const isOnboardingDismissed = tenant?.settings?.onboarding_completed === true;

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ["onboarding-steps", tenant?.id, user?.id],
    queryFn: async () => {
      const [clientesRes, servicosRes, orcamentosRes, despesasRes, gcalRes] = await Promise.all([
        supabase.from("dim_cliente").select("id_cliente", { count: "exact", head: true }),
        supabase.from("fato_servico").select("id_servico", { count: "exact", head: true }),
        supabase.from("fato_orcamento").select("id_orcamento", { count: "exact", head: true }),
        supabase.from("fato_despesas").select("id_despesas", { count: "exact", head: true }),
        user?.id
          ? supabase
              .from("google_calendar_tokens")
              .select("id, connection_status")
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      const hasClientes = (clientesRes.count || 0) > 0;
      const hasServicos = (servicosRes.count || 0) > 0;
      const hasOrcamentos = (orcamentosRes.count || 0) > 0;
      const hasDespesas = (despesasRes.count || 0) > 0;
      const gcalConnected =
        !!(gcalRes as any)?.data && (gcalRes as any).data.connection_status !== "needs_reconnect";

      const stepsList: OnboardingStep[] = [
        {
          id: "cliente",
          title: "Adicione seus clientes",
          description: "Importe sua base de clientes para começar",
          href: "/clientes",
          secondaryHref: "/clientes",
          actionType: "import",
          completed: hasClientes,
          icon: "Users",
        },
        {
          id: "servico",
          title: "Crie um projeto",
          description: "Registre o primeiro projeto para acompanhar",
          href: "/projetos",
          actionType: "create",
          completed: hasServicos,
          icon: "Briefcase",
        },
        {
          id: "orcamento",
          title: "Gere um orçamento",
          description: "Crie uma proposta comercial",
          href: "/orcamentos",
          actionType: "create",
          completed: hasOrcamentos,
          icon: "FileText",
        },
        {
          id: "despesa",
          title: "Registre uma despesa",
          description: "Controle os custos do seu negócio",
          href: "/despesas",
          secondaryHref: "/despesas",
          actionType: "import",
          completed: hasDespesas,
          icon: "Receipt",
        },
        {
          id: "google_calendar",
          title: "Conecte sua agenda Google",
          description: "Sincronize orçamentos e serviços com o Google Calendar",
          href: "/configuracoes?tab=integracoes",
          actionType: "create",
          completed: gcalConnected,
          icon: "Calendar",
        },
        {
          id: "dashboard",
          title: "Veja seu painel",
          description: "Acompanhe os resultados da empresa",
          href: "/",
          actionType: "view",
          completed: hasClientes && hasServicos && hasDespesas,
          icon: "BarChart3",
        },
      ];

      return stepsList;
    },
    enabled: !!tenant && !!user && !isOnboardingDismissed,
    staleTime: 60_000,
  });

  const completedCount = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const allCompleted = completedCount === totalSteps && totalSteps > 0;

  const dismissOnboarding = async () => {
    if (!tenant) return;
    const newSettings = { ...tenant.settings, onboarding_completed: true };
    await supabase.from("tenants").update({ settings: newSettings }).eq("id", tenant.id);
  };

  const shouldShow = !isOnboardingDismissed && !isLoading;

  return {
    steps,
    completedCount,
    totalSteps,
    progress,
    allCompleted,
    shouldShow,
    isLoading,
    dismissOnboarding,
  };
}
