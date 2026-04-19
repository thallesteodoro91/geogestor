import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Database, Info, FileText, Upload, Trash2, AlertTriangle, PartyPopper, X, ArrowRight } from "lucide-react";
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
import { useTenant } from "@/contexts/TenantContext";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";
import { GoogleCalendarCard } from "@/components/settings/GoogleCalendarCard";

export default function Configuracoes() {
  const { clientsCount, propertiesCount, usersCount } = useResourceCounts();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const { refetchTenant } = useTenant();
  const { refetch: refetchStripe } = useStripeSubscription();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [deleteAllDataDialogOpen, setDeleteAllDataDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setShowCheckoutSuccess(true);
      refetchStripe();
      refetchTenant();
      setSearchParams((prev) => {
        prev.delete("checkout");
        return prev;
      });
    }
  }, []);

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
    <AppLayout>
      <div className="space-y-8">
        {showCheckoutSuccess && (
          <div className="relative flex items-start gap-4 rounded-2xl border border-success/30 bg-success/10 p-5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20">
              <PartyPopper className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-success">Bem-vindo ao GeoGestor Premium! 🎉</p>
              <p className="text-sm text-success/80">
                Sua assinatura foi ativada com sucesso. Todos os recursos premium já estão disponíveis para você.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-success hover:bg-success/10"
              onClick={() => setShowCheckoutSuccess(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Configurações da Empresa</h1>
          <p className="text-muted-foreground mt-2">Gerencie sua empresa, equipe, plano e integrações</p>
        </div>

        <div className="grid gap-6">
          <TenantSettingsCard />

          <PlanInfoCard
            clientsCount={clientsCount}
            propertiesCount={propertiesCount}
            usersCount={usersCount}
          />

          <TeamManagementSection />

          {/* Template de Orçamento */}
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

          {/* Google Calendar */}
          <GoogleCalendarCard />

          {/* Importação de Dados (atalho) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Importação de Dados</CardTitle>
              </div>
              <CardDescription>Importe planilhas (CSV, XLS, XLSX) com detecção automática</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate("/importacao")}>
                Ir para Importação
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Zona de Perigo */}
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

          {/* Informações do Sistema */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle>Informações do Sistema</CardTitle>
              </div>
              <CardDescription>GeoGestor — Plataforma de Gestão para Topografia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Sistema</span>
                <span className="text-sm text-muted-foreground">GeoGestor</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Clientes</span>
                <span className="text-sm text-muted-foreground">{clientsCount} registros</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Propriedades</span>
                <span className="text-sm text-muted-foreground">{propertiesCount} registros</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
    </AppLayout>
  );
}
