import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Upload, Users, Settings, ArrowRight, Sparkles } from "lucide-react";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";
import { useTenant } from "@/contexts/TenantContext";

export default function CheckoutSucesso() {
  const navigate = useNavigate();
  const { refetch, subscription_end } = useStripeSubscription();
  const { refetchTenant } = useTenant();

  useEffect(() => {
    // Refresh subscription status on mount (Stripe may need a moment to propagate)
    refetch();
    refetchTenant();
    const t = setTimeout(() => {
      refetch();
      refetchTenant();
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  const nextSteps = [
    {
      icon: Upload,
      title: "Importar minha planilha",
      description: "Traga clientes, propriedades e orçamentos de uma vez só.",
      href: "/importacao",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Users,
      title: "Cadastrar primeiro cliente",
      description: "Comece pelo básico e construa sua base de relacionamento.",
      href: "/clientes",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Settings,
      title: "Personalizar minha empresa",
      description: "Logo, template de orçamento, equipe e integrações.",
      href: "/configuracoes",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  const proximaCobranca = subscription_end
    ? new Date(subscription_end).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-background to-purple-50/30 dark:from-emerald-950/20 dark:via-background dark:to-purple-950/10">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20 space-y-10">
        {/* Hero confirmação */}
        <section className="text-center space-y-5">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/5 animate-in zoom-in duration-500">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Pagamento confirmado! 🎉
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Bem-vindo ao GeoGestor. Vamos configurar sua empresa em 2 minutos.
            </p>
          </div>

          {proximaCobranca && (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
              <Sparkles className="h-3 w-3" />
              Próxima cobrança em {proximaCobranca}
            </div>
          )}
        </section>

        {/* Próximos passos */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-center">Por onde começar?</h2>
          <div className="grid gap-3">
            {nextSteps.map((step) => (
              <Card
                key={step.title}
                className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => navigate(step.href)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`inline-flex items-center justify-center h-11 w-11 rounded-xl ${step.bg} shrink-0`}>
                    <step.icon className={`h-5 w-5 ${step.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA principal */}
        <section className="space-y-4 text-center pt-2">
          <Button
            size="lg"
            className="w-full sm:w-auto px-10 text-base bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 border-0 shadow-lg shadow-purple-500/20"
            onClick={() => navigate("/")}
          >
            Começar agora
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground">
            ✉️ Recibo enviado para o seu e-mail · Acesso liberado imediatamente
          </p>
        </section>
      </div>
    </div>
  );
}
