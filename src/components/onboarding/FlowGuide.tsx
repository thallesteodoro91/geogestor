import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

const FLOW_STEPS = [
  { label: "Cadastrar Cliente", href: "/cadastros", stepId: "cliente" },
  { label: "Criar Serviço", href: "/servicos", stepId: "servico" },
  { label: "Gerar Orçamento", href: "/servicos-orcamentos", stepId: "orcamento" },
  { label: "Acompanhar", href: "/servicos", stepId: "servico" },
  { label: "Analisar", href: "/", stepId: "dashboard" },
];

export function FlowGuide() {
  const navigate = useNavigate();
  const { steps, allCompleted } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || allCompleted) return null;

  const isStepDone = (stepId: string) => steps.find(s => s.id === stepId)?.completed ?? false;

  return (
    <Card className="p-4 bg-muted/30 border-dashed">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Fluxo recomendado
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDismissed(true)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {FLOW_STEPS.map((step, idx) => {
          const done = isStepDone(step.stepId);
          return (
            <div key={idx} className="flex items-center gap-1">
              <button
                onClick={() => navigate(step.href)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  done
                    ? "bg-primary/10 text-primary"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {step.label}
              </button>
              {idx < FLOW_STEPS.length - 1 && (
                <span className="text-muted-foreground/40 text-xs">→</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
