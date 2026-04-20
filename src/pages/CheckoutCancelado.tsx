import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, Check, Info } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

export default function CheckoutCancelado() {
  const navigate = useNavigate();
  const { subscription } = useTenant();

  const trialEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
    : null;

  const beneficios = [
    "Mapas via satélite ilimitados e KML",
    "Orçamentos profissionais em PDF com sua marca",
    "Equipe multi-usuário e suporte prioritário",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 to-background flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full space-y-8">
        {/* Hero empático */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-muted">
            <Info className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Sem problema, sua compra foi cancelada
          </h1>
          <p className="text-muted-foreground">
            Nada foi cobrado. Seus dados estão salvos e seguros.
          </p>
        </section>

        {/* Trial info */}
        {trialEnd && subscription?.status === "trialing" && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-center text-sm">
              ⏱️ Seu período de avaliação continua ativo até <strong>{trialEnd}</strong>
            </CardContent>
          </Card>
        )}

        {/* Reforço de valor */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="font-semibold text-sm">O que você está deixando de aproveitar:</p>
            <ul className="space-y-2">
              {beneficios.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* CTAs */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 border-0"
            onClick={() => navigate("/assinatura")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar e escolher um plano
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            asChild
          >
            <a href="mailto:suporte@geogestor.com.br?subject=Ajuda%20com%20assinatura">
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com suporte
            </a>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => navigate("/")}
          >
            Voltar ao painel
          </Button>
        </div>
      </div>
    </div>
  );
}
