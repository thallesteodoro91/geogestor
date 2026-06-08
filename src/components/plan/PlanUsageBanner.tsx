import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "geogestor.planUsageBanner.dismissed";

type Severity = "warn" | "block";

interface ResourceUsage {
  label: string;
  current: number;
  max: number;
  ratio: number;
  severity: Severity;
}

function pickWorstUsage(
  clientsCount: number,
  propertiesCount: number,
  usersCount: number,
  maxClients: number,
  maxProperties: number,
  maxUsers: number,
): ResourceUsage | null {
  const items: ResourceUsage[] = [
    { label: "clientes", current: clientsCount, max: maxClients, ratio: clientsCount / maxClients, severity: "warn" },
    { label: "propriedades", current: propertiesCount, max: maxProperties, ratio: propertiesCount / maxProperties, severity: "warn" },
    { label: "usuários", current: usersCount, max: maxUsers, ratio: usersCount / maxUsers, severity: "warn" },
  ];

  const candidate = items
    .filter((i) => Number.isFinite(i.max) && i.max > 0 && i.ratio >= 0.8)
    .sort((a, b) => b.ratio - a.ratio)[0];

  if (!candidate) return null;
  return { ...candidate, severity: candidate.current >= candidate.max ? "block" : "warn" };
}

export function PlanUsageBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { maxUsers, maxProperties, maxClients, planSlug, isLoading, isActive } = usePlanLimits();
  const { clientsCount, propertiesCount, usersCount } = useResourceCounts();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  });

  // Hide on the subscription page itself to avoid noise
  if (location.pathname.startsWith("/assinatura")) return null;
  if (isLoading || !isActive || planSlug === "owner" || dismissed) return null;

  const usage = pickWorstUsage(
    clientsCount,
    propertiesCount,
    usersCount,
    maxClients,
    maxProperties,
    maxUsers,
  );
  if (!usage) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  const isBlock = usage.severity === "block";

  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between",
        isBlock
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">
            {isBlock
              ? `Limite de ${usage.label} atingido (${usage.current}/${usage.max})`
              : `Você está próximo do limite de ${usage.label} (${usage.current}/${usage.max})`}
          </p>
          <p className="text-xs opacity-90">
            {isBlock
              ? "Novas criações estão bloqueadas. Faça upgrade do plano para continuar."
              : "Considere fazer upgrade do plano para evitar bloqueios."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant={isBlock ? "destructive" : "default"}
          onClick={() => navigate("/assinatura")}
        >
          <Crown className="mr-1.5 h-4 w-4" />
          Fazer upgrade
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Dispensar aviso"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
