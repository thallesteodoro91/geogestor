import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Trash2, AlertTriangle } from "lucide-react";
import { PdfThumbnail } from "@/components/ui/pdf-thumbnail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TenantSettingsCard } from "@/components/plan/TenantSettingsCard";
import { PlanInfoCard } from "@/components/plan/PlanInfoCard";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { useUserRole } from "@/hooks/useUserRole";
import { TeamManagementSection } from "@/components/team";
import { getCurrentTenantId } from "@/services/supabase.service";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteAllCompanyData } from "@/services/reset-company-data.service";

export function CompanyTab() {
  const { clientsCount, propertiesCount, usersCount } = useResourceCounts();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [deleteAllDataDialogOpen, setDeleteAllDataDialogOpen] = useState(false);

  const { data: empresa } = useQuery({
    queryKey: ["empresa-config"],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("dim_empresa")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", tenantId)
          .single();
        const { data: newEmpresa, error: createError } = await supabase
          .from("dim_empresa")
          .insert({ nome: tenant?.name || "Minha Empresa", tenant_id: tenantId })
          .select()
          .single();
        if (createError) throw createError;
        return newEmpresa;
      }
      return data;
    },
  });

  const updateEmpresaMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!empresa?.id_empresa) throw new Error("Empresa não encontrada");
      const { error } = await supabase
        .from("dim_empresa")
        .update(updates)
        .eq("id_empresa", empresa.id_empresa);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa-config"] });
      toast.success("Configurações atualizadas!");
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteAllDataMutation = useMutation({
    mutationFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) throw new Error("Tenant não identificado");
      return deleteAllCompanyData(tenantId);
    },
    onSuccess: (result) => {
      if (result.success) {
        ["clientes", "propriedades", "servicos", "orcamentos", "despesas", "notificacoes", "dashboard", "kpis", "eventos", "tarefas"].forEach(
          (key) => queryClient.invalidateQueries({ queryKey: [key] })
        );
        toast.success(`Dados excluídos com sucesso! ${result.totalExcluido} registros removidos.`);
      } else {
        throw new Error(result.error || "Erro ao excluir dados");
      }
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir dados: ${error.message}`);
    },
  });

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são permitidos");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 5MB");
      return;
    }
    setUploadingTemplate(true);
    try {
      const fileName = `template-orcamento-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("empresa-assets")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("empresa-assets").getPublicUrl(fileName);
      await updateEmpresaMutation.mutateAsync({ template_orcamento_url: publicUrl });
      toast.success("Template carregado com sucesso!");
    } catch (error: any) {
      toast.error(`Erro ao fazer upload: ${error.message}`);
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleRemoveTemplate = async () => {
    if (!empresa?.template_orcamento_url) return;
    try {
      const fileName = empresa.template_orcamento_url.split("/").pop();
      if (fileName) await supabase.storage.from("empresa-assets").remove([fileName]);
      await updateEmpresaMutation.mutateAsync({ template_orcamento_url: null });
      toast.success("Template removido!");
    } catch (error: any) {
      toast.error(`Erro ao remover: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <TenantSettingsCard />

      <PlanInfoCard
        clientsCount={clientsCount}
        propertiesCount={propertiesCount}
        usersCount={usersCount}
      />

      <TeamManagementSection />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Template de Orçamento</CardTitle>
          </div>
          <CardDescription>Faça upload do seu PDF personalizado para gerar orçamentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {empresa?.template_orcamento_url ? (
            <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/20">
              <a
                href={empresa.template_orcamento_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex-shrink-0 rounded-md border bg-background overflow-hidden group hover:ring-2 hover:ring-primary transition-all"
              >
                <PdfThumbnail url={empresa.template_orcamento_url} width={128} />
              </a>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm font-medium">Template PDF Configurado</p>
                  <p className="text-xs text-muted-foreground">Pronto para gerar orçamentos personalizados</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={empresa.template_orcamento_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4 mr-2" />
                      Visualizar
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveTemplate}
                    disabled={updateEmpresaMutation.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="template-upload">Upload do Template PDF</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="template-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleTemplateUpload}
                  disabled={uploadingTemplate}
                  className="cursor-pointer"
                />
                <Button
                  variant="outline"
                  disabled={uploadingTemplate}
                  onClick={() => document.getElementById("template-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingTemplate ? "Enviando..." : "Enviar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Formato: PDF | Tamanho máximo: 5MB</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Zona de Perigo</CardTitle>
            </div>
            <CardDescription>Ações irreversíveis sobre os dados da empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Exclua todos os dados operacionais para começar do zero. Esta ação é irreversível.
            </p>
            <Button
              variant="destructive"
              onClick={() => setDeleteAllDataDialogOpen(true)}
              disabled={deleteAllDataMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteAllDataMutation.isPending ? "Excluindo..." : "Excluir Todos os Dados"}
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteAllDataDialogOpen}
        onOpenChange={setDeleteAllDataDialogOpen}
        title="⚠️ Excluir Todos os Dados"
        description="ATENÇÃO: Esta ação é irreversível!

Serão excluídos permanentemente:
• Todos os clientes
• Todas as propriedades  
• Todos os serviços e orçamentos
• Todas as despesas
• Todos os eventos e tarefas

Os tipos de serviço, tipos de despesa e configurações da empresa serão mantidos."
        confirmLabel="Excluir Tudo"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          deleteAllDataMutation.mutate();
          setDeleteAllDataDialogOpen(false);
        }}
      />
    </div>
  );
}
