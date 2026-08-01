import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { persistOperationalSetting } from '../services/operationalSettings';
import { APP_VERSION } from '../version';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import { 
  FolderOpen,
  Check, 
  Database,
  DownloadSimple,
  Gear, 
  Info,
  Palette,
  FileText,
  UploadSimple,
  WarningCircle,
  Trash,
  Link,
  Calendar
} from '@phosphor-icons/react';
import { Modal } from '../components/Modal';
import { cn } from '../utils/cn';
import { geoFieldClass, geoPanelClass, geoTabButtonClass, geoTabIconClass } from '../utils/geoTheme';
import { primarySmallActionButtonClass, primarySubmitButtonClass, revenueActionButtonClass } from '../utils/actionStyles';
import { BackupPolicyPanel } from '../components/BackupPolicyPanel';

export function Configuracoes() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'geral' | 'aparencia' | 'desktop' | 'template' | 'integracoes'>('geral');
  const settingsTabClass = (tab: typeof activeTab, tone: Parameters<typeof geoTabButtonClass>[1]) =>
    cn(geoTabButtonClass(activeTab === tab, tone), 'w-full justify-start');
  const systemPanelClass = cn(
    geoPanelClass,
    'relative overflow-hidden rounded-2xl p-5 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
  );
  const systemPanelLargeClass = cn(
    geoPanelClass,
    'relative overflow-hidden rounded-3xl p-6 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
  );
  const systemFieldClass = cn(geoFieldClass, 'w-full px-3.5 py-2 text-xs font-semibold');
  const systemFieldMonoClass = cn(systemFieldClass, 'font-mono');
  const systemCompactFieldClass = cn(geoFieldClass, 'h-9 w-full px-3 text-xs font-medium');
  const systemActionCardClass =
    'geo-card-interactive geo-focus-ring flex min-h-[100px] items-start gap-3 rounded-2xl p-4 text-left disabled:cursor-not-allowed disabled:opacity-60';

  // Form states
  const [empresaNome, setEmpresaNome] = useState('');
  const [dadosPasta, setDadosPasta] = useState('');
  const [adminNome, setAdminNome] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [alertaDias, setAlertaDias] = useState(() => localStorage.getItem('geogestor_alerta_dias') || '7');

  // Google Calendar States
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleStatus, setGoogleStatus] = useState<{ conectado: boolean; syncActive: boolean; configured: boolean }>({
    conectado: false,
    syncActive: false,
    configured: false
  });
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  // Danger zone reset states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetInputText, setResetInputText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreBundlePath, setRestoreBundlePath] = useState('');
  const [restoreInputText, setRestoreInputText] = useState('');
  const [restoring, setRestoring] = useState(false);

  const handleResetSistema = async () => {
    if (resetInputText.trim().toUpperCase() !== 'APAGAR DADOS DO GEOGESTOR') return;
    setResetting(true);
    try {
      await apiClient.post('/api/sistema/reset-dados', { confirmation: 'APAGAR DADOS DO GEOGESTOR' });
      queryClient.invalidateQueries();
      setShowResetModal(false);
      setResetInputText('');
      toast.success('Todas as informações operacionais do GeoGestor foram apagadas com sucesso.');
    } catch (err) {
      toast.error(`Erro ao apagar informações: ${err instanceof Error ? err.message : 'Falha de comunicação'}`);
    } finally {
      setResetting(false);
    }
  };

  const handleChooseRestoreBundle = async () => {
    if (!window.electronAPI?.selectBackupBundle) {
      toast.error('A seleção de backup está disponível somente no aplicativo desktop.');
      return;
    }
    const selected = await window.electronAPI.selectBackupBundle();
    if (!selected) return;
    setRestoreBundlePath(selected);
    setRestoreInputText('');
    setShowRestoreModal(true);
  };

  const handleRestoreBackup = async () => {
    if (restoreInputText.trim().toUpperCase() !== 'RESTAURAR BACKUP DO GEOGESTOR') return;
    setRestoring(true);
    try {
      await apiClient.post('/api/sistema/restaurar-backup', {
        bundlePath: restoreBundlePath,
        confirmation: 'RESTAURAR BACKUP DO GEOGESTOR'
      }, { timeoutMs: 60_000 });
      toast.success('Backup validado. O GeoGestor será reiniciado para concluir a restauração.');
    } catch (error) {
      setRestoring(false);
      toast.error(error instanceof Error ? error.message : 'Não foi possível restaurar o backup.');
    }
  };

  // Template states
  const [logoBase64, setLogoBase64] = useState('');
  const [templateRazaoSocial, setTemplateRazaoSocial] = useState('');
  const [templateCnpj, setTemplateCnpj] = useState('');
  const [templateTelefone, setTemplateTelefone] = useState('');
  const [templateEmail, setTemplateEmail] = useState('');
  const [templateEndereco, setTemplateEndereco] = useState('');
  const [templateCor, setTemplateCor] = useState('#059669');
  const [templateTermos, setTemplateTermos] = useState('Validade da proposta: 15 dias úteis.\nPagamento: 50% na aprovação e 50% na entrega técnica.');

  useEffect(() => {
    const saved = localStorage.getItem('geogestor_empresa_template');
    if (saved) {
      setTimeout(() => {
        try {
          const p = JSON.parse(saved);
          if (p.logo) setLogoBase64(p.logo);
          if (p.razao) setTemplateRazaoSocial(p.razao);
          if (p.cnpj) setTemplateCnpj(p.cnpj);
          if (p.telefone) setTemplateTelefone(p.telefone);
          if (p.email) setTemplateEmail(p.email);
          if (p.endereco) setTemplateEndereco(p.endereco);
          if (p.cor) setTemplateCor(p.cor);
          if (p.termos) setTemplateTermos(p.termos);
        } catch {
          // ignore parse error
        }
      }, 0);
    }
  }, []);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const tData = {
      logo: logoBase64,
      razao: templateRazaoSocial,
      cnpj: templateCnpj,
      telefone: templateTelefone,
      email: templateEmail,
      endereco: templateEndereco,
      cor: templateCor,
      termos: templateTermos
    };
    await persistOperationalSetting('geogestor_empresa_template', tData);
    toast.success('Identidade Visual & Template de Orçamentos salvos com sucesso!');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setLogoBase64(reader.result as string);
      };
      reader.readAsDataURL(f);
    }
  };

  // 1. Fetch Current Configuration
  const { data: config, isLoading } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const res = await apiClient.get<ConfiguracaoConfig & { googleClientId?: string; googleClientSecretConfigured?: boolean }>('/api/configuracoes');
      return res;
    },
  });

  interface DesktopInfo {
    mode: string;
    desktop: boolean;
    databasePath: string;
    dataDirectory: string;
    backupDirectory: string;
    filesRootDirectory?: string | null;
    webDistPath?: string | null;
  }

  interface BackupPreflightInfo {
    databasePath: string;
    filesRootDirectory: string;
    backupDirectory: string;
    databaseStats: { bytes: number; files: number; directories: number };
    filesStats: { bytes: number; files: number; directories: number };
    totalBytes: number;
    totalFiles: number;
  }

  interface FullBackupResult {
    backupPath: string;
    filesBackupPath: string;
    totalBytes?: number;
    totalFiles?: number;
  }

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: index === 0 ? 0 : 1 })} ${units[index]}`;
  };

  const { data: desktopInfo, isLoading: loadingDesktopInfo } = useQuery<DesktopInfo>({
    queryKey: ['sistema-info'],
    queryFn: async () => {
      return apiClient.get<DesktopInfo>('/api/sistema/info');
    }
  });

  interface ConfiguracaoConfig {
    empresaNome: string;
    dadosPasta: string;
    adminNome: string;
    adminEmail: string;
  }

  // Populate form states when data loads
  useEffect(() => {
    if (config) {
      Promise.resolve().then(() => {
        setEmpresaNome(config.empresaNome || '');
        setDadosPasta(config.dadosPasta || '');
        setAdminNome(config.adminNome || '');
        setAdminEmail(config.adminEmail || '');
        setGoogleClientId(config.googleClientId || '');
        setGoogleClientSecret('');
      });
    }
  }, [config]);

  const fetchGoogleStatus = async () => {
    try {
      const res = await apiClient.get<{ conectado: boolean; syncActive: boolean; configured: boolean }>('/api/google/status');
      setGoogleStatus(res);
    } catch (e) {
      console.error('Erro ao ler status do Google Calendar', e);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchGoogleStatus);
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const res = await apiClient.get<{ url: string }>('/api/google/auth-url');
      if (res.url) {
        window.open(res.url, '_blank');
        
        // Polling para checar se autenticou
        const interval = setInterval(async () => {
          try {
            const status = await apiClient.get<{ conectado: boolean; syncActive: boolean; configured: boolean }>('/api/google/status');
            if (status.conectado) {
              setGoogleStatus(status);
              clearInterval(interval);
              toast.success('Google Agenda conectada com sucesso!');
            }
          } catch {
            // Ignore polling errors
          }
        }, 3000);

        setTimeout(() => clearInterval(interval), 120000);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar URL de conexão do Google.');
    }
  };

  const handleSyncGoogle = async () => {
    setSyncingGoogle(true);
    try {
      const res = await apiClient.post<{ sent?: number; received?: number }>('/api/google/sync');
      fetchGoogleStatus();
      toast.success(`Sincronização concluída!\nEnviados para o Google: ${res.sent || 0}\nRecebidos no GeoGestor: ${res.received || 0}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao sincronizar com a Google Agenda.');
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleSaveGoogleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleClientSecret.trim() && !config?.googleClientSecretConfigured) {
      toast.error('Informe a Chave Secreta do Cliente para configurar a integração.');
      return;
    }
    try {
      await apiClient.patch('/api/configuracoes', {
        googleClientId,
        googleClientSecret
      });
      fetchGoogleStatus();
      setGoogleClientSecret('');
      toast.success('Credenciais da Google Agenda salvas com sucesso!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar credenciais.');
    }
  };

  // Mutation to update configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (payload: ConfiguracaoConfig) => {
      await apiClient.patch('/api/configuracoes', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao salvar as configurações no servidor.');
    }
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<{ backupPath: string }>('/api/sistema/backup');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sistema-info'] });
      toast.success(`Backup criado com sucesso:\n${data.backupPath}`);
    },
    onError: () => {
      toast.error('Erro ao criar backup local do banco de dados.');
    }
  });

  const createFullBackupMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<FullBackupResult>('/api/sistema/backup-completo');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sistema-info'] });
      const sizeInfo = data.totalBytes ? `\nTamanho copiado: ${formatBytes(data.totalBytes)} em ${data.totalFiles || 0} arquivo(s)` : '';
      toast.success(`Backup completo criado com sucesso:\nBanco: ${data.backupPath}\nArquivos: ${data.filesBackupPath}${sizeInfo}`);
    },
    onError: () => {
      toast.error('Erro ao criar backup completo. Verifique se a pasta de arquivos está configurada e acessível.');
    }
  });

  const openDataFolderMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/api/sistema/abrir-pasta-dados');
    },
    onError: () => {
      toast.error('Erro ao abrir a pasta de dados local.');
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('geogestor_theme') as 'light' | 'dark') || 'light';
  });
  const [checkingFullBackup, setCheckingFullBackup] = useState(false);
  const [fullBackupEstimate, setFullBackupEstimate] = useState<BackupPreflightInfo | null>(null);

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('geogestor_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleFullBackup = async () => {
    try {
      setCheckingFullBackup(true);
      const estimate = await apiClient.get<BackupPreflightInfo>('/api/sistema/backup-completo/preflight');
      setFullBackupEstimate(estimate);

      const shouldContinue = window.confirm([
        'Backup completo do GeoGestor',
        '',
        `Arquivos estimados: ${estimate.totalFiles.toLocaleString('pt-BR')}`,
        `Tamanho estimado: ${formatBytes(estimate.totalBytes)}`,
        `Destino: ${estimate.backupDirectory}`,
        '',
        'Em bases grandes, o app pode levar alguns minutos para copiar tudo. Deseja continuar?'
      ].join('\n'));

      if (shouldContinue) {
        createFullBackupMutation.mutate();
      }
    } catch (err) {
      toast.error(`Erro ao preparar backup completo: ${err instanceof Error ? err.message : 'falha desconhecida'}`);
    } finally {
      setCheckingFullBackup(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaNome.trim() || !dadosPasta.trim()) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    await persistOperationalSetting('geogestor_alerta_dias', alertaDias, alertaDias);

    updateConfigMutation.mutate({
      empresaNome,
      dadosPasta,
      adminNome,
      adminEmail
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-brand-primary-100 border-t-brand-primary-500 dark:border-brand-primary-400/15 dark:border-t-brand-primary-300 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        eyebrow="Painel do sistema"
        title="Configurações"
        description="Gerencie os dados da sua empresa, caminhos de diretórios locais e preferências."
      />

      {/* Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div role="tablist" aria-label="Abas de configuração" className="lg:col-span-1 space-y-2">
          <button
            role="tab"
            aria-selected={activeTab === 'geral'}
            onClick={() => setActiveTab('geral')}
            className={settingsTabClass('geral', 'system')}
          >
            <span aria-hidden="true" className={geoTabIconClass(activeTab === 'geral', 'system')}><Gear weight={activeTab === 'geral' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
            Configuração Geral
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'aparencia'}
            onClick={() => setActiveTab('aparencia')}
            className={settingsTabClass('aparencia', 'warning')}
          >
            <span aria-hidden="true" className={geoTabIconClass(activeTab === 'aparencia', 'warning')}><Palette weight={activeTab === 'aparencia' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
            Tema & Aparência
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'desktop'}
            onClick={() => setActiveTab('desktop')}
            className={settingsTabClass('desktop', 'system')}
          >
            <span aria-hidden="true" className={geoTabIconClass(activeTab === 'desktop', 'system')}><Database weight={activeTab === 'desktop' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
            Desktop & Backup
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'template'}
            onClick={() => setActiveTab('template')}
            className={settingsTabClass('template', 'success')}
          >
            <span aria-hidden="true" className={geoTabIconClass(activeTab === 'template', 'success')}><FileText weight={activeTab === 'template' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
            Template & Orçamentos
          </button>
          
          <button
            role="tab"
            aria-selected={activeTab === 'integracoes'}
            onClick={() => setActiveTab('integracoes')}
            className={settingsTabClass('integracoes', 'field')}
          >
            <span aria-hidden="true" className={geoTabIconClass(activeTab === 'integracoes', 'field')}><Link weight={activeTab === 'integracoes' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
            Integrações & Agenda
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {activeTab === 'geral' && (
            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Single Compact Card */}
                <div className={cn(systemPanelClass, 'space-y-4')}>
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-white flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <Gear className="w-5 h-5 text-indigo-500" /> Configurações Gerais do Sistema
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Nome da Empresa</label>
                      <input 
                        type="text"
                        required
                        value={empresaNome}
                        onChange={(e) => setEmpresaNome(e.target.value)}
                        placeholder="Ex: TopoGeo Engenharia"
                        className={systemFieldClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Diretório Raiz dos Dados</label>
                      <input 
                        type="text"
                        required
                        value={dadosPasta}
                        onChange={(e) => setDadosPasta(e.target.value)}
                        placeholder="Ex: C:/Users/Thalles/Documents/GeoGestor/data"
                        className={systemFieldMonoClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Nome Completo (Admin)</label>
                      <input 
                        type="text"
                        required
                        value={adminNome}
                        onChange={(e) => setAdminNome(e.target.value)}
                        placeholder="Nome do operador"
                        className={systemFieldClass}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">E-mail Operacional (Admin)</label>
                      <input 
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@empresa.com"
                        className={systemFieldClass}
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-900/30 rounded-xl p-3 flex gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Esta pasta é usada para gerenciar localmente o diretório físico dos arquivos de clientes e projetos.
                    </p>
                  </div>
                </div>

                {/* Card de Configuração de Alertas de Vencimento */}
                <div className={cn(systemPanelClass, 'space-y-4')}>
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-white flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <WarningCircle className="w-5 h-5 text-indigo-500" /> Configurações de Alertas e Prazos
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Alerta de Vencimento de Projetos (Dias de antecedência)
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="90"
                        value={alertaDias}
                        onChange={(e) => setAlertaDias(e.target.value)}
                        placeholder="Ex: 7"
                        className={systemFieldClass}
                      />
                    </div>
                  </div>
                  
                  <div className="rounded-xl border border-brand-primary-200/45 bg-gradient-to-r from-brand-primary-50/70 via-white to-brand-turquoise-50/70 p-3 text-xs font-medium text-zinc-600 dark:border-brand-primary-300/15 dark:from-brand-primary-400/10 dark:via-zinc-950 dark:to-brand-turquoise-400/10 dark:text-zinc-300 flex gap-2.5">
                    <Info className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Define com quantos dias de antecedência o sistema irá exibir um alerta de "Prazo Próximo" no ícone de notificações do cabeçalho para projetos que ainda não foram concluídos ou arquivados.
                    </p>
                  </div>
                </div>

                {/* Form submit */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updateConfigMutation.isPending}
                    className={cn(primarySubmitButtonClass, 'flex items-center gap-2 px-5 py-2 text-xs')}
                  >
                    <Check weight="bold" className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                </div>
              </form>

              {/* Zona de Perigo */}
              <div className="border-t border-red-200 dark:border-red-900/40 pt-4 mt-6">
                <div className="flex w-full flex-col justify-between gap-2.5 rounded-xl border border-red-200 bg-red-50/55 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4 dark:border-red-900/50 dark:bg-red-950/20">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400">
                      <WarningCircle weight="bold" className="h-3.5 w-3.5 shrink-0" /> Zona de Perigo — Limpeza Operacional
                    </h3>
                    <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                      Esta ação apaga definitivamente todos os Clientes, Projetos, Orçamentos, Parcelas, Documentos e registros da Jornada do Cliente. Não afeta as configurações da sua empresa ou template.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-red-600 px-3.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-red-700 active:scale-95 sm:self-center"
                  >
                    <Trash weight="bold" size={14} /> Apagar todas as informações
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'aparencia' && (
            <div className={cn(systemPanelClass, 'space-y-4')}>
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <Palette className="w-5 h-5 text-zinc-400" /> Preferências Visuais
              </h2>

              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Tema do Sistema</span>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      type="button" 
                      onClick={() => handleSetTheme('light')}
                      className={`border p-4 rounded-2xl text-left transition-all ${
                        theme === 'light'
                          ? 'border-brand-primary-200 bg-gradient-to-br from-brand-primary-50 via-white to-brand-turquoise-50 ring-2 ring-brand-primary-300/45 dark:border-brand-primary-300/20 dark:from-brand-primary-400/15 dark:via-zinc-900 dark:to-brand-turquoise-400/10 dark:ring-brand-primary-300/20'
                          : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="block font-semibold text-zinc-950 dark:text-white text-sm">Tema Claro (Default)</span>
                      <span className="block text-xs text-zinc-400 mt-1">Aparência clássica minimalista em tons de branco.</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleSetTheme('dark')}
                      className={`border p-4 rounded-2xl text-left transition-all ${
                        theme === 'dark'
                          ? 'border-brand-indigo-200 bg-gradient-to-br from-brand-indigo-50 via-white to-brand-blue-50 ring-2 ring-brand-indigo-300/45 dark:border-brand-indigo-300/20 dark:from-brand-indigo-400/15 dark:via-zinc-900 dark:to-brand-blue-400/10 dark:ring-brand-indigo-300/20'
                          : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="block font-semibold text-zinc-950 dark:text-white text-sm">Tema Escuro</span>
                      <span className="block text-xs text-zinc-400 mt-1">Modo escuro para melhor legibilidade noturna.</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'desktop' && (
            <div className="space-y-6">
              <div className={systemPanelClass}>
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
                      <Database className="h-5 w-5 text-zinc-400" /> Banco local do GeoGestor
                    </h2>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                      O app desktop salva os dados localmente no Windows. Use o backup antes de atualizações grandes ou manutenções.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-400/20 self-start md:self-auto">
                    Desktop local
                  </span>
                </div>

                {loadingDesktopInfo ? (
                  <div className="py-8 flex justify-center">
                    <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-6 h-6 rounded-full border-2 border-brand-primary-100 border-t-brand-primary-500 dark:border-brand-primary-400/15 dark:border-t-brand-primary-300 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="bg-emerald-500/10 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/20">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Versão do Aplicativo</p>
                        <p className="text-base font-heading font-extrabold text-emerald-950 dark:text-emerald-100 mt-0.5 flex items-center gap-2">
                          v{APP_VERSION} <span className="text-[11px] font-mono font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">Atualizado</span>
                        </p>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Ambiente Operacional</p>
                        <p className="text-base font-heading font-bold text-zinc-900 dark:text-white mt-0.5">
                          Electron Desktop (Win32)
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Caminho do banco</p>
                      <p className="select-all break-all rounded-xl bg-zinc-50 dark:bg-zinc-950 p-2.5 font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-350 ring-1 ring-zinc-900/5 dark:ring-white/5">
                        {desktopInfo?.databasePath || 'Não identificado'}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pasta de backups</p>
                      <p className="select-all break-all rounded-xl bg-zinc-50 dark:bg-zinc-950 p-2.5 font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-350 ring-1 ring-zinc-900/5 dark:ring-white/5">
                        {desktopInfo?.backupDirectory || 'Não identificado'}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pasta de arquivos dos clientes</p>
                      <p className="select-all break-all rounded-xl bg-zinc-50 dark:bg-zinc-950 p-2.5 font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-350 ring-1 ring-zinc-900/5 dark:ring-white/5">
                        {desktopInfo?.filesRootDirectory || 'Não identificado'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <BackupPolicyPanel />

              <RouterLink to="/pos-atualizacao" className="geo-focus-ring inline-flex min-h-11 items-center rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Executar verificação pós-atualização
              </RouterLink>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => createBackupMutation.mutate()}
                  disabled={createBackupMutation.isPending}
                  className={systemActionCardClass}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    <DownloadSimple className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-zinc-950 dark:text-white">
                      {createBackupMutation.isPending ? 'Criando backup...' : 'Criar backup agora'}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Copia o banco local para a pasta de backups com data e hora.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleChooseRestoreBundle}
                  disabled={restoring}
                  className={systemActionCardClass}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <UploadSimple className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-zinc-950 dark:text-white">
                      {restoring ? 'Restaurando backup…' : 'Restaurar backup'}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Valida o backup e reinicia o aplicativo com os dados restaurados.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleFullBackup}
                  disabled={checkingFullBackup || createFullBackupMutation.isPending}
                  className={systemActionCardClass}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                    <Database className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-zinc-950 dark:text-white">
                      {checkingFullBackup ? 'Calculando tamanho...' : createFullBackupMutation.isPending ? 'Criando backup completo...' : 'Backup completo'}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {fullBackupEstimate
                        ? `Estimativa: ${formatBytes(fullBackupEstimate.totalBytes)} em ${fullBackupEstimate.totalFiles.toLocaleString('pt-BR')} arquivo(s).`
                        : 'Copia o banco local e a pasta de arquivos dos clientes.'}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => openDataFolderMutation.mutate()}
                  disabled={openDataFolderMutation.isPending}
                  className={systemActionCardClass}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-zinc-950 dark:text-white">Abrir pasta de dados</span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Abre no Explorer a pasta onde ficam o banco local e os backups.
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'template' && (
            <form onSubmit={handleSaveTemplate} className="space-y-6">
              <div className={cn(systemPanelLargeClass, 'md:p-8')}>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-500" /> Identidade Visual para Exportação de Orçamentos
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">Configure o cabeçalho corporativo, cores e termos padrão dos relatórios em PDF.</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    PDF Engine 2.0
                  </span>
                </div>

                {/* Grid Logo + Cores */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="md:col-span-1 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center flex flex-col items-center justify-center relative hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    {logoBase64 ? (
                      <div className="relative group w-full">
                        <img src={logoBase64} alt="Logo" className="max-h-24 mx-auto object-contain mb-3" />
                        <button 
                          type="button" 
                          onClick={() => setLogoBase64('')}
                          className="text-xs text-red-500 font-bold underline cursor-pointer hover:opacity-80"
                        >
                          Remover logo
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center w-full">
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        <UploadSimple className="w-8 h-8 text-zinc-400 mb-2" />
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Upload Logo (PNG/JPG)</span>
                        <span className="text-xs text-zinc-400 mt-1">Sugerido: Fundo transparente</span>
                      </label>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Razão Social / Nome de Exibição no PDF</label>
                      <input 
                        type="text"
                        value={templateRazaoSocial}
                        onChange={e => setTemplateRazaoSocial(e.target.value)}
                        placeholder="Ex: TopoGeo Soluções Fundiárias Ltda"
                          className={cn(systemCompactFieldClass, 'px-3.5 font-semibold')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">CNPJ / CPF Oficial</label>
                        <input 
                          type="text"
                          value={templateCnpj}
                          onChange={e => setTemplateCnpj(e.target.value)}
                          placeholder="00.000.000/0001-00"
                          className={systemCompactFieldClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Telefone / WhatsApp</label>
                        <input 
                          type="text"
                          value={templateTelefone}
                          onChange={e => setTemplateTelefone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className={systemCompactFieldClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">E-mail Comercial de Contato</label>
                    <input 
                      type="email"
                      value={templateEmail}
                      onChange={e => setTemplateEmail(e.target.value)}
                      placeholder="orcamentos@empresa.com"
                      className={cn(systemCompactFieldClass, 'px-3.5')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Cor Destaque do Orçamento</label>
                    <div className={cn(geoFieldClass, 'flex h-9 items-center gap-3 px-2')}>
                      {[
                        { name: 'Emerald', hex: '#059669' },
                        { name: 'Indigo', hex: '#4f46e5' },
                        { name: 'Blue', hex: '#2563eb' },
                        { name: 'Amber', hex: '#d97706' },
                        { name: 'Rose', hex: '#e11d48' },
                        { name: 'Zinc', hex: '#27272a' }
                      ].map(c => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setTemplateCor(c.hex)}
                          className={`w-6 h-6 rounded-lg transition-transform ${templateCor === c.hex ? 'scale-125 ring-2 ring-brand-primary-400 ring-offset-2 dark:ring-brand-primary-300 dark:ring-offset-zinc-900' : 'hover:scale-110 opacity-70'}`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                      <span className="text-xs font-mono text-zinc-500 ml-auto">{templateCor}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Endereço Físico Completo (Exibido no Cabeçalho)</label>
                  <input 
                    type="text"
                    value={templateEndereco}
                    onChange={e => setTemplateEndereco(e.target.value)}
                    placeholder="Av. Engenharia Topográfica, 100 - Sala 402 - Edifício Centro Comercial"
                    className={cn(systemCompactFieldClass, 'px-3.5')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Termos, Prazos & Condições Gerais (Exibido no Rodapé)</label>
                  <textarea 
                    rows={4}
                    value={templateTermos}
                    onChange={e => setTemplateTermos(e.target.value)}
                    placeholder="Descreva as condições contratuais, dados bancários PIX ou observações legais..."
                    className={cn(geoFieldClass, 'w-full resize-none p-3 text-xs font-medium leading-relaxed')}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className={cn(revenueActionButtonClass, 'h-10 min-h-10 px-8 py-2 text-xs')}
                >
                  <Check weight="bold" size={16} /> Salvar Template Oficial
                </button>
              </div>
            </form>
          )}

          {activeTab === 'integracoes' && (
            <div className="space-y-6">
              {/* Google API Keys Form */}
              <form onSubmit={handleSaveGoogleCredentials} className={cn(systemPanelLargeClass, 'space-y-6')}>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                      <Gear className="w-5 h-5 text-indigo-600" /> Credenciais Google API
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Insira as chaves criadas no Google Cloud Console para sincronizar com sua Google Agenda.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-sans">ID do Cliente (Client ID)</label>
                    <input
                      type="text"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="Cole o Client ID aqui..."
                      className={cn(geoFieldClass, 'w-full px-4 py-2.5 text-sm font-medium')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-sans">Chave Secreta do Cliente (Client Secret)</label>
                    <input
                      type="password"
                      value={googleClientSecret}
                      onChange={(e) => setGoogleClientSecret(e.target.value)}
                      placeholder={config?.googleClientSecretConfigured ? 'Segredo já configurado; deixe vazio para preservar' : 'Cole a Client Secret aqui…'}
                      className={cn(geoFieldClass, 'w-full px-4 py-2.5 text-sm font-medium')}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="submit"
                    className={cn(primarySmallActionButtonClass, 'text-xs')}
                  >
                    <Check weight="bold" size={16} /> Salvar Credenciais do Google
                  </button>
                </div>
              </form>

              {/* Status e Sincronização */}
              <div className={cn(systemPanelLargeClass, 'space-y-6')}>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-500" /> Sincronização da Agenda
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Conecte sua conta do Google e gerencie a sincronização de seus compromissos locais e do Google Calendar.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-2xl border border-brand-primary-200/35 bg-gradient-to-r from-brand-primary-50/70 via-white to-brand-turquoise-50/65 dark:border-brand-primary-300/15 dark:from-brand-primary-400/10 dark:via-zinc-950 dark:to-brand-turquoise-400/10 gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1">Status da Conexão</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      googleStatus.conectado 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${googleStatus.conectado ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                      {googleStatus.conectado ? 'Conectado à Conta Google' : 'Desconectado'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {!googleStatus.conectado ? (
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        disabled={!googleStatus.configured}
                        className={`flex items-center gap-2 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95 ${
                          googleStatus.configured 
                            ? 'geo-button-base geo-button-revenue geo-focus-ring'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                        }`}
                      >
                        Conectar Google Agenda
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleSyncGoogle}
                          disabled={syncingGoogle}
                          className={cn(primarySmallActionButtonClass, 'text-xs disabled:opacity-55')}
                        >
                          {syncingGoogle ? 'Sincronizando...' : 'Sincronização Total (Espelhada)'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm('Deseja desconectar sua conta Google?')) {
                              try {
                                await apiClient.patch('/api/configuracoes', {
                                  googleRefreshToken: null,
                                  googleAccessToken: null,
                                  googleSyncActive: false
                                });
                                fetchGoogleStatus();
                                toast.success('Conta Google desconectada!');
                              } catch {
                                toast.error('Erro ao desconectar conta Google.');
                              }
                            }
                          }}
                          className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 rounded-xl px-5 py-2.5 text-xs font-bold transition-all"
                        >
                          Desconectar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!googleStatus.configured && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1.5 font-semibold">
                    <WarningCircle className="w-4 h-4" /> Cadastre o ID e a Chave Secreta acima para poder conectar sua agenda.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>



        <Modal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          title="Apagar Todas as Informações"
          maxWidth="max-w-sm"
        >
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl space-y-2">
              <p className="text-xs font-bold text-red-800 dark:text-red-300">
                Atenção! Você está prestes a realizar um reset de fábrica no banco de dados.
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                Todos os cadastros operacionais e históricos serão removidos permanentemente. Esta ação é irreversível.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Digite <span className="font-mono font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">APAGAR DADOS DO GEOGESTOR</span> para confirmar:
              </label>
              <input
                type="text"
                value={resetInputText}
                onChange={e => setResetInputText(e.target.value.toUpperCase())}
                placeholder="Digite APAGAR DADOS DO GEOGESTOR"
                className="w-full h-10 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 text-xs font-bold text-zinc-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="h-9 px-4 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetInputText.trim().toUpperCase() !== 'APAGAR DADOS DO GEOGESTOR' || resetting}
                onClick={handleResetSistema}
                className="h-9 px-5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {resetting ? 'Apagando dados...' : 'Confirmar Exclusão Total'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showRestoreModal}
          onClose={() => { if (!restoring) setShowRestoreModal(false); }}
          title="Restaurar Backup"
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              A restauração substituirá o banco e, em backups completos, os arquivos dos clientes. O GeoGestor criará cópias de segurança e reiniciará automaticamente.
            </div>
            <div>
              <label htmlFor="restore-bundle-path" className="mb-2 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Backup selecionado</label>
              <input id="restore-bundle-path" value={restoreBundlePath} readOnly className={systemFieldMonoClass} />
            </div>
            <div>
              <label htmlFor="restore-confirmation" className="mb-2 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Digite <span className="font-mono font-bold text-amber-700">RESTAURAR BACKUP DO GEOGESTOR</span> para confirmar:
              </label>
              <input
                id="restore-confirmation"
                type="text"
                value={restoreInputText}
                onChange={(event) => setRestoreInputText(event.target.value.toUpperCase())}
                autoComplete="off"
                placeholder="Digite a frase de confirmação"
                className={systemFieldClass}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <button type="button" onClick={() => setShowRestoreModal(false)} disabled={restoring} className="h-9 rounded-xl px-4 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
              <button
                type="button"
                onClick={handleRestoreBackup}
                disabled={restoring || restoreInputText.trim().toUpperCase() !== 'RESTAURAR BACKUP DO GEOGESTOR'}
                className="h-9 rounded-xl bg-amber-600 px-5 text-xs font-bold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
              >
                {restoring ? 'Restaurando…' : 'Validar e restaurar'}
              </button>
            </div>
          </div>
        </Modal>
    </Layout>
  );
}
