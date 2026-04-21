import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BellRing, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { useUserRole } from "@/hooks/useUserRole";

export function NotificationsTab() {
  const { tenant, refetchTenant } = useTenant();
  const { isAdmin } = useUserRole();

  const updateSetting = async (key: string, value: any, successMsg: string) => {
    if (!tenant) return;
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ settings: { ...tenant.settings, [key]: value } })
        .eq("id", tenant.id);
      if (error) throw error;
      refetchTenant();
      toast.success(successMsg);
    } catch {
      toast.error("Erro ao salvar preferência");
    }
  };

  const settings = (tenant?.settings || {}) as Record<string, any>;
  const alertasPagamentoEnabled = settings.alertas_pagamento_enabled !== false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <CardTitle>Alertas de Pagamento</CardTitle>
          </div>
          <CardDescription>Notificações sobre vencimentos e pagamentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar alertas de pagamento</Label>
              <p className="text-sm text-muted-foreground">Notificar sobre pagamentos próximos e vencidos</p>
            </div>
            <Switch
              disabled={!isAdmin}
              checked={alertasPagamentoEnabled}
              onCheckedChange={(checked) =>
                updateSetting("alertas_pagamento_enabled", checked, checked ? "Alertas ativados" : "Alertas desativados")
              }
            />
          </div>

          {alertasPagamentoEnabled && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="alert-days-threshold">Antecedência dos alertas</Label>
                <p className="text-sm text-muted-foreground">
                  Defina com quantos dias de antecedência você deseja ser notificado.
                </p>
                <Select
                  disabled={!isAdmin}
                  value={String(settings.alert_days_threshold || 30)}
                  onValueChange={(value) =>
                    updateSetting("alert_days_threshold", Number(value), `Alertas com ${value} dias de antecedência`)
                  }
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
                  disabled={!isAdmin}
                  value={String(settings.overdue_alert_frequency_days || 3)}
                  onValueChange={(value) =>
                    updateSetting("overdue_alert_frequency_days", Number(value), `Alertas a cada ${value} dia(s)`)
                  }
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Tipos de Alerta</CardTitle>
          </div>
          <CardDescription>Escolha quais eventos geram notificações no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "notif_pagamentos_proximos", label: "Pagamentos próximos do vencimento", desc: "Avisa antes da data de vencimento" },
            { key: "notif_pagamentos_vencidos", label: "Pagamentos vencidos", desc: "Lembretes recorrentes para pagamentos em atraso" },
            { key: "notif_novos_orcamentos", label: "Novos orçamentos e conversões", desc: "Quando um orçamento é criado ou aprovado" },
            { key: "notif_tarefas_atribuidas", label: "Tarefas atribuídas a mim", desc: "Quando alguém te designa para uma tarefa" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="space-y-0.5 pr-4">
                <Label>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                disabled={!isAdmin}
                checked={settings[item.key] !== false}
                onCheckedChange={(checked) => updateSetting(item.key, checked, "Preferência salva")}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Canais de Entrega</CardTitle>
          </div>
          <CardDescription>Onde você recebe as notificações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificações no sistema</Label>
              <p className="text-sm text-muted-foreground">Sempre ativas no sino do menu</p>
            </div>
            <Switch checked disabled />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <Label>Notificações por e-mail</Label>
              <p className="text-sm text-muted-foreground">Receber resumos importantes no seu e-mail</p>
            </div>
            <Switch
              disabled={!isAdmin}
              checked={settings.notif_canal_email !== false}
              onCheckedChange={(checked) => updateSetting("notif_canal_email", checked, "Preferência salva")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
