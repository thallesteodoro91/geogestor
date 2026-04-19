import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Bell, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { useTheme } from "next-themes";
import { useTenant } from "@/contexts/TenantContext";

export default function Perfil() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { tenant, refetchTenant } = useTenant();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground mt-2">Gerencie sua conta pessoal, preferências e notificações</p>
        </div>

        <div className="grid gap-6">
          {/* Perfil */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Dados Pessoais</CardTitle>
              </div>
              <CardDescription>Suas informações de acesso</CardDescription>
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

          {/* Aparência */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Aparência</CardTitle>
              </div>
              <CardDescription>Personalize a interface do sistema</CardDescription>
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

          {/* Minhas Notificações */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Minhas Notificações</CardTitle>
              </div>
              <CardDescription>Controle como você recebe alertas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alertas de Pagamento</Label>
                  <p className="text-sm text-muted-foreground">Notificar sobre pagamentos próximos e vencidos</p>
                </div>
                <Switch
                  checked={tenant?.settings?.alertas_pagamento_enabled !== false}
                  onCheckedChange={async (checked) => {
                    if (!tenant) return;
                    try {
                      const { error } = await supabase
                        .from("tenants")
                        .update({ settings: { ...tenant.settings, alertas_pagamento_enabled: checked } })
                        .eq("id", tenant.id);
                      if (error) throw error;
                      refetchTenant();
                      toast.success(checked ? "Alertas ativados" : "Alertas desativados");
                    } catch {
                      toast.error("Erro ao salvar preferência");
                    }
                  }}
                />
              </div>

              {tenant?.settings?.alertas_pagamento_enabled !== false && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="alert-days-threshold">Antecedência dos alertas</Label>
                    <p className="text-sm text-muted-foreground">
                      Defina com quantos dias de antecedência você deseja ser notificado.
                    </p>
                    <Select
                      value={String((tenant?.settings?.alert_days_threshold as number) || 30)}
                      onValueChange={async (value) => {
                        if (!tenant) return;
                        try {
                          const { error } = await supabase
                            .from("tenants")
                            .update({ settings: { ...tenant.settings, alert_days_threshold: Number(value) } })
                            .eq("id", tenant.id);
                          if (error) throw error;
                          refetchTenant();
                          toast.success(`Alertas com ${value} dias de antecedência`);
                        } catch {
                          toast.error("Erro ao salvar preferência");
                        }
                      }}
                    >
                      <SelectTrigger id="alert-days-threshold" className="w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 dias antes</SelectItem>
                        <SelectItem value="15">15 dias antes</SelectItem>
                        <SelectItem value="30">30 dias antes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="overdue-frequency">Frequência de alertas vencidos</Label>
                    <p className="text-sm text-muted-foreground">
                      Após o vencimento, a cada quantos dias o sistema lembra novamente.
                    </p>
                    <Select
                      value={String((tenant?.settings?.overdue_alert_frequency_days as number) || 3)}
                      onValueChange={async (value) => {
                        if (!tenant) return;
                        try {
                          const { error } = await supabase
                            .from("tenants")
                            .update({ settings: { ...tenant.settings, overdue_alert_frequency_days: Number(value) } })
                            .eq("id", tenant.id);
                          if (error) throw error;
                          refetchTenant();
                          toast.success(`Alertas a cada ${value} dia(s)`);
                        } catch {
                          toast.error("Erro ao salvar preferência");
                        }
                      }}
                    >
                      <SelectTrigger id="overdue-frequency" className="w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">A cada 1 dia</SelectItem>
                        <SelectItem value="3">A cada 3 dias</SelectItem>
                        <SelectItem value="5">A cada 5 dias</SelectItem>
                        <SelectItem value="7">A cada 7 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
