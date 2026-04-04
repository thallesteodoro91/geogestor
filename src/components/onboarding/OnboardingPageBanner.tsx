import { useState } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileSpreadsheet, Plus, ClipboardList } from "lucide-react";

interface OnboardingPageBannerProps {
  stepId: string;
  onImport?: () => void;
  onCreate?: () => void;
}

export function OnboardingPageBanner({ stepId, onImport, onCreate }: OnboardingPageBannerProps) {
  const { steps, shouldShow, completedCount, totalSteps } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);

  if (!shouldShow || dismissed) return null;

  const step = steps.find(s => s.id === stepId);
  if (!step || step.completed) return null;

  const stepIndex = steps.findIndex(s => s.id === stepId);

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
          <ClipboardList className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Passo {stepIndex + 1} de {totalSteps}: {step.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {step.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {step.actionType === "import" && onImport && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onImport}>
                <FileSpreadsheet className="h-3 w-3" />
                Importar planilha
              </Button>
            )}
            {onCreate && (
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onCreate}>
                <Plus className="h-3 w-3" />
                {step.actionType === "import" ? "Cadastrar manualmente" : "Criar"}
              </Button>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDismissed(true)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
