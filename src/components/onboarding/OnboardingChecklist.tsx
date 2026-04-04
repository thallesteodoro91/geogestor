import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/hooks/useOnboarding";
import {
  CheckCircle2, Circle, Rocket, X, ChevronDown, ChevronUp,
  Users, Briefcase, FileText, Receipt, BarChart3, FileSpreadsheet, Plus, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Briefcase, FileText, Receipt, BarChart3,
};

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { steps, completedCount, totalSteps, progress, allCompleted, shouldShow, dismissOnboarding } = useOnboarding();
  const { refetchTenant } = useTenant();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!shouldShow || dismissed) return null;

  const handleDismiss = async () => {
    await dismissOnboarding();
    await refetchTenant();
    setDismissed(true);
  };

  if (allCompleted && !dismissed) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-heading font-semibold text-foreground">
              🎉 Parabéns! Configuração completa!
            </h3>
            <p className="text-sm text-muted-foreground">
              Sua empresa está pronta para ser gerida. Explore os dashboards e análises.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  const nextStepIndex = steps.findIndex(s => !s.completed);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent overflow-hidden animate-fade-in">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-foreground">
                Bem-vindo ao GeoGestor! 🎯
              </h3>
              <p className="text-xs text-muted-foreground">
                Sua empresa está {progress}% configurada
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              Pular configuração
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs font-medium text-muted-foreground">{completedCount}/{totalSteps}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-1">
          {steps.map((step, idx) => {
            const isNext = idx === nextStepIndex;
            const StepIcon = ICON_MAP[step.icon] || Circle;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 transition-all",
                  step.completed
                    ? "opacity-50"
                    : isNext
                      ? "bg-primary/5 ring-1 ring-primary/20"
                      : ""
                )}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <StepIcon className={cn("h-5 w-5 shrink-0", isNext ? "text-primary" : "text-muted-foreground/40")} />
                )}

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium",
                    step.completed ? "line-through text-muted-foreground" : "text-foreground"
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>

                {!step.completed && isNext && (
                  <div className="flex items-center gap-2 shrink-0">
                    {step.actionType === "import" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => navigate(step.href)}
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        Importar planilha
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => navigate(step.href)}
                    >
                      {step.actionType === "view" ? (
                        <><Eye className="h-3 w-3" />Ver painel</>
                      ) : step.actionType === "import" ? (
                        <><Plus className="h-3 w-3" />Cadastrar</>
                      ) : (
                        <><Plus className="h-3 w-3" />Criar</>
                      )}
                    </Button>
                  </div>
                )}

                {!step.completed && !isNext && (
                  <button
                    onClick={() => navigate(step.href)}
                    className="text-xs text-muted-foreground/60 hover:text-foreground shrink-0"
                  >
                    Ir →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
