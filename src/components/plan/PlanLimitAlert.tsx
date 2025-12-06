import { AlertTriangle, Crown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface PlanLimitAlertProps {
  resource: 'users' | 'properties' | 'clients';
  currentCount: number;
  onUpgrade?: () => void;
}

const resourceLabels: Record<string, { singular: string; plural: string }> = {
  users: { singular: 'usuário', plural: 'usuários' },
  properties: { singular: 'propriedade', plural: 'propriedades' },
  clients: { singular: 'cliente', plural: 'clientes' },
};

export function PlanLimitAlert({ resource, currentCount, onUpgrade }: PlanLimitAlertProps) {
  const { isWithinLimit, maxUsers, maxProperties, maxClients, planName, isActive } = usePlanLimits();

  if (!isActive) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Assinatura Inativa</AlertTitle>
        <AlertDescription>
          Sua assinatura está inativa. Entre em contato com o suporte para reativar.
        </AlertDescription>
      </Alert>
    );
  }

  const maxLimit = resource === 'users' ? maxUsers : resource === 'properties' ? maxProperties : maxClients;
  const withinLimit = isWithinLimit(resource, currentCount);
  const labels = resourceLabels[resource];
  const remaining = maxLimit - currentCount;

  if (withinLimit && remaining > 3) return null;

  if (!withinLimit) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Limite Atingido</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Você atingiu o limite de {maxLimit} {labels.plural} do plano {planName}.
          </span>
          {onUpgrade && (
            <Button size="sm" variant="outline" onClick={onUpgrade} className="ml-4">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Warning when approaching limit
  return (
    <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-500">Próximo do Limite</AlertTitle>
      <AlertDescription>
        Você tem apenas {remaining} {remaining === 1 ? labels.singular : labels.plural} restante(s) no plano {planName}.
      </AlertDescription>
    </Alert>
  );
}
