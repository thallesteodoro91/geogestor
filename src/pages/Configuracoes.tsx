import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Bell, Palette, Database, Info, FileText, Upload, Trash2, AlertTriangle, ShieldAlert, PartyPopper, X, FileSpreadsheet } from "lucide-react";
import { PdfThumbnail } from "@/components/ui/pdf-thumbnail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TenantSettingsCard } from "@/components/plan/TenantSettingsCard";
import { PlanInfoCard } from "@/components/plan/PlanInfoCard";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { useUserRole } from "@/hooks/useUserRole";
import { TeamManagementSection } from "@/components/team";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { getCurrentTenantId } from "@/services/supabase.service";
import { useTheme } from "next-themes";
import { CsvImportDialog } from "@/components/import/CsvImportDialog";
import { SmartImporter, ImportEntityType } from "@/components/import/SmartImporter";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteAllCompanyData } from "@/services/reset-company-data.service";

import { useTenant } from "@/contexts/TenantContext";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";

export default function Configuracoes() {
  const { clientsCount, propertiesCount, usersCount } = useResourceCounts();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { tenant, refetchTenant } = useTenant();
  const { refetch: refetchStripe } = useStripeSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [deleteAllDataDialogOpen, setDeleteAllDataDialogOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [smartImportEntity, setSmartImportEntity] = useState<ImportEntityType>("clientes");

  // Detectar checkout=success, sincronizar com Stripe e atualizar status da assinatura
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

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', currentUser.id)
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
      const updates: any = {
        data: { full_name: name }
      };
      if (email !== currentUser?.email) {
        updates.email = email;
      }
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar perfil: ${error.message}`);
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ['empresa-config'],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('dim_empresa')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', tenantId)
          .single();
        const { data: newEmpresa, error: createError } = await supabase
          .from('dim_empresa')
          .insert({ nome: tenant?.name || 'Minha Empresa', tenant_id: tenantId })
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
      if (!empresa?.id_empresa) {
        throw new Error('Empresa não encontrada');
      }
      const { error } = await supabase
        .from('dim_empresa')
        .update(updates)
        .eq('id_empresa', empresa.id_empresa);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa-config'] });
      toast.success('Configurações atualizadas!');
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteAllDataMutation = useMutation({
    mutationFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        throw new Error('Tenant não identificado');
      }
      return deleteAllCompanyData(tenantId);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['clientes'] });
        queryClient.invalidateQueries({ queryKey: ['propriedades'] });
        queryClient.invalidateQueries({ queryKey: ['servicos'] });
        queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
        queryClient.invalidateQueries({ queryKey: ['despesas'] });
        queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['kpis'] });
        queryClient.invalidateQueries({ queryKey: ['eventos'] });
        queryClient.invalidateQueries({ queryKey: ['tarefas'] });
        toast.success(`Dados excluídos com sucesso! ${result.totalExcluido} registros removidos.`);
      } else {
        throw new Error(result.error || 'Erro ao excluir dados');
      }
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir dados: ${error.message}`);
    },
  });


  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo: 5MB');
      return;
    }
    setUploadingTemplate(true);
    try {
      const fileName = `template-orcamento-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('empresa-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('empresa-assets')
        .getPublicUrl(fileName);
      await updateEmpresaMutation.mutateAsync({
        template_orcamento_url: publicUrl,
      });
      toast.success('Template carregado com sucesso!');
    } catch (error: any) {
      toast.error(`Erro ao fazer upload: ${error.message}`);
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleRemoveTemplate = async () => {
    if (!empresa?.template_orcamento_url) return;
    try {
      const fileName = empresa.template_orcamento_url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('empresa-assets').remove([fileName]);
      }
      await updateEmpresaMutation.mutateAsync({
        template_orcamento_url: null,
      });
      toast.success('Template removido!');
    } catch (error: any) {
      toast.error(`Erro ao remover: ${error.message}`);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Banner de sucesso pós-checkout */}
        {showCheckoutSuccess && (
          <div className="relative flex items-start gap-4 rounded-2xl border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20">
              <PartyPopper className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-green-700 dark:text-green-300">
                Bem-vindo ao GeoGestor Premium! 🎉
              </p>
              <p className="text-sm text-green-600/80 dark:text-green-400/80">
                Sua assinatura foi ativada com sucesso. Todos os recursos premium já estão disponíveis para você. Obrigado por assinar!
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:text-green-400"
              onClick={() => setShowCheckoutSuccess(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-2">Personalize o sistema e gerencie suas preferências</p>
        </div>

        <div className="grid gap-6">
          {/* 1. Perfil do Usuário */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Perfil do Usuário</CardTitle>
              </div>
              <CardDescription>Informações pessoais e dados de acesso</CardDescription>
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
                  <Input 
                    id="nome" 
                    placeholder="Seu nome" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="seu@email.com" 
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={() => updateUserMutation.mutate({ name: userName, email: userEmail })}
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 2. Aparência */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Aparência</CardTitle>
              </div>
              <CardDescription>Personalize a interface do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">Ativar tema escuro no sistema</p>
                </div>
                <Switch 
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </CardContent>
          </Card>

          {/* 3. Informações da Empresa */}
          <TenantSettingsCard />
          
          {/* 4. Plano & Assinatura */}
          <PlanInfoCard 
            clientsCount={clientsCount}
            propertiesCount={propertiesCount}
            usersCount={usersCount}
          />

          {/* 5. Gestão de Equipe */}
          <TeamManagementSection />

          {/* 6. Template de Orçamento */}
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
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/20">
                    <a
                      href={empresa.template_orcamento_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative flex-shrink-0 rounded-md border bg-background overflow-hidden group hover:ring-2 hover:ring-primary transition-all"
                    >
                      <PdfThumbnail 
                        url={empresa.template_orcamento_url}
                        width={128}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                          Abrir PDF
                        </span>
                      </div>
                    </a>
                    
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-sm font-medium">Template PDF Configurado</p>
                        <p className="text-xs text-muted-foreground">Pronto para gerar orçamentos personalizados</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={empresa.template_orcamento_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
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
                      onClick={() => document.getElementById('template-upload')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingTemplate ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: PDF | Tamanho máximo: 5MB
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 7. Dados e Backup */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Dados e Backup</CardTitle>
              </div>
              <CardDescription>Gerenciar importação de dados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar CSV
                </Button>
                <Button onClick={() => { setSmartImportEntity("clientes"); setSmartImportOpen(true); }}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importar Clientes
                </Button>
                <Button variant="secondary" onClick={() => { setSmartImportEntity("propriedades"); setSmartImportOpen(true); }}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importar Propriedades
                </Button>
                <Button variant="secondary" onClick={() => { setSmartImportEntity("orcamentos"); setSmartImportOpen(true); }}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importar Orçamentos
                </Button>
              </div>

              {isAdmin && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <p className="text-sm font-medium">Zona de Perigo</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Exclua todos os dados operacionais para começar do zero. Esta ação é irreversível.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={() => setDeleteAllDataDialogOpen(true)}
                      disabled={deleteAllDataMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleteAllDataMutation.isPending ? 'Excluindo...' : 'Excluir Todos os Dados'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 8. Notificações */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Notificações</CardTitle>
              </div>
              <CardDescription>Controle como você recebe alertas e Story Cards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        .from('tenants')
                        .update({ 
                          settings: { 
                            ...tenant.settings, 
                            alertas_pagamento_enabled: checked 
                          } 
                        })
                        .eq('id', tenant.id);
                      if (error) throw error;
                      refetchTenant();
                      toast.success(checked ? 'Alertas de pagamento ativados' : 'Alertas de pagamento desativados');
                    } catch {
                      toast.error('Erro ao salvar preferência');
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>


          {/* 10. Informações do Sistema */}
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

      <CsvImportDialog 
        open={csvImportOpen} 
        onOpenChange={setCsvImportOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['clientes'] });
          queryClient.invalidateQueries({ queryKey: ['propriedades'] });
          queryClient.invalidateQueries({ queryKey: ['tipos-servico'] });
          queryClient.invalidateQueries({ queryKey: ['tipos-despesa'] });
        }}
      />

      <SmartImporter
        open={smartImportOpen}
        onOpenChange={setSmartImportOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['clientes'] });
        }}
      />

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
