import { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function TenantSettingsCard() {
  const { tenant, refetchTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(tenant?.name || "");

  const handleSave = async () => {
    if (!tenant || !name.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ name: name.trim() })
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
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading || name === tenant.name}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
