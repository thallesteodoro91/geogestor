import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Crown, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TeamMember {
  id: string;
  user_id: string;
  role: "admin" | "user";
  joined_at: string;
  email?: string;
}

export function TeamMembersList() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("tenant_members")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("joined_at", { ascending: true });

      if (error) throw error;
      return data as TeamMember[];
    },
    enabled: !!tenant?.id,
  });

  const { data: currentMember } = useQuery({
    queryKey: ["current-member", tenant?.id, user?.id],
    queryFn: async () => {
      if (!tenant?.id || !user?.id) return null;

      const { data, error } = await supabase
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", tenant.id)
        .eq("user_id", user.id)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!tenant?.id && !!user?.id,
  });

  const isAdmin = currentMember?.role === "admin";

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("tenant_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["resource-counts"] });
      toast.success("Membro removido com sucesso");
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover membro: ${error.message}`);
    },
  });

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Membros da Equipe</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Membros da Equipe</CardTitle>
        </div>
        <CardDescription>
          {members?.length || 0} membro{(members?.length || 0) !== 1 ? "s" : ""} ativo{(members?.length || 0) !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members?.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(member.email || member.user_id)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {member.email || `Usuário ${member.user_id.slice(0, 8)}`}
                    </p>
                    {member.user_id === user?.id && (
                      <Badge variant="outline" className="text-xs">Você</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Desde {formatDate(member.joined_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  variant={member.role === "admin" ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  {member.role === "admin" ? (
                    <Crown className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  {member.role === "admin" ? "Admin" : "Usuário"}
                </Badge>

                {isAdmin && member.user_id !== user?.id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover Membro</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover este membro da equipe? 
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMemberMutation.mutate(member.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}

          {(!members || members.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum membro encontrado</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
