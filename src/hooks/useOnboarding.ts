import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

export function useOnboarding() {
  const { tenant } = useTenant();
  const { user } = useAuth();

  const isOnboardingDismissed = tenant?.settings?.onboarding_completed === true;

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ["onboarding-steps", tenant?.id],
    queryFn: async () => {
      // Check real data to determine completed steps
      const [clientesRes, servicosRes, orcamentosRes, empresaRes] = await Promise.all([
        supabase.from("dim_cliente").select("id_cliente", { count: "exact", head: true }),
        supabase.from("fato_servico").select("id_servico", { count: "exact", head: true }),
        supabase.from("fato_orcamento").select("id_orcamento", { count: "exact", head: true }),
        supabase.from("dim_empresa").select("id_empresa, nome").limit(1).maybeSingle(),
      ]);

      const hasClientes = (clientesRes.count || 0) > 0;
      const hasServicos = (servicosRes.count || 0) > 0;
      const hasOrcamentos = (orcamentosRes.count || 0) > 0;
      const hasEmpresa = !!empresaRes.data?.nome;

      const stepsList: OnboardingStep[] = [
        {
          id: "empresa",
          title: "Configure sua empresa",
          description: "Defina o nome e logotipo da empresa",
          href: "/configuracoes",
          completed: hasEmpresa,
        },
        {
          id: "cliente",
          title: "Cadastre seu primeiro cliente",
          description: "Adicione um cliente para organizar projetos",
          href: "/cadastros",
          completed: hasClientes,
        },
        {
          id: "servico",
          title: "Crie um serviço",
          description: "Registre um serviço para acompanhar progresso",
          href: "/servicos",
          completed: hasServicos,
        },
        {
          id: "orcamento",
          title: "Gere um orçamento",
          description: "Crie uma proposta comercial em PDF",
          href: "/servicos-orcamentos",
          completed: hasOrcamentos,
        },
        {
          id: "dashboard",
          title: "Analise seus resultados",
          description: "Veja os indicadores financeiros e operacionais",
          href: "/",
          completed: hasClientes && hasServicos && hasOrcamentos,
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

  // Show onboarding if tenant is new (< 14 days) or hasn't dismissed
  const tenantAge = tenant?.settings?.created_at
    ? (Date.now() - new Date(tenant.settings.created_at as string).getTime()) / 86400000
    : 0;

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
