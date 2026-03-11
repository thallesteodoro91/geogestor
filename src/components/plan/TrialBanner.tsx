import { useTenant } from "@/contexts/TenantContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles, X } from "lucide-react";
import { useState } from "react";

export function TrialBanner() {
  const { subscription } = useTenant();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Only show for trialing subscriptions with a future end date
  if (!subscription || subscription.status !== "trialing" || !subscription.current_period_end) {
    return null;
  }

  const now = new Date();
  const periodEnd = new Date(subscription.current_period_end);
  const diffMs = periodEnd.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  // Don't show if already expired (ProtectedRoute handles that)
  if (daysLeft <= 0) return null;

  const isUrgent = daysLeft <= 2;
  const isWarning = daysLeft <= 4;

  return (
    <div
      className={`relative rounded-xl border px-4 py-3 md:px-6 md:py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 animate-fade-in ${
        isUrgent
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : isWarning
            ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
            : "bg-primary/5 border-primary/20 text-primary"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={`flex-shrink-0 rounded-full p-2 ${
            isUrgent
              ? "bg-destructive/15"
              : isWarning
                ? "bg-amber-500/15"
                : "bg-primary/10"
          }`}
        >
          <Clock className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm md:text-base">
            {daysLeft === 1
              ? "Último dia do período de avaliação!"
              : `${daysLeft} dias restantes no período de avaliação`}
          </p>
          <p className="text-xs md:text-sm opacity-80 mt-0.5">
            {isUrgent
              ? "Assine agora para não perder acesso às suas ferramentas."
              : "Assine o plano completo e garanta acesso ilimitado ao GeoGestor."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          onClick={() => navigate("/assinatura")}
          className={
            isUrgent
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          Assinar agora
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Fechar banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
