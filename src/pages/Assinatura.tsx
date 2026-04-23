import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Crown,
  ExternalLink,
  FileText,
  Globe,
  Headphones,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";

const MONTHLY_PRICE = 97;
const YEARLY_PRICE = 970;
const YEARLY_EQUIVALENT = 81;
const YEARLY_SAVINGS = 194;

const valueProps = [
  "Mais clareza para decidir com dashboards e indicadores em um só lugar",
  "Menos tempo perdido na operação com clientes, equipe e tarefas centralizados",
  "Tudo integrado para você parar de depender de planilhas soltas e retrabalho",
] as const;

const benefits = [
  {
    icon: Wallet,
    title: "Financeiro sem improviso",
    description: "Acompanhe receitas, despesas, margem e previsões com segurança para decidir mais rápido.",
    tone: "success",
  },
  {
    icon: Globe,
    title: "Operação e mapas no mesmo fluxo",
    description: "Gerencie propriedades, KML e execução de serviços sem trocar de ferramenta o dia inteiro.",
    tone: "info",
  },
  {
    icon: FileText,
    title: "Orçamentos profissionais em minutos",
    description: "Envie propostas com aparência profissional e transforme negociação em fechamento com mais agilidade.",
    tone: "warning",
  },
  {
    icon: Headphones,
    title: "Suporte que acelera sua equipe",
    description: "Conte com atendimento prioritário para implementar, ajustar e manter a operação rodando.",
    tone: "primary",
  },
  {
    icon: WifiOff,
    title: "Acesso mesmo no campo",
    description: "Continue trabalhando quando a internet oscilar e sincronize tudo assim que voltar a conexão.",
    tone: "accent",
  },
  {
    icon: Users,
    title: "Equipe alinhada no mesmo sistema",
    description: "Compartilhe contexto, acompanhe atividades e reduza ruído entre quem vende, planeja e executa.",
    tone: "danger",
  },
] as const;

const benefitToneClasses = {
  success: "text-success bg-success/10",
  info: "text-info bg-info/10",
  warning: "text-warning bg-warning/10",
  primary: "text-primary bg-primary/10",
  accent: "text-accent bg-accent/10",
  danger: "text-destructive bg-destructive/10",
} as const;

const plans = [
  {
    id: "mensal",
    label: "Plano Mensal",
    headline: `R$ ${MONTHLY_PRICE}/mês`,
    description: "Para começar com flexibilidade e acesso completo desde o primeiro dia.",
    kicker: "Sem compromisso anual",
    secondary: "Cobrança mensal recorrente",
    cta: "Começar agora",
    priceId: "price_1T2DaxK3j5PLJZVV2QghyqC5",
    features: ["Acesso completo", "Sem contrato", "Cancele quando quiser"],
  },
  {
    id: "anual",
    label: "Plano Anual",
    headline: `R$ ${YEARLY_PRICE}/ano`,
    description: "A forma mais rápida de decidir com clareza e pagar menos pelo acesso completo.",
    kicker: "2 meses grátis",
    secondary: `Equivalente a R$ ${YEARLY_EQUIVALENT}/mês`,
    savings: `Economize R$ ${YEARLY_SAVINGS} por ano em relação ao mensal`,
    cta: "Começar com desconto",
    priceId: "price_1TPMGBK3j5PLJZVVFGcr8tdf",
    best: true,
    features: ["Mais escolhido", "Melhor custo-benefício", "Acesso completo imediato"],
  },
] as const;

const includedItems = [
  "Dashboard financeiro e operacional completos",
  "Gestão de clientes, propriedades e equipe",
  "GeoBot IA e calendário integrado",
  "Orçamentos em PDF e relatórios executivos",
  "Mapas KML/KMZ e acompanhamento centralizado",
  "Suporte prioritário e acesso imediato",
] as const;

const trustItems = [
  { icon: ShieldCheck, label: "Pagamento 100% seguro" },
  { icon: XCircle, label: "Cancele quando quiser" },
  { icon: Zap, label: "Acesso imediato" },
] as const;

const riskItems = ["Cancele quando quiser", "Sem contrato", "Acesso imediato"] as const;

const faqItems = [
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim. Você pode cancelar quando quiser, sem multa nem burocracia. Seu acesso continua até o fim do período já pago.",
  },
  {
    q: "Existe teste antes de assinar?",
    a: "Sim. Você pode experimentar o sistema por 7 dias com acesso completo e decidir com segurança antes de contratar.",
  },
  {
    q: "O que muda entre mensal e anual?",
    a: "As funcionalidades são as mesmas. A diferença é que o anual reduz o custo total e deixa a decisão mais simples para quem já quer consolidar a operação.",
  },
  {
    q: "Meu acesso libera na hora?",
    a: "Sim. Assim que o pagamento é confirmado, o acesso é liberado imediatamente e seus dados continuam disponíveis no sistema.",
  },
] as const;

export default function Assinatura() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<(typeof plans)[number]["id"]>("anual");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { subscription } = useTenant();
  const stripeStatus = useStripeSubscription();

  useEffect(() => {
    if (searchParams.get("checkout") === "canceled") {
      toast("Compra cancelada — seus dados estão salvos", {
        description: "Quando quiser, você pode escolher um plano novamente.",
        icon: "ℹ️",
      });
      setSearchParams((prev) => {
        prev.delete("checkout");
        return prev;
      });
    }
  }, [searchParams, setSearchParams]);

  const isActiveSubscriber = stripeStatus.subscribed ||
    (subscription?.status === "active" && subscription?.plan?.slug !== "owner");

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

  const handleSubscribe = async (planId: string) => {
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
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Voltar às Configurações</span>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-10 md:px-8 md:py-16">
        <section className="mx-auto flex max-w-5xl flex-col gap-8">
          <PageHeader
            title="Assinatura"
            subtitle="Escolha em segundos o plano que mantém sua operação, equipe e gestão financeira no controle."
          />

          <div className="grid gap-6 rounded-lg border border-border/80 bg-card/70 p-6 shadow-sm lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  Oferta simples, sem confusão
                </Badge>
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                    Tenha controle total do seu negócio em um único lugar
                  </h2>
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                    Organize financeiro, operação, clientes e equipe sem planilhas soltas, retrabalho ou perda de contexto.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {valueProps.map((item) => (
                  <div key={item} className="rounded-md border border-border/70 bg-background/60 p-4">
                    <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Check className="h-4 w-4" />
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{item}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {trustItems.map((item) => (
                  <div key={item.label} className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-2">
                    <item.icon className="h-4 w-4 text-success" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <Card className="border-primary/25 bg-primary/5 shadow-sm">
              <CardContent className="flex h-full flex-col gap-5 p-6">
                <div className="space-y-2">
                  <Badge className="bg-primary text-primary-foreground">Mais escolhido</Badge>
                  <h3 className="text-xl font-semibold text-foreground">Plano Anual</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Menor custo mensal, decisão mais simples e tudo o que você precisa para operar com confiança.
                  </p>
                </div>

                <div className="space-y-3 rounded-md border border-primary/20 bg-background/80 p-5">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-foreground">R$ {YEARLY_PRICE}</span>
                    <span className="pb-1 text-sm text-muted-foreground">/ano</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-success text-success-foreground">2 meses grátis</Badge>
                    <Badge variant="outline" className="border-border text-foreground">Equivalente a R$ {YEARLY_EQUIVALENT}/mês</Badge>
                  </div>
                  <p className="text-sm font-medium text-success">Economize R$ {YEARLY_SAVINGS} por ano em relação ao plano mensal.</p>
                </div>

                {isActiveSubscriber && stripeStatus.price_id === "price_1TPMGBK3j5PLJZVVFGcr8tdf" ? (
                  <Button onClick={handleOpenPortal} disabled={portalLoading}>
                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Gerenciar assinatura
                  </Button>
                ) : (
                  <Button onClick={() => handleSubscribe("anual")} disabled={loadingPlan === "anual"}>
                    {loadingPlan === "anual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Começar com desconto
                  </Button>
                )}

                <div className="grid gap-2 text-sm text-muted-foreground">
                  {riskItems.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {isActiveSubscriber && (
          <section className="mx-auto w-full max-w-4xl">
            <Card className="border-success/30 bg-success/5">
              <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-success/10">
                  <Crown className="h-6 w-6 text-success" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-lg font-semibold text-foreground">Você já possui uma assinatura ativa</p>
                  <p className="text-sm text-muted-foreground">
                    Para alterar pagamento, trocar plano ou cancelar, use o portal de gerenciamento.
                  </p>
                </div>
                <Button onClick={handleOpenPortal} disabled={portalLoading} className="shrink-0">
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Gerenciar assinatura
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        <section className="mx-auto w-full max-w-5xl space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold text-foreground">Escolha sem dúvida, com clareza total de valor</h2>
            <p className="text-base text-muted-foreground">
              Duas opções, mesmo acesso completo e uma decisão fácil em menos de 5 segundos.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const isCurrentPlan = isActiveSubscriber && stripeStatus.price_id === plan.priceId;
              const isLoading = loadingPlan === plan.id;

              return (
                <Card
                  key={plan.id}
                  className={`relative border transition-all duration-200 ${
                    plan.best
                      ? "border-primary shadow-sm shadow-primary/15"
                      : isSelected
                        ? "border-primary/50"
                        : "border-border"
                  } ${isCurrentPlan ? "border-success shadow-sm shadow-success/15" : ""}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <CardContent className="flex h-full flex-col gap-6 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-foreground">{plan.label}</h3>
                          {isCurrentPlan ? (
                            <Badge className="bg-success text-success-foreground">Seu plano atual</Badge>
                          ) : plan.best ? (
                            <Badge className="bg-primary text-primary-foreground">Mais escolhido</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-md border border-border/70 bg-background/70 p-5">
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-foreground">{plan.headline.replace('/ano','').replace('/mês','')}</span>
                        <span className="pb-1 text-sm text-muted-foreground">
                          {plan.id === "anual" ? "/ano" : "/mês"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={plan.best ? "default" : "outline"} className={plan.best ? "bg-success text-success-foreground" : "border-border text-foreground"}>
                          {plan.kicker}
                        </Badge>
                        <Badge variant="outline" className="border-border text-foreground">
                          {plan.secondary}
                        </Badge>
                      </div>
                      {"savings" in plan && plan.savings ? (
                        <p className="text-sm font-medium text-success">{plan.savings}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-success" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    {isCurrentPlan ? (
                      <Button
                        variant="outline"
                        className="mt-auto"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenPortal();
                        }}
                        disabled={portalLoading}
                      >
                        {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        Gerenciar assinatura
                      </Button>
                    ) : (
                      <Button
                        variant={plan.best ? "default" : "outline"}
                        className="mt-auto"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSubscribe(plan.id);
                        }}
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {plan.cta}
                      </Button>
                    )}

                    {!isCurrentPlan ? (
                      <p className="text-center text-xs text-muted-foreground">
                        Cancele quando quiser · Sem contrato · Acesso imediato
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold text-foreground">Resultados reais, não só funcionalidades</h2>
            <p className="text-base text-muted-foreground">
              Tudo o que você precisa para ter controle, velocidade e previsibilidade na gestão.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="border-border/80 bg-card/70">
                <CardContent className="space-y-4 p-6">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-md ${benefitToneClasses[benefit.tone]}`}>
                    <benefit.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">{benefit.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{benefit.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl rounded-lg border border-border/80 bg-muted/30 p-6 md:p-8">
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <h3 className="text-2xl font-semibold text-foreground">Incluído em qualquer plano</h3>
              <p className="text-sm text-muted-foreground">Você não perde funcionalidade escolhendo mensal ou anual. A diferença é só o melhor custo total.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {includedItems.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-4 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl">
          <Card className="border-success/30 bg-success/5">
            <CardContent className="space-y-4 p-8 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <ShieldCheck className="h-6 w-6 text-success" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-foreground">Risco quase zero para começar</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Você entra com acesso imediato, sem contrato e com liberdade para cancelar quando quiser. Se não fizer sentido, seus dados continuam salvos.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-foreground">
                {riskItems.map((item) => (
                  <div key={item} className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-background/80 px-3 py-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-3xl space-y-4">
          <h3 className="text-center text-2xl font-semibold text-foreground">Perguntas frequentes</h3>
          <div className="space-y-3">
            {faqItems.map((item) => (
              <div key={item.q} className="rounded-md border border-border/70 bg-card/70 p-5">
                <p className="text-sm font-semibold text-foreground">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-2 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              {isActiveSubscriber ? "Precisa ajustar sua assinatura?" : "Pronto para decidir com clareza total?"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isActiveSubscriber
                ? "Gerencie cobrança, forma de pagamento e plano atual em poucos cliques."
                : "Escolha uma das duas opções e comece agora, sem dúvida e sem confusão."}
            </p>
          </div>

          {isActiveSubscriber ? (
            <Button size="lg" variant="outline" onClick={handleOpenPortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ExternalLink className="h-5 w-5" />}
              Gerenciar assinatura
            </Button>
          ) : (
            <Button size="lg" onClick={() => handleSubscribe(selectedPlan)} disabled={loadingPlan === selectedPlan}>
              {loadingPlan === selectedPlan ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {selectedPlan === "anual" ? "Começar com desconto" : "Começar agora"}
            </Button>
          )}

          <p className="text-xs text-muted-foreground">Cancele quando quiser · Sem contrato · Acesso imediato</p>
        </section>
      </div>
    </div>
  );
}
