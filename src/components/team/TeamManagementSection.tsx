import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { TeamMembersList } from "./TeamMembersList";
import { InviteUserDialog } from "./InviteUserDialog";
import { PendingInvitesList } from "./PendingInvitesList";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";

export function TeamManagementSection() {
  const { maxUsers, isActive } = usePlanLimits();
  const { usersCount } = useResourceCounts();
  
  const isNearLimit = isActive && usersCount >= maxUsers - 1;
  const isAtLimit = isActive && usersCount >= maxUsers;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Gestão de Equipe</CardTitle>
                <CardDescription>
                  Gerencie os membros da sua equipe ({usersCount}/{maxUsers} usuários)
                </CardDescription>
              </div>
            </div>
            <InviteUserDialog />
          </div>
        </CardHeader>
        <CardContent>
          {(isNearLimit || isAtLimit) && (
            <div className="mb-4">
              <PlanLimitAlert resource="users" currentCount={usersCount} />
            </div>
          )}
        </CardContent>
      </Card>

      <PendingInvitesList />
      
      <TeamMembersList />
    </div>
  );
}
