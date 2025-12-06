import { useTenant } from "@/contexts/TenantContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, Users, MapPin, UserCircle, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UsageBarProps {
  label: string;
  current: number;
  max: number;
  icon: React.ReactNode;
}

function UsageBar({ label, current, max, icon }: UsageBarProps) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={isAtLimit ? "text-destructive font-medium" : isNearLimit ? "text-yellow-500" : ""}>
          {current} / {max}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""}`}
      />
    </div>
  );
}

interface PlanInfoCardProps {
  clientsCount?: number;
  propertiesCount?: number;
  usersCount?: number;
}

export function PlanInfoCard({ clientsCount = 0, propertiesCount = 0, usersCount = 1 }: PlanInfoCardProps) {
  const { subscription } = useTenant();
  const { planName, maxUsers, maxClients, maxProperties, isTrialing, isActive, features } = usePlanLimits();

  const periodEnd = subscription?.current_period_end 
    ? format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  const statusBadge = () => {
    if (!isActive) {
      return <Badge variant="destructive">Inativo</Badge>;
    }
    if (isTrialing) {
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Trial</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-500/20 text-green-600 border-green-500/30">Ativo</Badge>;
  };

  const featuresList = Object.entries(features)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle>Plano & Assinatura</CardTitle>
          </div>
          {statusBadge()}
        </div>
        <CardDescription>
          Gerencie seu plano e acompanhe o uso de recursos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div>
            <p className="font-medium text-lg">{planName}</p>
            {periodEnd && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {isTrialing ? "Trial expira em" : "Próxima cobrança"}: {periodEnd}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Uso de Recursos</h4>
          <UsageBar 
            label="Clientes" 
            current={clientsCount} 
            max={maxClients} 
            icon={<UserCircle className="h-4 w-4" />}
          />
          <UsageBar 
            label="Propriedades" 
            current={propertiesCount} 
            max={maxProperties} 
            icon={<MapPin className="h-4 w-4" />}
          />
          <UsageBar 
            label="Usuários" 
            current={usersCount} 
            max={maxUsers} 
            icon={<Users className="h-4 w-4" />}
          />
        </div>

        {featuresList.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Funcionalidades Incluídas</h4>
            <div className="grid grid-cols-2 gap-2">
              {featuresList.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
