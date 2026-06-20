import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Palette, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { useTheme } from "next-themes";

export function AccountTab() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.id,
  });

  useEffect(() => {
    if (currentUser) {
      setUserEmail(currentUser.email || "");
      setUserName(currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || "");
    }
  }, [currentUser]);

  const updateUserMutation = useMutation({
    mutationFn: async ({ name, email }: { name: string; email: string }) => {
      const updates: any = { data: { full_name: name } };
      if (email !== currentUser?.email) updates.email = email;
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar perfil: ${error.message}`);
    },
  });

  const handlePasswordReset = async () => {
    if (!userEmail) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Link de redefinição enviado para seu e-mail!");
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Dados Pessoais</CardTitle>
          </div>
          <CardDescription>Informações da sua conta de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentUser && (
            <AvatarUpload
              userId={currentUser.id}
              currentAvatarUrl={userProfile?.avatar_url}
              userName={userName}
              userEmail={userEmail}
            />
          )}
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input id="nome" placeholder="Seu nome" value={userName} onChange={(e) => setUserName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => updateUserMutation.mutate({ name: userName, email: userEmail })}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle>Segurança</CardTitle>
          </div>
          <CardDescription>Atualize sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enviaremos um link de redefinição para <span className="font-medium text-foreground">{userEmail}</span>.
          </p>
          <Button variant="outline" onClick={handlePasswordReset} disabled={sendingReset || !userEmail}>
            {sendingReset ? "Enviando..." : "Enviar link para alterar senha"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Preferências</CardTitle>
          </div>
          <CardDescription>Personalize a aparência do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Tema</Label>
          <Select value={theme || "system"} onValueChange={setTheme}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
