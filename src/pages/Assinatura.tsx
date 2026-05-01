import { useEffect, useRef, useState } from "react";
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
import {
  VALID_PLANOS,
  VALID_OFERTAS,
  isValidPlano,
  isValidOferta,
  parsePlano,
  parseOferta,
  buildCheckoutAuditEntry,
  logCheckoutRejection,
  logCheckoutRecoveryClick,
  type PlanId as CheckoutPlanId,
  type OfertaId,
} from "@/lib/checkoutValidation";
import {
  ASSINATURA_TOASTS,
  formatPlanoExibido,
  formatParamsInvalidos,
} from "@/lib/assinaturaToasts";

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

type PlanId = CheckoutPlanId;

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

  const [selectedPlan, setSelectedPlanState] = useState<PlanId>(parsePlano(searchParams.get("plano")));
  const [selectedOferta, setSelectedOfertaState] = useState<OfertaId>(parseOferta(searchParams.get("oferta")));

  const updateUrlParams = (next: { plano?: PlanId; oferta?: OfertaId }) => {
    setSearchParams(
      (prev) => {
        if (next.plano) prev.set("plano", next.plano);
        if (next.oferta) {
          if (next.oferta === "padrao") prev.delete("oferta");
          else prev.set("oferta", next.oferta);
        }
        return prev;
      },
      { replace: true },
    );
  };

  const setSelectedPlan = (plan: PlanId) => {
    setSelectedPlanState(plan);
    updateUrlParams({ plano: plan });
  };

  const setSelectedOferta = (oferta: OfertaId) => {
    setSelectedOfertaState(oferta);
    updateUrlParams({ oferta });
  };

  // Sanitiza parâmetros inválidos da URL sempre que ela mudar
  // (cobre primeira carga, refresh com valores quebrados e navegação back/forward)
  // Usamos uma ref para evitar repetir o mesmo toast para o mesmo par inválido.
  const lastInvalidToastRef = useRef<string | null>(null);
  useEffect(() => {
    const rawPlano = searchParams.get("plano");
    const rawOferta = searchParams.get("oferta");
    const planoInvalido = rawPlano !== null && !isValidPlano(rawPlano);
    const ofertaInvalida = rawOferta !== null && !isValidOferta(rawOferta);

    if (planoInvalido || ofertaInvalida) {
      const signature = `${planoInvalido ? rawPlano : ""}|${ofertaInvalida ? rawOferta : ""}`;
      setSearchParams(
        (prev) => {
          if (planoInvalido) prev.delete("plano");
          if (ofertaInvalida) prev.delete("oferta");
          return prev;
        },
        { replace: true },
      );
      if (lastInvalidToastRef.current !== signature) {
        lastInvalidToastRef.current = signature;
        const partes = formatParamsInvalidos({
          planoInvalido: planoInvalido ? rawPlano : null,
          ofertaInvalida: ofertaInvalida ? rawOferta : null,
        });
        toast(ASSINATURA_TOASTS.paramInvalido(partes), { icon: "ℹ️" });
      }
      return;
    }

    // URL válida — limpa a assinatura para permitir avisar de novo se voltar a ficar inválida
    lastInvalidToastRef.current = null;

    // Sincroniza estado quando a URL muda externamente (ex: voltar/avançar do navegador)
    const urlPlan = parsePlano(rawPlano);
    setSelectedPlanState((current) => (current !== urlPlan ? urlPlan : current));
    const urlOferta = parseOferta(rawOferta);
    setSelectedOfertaState((current) => (current !== urlOferta ? urlOferta : current));
  }, [searchParams]);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { subscription } = useTenant();
  const stripeStatus = useStripeSubscription();

  useEffect(() => {
    const status = searchParams.get("checkout");
    if (!status) return;

    if (status === "canceled") {
      toast(ASSINATURA_TOASTS.checkoutCancelado.message, {
        description: ASSINATURA_TOASTS.checkoutCancelado.description,
        icon: "ℹ️",
      });
    } else if (status === "approved") {
      toast.success(ASSINATURA_TOASTS.checkoutApproved.message, {
        description: ASSINATURA_TOASTS.checkoutApproved.description,
      });
    } else if (status === "failed") {
      toast.error(ASSINATURA_TOASTS.checkoutFailed.message, {
        description: ASSINATURA_TOASTS.checkoutFailed.description,
      });
    } else if (status === "processing") {
      toast(ASSINATURA_TOASTS.checkoutProcessing.message, {
        description: ASSINATURA_TOASTS.checkoutProcessing.description,
        icon: "⏳",
      });
    }

    if (["canceled", "approved", "failed", "processing"].includes(status)) {
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
      toast.error(ASSINATURA_TOASTS.erroPortal.message, { description: msg });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    // Validação defensiva: garante que só enviamos valores reconhecidos ao backend,
    // mesmo que o estado tenha sido influenciado por uma URL adulterada manualmente.
    if (!isValidPlano(planId)) {
      const planoExibido = formatPlanoExibido(planId);
      const auditEntry = buildCheckoutAuditEntry({
        rejectedPlanId: planId,
        currentSelectedPlan: selectedPlan,
        currentSelectedOferta: selectedOferta,
        urlPlano: searchParams.get("plano"),
        urlOferta: searchParams.get("oferta"),
        url: typeof window !== "undefined" ? window.location.href : null,
      });
      // Auditoria 1: registra rejeição no console (filtre por [AUDIT][CHECKOUT])
      logCheckoutRejection(auditEntry);

      const copy = ASSINATURA_TOASTS.planoInvalido(planoExibido, VALID_PLANOS);
      toast.error(copy.message, {
        description: copy.description,
        duration: copy.duration,
        action: {
          label: copy.actionLabel,
          onClick: () => {
            // Auditoria 2: registra ação tomada pelo usuário no toast
            logCheckoutRecoveryClick(auditEntry);
            setSelectedPlan("anual");
          },
        },
      });
      // Reseta para o padrão para que o próximo clique já parta de um estado válido
      setSelectedPlan("anual");
      return;
    }
    const safeOferta: OfertaId = isValidOferta(selectedOferta) ? selectedOferta : "padrao";

    setLoadingPlan(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(ASSINATURA_TOASTS.semSessao);
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { planId, oferta: safeOferta },
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
        toast.success(ASSINATURA_TOASTS.checkoutAberto.message, {
          description: ASSINATURA_TOASTS.checkoutAberto.description,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast.error(ASSINATURA_TOASTS.erroCheckout.message, { description: msg });
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
                <div className="space-y-3">
                  <div className="inline-flex rounded-md border border-border bg-background/80 p-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPlan("anual")}
                      className={`relative rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedPlan === "anual"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Anual
                      <span className="ml-1.5 rounded bg-success/20 px-1 py-0.5 text-[10px] font-semibold text-success">
                        -17%
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPlan("mensal")}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedPlan === "mensal"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Mensal
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedPlan === "anual" ? (
                      <Badge className="bg-primary text-primary-foreground">Mais escolhido</Badge>
                    ) : (
                      <Badge variant="outline" className="border-border text-foreground">Sem compromisso anual</Badge>
                    )}
                    {selectedOferta === "premium" && (
                      <Badge className="bg-warning text-warning-foreground inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Oferta premium
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {selectedPlan === "anual" ? "Plano Anual" : "Plano Mensal"}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selectedPlan === "anual"
                      ? "Menor custo mensal, decisão mais simples e tudo o que você precisa para operar com confiança."
                      : "Comece com flexibilidade total e acesso completo desde o primeiro dia."}
                  </p>
                </div>

                <div className="space-y-3 rounded-md border border-primary/20 bg-background/80 p-5">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-foreground">
                      R$ {selectedPlan === "anual" ? YEARLY_PRICE : MONTHLY_PRICE}
                    </span>
                    <span className="pb-1 text-sm text-muted-foreground">
                      {selectedPlan === "anual" ? "/ano" : "/mês"}
                    </span>
                  </div>
                  {selectedPlan === "anual" ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-success text-success-foreground">2 meses grátis</Badge>
                        <Badge variant="outline" className="border-border text-foreground">Equivalente a R$ {YEARLY_EQUIVALENT}/mês</Badge>
                      </div>
                      <p className="text-sm font-medium text-success">Economize R$ {YEARLY_SAVINGS} por ano em relação ao plano mensal.</p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-border text-foreground">Cobrança mensal recorrente</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Quer pagar menos? O plano anual sai por R$ {YEARLY_EQUIVALENT}/mês (R$ {YEARLY_SAVINGS} de economia).
                      </p>
                    </>
                  )}
                </div>

                {(() => {
                  const currentPriceId = selectedPlan === "anual"
                    ? "price_1TPMGBK3j5PLJZVVFGcr8tdf"
                    : "price_1T2DaxK3j5PLJZVV2QghyqC5";
                  const isCurrentPlan = isActiveSubscriber && stripeStatus.price_id === currentPriceId;
                  if (isCurrentPlan) {
                    return (
                      <Button onClick={handleOpenPortal} disabled={portalLoading}>
                        {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        Gerenciar assinatura
                      </Button>
                    );
                  }
                  return (
                    <Button onClick={() => handleSubscribe(selectedPlan)} disabled={loadingPlan === selectedPlan}>
                      {loadingPlan === selectedPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {selectedPlan === "anual" ? "Começar com desconto" : "Começar agora"}
                    </Button>
                  );
                })()}

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
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => navigate("/faturas")}>
                    <FileText className="h-4 w-4" />
                    Ver faturas
                  </Button>
                  <Button onClick={handleOpenPortal} disabled={portalLoading}>
                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Gerenciar assinatura
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

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
