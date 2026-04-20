import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  Globe,
  FileText,
  Headphones,
  WifiOff,
  Users,
  Check,
  Sparkles,
  Loader2,
  Crown,
  ExternalLink,
  ShieldCheck,
  Zap,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";

const benefits = [
  {
    icon: DollarSign,
    title: "Gestão Financeira Completa",
    description: "Dashboards, KPIs, orçamentos e controle total de receitas e despesas em tempo real.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Globe,
    title: "Mapas via Satélite Ilimitados",
    description: "Visualize propriedades com camadas geográficas, KML e análise territorial avançada.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: FileText,
    title: "Geração de Orçamentos PDF",
    description: "Crie orçamentos profissionais com sua marca em poucos cliques.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: Headphones,
    title: "Suporte Prioritário",
    description: "Atendimento dedicado com tempo de resposta reduzido e acompanhamento personalizado.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: WifiOff,
    title: "Acesso Offline — App",
    description: "Continue trabalhando mesmo sem internet. Seus dados sincronizam automaticamente.",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Users,
    title: "Multi-usuários",
    description: "Adicione sua equipe com permissões personalizadas e colabore em tempo real.",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
];

const plans = [
  { id: "mensal", label: "Mensal", price: 97, total: 97, perMonth: 97, period: "/mês", discount: null, savings: null, priceId: "price_1T2DaxK3j5PLJZVV2QghyqC5" },
  { id: "trimestral", label: "Trimestral", price: 86, total: 260, perMonth: 86, period: "/mês", discount: "Economize 11%", savings: null, priceId: "price_1T2DbOK3j5PLJZVV2o5aMbqN" },
  { id: "semestral", label: "Semestral", price: 80, total: 480, perMonth: 80, period: "/mês", discount: "Economize 18%", savings: null, priceId: "price_1T2DbfK3j5PLJZVV9qD9q5F6" },
  { id: "anual", label: "Anual", price: 70, total: 840, perMonth: 70, period: "/mês", discount: "Economize 28%", savings: "vs R$97/mês no plano mensal — você economiza R$324/ano", best: true, priceId: "price_1T2DbzK3j5PLJZVVbM9rKysr" },
];

const allFeatures = [
  "Dashboard Financeiro completo",
  "Dashboard Operacional",
  "GeoBot IA — Assistente inteligente",
  "Calendário de compromissos",
  "Gestão de clientes e propriedades",
  "Orçamentos em PDF",
  "Importe os mapas das propriedades (KML/KMZ)",
  "Relatórios e exportações",
  "Equipe multi-usuário",
  "Suporte prioritário",
];

export default function Assinatura() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("anual");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { subscription } = useTenant();
  const stripeStatus = useStripeSubscription();

  const isActiveSubscriber = stripeStatus.subscribed || 
    (subscription?.status === 'active' && subscription?.plan?.slug !== 'owner');

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error || !data?.url) throw new Error(error?.message || "Erro ao abrir portal");
      window.open(data.url, "_blank");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error("Erro ao abrir portal de gerenciamento", { description: msg });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSubscribe = async (planId: string, planLabel: string) => {
    setLoadingPlan(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Faça login para assinar um plano.");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { planId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.url) {
        throw new Error(error?.message || "Erro ao criar sessão de pagamento");
      }

      // Mobile: redirect na mesma aba evita perder contexto.
      // Desktop: nova aba mantém o app aberto.
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (isMobile) {
        window.location.href = data.url;
      } else {
        window.open(data.url, "_blank");
        toast.success("Abrimos o pagamento em uma nova aba", {
          description: "Conclua a compra para liberar o acesso completo.",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error("Erro ao iniciar pagamento", { description: msg });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-medium text-sm text-muted-foreground">Voltar às Configurações</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 md:px-8 md:py-20 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Desbloqueie todo o potencial do{" "}
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              GeoGestor
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Automatize sua gestão rural, aumente a produtividade da equipe e tome decisões baseadas em dados — tudo em uma única plataforma.
          </p>
        </section>

        {/* Active Subscription Banner */}
        {isActiveSubscriber && (
          <section className="max-w-3xl mx-auto">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-500/10 shrink-0">
                  <Crown className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="font-semibold text-lg">Você já possui uma assinatura ativa!</p>
                  <p className="text-sm text-muted-foreground">
                    Para gerenciar sua assinatura, alterar método de pagamento ou cancelar, acesse o portal de gerenciamento.
                  </p>
                </div>
                <Button
                  onClick={handleOpenPortal}
                  disabled={portalLoading}
                  className="shrink-0"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-1" />
                  )}
                  Gerenciar Assinatura
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Benefits Grid */}
        <section className="space-y-8">
          <h2 className="text-2xl font-bold text-center">Tudo que você precisa em um só lugar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b) => (
              <Card
                key={b.title}
                className="hover:scale-[1.02] hover:shadow-lg transition-all duration-200 cursor-default"
              >
                <CardContent className="p-6 space-y-3">
                  <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl ${b.bg}`}>
                    <b.icon className={`h-6 w-6 ${b.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Escolha o plano ideal para você</h2>
            <p className="text-muted-foreground">Todos os planos incluem acesso completo a todas as funcionalidades</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const isBest = plan.best;
              const isCurrentPlan = isActiveSubscriber && stripeStatus.price_id === plan.priceId;

              return (
                <div key={plan.id} className="flex flex-col">
                  {isCurrentPlan ? (
                    <div className="flex justify-center mb-0">
                      <Badge className="bg-emerald-500 text-white border-0 px-3 py-1 text-xs font-semibold shadow-md rounded-b-none rounded-t-xl">
                        <Crown className="h-3 w-3 mr-1" />
                        Seu Plano Atual
                      </Badge>
                    </div>
                  ) : isBest ? (
                    <div className="flex justify-center mb-0">
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-3 py-1 text-xs font-semibold shadow-md rounded-b-none rounded-t-xl">
                        Melhor Valor
                      </Badge>
                    </div>
                  ) : (
                    <div className="h-6" />
                  )}
                  <div
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative rounded-2xl p-[1px] cursor-pointer transition-all duration-200 flex-1 ${
                      isCurrentPlan
                        ? "bg-emerald-500 shadow-xl shadow-emerald-500/20 rounded-t-none"
                        : isBest
                          ? "bg-gradient-to-br from-purple-500 to-pink-500 shadow-xl shadow-purple-500/20 rounded-t-none"
                          : isSelected
                            ? "bg-gradient-to-br from-purple-400/60 to-pink-400/60"
                            : "bg-border"
                    }`}
                  >
                    <div className="rounded-[15px] bg-card/80 backdrop-blur-xl p-6 h-full flex flex-col">
                      <p className="font-semibold text-lg">{plan.label}</p>
                      <div className="mt-4 mb-1">
                        <span className="text-4xl font-extrabold">R$ {plan.perMonth}</span>
                        <span className="text-muted-foreground text-sm">{plan.period}</span>
                      </div>

                      {plan.discount && (
                        <span className="inline-flex items-center self-start text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 mb-2">
                          {plan.discount}
                        </span>
                      )}

                      {plan.total !== plan.perMonth && (
                        <p className="text-xs text-muted-foreground mb-1">
                          Total: R$ {plan.total}
                        </p>
                      )}

                      {plan.savings && (
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                          {plan.savings}
                        </p>
                      )}

                      {!plan.discount && !plan.savings && <div className="mb-4" />}
                      {plan.discount && !plan.savings && <div className="mb-2" />}

                      {isCurrentPlan ? (
                        <Button
                          className="w-full mt-auto"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPortal();
                          }}
                          disabled={portalLoading}
                        >
                          {portalLoading ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4 mr-1" />
                          )}
                          Gerenciar Assinatura
                        </Button>
                      ) : (
                        <Button
                          className={`w-full mt-auto ${
                            isBest
                              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 border-0"
                              : ""
                          }`}
                          variant={isBest ? "default" : "outline"}
                          disabled={loadingPlan === plan.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubscribe(plan.id, plan.label);
                          }}
                        >
                          {loadingPlan === plan.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          {loadingPlan === plan.id ? "Aguarde..." : isActiveSubscriber ? "Trocar Plano" : "Assinar Agora"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature list */}
        <section className="max-w-2xl mx-auto bg-muted/30 rounded-2xl p-8 space-y-4">
          <h3 className="text-lg font-semibold text-center">Incluso em todos os planos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {allFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-2xl mx-auto space-y-4">
          <h3 className="text-lg font-semibold text-center">Perguntas Frequentes</h3>
          <div className="space-y-3">
            {[
              {
                q: "Posso cancelar a qualquer momento?",
                a: "Sim. Você pode cancelar sua assinatura quando quiser, sem multas ou burocracia. O acesso continua até o fim do período já pago.",
              },
              {
                q: "Há período de teste gratuito?",
                a: "Oferecemos 7 dias de avaliação gratuita com acesso completo a todas as funcionalidades. Após o período, escolha um dos planos pagos para continuar usando.",
              },
              {
                q: "Quais formas de pagamento são aceitas?",
                a: "Aceitamos cartões de crédito (Visa, Mastercard, Elo, American Express), Pix e boleto bancário.",
              },
              {
                q: "Posso mudar de plano depois?",
                a: "Sim. Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. O valor é ajustado proporcionalmente.",
              },
              {
                q: "Os dados da minha empresa ficam seguros?",
                a: "Absolutamente. Todos os dados são armazenados com criptografia e backups automáticos. Você é o único proprietário das suas informações.",
              },
            ].map((item) => (
              <div key={item.q} className="bg-muted/30 rounded-xl p-5 space-y-2">
                <p className="font-semibold text-sm">{item.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center space-y-4 py-8">
          <p className="text-muted-foreground text-base">
            {isActiveSubscriber ? "Precisa de ajuda com sua assinatura?" : "Pronto para transformar sua gestão rural?"}
          </p>
          {isActiveSubscriber ? (
            <Button
              size="lg"
              variant="outline"
              className="px-10 text-base"
              onClick={handleOpenPortal}
              disabled={portalLoading}
            >
              {portalLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <ExternalLink className="h-5 w-5 mr-2" />}
              Abrir Portal de Gerenciamento
            </Button>
          ) : (
            <Button
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-10 text-base hover:opacity-90 border-0 shadow-lg shadow-purple-500/25"
              onClick={() => handleSubscribe("anual", "Anual")}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Começar Agora com Melhor Valor
            </Button>
          )}
        </section>
      </div>
    </div>
  );
}
