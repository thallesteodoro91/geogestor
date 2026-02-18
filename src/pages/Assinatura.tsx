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
  Headphones,
  WifiOff,
  Users,
  Check,
  Sparkles,
} from "lucide-react";

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
  { id: "mensal", label: "Mensal", price: 97, total: 97, perMonth: 97, period: "/mês" },
  { id: "trimestral", label: "Trimestral", price: 86, total: 260, perMonth: 86, period: "/mês" },
  { id: "semestral", label: "Semestral", price: 80, total: 480, perMonth: 80, period: "/mês" },
  { id: "anual", label: "Anual", price: 70, total: 840, perMonth: 70, period: "/mês", best: true },
];

const allFeatures = [
  "Dashboard Financeiro completo",
  "Dashboard Operacional",
  "GeoBot IA — Assistente inteligente",
  "Calendário de compromissos",
  "Gestão de clientes e propriedades",
  "Orçamentos e contratos em PDF",
  "Mapas via satélite",
  "Relatórios e exportações",
  "Equipe multi-usuário",
  "Suporte prioritário",
];

export default function Assinatura() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("anual");

  const handleSubscribe = (planLabel: string) => {
    toast.info("Redirecionando para o gateway de pagamento...", {
      description: `Plano ${planLabel} selecionado. Integração em breve.`,
    });
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

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative rounded-2xl p-[1px] cursor-pointer transition-all duration-200 ${
                    isBest
                      ? "bg-gradient-to-br from-purple-500 to-pink-500 shadow-xl shadow-purple-500/20"
                      : isSelected
                        ? "bg-gradient-to-br from-purple-400/60 to-pink-400/60"
                        : "bg-border"
                  }`}
                >
                  {isBest && (
                    <Badge className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-3 py-1 text-xs font-semibold shadow-md">
                      Melhor Valor
                    </Badge>
                  )}
                  <div className="rounded-[15px] bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl p-6 h-full flex flex-col">
                    <p className="font-semibold text-lg">{plan.label}</p>
                    <div className="mt-4 mb-1">
                      <span className="text-4xl font-extrabold">R$ {plan.perMonth}</span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>
                    {plan.total !== plan.perMonth && (
                      <p className="text-xs text-muted-foreground mb-4">
                        Total: R$ {plan.total}
                      </p>
                    )}
                    {plan.total === plan.perMonth && <div className="mb-4" />}

                    <Button
                      className={`w-full mt-auto ${
                        isBest
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 border-0"
                          : ""
                      }`}
                      variant={isBest ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubscribe(plan.label);
                      }}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Assinar Agora
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature list */}
        <section className="max-w-2xl mx-auto space-y-4">
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
      </div>
    </div>
  );
}
