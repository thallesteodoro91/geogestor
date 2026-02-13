import { useState } from "react";
import { useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Save, Bell, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export function TenantSettingsCard() {
  const { tenant, refetchTenant } = useTenant();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(tenant?.name || "");
  const [alertDaysThreshold, setAlertDaysThreshold] = useState<number>(
    (tenant?.settings?.alert_days_threshold as number) || 30
  );

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || "");
      setAlertDaysThreshold((tenant.settings?.alert_days_threshold as number) || 30);
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!tenant || !name.trim()) return;

    setLoading(true);
    try {
      const updatedSettings = {
        ...tenant.settings,
        alert_days_threshold: alertDaysThreshold,
      };

      const { error } = await supabase
        .from('tenants')
        .update({ 
          name: name.trim(),
          settings: updatedSettings,
        })
        .eq('id', tenant.id);

      if (error) throw error;

      await refetchTenant();
      toast.success("Empresa atualizada com sucesso!");
    } catch (error: any) {
      console.error("Error updating tenant:", error);
      toast.error(error.message || "Erro ao atualizar empresa");
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return null;

  // Mostrar card read-only para não-admins
  if (!roleLoading && !isAdmin) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Informações da Empresa</CardTitle>
          </div>
          <CardDescription>
            Dados principais da sua empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <p className="text-sm font-medium">{tenant.name}</p>
            </div>
            <div className="space-y-2">
              <Label>Identificador</Label>
              <p className="text-sm text-muted-foreground">{tenant.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
            <ShieldAlert className="h-4 w-4" />
            <span>Apenas administradores podem alterar as configurações da empresa.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Informações da Empresa</CardTitle>
        </div>
        <CardDescription>
          Configure os dados principais da sua empresa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Nome da Empresa</Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">Identificador</Label>
            <Input
              id="tenant-slug"
              value={tenant.slug}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Identificador único da empresa (não editável)
            </p>
          </div>
        </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Configurações de Alertas</h4>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="alert-days">Dias para alerta de pagamento próximo</Label>
            <Input
              id="alert-days"
              type="number"
              min={1}
              max={90}
              value={alertDaysThreshold}
              onChange={(e) => setAlertDaysThreshold(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Alertas serão exibidos quando o vencimento estiver dentro deste período (1-90 dias)
            </p>
          </div>
        </div>
      </div>

        <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={loading || (name === tenant.name && alertDaysThreshold === ((tenant.settings?.alert_days_threshold as number) || 30))}
        >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
