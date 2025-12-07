import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Bell, Palette, Bot, Database, Info, FileText, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TenantSettingsCard } from "@/components/plan/TenantSettingsCard";
import { PlanInfoCard } from "@/components/plan/PlanInfoCard";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { TeamManagementSection } from "@/components/team";
import { AvatarUpload } from "@/components/settings/AvatarUpload";

export default function Configuracoes() {
  const { clientsCount, propertiesCount, usersCount } = useResourceCounts();
  const queryClient = useQueryClient();
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Fetch current user data
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    },
  });

  // Fetch user profile for avatar
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

  // Set initial values when user data loads
  useEffect(() => {
    if (currentUser) {
      setUserEmail(currentUser.email || "");
      setUserName(currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || "");
    }
  }, [currentUser]);

  // Mutation to update user profile
  const updateUserMutation = useMutation({
    mutationFn: async ({ name, email }: { name: string; email: string }) => {
      const updates: any = {
        data: { full_name: name }
      };
      
      // Only update email if it changed
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
      const { data, error } = await supabase
        .from('dim_empresa')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
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
        <div>
          <h1 className="text-4xl font-heading font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-2">Personalize o sistema e gerencie suas preferências</p>
        </div>

        <div className="grid gap-6">
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
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Animações</Label>
                  <p className="text-sm text-muted-foreground">Habilitar animações e transições</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

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
                  <Label>Story Cards Automáticos</Label>
                  <p className="text-sm text-muted-foreground">Receber insights AI sobre performance</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alertas de Desvio Orçamentário</Label>
                  <p className="text-sm text-muted-foreground">Notificar quando houver desvios significativos</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Relatórios Mensais</Label>
                  <p className="text-sm text-muted-foreground">Receber resumo executivo mensal por email</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle>Integração AI</CardTitle>
              </div>
              <CardDescription>Configurações do Consultor Financeiro GPT-5</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Consultor Financeiro Ativo</Label>
                  <p className="text-sm text-muted-foreground">Habilitar análises automáticas com IA</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="frequencia">Frequência de Análises</Label>
                <select 
                  id="frequencia" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  defaultValue="Semanal"
                >
                  <option value="Diária">Diária</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensal">Mensal</option>
                </select>
              </div>
            </CardContent>
          </Card>

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
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Template PDF Configurado</p>
                        <p className="text-xs text-muted-foreground">Pronto para gerar orçamentos</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveTemplate}
                      disabled={updateEmpresaMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                  <a
                    href={empresa.template_orcamento_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Visualizar template atual
                  </a>
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

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Dados e Backup</CardTitle>
              </div>
              <CardDescription>Gerenciar importação, exportação e backup de dados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button variant="outline">Importar Planilhas Excel</Button>
                <Button variant="outline">Exportar Dados</Button>
                <Button variant="outline">Fazer Backup</Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Último Backup</p>
                <p className="text-sm text-muted-foreground">15 de Maio de 2025 às 14:30</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle>Informações do Sistema</CardTitle>
              </div>
              <CardDescription>Versão e logs do TopoVision Dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Versão</span>
                <span className="text-sm text-muted-foreground">1.0.0</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Última Atualização</span>
                <span className="text-sm text-muted-foreground">Maio 2025</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Registros de Dados</span>
                <span className="text-sm text-muted-foreground">1.247 registros</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
