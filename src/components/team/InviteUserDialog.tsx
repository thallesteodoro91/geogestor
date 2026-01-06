import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, Crown, User } from "lucide-react";
import { toast } from "sonner";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const queryClient = useQueryClient();
  
  const { maxUsers, isActive } = usePlanLimits();
  const { usersCount } = useResourceCounts();
  
  const canInvite = isActive && usersCount < maxUsers;

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { email, role },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      queryClient.invalidateQueries({ queryKey: ["resource-counts"] });
      toast.success(data?.message || "Convite enviado com sucesso!");
      setEmail("");
      setRole("user");
      setOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao enviar convite");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Digite o email do usuário");
      return;
    }

    if (!email.includes("@")) {
      toast.error("Digite um email válido");
      return;
    }

    inviteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!canInvite}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Membro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md z-[1000]">
        <DialogHeader>
          <DialogTitle>Convidar Novo Membro</DialogTitle>
          <DialogDescription>
            Envie um convite por email para adicionar um novo membro à equipe.
          </DialogDescription>
        </DialogHeader>

        {!canInvite && (
          <PlanLimitAlert resource="users" currentCount={usersCount} />
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviteMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Função</Label>
              <Select
                value={role}
                onValueChange={(value: "admin" | "user") => setRole(value)}
                disabled={inviteMutation.isPending}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <div className="text-left">
                        <p className="font-medium">Usuário</p>
                        <p className="text-xs text-muted-foreground">
                          Pode visualizar e editar dados
                        </p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      <div className="text-left">
                        <p className="font-medium">Administrador</p>
                        <p className="text-xs text-muted-foreground">
                          Acesso total + gestão de equipe
                        </p>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={inviteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending || !canInvite}>
              {inviteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enviar Convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
