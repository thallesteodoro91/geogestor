import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingInvite {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
  expires_at: string;
}

export function PendingInvitesList() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: invites, isLoading } = useQuery({
    queryKey: ["pending-invites", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("tenant_invites")
        .select("*")
        .eq("tenant_id", tenant.id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PendingInvite[];
    },
    enabled: !!tenant?.id,
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("tenant_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      toast.success("Convite cancelado");
    },
    onError: (error: any) => {
      toast.error(`Erro ao cancelar convite: ${error.message}`);
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (invite: PendingInvite) => {
      // Delete old invite
      await supabase
        .from("tenant_invites")
        .delete()
        .eq("id", invite.id);

      // Create new invite via edge function
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { email: invite.email, role: invite.role },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      toast.success("Convite reenviado");
    },
    onError: (error: any) => {
      toast.error(`Erro ao reenviar convite: ${error.message}`);
    },
  });

  const formatExpiry = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    
    if (expiry < now) return "Expirado";
    
    return `Expira ${formatDistanceToNow(expiry, { 
      locale: ptBR, 
      addSuffix: true 
    })}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Convites Pendentes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!invites || invites.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Convites Pendentes</CardTitle>
        </div>
        <CardDescription>
          {invites.length} convite{invites.length !== 1 ? "s" : ""} aguardando resposta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatExpiry(invite.expires_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {invite.role === "admin" ? "Admin" : "Usuário"}
                </Badge>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => resendInviteMutation.mutate(invite)}
                  disabled={resendInviteMutation.isPending}
                  title="Reenviar convite"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => cancelInviteMutation.mutate(invite.id)}
                  disabled={cancelInviteMutation.isPending}
                  title="Cancelar convite"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
