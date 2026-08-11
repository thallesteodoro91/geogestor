import { toast } from 'sonner';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { DEFAULT_COMPANY_TEMPLATE, loadCompanyTemplate, saveCompanyTemplate } from '../services/companyTemplate';
import { APP_VERSION } from '../version';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { motion } from 'framer-motion';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
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
  Calendar,
  Bell,
  Buildings,
  Files,
  Wrench,
  ArrowClockwise,
  Eye,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  ArrowCounterClockwise,
  ShieldCheck,
  ClipboardText,
  Export,
  X
} from '@phosphor-icons/react';
import { Modal } from '../components/Modal';
import { cn } from '../utils/cn';
import { geoFieldClass, geoPanelClass, geoTabButtonClass, geoTabIconClass } from '../utils/geoTheme';
import { primarySmallActionButtonClass, primarySubmitButtonClass } from '../utils/actionStyles';
import { BackupPolicyPanel } from '../components/BackupPolicyPanel';
import { AlertSettingsPanel } from '../components/AlertSettingsPanel';
import { SettingsSaveBar, type SettingsSaveState } from '../components/SettingsSaveBar';
import { requestOpenDiagnosticsFolder } from './diagnosticActions';

const SETTINGS_SECTIONS = ['empresa', 'arquivos', 'backups', 'alertas', 'modelos', 'integracoes', 'aparencia', 'manutencao'] as const;
type SettingsSection = typeof SETTINGS_SECTIONS[number];

interface MaintenanceOperation {
  id: string;
  type: 'backup_database' | 'backup_complete' | 'data_migration' | 'restore_test';
  status: 'running' | 'success' | 'failed' | 'cancelled';
  stage: string;
  startedAt: string;
  completedAt: string | null;
  processedFiles: number;
  processedBytes: number;
  totalFiles: number;
  totalBytes: number;
  cancelRequested: boolean;
  cancellable: boolean;
  error: string | null;
}

interface MaintenanceHistoryEntry {
  id: string;
  type: 'backup_database' | 'backup_complete' | 'restore_test' | 'restore' | 'data_migration' | 'operational_reset' | 'integrity_check' | 'diagnostic_export';
  status: 'running' | 'success' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sourceLabel: string | null;
  destinationLabel: string | null;
  files: number | null;
  bytes: number | null;
  user: string | null;
  error: string | null;
  auditId: string | null;
}

const SETTINGS_SEARCH_INDEX: Array<{ section: SettingsSection; title: string; description: string; keywords: string[]; anchor?: string }> = [
  { section: 'empresa', title: 'Nome da empresa', description: 'Identificação usada no GeoGestor.', keywords: ['empresa', 'nome', 'responsável', 'usuário'], anchor: 'company-name' },
  { section: 'empresa', title: 'E-mail operacional', description: 'Contato do responsável pelo sistema.', keywords: ['email', 'administrador', 'responsável'], anchor: 'admin-email' },
  { section: 'arquivos', title: 'Diretório de documentos', description: 'Pasta onde ficam os arquivos dos clientes.', keywords: ['diretório', 'pasta', 'arquivos', 'migração'], anchor: 'data-directory-target' },
  { section: 'backups', title: 'Política de backups', description: 'Frequência, destino e retenção.', keywords: ['backup', 'retenção', 'segurança', 'destino'], anchor: 'backup-policy-title' },
  { section: 'backups', title: 'Restaurar e testar backup', description: 'Validação e recuperação isolada dos dados.', keywords: ['restaurar', 'restauração', 'checksum', 'integridade'], anchor: 'backup-actions' },
  { section: 'alertas', title: 'Alertas e prazos', description: 'Antecedência e recorrência das notificações.', keywords: ['alerta', 'prazo', 'notificação'], anchor: 'alert-settings-title' },
  { section: 'modelos', title: 'Modelo oficial de documentos', description: 'Logo, cores, cabeçalho e termos.', keywords: ['modelo', 'documento', 'pdf', 'logo'], anchor: 'template-preview-title' },
  { section: 'integracoes', title: 'Google Agenda', description: 'Credenciais protegidas e sincronização.', keywords: ['google', 'agenda', 'integração', 'credencial', 'segurança'], anchor: 'google-client-id' },
  { section: 'aparencia', title: 'Tema do aplicativo', description: 'Claro, escuro ou padrão do sistema.', keywords: ['tema', 'aparência', 'escuro', 'claro'], anchor: 'appearance-title' },
  { section: 'manutencao', title: 'Histórico operacional', description: 'Backups, restaurações, migrações e verificações.', keywords: ['histórico', 'auditoria', 'backup', 'migração'], anchor: 'maintenance-history-title' },
  { section: 'manutencao', title: 'Diagnóstico seguro', description: 'Pacote redigido para suporte técnico.', keywords: ['diagnóstico', 'suporte', 'exportar', 'segurança'], anchor: 'diagnostic-export-title' }
];

const normalizeSettingsSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export function Configuracoes() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get('secao');
  const activeTab: SettingsSection = SETTINGS_SECTIONS.includes(requestedSection as SettingsSection) ? requestedSection as SettingsSection : 'empresa';
  const [navigationBlockedMessage, setNavigationBlockedMessage] = useState('');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [settingsSearchOpen, setSettingsSearchOpen] = useState(false);
  const settingsNavRef = useRef<HTMLDivElement | null>(null);
  const [navOverflow, setNavOverflow] = useState({ left: false, right: false });
  const [externalSectionStates, setExternalSectionStates] = useState<Partial<Record<SettingsSection, SettingsSaveState>>>({});
  const [companySaveState, setCompanySaveState] = useState<SettingsSaveState>('saved');
  const [companySaveError, setCompanySaveError] = useState('');
  const [companyFieldErrors, setCompanyFieldErrors] = useState<Partial<Record<'empresaNome' | 'dadosPasta' | 'adminNome' | 'adminEmail', string>>>({});
  const settingsTabClass = (tab: SettingsSection, tone: Parameters<typeof geoTabButtonClass>[1]) =>
    cn(geoTabButtonClass(activeTab === tab, tone), 'shrink-0 justify-start lg:w-full');
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
  const [savedCompanySnapshot, setSavedCompanySnapshot] = useState('');
  const [directoryTarget, setDirectoryTarget] = useState('');
  const [directoryStrategy, setDirectoryStrategy] = useState<'use' | 'copy' | 'move'>('copy');
  const [directoryConfirmation, setDirectoryConfirmation] = useState('');
  const [directoryPreflight, setDirectoryPreflight] = useState<DataDirectoryPreflight | null>(null);
  const [checkingDirectory, setCheckingDirectory] = useState(false);
  const [migratingDirectory, setMigratingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState('');

  // Google Calendar States
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [googleSaveState, setGoogleSaveState] = useState<SettingsSaveState>('saved');
  const [googleSaveError, setGoogleSaveError] = useState('');
  const [googleStatusError, setGoogleStatusError] = useState('');
  const googlePollingRef = useRef<{ interval: number; timeout: number } | null>(null);
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
  const [restoreRecoveryCode, setRestoreRecoveryCode] = useState('');
  const [restoreInputText, setRestoreInputText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [validatingRestore, setValidatingRestore] = useState(false);
  const [testingRestore, setTestingRestore] = useState(false);
  const [restoreTestResult, setRestoreTestResult] = useState<{ testedAt: string; checksumFilesVerified: number; checksumCoverage: 'verified' | 'legacy-unverified'; credentialsExcluded: boolean } | null>(null);
  const [restoreValidationError, setRestoreValidationError] = useState('');
  const [restorePreview, setRestorePreview] = useState<{ type: 'database' | 'complete'; createdAt: string; schemaVersion: number; totals: { files: number; bytes: number }; encrypted: boolean; integrity: 'verified' | 'legacy-unverified'; checksumFilesVerified: number; credentialsExcluded: boolean; availableBytes: number; estimatedRequiredBytes: number; canProceed: boolean } | null>(null);

  const handleResetSistema = async () => {
    if (resetInputText.trim().toUpperCase() !== 'APAGAR DADOS DO GEOGESTOR') return;
    setResetting(true);
    try {
      const result = await apiClient.post<{ removedTotal: number; recoveryBackupPath: string; removedByTable: Record<string, number> }>('/api/sistema/reset-dados', { confirmation: 'APAGAR DADOS DO GEOGESTOR' });
      await queryClient.invalidateQueries();
      setShowResetModal(false);
      setResetInputText('');
      toast.success(`${result.removedTotal.toLocaleString('pt-BR')} registro(s) operacional(is) removido(s). Backup de recuperação: ${result.recoveryBackupPath}`);
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
    setRestorePreview(null);
    setRestoreValidationError('');
    setValidatingRestore(true);
    try {
      const preview = await apiClient.post<{ type: 'database' | 'complete'; createdAt: string; schemaVersion: number; totals: { files: number; bytes: number }; encrypted: boolean; integrity: 'verified' | 'legacy-unverified'; checksumFilesVerified: number; credentialsExcluded: boolean; availableBytes: number; estimatedRequiredBytes: number; canProceed: boolean }>('/api/sistema/restaurar-backup/preflight', { bundlePath: selected, recoveryCode: restoreRecoveryCode || null }, { timeoutMs: 60_000 });
      setRestorePreview(preview);
      setRestoreTestResult(null);
    } catch (error) {
      setRestoreValidationError(error instanceof Error ? error.message : 'O backup não pôde ser validado.');
    } finally {
      setValidatingRestore(false);
    }
  };

  const handleValidateRestore = async () => {
    if (!restoreBundlePath) return;
    setValidatingRestore(true);
    setRestoreValidationError('');
    try {
      const preview = await apiClient.post<typeof restorePreview extends infer T ? Exclude<T, null> : never>('/api/sistema/restaurar-backup/preflight', { bundlePath: restoreBundlePath, recoveryCode: restoreRecoveryCode || null }, { timeoutMs: 60_000 });
      setRestorePreview(preview);
      setRestoreTestResult(null);
    } catch (error) {
      setRestorePreview(null);
      setRestoreValidationError(error instanceof Error ? error.message : 'O backup não pôde ser validado.');
    } finally {
      setValidatingRestore(false);
    }
  };

  const handleTestRestore = async () => {
    if (!restoreBundlePath || !restorePreview) return;
    setTestingRestore(true);
    setRestoreValidationError('');
    try {
      const result = await apiClient.post<{ testedAt: string; checksumFilesVerified: number; checksumCoverage: 'verified' | 'legacy-unverified'; credentialsExcluded: boolean }>('/api/sistema/restaurar-backup/testar', { bundlePath: restoreBundlePath, recoveryCode: restoreRecoveryCode || null }, { timeoutMs: 180_000 });
      setRestoreTestResult(result);
      await queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      toast.success(`Restauração testada em área isolada. ${result.checksumFilesVerified.toLocaleString('pt-BR')} checksum(s) confirmado(s).`);
    } catch (error) {
      setRestoreValidationError(error instanceof Error ? error.message : 'O teste isolado de restauração falhou.');
    } finally {
      setTestingRestore(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (restoreInputText.trim().toUpperCase() !== 'RESTAURAR BACKUP DO GEOGESTOR') return;
    setRestoring(true);
    try {
      await apiClient.post('/api/sistema/restaurar-backup', {
        bundlePath: restoreBundlePath,
        confirmation: 'RESTAURAR BACKUP DO GEOGESTOR',
        recoveryCode: restoreRecoveryCode || null
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
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaveState, setTemplateSaveState] = useState<SettingsSaveState>('saved');
  const [templateError, setTemplateError] = useState('');
  const [savedTemplateSnapshot, setSavedTemplateSnapshot] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [diagnosticSummary, setDiagnosticSummary] = useState<{ included: string[]; excluded: string[]; format: string; containsPersonalData: boolean; containsCredentials: boolean } | null>(null);
  const [creatingDiagnostic, setCreatingDiagnostic] = useState(false);
  const [createdDiagnostic, setCreatedDiagnostic] = useState<{ path: string; createdAt: string } | null>(null);

  const operationQuery = useQuery<{ operation: MaintenanceOperation | null }>({
    queryKey: ['maintenance-operation'],
    queryFn: () => apiClient.get('/api/sistema/operacoes/status'),
    refetchInterval: (query) => query.state.data?.operation?.status === 'running' ? 600 : 4_000
  });
  const activeOperation = operationQuery.data?.operation ?? null;

  const historyQuery = useQuery<{ items: MaintenanceHistoryEntry[] }>({
    queryKey: ['maintenance-history', historyTypeFilter, historyStatusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (historyTypeFilter) params.set('type', historyTypeFilter);
      if (historyStatusFilter) params.set('status', historyStatusFilter);
      params.set('limit', '100');
      return apiClient.get(`/api/sistema/historico-operacional?${params.toString()}`);
    },
    enabled: activeTab === 'manutencao'
  });

  const cancelOperationMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/sistema/operacoes/${id}/cancelar`),
    onSuccess: async () => {
      await operationQuery.refetch();
      toast.success('Cancelamento solicitado. O GeoGestor concluirá a etapa atual e reverterá a cópia parcial.');
    },
    onError: (error: Error) => toast.error(error.message)
  });

  interface DataDirectoryPreflight {
    currentDirectory: string;
    targetDirectory: string;
    sameDirectory: boolean;
    targetExisted: boolean;
    current: { bytes: number; files: number; directories: number };
    target: { bytes: number; files: number; directories: number };
    availableBytes: number;
    trackedDocuments: number;
    trackedOutsideCurrent: number;
    missingTrackedAtTarget: number;
    conflictingFiles: number;
    canUseExisting: boolean;
    canCopyOrMove: boolean;
    requiresMigration: boolean;
  }

  useEffect(() => {
    let active = true;
    loadCompanyTemplate()
      .then((template) => {
        if (!active) return;
        setLogoBase64(template.logo);
        setTemplateRazaoSocial(template.razao);
        setTemplateCnpj(template.cnpj);
        setTemplateTelefone(template.telefone);
        setTemplateEmail(template.email);
        setTemplateEndereco(template.endereco);
        setTemplateCor(template.cor);
        setTemplateTermos(template.termos);
        setSavedTemplateSnapshot(JSON.stringify(template));
        setTemplateError('');
      })
      .catch((error) => setTemplateError(error instanceof Error ? error.message : 'Não foi possível carregar o modelo oficial.'))
      .finally(() => { if (active) setTemplateLoading(false); });
    return () => { active = false; };
  }, []);

  const handleSaveTemplate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const tData = {
      version: 1 as const,
      logo: logoBase64,
      razao: templateRazaoSocial,
      cnpj: templateCnpj,
      telefone: templateTelefone,
      email: templateEmail,
      endereco: templateEndereco,
      cor: templateCor,
      termos: templateTermos
    };
    setTemplateSaving(true);
    setTemplateError('');
    try {
      await saveCompanyTemplate(tData);
      setSavedTemplateSnapshot(JSON.stringify(tData));
      setTemplateSaveState('success');
      window.setTimeout(() => setTemplateSaveState('saved'), 1800);
      toast.success('Modelo oficial salvo e disponível para as próximas exportações.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o modelo.';
      setTemplateError(message);
      setTemplateSaveState('error');
      toast.error(message);
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
        toast.error('Use uma imagem PNG, JPG ou WebP.');
        e.target.value = '';
        return;
      }
      if (f.size > 2 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 2 MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setLogoBase64(reader.result as string);
      };
      reader.readAsDataURL(f);
    }
  };

  // 1. Fetch Current Configuration
  const { data: config, isLoading, isError: configIsError, error: configError, refetch: refetchConfig } = useQuery({
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
    availableBytes: number;
    estimatedRequiredBytes: number;
    canProceed: boolean;
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

  const { data: desktopInfo, isLoading: loadingDesktopInfo, isError: desktopInfoError, refetch: refetchDesktopInfo } = useQuery<DesktopInfo>({
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
        setSavedCompanySnapshot(JSON.stringify({
          empresaNome: config.empresaNome || '',
          adminNome: config.adminNome || '',
          adminEmail: config.adminEmail || ''
        }));
        setGoogleClientId(config.googleClientId || '');
        setGoogleClientSecret('');
      });
    }
  }, [config]);

  const fetchGoogleStatus = async () => {
    try {
      const res = await apiClient.get<{ conectado: boolean; syncActive: boolean; configured: boolean }>('/api/google/status');
      setGoogleStatus(res);
      setGoogleStatusError('');
    } catch (e) {
      setGoogleStatusError(e instanceof Error ? e.message : 'Não foi possível consultar a integração.');
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchGoogleStatus);
    return () => {
      if (googlePollingRef.current) {
        window.clearInterval(googlePollingRef.current.interval);
        window.clearTimeout(googlePollingRef.current.timeout);
      }
    };
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const res = await apiClient.get<{ url: string }>('/api/google/auth-url');
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
        
        // Polling para checar se autenticou
        if (googlePollingRef.current) {
          window.clearInterval(googlePollingRef.current.interval);
          window.clearTimeout(googlePollingRef.current.timeout);
        }
        const interval = window.setInterval(async () => {
          try {
            const status = await apiClient.get<{ conectado: boolean; syncActive: boolean; configured: boolean }>('/api/google/status');
            if (status.conectado) {
              setGoogleStatus(status);
              clearInterval(interval);
              googlePollingRef.current = null;
              toast.success('Google Agenda conectada com sucesso!');
            }
          } catch {
            // Ignore polling errors
          }
        }, 3000);

        const timeout = window.setTimeout(() => {
          window.clearInterval(interval);
          googlePollingRef.current = null;
        }, 120000);
        googlePollingRef.current = { interval, timeout };
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

  const handleSaveGoogleCredentials = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!googleClientSecret.trim() && !config?.googleClientSecretConfigured) {
      toast.error('Informe a Chave Secreta do Cliente para configurar a integração.');
      return;
    }
    setSavingGoogle(true);
    setGoogleSaveError('');
    try {
      await apiClient.patch('/api/configuracoes', {
        googleClientId,
        googleClientSecret
      });
      await queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      fetchGoogleStatus();
      setGoogleClientSecret('');
      setGoogleSaveState('success');
      window.setTimeout(() => setGoogleSaveState('saved'), 1800);
      toast.success('Credenciais da Google Agenda salvas com sucesso!');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao salvar credenciais.';
      setGoogleSaveError(message);
      setGoogleSaveState('error');
      toast.error(message);
    } finally {
      setSavingGoogle(false);
    }
  };

  // Mutation to update configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (payload: ConfiguracaoConfig) => {
      await apiClient.patch('/api/configuracoes', payload);
    },
    onMutate: () => {
      setCompanySaveState('saving');
      setCompanySaveError('');
      setCompanyFieldErrors({});
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
      setSavedCompanySnapshot(JSON.stringify({ empresaNome: variables.empresaNome, adminNome: variables.adminNome, adminEmail: variables.adminEmail }));
      setCompanySaveState('success');
      window.setTimeout(() => setCompanySaveState('saved'), 1800);
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (error: Error) => {
      setCompanySaveError(error.message);
      setCompanySaveState('error');
      toast.error('Erro ao salvar as configurações no servidor.');
    }
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<{ backupPath: string }>('/api/sistema/backup');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sistema-info'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      toast.success(`Backup criado com sucesso:\n${data.backupPath}`);
    },
    onError: (error: Error) => toast.error(`Backup não concluído: ${error.message}. Verifique o destino e tente novamente.`),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['backup-status'] }); }
  });

  const createFullBackupMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<FullBackupResult>('/api/sistema/backup-completo');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sistema-info'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      const sizeInfo = data.totalBytes ? `\nTamanho copiado: ${formatBytes(data.totalBytes)} em ${data.totalFiles || 0} arquivo(s)` : '';
      toast.success(`Backup completo criado com sucesso:\nBanco: ${data.backupPath}\nArquivos: ${data.filesBackupPath}${sizeInfo}`);
    },
    onError: (error: Error) => toast.error(`Backup completo não concluído: ${error.message}. Verifique a pasta de documentos e o espaço livre.`),
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: ['backup-status'] }); }
  });

  const openDataFolderMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/api/sistema/abrir-pasta-dados');
    },
    onError: () => {
      toast.error('Erro ao abrir a pasta de dados local.');
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('geogestor_theme');
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  });
  const [checkingFullBackup, setCheckingFullBackup] = useState(false);
  const [fullBackupEstimate, setFullBackupEstimate] = useState<BackupPreflightInfo | null>(null);

  const applyTheme = (preference: 'light' | 'dark' | 'system') => {
    const shouldUseDark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', shouldUseDark);
    document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light';
  };

  const handleSetTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('geogestor_theme', newTheme);
    applyTheme(newTheme);
    window.dispatchEvent(new Event('geogestor:theme-change'));
  };

  const exportMaintenanceHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (historyTypeFilter) params.set('type', historyTypeFilter);
      if (historyStatusFilter) params.set('status', historyStatusFilter);
      const csv = await apiClient.get<string>(`/api/sistema/historico-operacional/exportar?${params.toString()}`);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `historico-operacional-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Histórico operacional exportado em CSV.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível exportar o histórico.');
    }
  };

  const openDiagnosticPreview = async () => {
    setShowDiagnosticModal(true);
    setDiagnosticSummary(null);
    setCreatedDiagnostic(null);
    try {
      setDiagnosticSummary(await apiClient.get('/api/sistema/diagnostico/resumo'));
    } catch (error) {
      setShowDiagnosticModal(false);
      toast.error(error instanceof Error ? error.message : 'Não foi possível preparar o resumo do diagnóstico.');
    }
  };

  const openDiagnosticsFolder = async () => {
    const result = await requestOpenDiagnosticsFolder(window.electronAPI?.openDiagnosticsFolder);
    if (!result.success) toast.error(result.error);
    else toast.success('Pasta de diagnósticos aberta.');
  };

  const copyDiagnosticPath = async () => {
    if (!createdDiagnostic?.path || !navigator.clipboard?.writeText) {
      toast.error('Não foi possível copiar o caminho. Abra a pasta de diagnósticos e tente novamente.');
      return;
    }
    try {
      await navigator.clipboard.writeText(createdDiagnostic.path);
      toast.success('Caminho do diagnóstico copiado.');
    } catch {
      toast.error('Não foi possível copiar o caminho. Verifique a permissão da área de transferência.');
    }
  };

  const createSafeDiagnostic = async () => {
    setCreatingDiagnostic(true);
    try {
      const result = await apiClient.post<{ path: string; createdAt: string }>('/api/sistema/diagnostico');
      setCreatedDiagnostic(result);
      await historyQuery.refetch();
      toast.success('Diagnóstico seguro criado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o diagnóstico seguro.');
    } finally {
      setCreatingDiagnostic(false);
    }
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => { if (theme === 'system') applyTheme('system'); };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  const currentCompanySnapshot = JSON.stringify({ empresaNome, adminNome, adminEmail });
  const currentTemplateSnapshot = JSON.stringify({
    version: 1,
    logo: logoBase64,
    razao: templateRazaoSocial,
    cnpj: templateCnpj,
    telefone: templateTelefone,
    email: templateEmail,
    endereco: templateEndereco,
    cor: templateCor,
    termos: templateTermos
  });
  const companyDirty = Boolean(savedCompanySnapshot) && currentCompanySnapshot !== savedCompanySnapshot;
  const templateDirty = Boolean(savedTemplateSnapshot) && currentTemplateSnapshot !== savedTemplateSnapshot;
  const googleDirty = googleClientId !== (config?.googleClientId || '') || Boolean(googleClientSecret);
  const effectiveCompanySaveState: SettingsSaveState = updateConfigMutation.isPending ? 'saving' : companyDirty && companySaveState !== 'error' ? 'dirty' : companySaveState;
  const effectiveTemplateSaveState: SettingsSaveState = templateSaving ? 'saving' : templateDirty && templateSaveState !== 'error' ? 'dirty' : templateSaveState;
  const effectiveGoogleSaveState: SettingsSaveState = savingGoogle ? 'saving' : googleDirty && googleSaveState !== 'error' ? 'dirty' : googleSaveState;
  const hasUnsavedChanges = (activeTab === 'empresa' && companyDirty)
    || (activeTab === 'modelos' && templateDirty)
    || (activeTab === 'integracoes' && googleDirty)
    || externalSectionStates[activeTab] === 'dirty'
    || externalSectionStates[activeTab] === 'error';

  useEffect(() => {
    const receiveState = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: SettingsSection; state?: SettingsSaveState }>).detail;
      if (!detail?.section || !detail.state) return;
      setExternalSectionStates((current) => ({ ...current, [detail.section!]: detail.state }));
    };
    window.addEventListener('geogestor:settings-section-state', receiveState);
    return () => window.removeEventListener('geogestor:settings-section-state', receiveState);
  }, []);

  const settingsSearchResults = useMemo(() => {
    const query = normalizeSettingsSearch(settingsSearch);
    if (!query) return [];
    return SETTINGS_SEARCH_INDEX.filter((item) => normalizeSettingsSearch([
      item.title,
      item.description,
      ...item.keywords
    ].join(' ')).includes(query)).slice(0, 8);
  }, [settingsSearch]);

  const refreshNavOverflow = useCallback(() => {
    const nav = settingsNavRef.current;
    if (!nav) return;
    setNavOverflow({
      left: nav.scrollLeft > 4,
      right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4
    });
  }, []);

  const revealActiveSettingsSection = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const nav = settingsNavRef.current;
    const active = nav?.querySelector<HTMLElement>('[data-settings-active="true"]');
    if (!nav || !active) return;
    const navBox = nav.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    const left = Math.max(0, nav.scrollLeft + activeBox.left - navBox.left - (nav.clientWidth - activeBox.width) / 2);
    if (behavior === 'auto') {
      const previousScrollBehavior = nav.style.scrollBehavior;
      nav.style.scrollBehavior = 'auto';
      nav.scrollLeft = left;
      window.requestAnimationFrame(() => {
        nav.style.scrollBehavior = previousScrollBehavior;
        refreshNavOverflow();
      });
    } else nav.scrollTo({ left, behavior });
  }, [refreshNavOverflow]);

  useEffect(() => {
    const nav = settingsNavRef.current;
    if (!nav) return;
    if (typeof ResizeObserver === 'undefined') {
      refreshNavOverflow();
      return;
    }
    const resize = new ResizeObserver(refreshNavOverflow);
    resize.observe(nav);
    refreshNavOverflow();
    return () => resize.disconnect();
  }, [configIsError, isLoading, refreshNavOverflow]);

  useEffect(() => {
    revealActiveSettingsSection();
    const focusId = searchParams.get('foco');
    if (!focusId) return;
    window.setTimeout(() => {
      const target = document.getElementById(focusId);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (target instanceof HTMLElement && target.matches('input,button,select,textarea,[tabindex]')) target.focus();
    }, 120);
  }, [activeTab, revealActiveSettingsSection, searchParams]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);

  const discardSectionChanges = (section: SettingsSection) => {
    if (section === 'empresa' && config) {
      setEmpresaNome(config.empresaNome || '');
      setDadosPasta(config.dadosPasta || '');
      setAdminNome(config.adminNome || '');
      setAdminEmail(config.adminEmail || '');
      setCompanyFieldErrors({});
      setCompanySaveError('');
      setCompanySaveState('saved');
    } else if (section === 'modelos' && savedTemplateSnapshot) {
      const saved = JSON.parse(savedTemplateSnapshot) as typeof DEFAULT_COMPANY_TEMPLATE;
      setLogoBase64(saved.logo);
      setTemplateRazaoSocial(saved.razao);
      setTemplateCnpj(saved.cnpj);
      setTemplateTelefone(saved.telefone);
      setTemplateEmail(saved.email);
      setTemplateEndereco(saved.endereco);
      setTemplateCor(saved.cor);
      setTemplateTermos(saved.termos);
      setTemplateError('');
      setTemplateSaveState('saved');
    } else if (section === 'integracoes') {
      setGoogleClientId(config?.googleClientId || '');
      setGoogleClientSecret('');
      setGoogleSaveError('');
      setGoogleSaveState('saved');
    } else if (section === 'backups' || section === 'alertas') {
      window.dispatchEvent(new CustomEvent('geogestor:settings-discard', { detail: { section } }));
    }
  };

  const navigateToSection = (section: SettingsSection, focusId?: string) => {
    if (section === activeTab && !focusId) return;
    if (hasUnsavedChanges && !window.confirm('Há alterações não salvas nesta seção. Deseja descartá-las e continuar?')) {
      setNavigationBlockedMessage('Navegação cancelada. Salve ou descarte as alterações atuais.');
      window.requestAnimationFrame(() => revealActiveSettingsSection('auto'));
      return;
    }
    if (hasUnsavedChanges) discardSectionChanges(activeTab);
    setNavigationBlockedMessage('');
    setSearchParams(focusId ? { secao: section, foco: focusId } : { secao: section });
    setSettingsSearchOpen(false);
  };

  const confirmLeavingSettings = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (hasUnsavedChanges && !window.confirm('Há alterações não salvas nesta seção. Deseja descartá-las e continuar?')) event.preventDefault();
  };

  const chooseDataDirectory = async () => {
    if (!window.electronAPI?.selectDataDirectory) {
      toast.error('A seleção de pasta está disponível somente no aplicativo desktop.');
      return;
    }
    const selected = await window.electronAPI.selectDataDirectory();
    if (selected) {
      setDirectoryTarget(selected);
      setDirectoryPreflight(null);
      setDirectoryError('');
    }
  };

  const checkDataDirectory = async () => {
    setCheckingDirectory(true);
    setDirectoryError('');
    try {
      const result = await apiClient.post<DataDirectoryPreflight>('/api/sistema/diretorio-arquivos/preflight', { targetDirectory: directoryTarget });
      setDirectoryPreflight(result);
      if (!result.canCopyOrMove && result.canUseExisting) setDirectoryStrategy('use');
      else if (result.canCopyOrMove) setDirectoryStrategy('copy');
    } catch (error) {
      setDirectoryPreflight(null);
      setDirectoryError(error instanceof Error ? error.message : 'Não foi possível validar a pasta.');
    } finally {
      setCheckingDirectory(false);
    }
  };

  const migrateDataDirectory = async () => {
    setMigratingDirectory(true);
    setDirectoryError('');
    try {
      const result = await apiClient.post<{ targetDirectory: string; copiedFiles: number; checksumFilesVerified: number; cleanupWarning: string | null }>('/api/sistema/diretorio-arquivos/migrar', {
        targetDirectory: directoryTarget,
        strategy: directoryStrategy,
        confirmation: directoryConfirmation
      }, { timeoutMs: 120_000 });
      setDadosPasta(result.targetDirectory);
      setDirectoryConfirmation('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['configuracoes'] }),
        queryClient.invalidateQueries({ queryKey: ['sistema-info'] })
      ]);
      toast.success(result.cleanupWarning || `Pasta alterada com segurança. ${result.checksumFilesVerified.toLocaleString('pt-BR')} arquivo(s) conferido(s) por checksum.`);
      setDirectoryPreflight(null);
      setDirectoryTarget('');
    } catch (error) {
      setDirectoryError(error instanceof Error ? error.message : 'Não foi possível alterar a pasta. Nenhuma configuração foi aplicada.');
    } finally {
      setMigratingDirectory(false);
    }
  };

  const handleFullBackup = async () => {
    try {
      setCheckingFullBackup(true);
      const estimate = await apiClient.get<BackupPreflightInfo>('/api/sistema/backup-completo/preflight');
      setFullBackupEstimate(estimate);
      if (!estimate.canProceed) {
        toast.error(`Espaço insuficiente. Necessário: ${formatBytes(estimate.estimatedRequiredBytes)}; disponível: ${formatBytes(estimate.availableBytes)}.`);
        return;
      }

      const shouldContinue = window.confirm([
        'Backup completo do GeoGestor',
        '',
        `Arquivos estimados: ${estimate.totalFiles.toLocaleString('pt-BR')}`,
        `Tamanho estimado: ${formatBytes(estimate.totalBytes)}`,
        `Espaço livre: ${formatBytes(estimate.availableBytes)}`,
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

  const saveCompanySettings = () => {
    const errors: typeof companyFieldErrors = {};
    if (!empresaNome.trim()) errors.empresaNome = 'Informe o nome da empresa.';
    if (!dadosPasta.trim()) errors.dadosPasta = 'Configure uma pasta de documentos válida.';
    if (!adminNome.trim()) errors.adminNome = 'Informe o nome do responsável.';
    if (!adminEmail.trim()) errors.adminEmail = 'Informe o e-mail operacional.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) errors.adminEmail = 'Informe um e-mail válido, como nome@empresa.com.';
    setCompanyFieldErrors(errors);
    const firstField = (Object.keys(errors) as Array<keyof typeof errors>)[0];
    if (firstField) {
      const fieldId = { empresaNome: 'company-name', dadosPasta: 'data-folder', adminNome: 'admin-name', adminEmail: 'admin-email' }[firstField];
      const field = document.getElementById(fieldId);
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.setTimeout(() => field?.focus(), 180);
      setCompanySaveState('error');
      setCompanySaveError(errors[firstField] || 'Revise os campos destacados.');
      return;
    }
    updateConfigMutation.mutate({
      empresaNome,
      dadosPasta,
      adminNome,
      adminEmail
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCompanySettings();
  };

  const discardCompanyChanges = () => {
    if (!config) return;
    setEmpresaNome(config.empresaNome || '');
    setDadosPasta(config.dadosPasta || '');
    setAdminNome(config.adminNome || '');
    setAdminEmail(config.adminEmail || '');
    setCompanyFieldErrors({});
    setCompanySaveError('');
    setCompanySaveState('saved');
  };

  const discardTemplateChanges = () => {
    if (!savedTemplateSnapshot) return;
    const saved = JSON.parse(savedTemplateSnapshot) as typeof DEFAULT_COMPANY_TEMPLATE;
    setLogoBase64(saved.logo);
    setTemplateRazaoSocial(saved.razao);
    setTemplateCnpj(saved.cnpj);
    setTemplateTelefone(saved.telefone);
    setTemplateEmail(saved.email);
    setTemplateEndereco(saved.endereco);
    setTemplateCor(saved.cor);
    setTemplateTermos(saved.termos);
    setTemplateError('');
    setTemplateSaveState('saved');
  };

  const discardGoogleChanges = () => {
    setGoogleClientId(config?.googleClientId || '');
    setGoogleClientSecret('');
    setGoogleSaveError('');
    setGoogleSaveState('saved');
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

  if (configIsError) {
    return (
      <Layout>
        <PageHeader eyebrow="Painel do sistema" title="Configurações" description="Gerencie as preferências e a operação local do GeoGestor." />
        <div role="alert" className={cn(systemPanelClass, 'mx-auto max-w-3xl space-y-4 border-red-200 dark:border-red-900')}>
          <div className="flex items-start gap-3 text-red-700 dark:text-red-300">
            <WarningCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div><h2 className="font-semibold">Não foi possível carregar as configurações</h2><p className="mt-1 break-words text-sm">{configError instanceof Error ? configError.message : 'Verifique se o serviço local está disponível.'}</p></div>
          </div>
          <button type="button" onClick={() => void refetchConfig()} className={cn(primarySmallActionButtonClass, 'min-h-11')}><ArrowClockwise aria-hidden="true" size={17} /> Tentar novamente</button>
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
      <p aria-live="polite" className="sr-only">{navigationBlockedMessage}</p>

      <div className="relative mb-5 max-w-2xl" role="search">
        <label htmlFor="settings-search" className="sr-only">Buscar nas configurações</label>
        <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
        <input
          id="settings-search"
          type="search"
          name="settings_search"
          autoComplete="off"
          value={settingsSearch}
          onChange={(event) => { setSettingsSearch(event.target.value); setSettingsSearchOpen(true); }}
          onFocus={() => setSettingsSearchOpen(true)}
          onKeyDown={(event) => { if (event.key === 'Escape') { setSettingsSearchOpen(false); event.currentTarget.blur(); } }}
          placeholder="Buscar backup, Google, tema, diretório…"
          className="min-h-11 w-full rounded-2xl border border-zinc-300 bg-white py-2.5 pl-10 pr-10 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
        {settingsSearch && <button type="button" onClick={() => { setSettingsSearch(''); setSettingsSearchOpen(false); }} aria-label="Limpar busca nas configurações" className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:hover:bg-zinc-800"><X aria-hidden="true" size={16} /></button>}
        {settingsSearchOpen && settingsSearch && (
          <div id="settings-search-results" className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-40 max-h-80 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {settingsSearchResults.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">Nenhuma configuração encontrada. Tente “backup”, “tema” ou “Google”.</p>
            ) : settingsSearchResults.map((result) => (
              <button key={`${result.section}-${result.title}`} type="button" onClick={() => navigateToSection(result.section, result.anchor)} className="geo-focus-ring flex min-h-12 w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <MagnifyingGlass aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <span className="min-w-0"><strong className="block text-sm text-zinc-900 dark:text-white">{result.title}</strong><span className="block text-xs text-zinc-500">{result.description}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <nav aria-label="Áreas de configuração" className="min-w-0 space-y-2 lg:col-span-1">
          <div className="relative min-w-0">
            {navOverflow.left && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-zinc-50 to-transparent dark:from-[#121215] lg:hidden" />}
            {navOverflow.right && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-zinc-50 to-transparent dark:from-[#121215] lg:hidden" />}
            {navOverflow.left && <button type="button" aria-label="Mostrar seções anteriores" onClick={() => settingsNavRef.current?.scrollBy({ left: -220, behavior: 'smooth' })} className="absolute left-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-zinc-300 bg-white p-1.5 text-zinc-700 shadow sm:block lg:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><CaretLeft aria-hidden="true" size={15} /></button>}
            <div
              ref={settingsNavRef}
              aria-label="Seções de configuração"
              onScroll={refreshNavOverflow}
              onWheel={(event) => {
                const target = event.currentTarget;
                if (target.scrollWidth <= target.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
                target.scrollLeft += event.deltaY;
                event.preventDefault();
              }}
              className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 [scrollbar-width:thin] lg:flex-col lg:overflow-visible lg:pb-0"
            >
            {([
              ['empresa', 'Empresa e usuário', Buildings, 'system'],
              ['arquivos', 'Arquivos e pastas', Files, 'field'],
              ['backups', 'Backups', Database, 'system'],
              ['alertas', 'Alertas', Bell, 'warning'],
              ['modelos', 'Modelos e documentos', FileText, 'success'],
              ['integracoes', 'Integrações', Link, 'field'],
              ['aparencia', 'Aparência', Palette, 'warning'],
              ['manutencao', 'Manutenção e segurança', Wrench, 'system']
            ] as const).map(([section, label, Icon, tone]) => (
              <button
                key={section}
                type="button"
                data-settings-active={activeTab === section}
                aria-current={activeTab === section ? 'page' : undefined}
                onClick={() => navigateToSection(section)}
                className={settingsTabClass(section, tone)}
              >
                <span aria-hidden="true" className={geoTabIconClass(activeTab === section, tone)}><Icon weight={activeTab === section ? 'fill' : 'regular'} className="h-4 w-4" /></span>
                <span className="min-w-0">{label}</span>
                {(() => {
                  const state = section === 'empresa' ? effectiveCompanySaveState : section === 'modelos' ? effectiveTemplateSaveState : section === 'integracoes' ? effectiveGoogleSaveState : externalSectionStates[section];
                  if (!state || state === 'saved' || state === 'success') return null;
                  const text = state === 'dirty' ? 'Alterada' : state === 'saving' ? 'Salvando' : 'Erro';
                  return <span className={cn('ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold', state === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : state === 'dirty' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300')}>{text}</span>;
                })()}
              </button>
            ))}
            </div>
            {navOverflow.right && <button type="button" aria-label="Mostrar próximas seções" onClick={() => settingsNavRef.current?.scrollBy({ left: 220, behavior: 'smooth' })} className="absolute right-1 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-zinc-300 bg-white p-1.5 text-zinc-700 shadow sm:block lg:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"><CaretRight aria-hidden="true" size={15} /></button>}
          </div>
          <div className="hidden border-t border-zinc-200 pt-2 dark:border-zinc-800 lg:block">
            <span className="mb-1 hidden px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 lg:block">Ferramentas</span>
            <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              <RouterLink onClick={confirmLeavingSettings} to="/importacao" className={cn(geoTabButtonClass(false, 'success'), 'shrink-0 justify-start lg:w-full')}>
                <span aria-hidden="true" className={geoTabIconClass(false, 'success')}><UploadSimple className="h-4 w-4" /></span> Importação de dados
              </RouterLink>
              <RouterLink onClick={confirmLeavingSettings} to="/qualidade-dados" className={cn(geoTabButtonClass(false, 'warning'), 'shrink-0 justify-start lg:w-full')}>
                <span aria-hidden="true" className={geoTabIconClass(false, 'warning')}><WarningCircle className="h-4 w-4" /></span> Qualidade dos dados
              </RouterLink>
              <RouterLink onClick={confirmLeavingSettings} to="/audit-logs" className={cn(geoTabButtonClass(false, 'system'), 'shrink-0 justify-start lg:w-full')}>
                <span aria-hidden="true" className={geoTabIconClass(false, 'system')}><FileText className="h-4 w-4" /></span> Logs de auditoria
              </RouterLink>
            </div>
          </div>
        </nav>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {activeOperation?.status === 'running' && (
            <section className="mb-5 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900 dark:bg-sky-950/30" aria-labelledby="maintenance-progress-title" aria-busy="true">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="maintenance-progress-title" className="text-sm font-semibold text-sky-900 dark:text-sky-200">Operação segura em andamento</h2>
                  <p aria-live="polite" className="mt-1 text-xs text-sky-800 dark:text-sky-300">{activeOperation.stage}</p>
                </div>
                {activeOperation.cancellable && <button type="button" onClick={() => cancelOperationMutation.mutate(activeOperation.id)} disabled={activeOperation.cancelRequested || cancelOperationMutation.isPending} className="min-h-10 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{activeOperation.cancelRequested ? 'Cancelamento solicitado…' : 'Cancelar com segurança'}</button>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950" role="progressbar" aria-label="Progresso da operação" aria-valuemin={0} aria-valuemax={100} aria-valuenow={activeOperation.totalBytes > 0 ? Math.min(100, Math.round(activeOperation.processedBytes / activeOperation.totalBytes * 100)) : 0}>
                <div className="h-full rounded-full bg-sky-600 transition-[width] motion-reduce:transition-none" style={{ width: `${activeOperation.totalBytes > 0 ? Math.min(100, activeOperation.processedBytes / activeOperation.totalBytes * 100) : 4}%` }} />
              </div>
              <p className="mt-2 text-xs tabular-nums text-sky-800 dark:text-sky-300">{activeOperation.processedFiles.toLocaleString('pt-BR')} de {activeOperation.totalFiles.toLocaleString('pt-BR')} arquivo(s) • {formatBytes(activeOperation.processedBytes)} de {formatBytes(activeOperation.totalBytes)}</p>
            </section>
          )}
          {activeTab === 'empresa' && (
            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Single Compact Card */}
                <div className={cn(systemPanelClass, 'space-y-4')}>
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-white flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <Gear className="w-5 h-5 text-indigo-500" /> Configurações Gerais do Sistema
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="company-name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Nome da empresa</label>
                      <input 
                        id="company-name"
                        name="company_name"
                        type="text"
                        autoComplete="organization"
                        required
                        value={empresaNome}
                        onChange={(e) => { setEmpresaNome(e.target.value); setCompanyFieldErrors((current) => ({ ...current, empresaNome: undefined })); }}
                        placeholder="Ex: TopoGeo Engenharia"
                        aria-invalid={Boolean(companyFieldErrors.empresaNome)}
                        aria-describedby={companyFieldErrors.empresaNome ? 'company-name-error' : undefined}
                        className={cn(systemFieldClass, companyFieldErrors.empresaNome && 'border-red-500 ring-1 ring-red-500/30')}
                      />
                      {companyFieldErrors.empresaNome && <p id="company-name-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-300">{companyFieldErrors.empresaNome}</p>}
                    </div>

                    <div>
                      <label htmlFor="admin-name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Nome completo do responsável</label>
                      <input 
                        id="admin-name"
                        name="admin_name"
                        type="text"
                        autoComplete="name"
                        required
                        value={adminNome}
                        onChange={(e) => { setAdminNome(e.target.value); setCompanyFieldErrors((current) => ({ ...current, adminNome: undefined })); }}
                        placeholder="Nome do operador"
                        aria-invalid={Boolean(companyFieldErrors.adminNome)}
                        aria-describedby={companyFieldErrors.adminNome ? 'admin-name-error' : undefined}
                        className={cn(systemFieldClass, companyFieldErrors.adminNome && 'border-red-500 ring-1 ring-red-500/30')}
                      />
                      {companyFieldErrors.adminNome && <p id="admin-name-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-300">{companyFieldErrors.adminNome}</p>}
                    </div>

                    <div>
                      <label htmlFor="admin-email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">E-mail operacional</label>
                      <input 
                        id="admin-email"
                        name="admin_email"
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        required
                        value={adminEmail}
                        onChange={(e) => { setAdminEmail(e.target.value); setCompanyFieldErrors((current) => ({ ...current, adminEmail: undefined })); }}
                        placeholder="admin@empresa.com"
                        aria-invalid={Boolean(companyFieldErrors.adminEmail)}
                        aria-describedby={companyFieldErrors.adminEmail ? 'admin-email-error' : undefined}
                        className={cn(systemFieldClass, companyFieldErrors.adminEmail && 'border-red-500 ring-1 ring-red-500/30')}
                      />
                      {companyFieldErrors.adminEmail && <p id="admin-email-error" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-300">{companyFieldErrors.adminEmail}</p>}
                    </div>
                  </div>

                  <div className="bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/40 dark:border-sky-900/30 rounded-xl p-3 flex gap-2.5 text-xs text-sky-800 dark:text-sky-300 font-medium">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Estes dados aparecem em documentos e identificam o responsável pela operação local. A pasta dos arquivos agora é alterada com validação na seção “Arquivos e pastas”.
                    </p>
                  </div>
                </div>

              </form>
              <SettingsSaveBar state={effectiveCompanySaveState} errorMessage={companySaveError} onSave={saveCompanySettings} onDiscard={discardCompanyChanges} />
            </div>
          )}

          {activeTab === 'arquivos' && (
            <div className="space-y-6">
              <section className={cn(systemPanelLargeClass, 'space-y-5')} aria-labelledby="data-directory-title">
                <div>
                  <h2 id="data-directory-title" className="flex items-center gap-2 text-lg font-bold text-zinc-950 dark:text-white"><Files aria-hidden="true" className="h-5 w-5 text-sky-600" /> Arquivos e pasta principal</h2>
                  <p className="mt-1 text-sm text-zinc-500">O GeoGestor valida permissões, espaço e documentos vinculados antes de mudar a pasta.</p>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Pasta em uso</span>
                  <code className="block break-all rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">{dadosPasta || desktopInfo?.filesRootDirectory || 'Não identificada'}</code>
                </div>
                <div>
                  <label htmlFor="data-directory-target" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Nova pasta</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input id="data-directory-target" name="data_directory_target" autoComplete="off" value={directoryTarget} onChange={(event) => { setDirectoryTarget(event.target.value); setDirectoryPreflight(null); }} placeholder="Escolha uma pasta local…" className={systemFieldMonoClass} />
                    <button type="button" onClick={() => void chooseDataDirectory()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-300 px-4 text-sm font-semibold text-sky-800 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"><FolderOpen aria-hidden="true" size={18} /> Escolher pasta</button>
                    <button type="button" onClick={() => void checkDataDirectory()} disabled={!directoryTarget.trim() || checkingDirectory} className={cn(primarySmallActionButtonClass, 'min-h-11 shrink-0 disabled:opacity-50')}><Check aria-hidden="true" size={17} /> {checkingDirectory ? 'Validando…' : 'Validar'}</button>
                  </div>
                </div>
                {directoryError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><strong>Alteração não aplicada.</strong> {directoryError}</div>}
                {directoryPreflight && (
                  <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/20">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div><span className="block text-xs text-zinc-500">Origem</span><strong className="tabular-nums text-sm">{directoryPreflight.current.files.toLocaleString('pt-BR')} arquivo(s) • {formatBytes(directoryPreflight.current.bytes)}</strong></div>
                      <div><span className="block text-xs text-zinc-500">Espaço livre</span><strong className="tabular-nums text-sm">{formatBytes(directoryPreflight.availableBytes)}</strong></div>
                      <div><span className="block text-xs text-zinc-500">Espaço estimado</span><strong className="tabular-nums text-sm">{formatBytes(Math.ceil(directoryPreflight.current.bytes * 1.1))}</strong></div>
                      <div><span className="block text-xs text-zinc-500">Documentos vinculados</span><strong className="tabular-nums text-sm">{directoryPreflight.trackedDocuments.toLocaleString('pt-BR')}</strong></div>
                    </div>
                    {(directoryPreflight.conflictingFiles > 0 || directoryPreflight.trackedOutsideCurrent > 0) && <p role="alert" className="text-sm font-medium text-amber-800 dark:text-amber-300">Atenção: {directoryPreflight.conflictingFiles} conflito(s) no destino e {directoryPreflight.trackedOutsideCurrent} vínculo(s) fora da pasta atual.</p>}
                    <fieldset>
                      <legend className="mb-2 text-sm font-semibold">Como alterar</legend>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {([
                          ['copy', 'Copiar e preservar', 'Mantém a pasta antiga intacta.', directoryPreflight.canCopyOrMove],
                          ['move', 'Mover após validar', 'Remove a origem só após o sucesso.', directoryPreflight.canCopyOrMove],
                          ['use', 'Usar conteúdo existente', 'Não copia arquivos.', directoryPreflight.canUseExisting]
                        ] as const).map(([value, label, description, enabled]) => (
                          <label key={value} className={cn('flex min-h-20 cursor-pointer gap-3 rounded-xl border p-3', directoryStrategy === value ? 'border-sky-500 bg-white dark:bg-zinc-900' : 'border-zinc-200 dark:border-zinc-800', !enabled && 'cursor-not-allowed opacity-50')}>
                            <input type="radio" name="directory_strategy" value={value} checked={directoryStrategy === value} disabled={!enabled} onChange={() => setDirectoryStrategy(value)} />
                            <span><strong className="block text-sm">{label}</strong><span className="text-xs text-zinc-500">{description}</span></span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div>
                      <label htmlFor="directory-confirmation" className="mb-1.5 block text-sm font-medium">Digite <code className="rounded bg-sky-100 px-1 text-xs dark:bg-sky-950">ALTERAR PASTA DE DADOS DO GEOGESTOR</code> para confirmar</label>
                      <input id="directory-confirmation" name="directory_confirmation" autoComplete="off" value={directoryConfirmation} onChange={(event) => setDirectoryConfirmation(event.target.value.toUpperCase())} className={systemFieldClass} />
                    </div>
                    <div className="flex justify-end"><button type="button" onClick={() => void migrateDataDirectory()} disabled={migratingDirectory || directoryPreflight.availableBytes < Math.ceil(directoryPreflight.current.bytes * 1.1) || directoryConfirmation !== 'ALTERAR PASTA DE DADOS DO GEOGESTOR'} className={cn(primarySubmitButtonClass, 'min-h-11 disabled:opacity-40')}><FolderOpen aria-hidden="true" size={17} /> {migratingDirectory ? 'Migrando e verificando…' : 'Aplicar alteração segura'}</button></div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <button type="button" onClick={() => apiClient.post('/api/sistema/abrir-pasta-arquivos').catch((error) => toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a pasta.'))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 px-4 text-sm font-semibold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800"><FolderOpen aria-hidden="true" size={17} /> Abrir pasta atual</button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'alertas' && <AlertSettingsPanel />}

          {activeTab === 'aparencia' && (
            <div className={cn(systemPanelClass, 'space-y-4')} aria-labelledby="appearance-title">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <h2 id="appearance-title" className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
                  <Palette aria-hidden="true" className="h-5 w-5 text-zinc-400" /> Preferências visuais
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    if (theme === 'system') return;
                    if (window.confirm('Restaurar o tema padrão do GeoGestor e acompanhar o tema do Windows?')) {
                      handleSetTheme('system');
                      toast.success('Tema padrão restaurado.');
                    }
                  }}
                  disabled={theme === 'system'}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-default disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <ArrowCounterClockwise aria-hidden="true" size={16} /> Restaurar padrão
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Tema do Sistema</span>
                  <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Tema do sistema">
                    <button 
                      type="button" 
                      onClick={() => handleSetTheme('light')}
                      aria-pressed={theme === 'light'}
                      className={`border p-4 rounded-2xl text-left transition-[background-color,border-color,box-shadow] ${
                        theme === 'light'
                          ? 'border-brand-primary-200 bg-gradient-to-br from-brand-primary-50 via-white to-brand-turquoise-50 ring-2 ring-brand-primary-300/45 dark:border-brand-primary-300/20 dark:from-brand-primary-400/15 dark:via-zinc-900 dark:to-brand-turquoise-400/10 dark:ring-brand-primary-300/20'
                          : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="block font-semibold text-zinc-950 dark:text-white text-sm">Claro</span>
                      <span className="block text-xs text-zinc-400 mt-1">Aparência clássica minimalista em tons de branco.</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleSetTheme('dark')}
                      aria-pressed={theme === 'dark'}
                      className={`border p-4 rounded-2xl text-left transition-[background-color,border-color,box-shadow] ${
                        theme === 'dark'
                          ? 'border-brand-indigo-200 bg-gradient-to-br from-brand-indigo-50 via-white to-brand-blue-50 ring-2 ring-brand-indigo-300/45 dark:border-brand-indigo-300/20 dark:from-brand-indigo-400/15 dark:via-zinc-900 dark:to-brand-blue-400/10 dark:ring-brand-indigo-300/20'
                          : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="block font-semibold text-zinc-950 dark:text-white text-sm">Tema Escuro</span>
                      <span className="block text-xs text-zinc-400 mt-1">Modo escuro para melhor legibilidade noturna.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetTheme('system')}
                      aria-pressed={theme === 'system'}
                      className={`border p-4 rounded-2xl text-left transition-[background-color,border-color,box-shadow] ${
                        theme === 'system'
                          ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-300/45 dark:border-sky-700 dark:bg-sky-950/30 dark:ring-sky-700/40'
                          : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="block font-semibold text-zinc-950 dark:text-white text-sm">Usar o sistema</span>
                      <span className="block text-xs text-zinc-400 mt-1">Acompanha automaticamente o tema do Windows.</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'backups' && (
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
                    {desktopInfo?.desktop ? 'Aplicativo desktop' : 'Modo local'}
                  </span>
                </div>

                {loadingDesktopInfo ? (
                  <div className="py-8 flex justify-center">
                    <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-6 h-6 rounded-full border-2 border-brand-primary-100 border-t-brand-primary-500 dark:border-brand-primary-400/15 dark:border-t-brand-primary-300 animate-spin" />
                  </div>
                ) : desktopInfoError || !desktopInfo ? (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    <span>Não foi possível consultar os caminhos e o ambiente local.</span>
                    <button type="button" onClick={() => void refetchDesktopInfo()} className="min-h-11 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-800 dark:hover:bg-red-950/50">Tentar novamente</button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="bg-emerald-500/10 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/20">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Versão do Aplicativo</p>
                        <p className="text-base font-heading font-extrabold text-emerald-950 dark:text-emerald-100 mt-0.5 flex items-center gap-2">
                          v{APP_VERSION} <span className="text-[11px] font-mono font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">Instalada</span>
                        </p>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Ambiente Operacional</p>
                        <p className="text-base font-heading font-bold text-zinc-900 dark:text-white mt-0.5">
                          {desktopInfo.desktop ? `Electron Desktop (${navigator.platform || 'Windows'})` : desktopInfo.mode || 'Servidor local'}
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

              <div id="backup-actions" className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => createBackupMutation.mutate()}
                  disabled={createBackupMutation.isPending}
                  className={systemActionCardClass}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    <DownloadSimple aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-zinc-950 dark:text-white">
                      {createBackupMutation.isPending ? 'Criando backup…' : 'Criar backup agora'}
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
                    <Database aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-zinc-950 dark:text-white">
                      {checkingFullBackup ? 'Calculando tamanho…' : createFullBackupMutation.isPending ? 'Criando backup completo…' : 'Backup completo'}
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

          {activeTab === 'modelos' && (
            <form onSubmit={handleSaveTemplate} className="space-y-6" aria-busy={templateLoading || templateSaving}>
              {templateLoading && <p aria-live="polite" className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-900">Carregando o modelo oficial…</p>}
              {templateError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{templateError} Corrija os dados e tente novamente.</div>}
              <div className={cn(systemPanelLargeClass, 'md:p-8')}>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-500" /> Identidade Visual para Exportação de Orçamentos
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">Configure o cabeçalho corporativo, cores e termos padrão dos relatórios em PDF.</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" onClick={() => {
                      if (!window.confirm('Restaurar os padrões do modelo?\n\nLogo, dados corporativos, cor e termos voltarão ao modelo inicial. Você poderá revisar antes de salvar.')) return;
                      setLogoBase64(DEFAULT_COMPANY_TEMPLATE.logo);
                      setTemplateRazaoSocial(DEFAULT_COMPANY_TEMPLATE.razao);
                      setTemplateCnpj(DEFAULT_COMPANY_TEMPLATE.cnpj);
                      setTemplateTelefone(DEFAULT_COMPANY_TEMPLATE.telefone);
                      setTemplateEmail(DEFAULT_COMPANY_TEMPLATE.email);
                      setTemplateEndereco(DEFAULT_COMPANY_TEMPLATE.endereco);
                      setTemplateCor(DEFAULT_COMPANY_TEMPLATE.cor);
                      setTemplateTermos(DEFAULT_COMPANY_TEMPLATE.termos);
                      setTemplateSaveState('dirty');
                    }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"><ArrowCounterClockwise aria-hidden="true" size={16} /> Restaurar padrões</button>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">PDF Engine 2.0</span>
                  </div>
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
                        <input name="company_logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" />
                        <UploadSimple className="w-8 h-8 text-zinc-400 mb-2" />
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Upload Logo (PNG/JPG)</span>
                        <span className="text-xs text-zinc-400 mt-1">Sugerido: Fundo transparente</span>
                      </label>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label htmlFor="template-company-name" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Razão social / nome no PDF</label>
                      <input 
                        id="template-company-name"
                        name="template_company_name"
                        autoComplete="organization"
                        type="text"
                        value={templateRazaoSocial}
                        onChange={e => setTemplateRazaoSocial(e.target.value)}
                        placeholder="Ex: TopoGeo Soluções Fundiárias Ltda"
                          className={cn(systemCompactFieldClass, 'px-3.5 font-semibold')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="template-document" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">CNPJ / CPF oficial</label>
                        <input 
                          id="template-document"
                          name="template_document"
                          autoComplete="off"
                          type="text"
                          value={templateCnpj}
                          onChange={e => setTemplateCnpj(e.target.value)}
                          placeholder="00.000.000/0001-00"
                          className={systemCompactFieldClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="template-phone" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Telefone / WhatsApp</label>
                        <input id="template-phone" name="template_phone" type="tel" autoComplete="tel" value={templateTelefone} onChange={(event) => setTemplateTelefone(event.target.value)} placeholder="(11) 99999-9999" className={systemCompactFieldClass} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="template-email" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">E-mail comercial</label>
                    <input 
                      id="template-email"
                      name="template_email"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      value={templateEmail}
                      onChange={e => setTemplateEmail(e.target.value)}
                      placeholder="orcamentos@empresa.com"
                      className={cn(systemCompactFieldClass, 'px-3.5')}
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Cor de destaque do orçamento</span>
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
                          aria-label={`Usar a cor ${c.name}`}
                          aria-pressed={templateCor === c.hex}
                        />
                      ))}
                      <span className="text-xs font-mono text-zinc-500 ml-auto">{templateCor}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="template-address" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Endereço completo exibido no cabeçalho</label>
                  <input 
                    id="template-address"
                    name="template_address"
                    autoComplete="street-address"
                    type="text"
                    value={templateEndereco}
                    onChange={e => setTemplateEndereco(e.target.value)}
                    placeholder="Av. Engenharia Topográfica, 100 - Sala 402 - Edifício Centro Comercial"
                    className={cn(systemCompactFieldClass, 'px-3.5')}
                  />
                </div>

                <div>
                  <label htmlFor="template-terms" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Termos, prazos e condições exibidos no rodapé</label>
                  <textarea 
                    id="template-terms"
                    name="template_terms"
                    rows={4}
                    value={templateTermos}
                    onChange={e => setTemplateTermos(e.target.value)}
                    placeholder="Descreva as condições contratuais, dados bancários PIX ou observações legais..."
                    className={cn(geoFieldClass, 'w-full resize-none p-3 text-xs font-medium leading-relaxed')}
                  />
                </div>
              </div>

              <section className={cn(systemPanelClass, 'space-y-4')} aria-labelledby="template-preview-title">
                <h2 id="template-preview-title" className="flex items-center gap-2 text-base font-semibold"><Eye aria-hidden="true" size={19} /> Prévia do cabeçalho</h2>
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900 dark:border-zinc-700" style={{ borderTopColor: templateCor, borderTopWidth: 5 }}>
                  <div className="flex items-start gap-4">
                    {logoBase64 ? <img src={logoBase64} alt="Prévia do logotipo da empresa" width="96" height="64" className="h-16 w-24 object-contain" /> : <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-500">Sem logo</div>}
                    <div className="min-w-0"><strong className="block break-words text-lg">{templateRazaoSocial || 'Nome da empresa'}</strong><span className="block break-words text-xs text-zinc-500">{[templateCnpj, templateTelefone, templateEmail].filter(Boolean).join(' • ') || 'Dados de contato'}</span><span className="mt-1 block break-words text-xs text-zinc-500">{templateEndereco || 'Endereço da empresa'}</span></div>
                  </div>
                </div>
              </section>

              <SettingsSaveBar state={effectiveTemplateSaveState} errorMessage={templateError} saveDisabled={templateLoading} onSave={() => void handleSaveTemplate()} onDiscard={discardTemplateChanges} />
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
                    <label htmlFor="google-client-id" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-sans">ID do cliente (Client ID)</label>
                    <input
                      id="google-client-id"
                      name="google_client_id"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="Cole o Client ID aqui..."
                      className={cn(geoFieldClass, 'w-full px-4 py-2.5 text-sm font-medium')}
                    />
                  </div>

                  <div>
                    <label htmlFor="google-client-secret" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 font-sans">Chave secreta do cliente (Client Secret)</label>
                    <input
                      id="google-client-secret"
                      name="google_client_secret"
                      type="password"
                      autoComplete="new-password"
                      spellCheck={false}
                      value={googleClientSecret}
                      onChange={(e) => setGoogleClientSecret(e.target.value)}
                      placeholder={config?.googleClientSecretConfigured ? 'Segredo já configurado; deixe vazio para preservar' : 'Cole a Client Secret aqui…'}
                      className={cn(geoFieldClass, 'w-full px-4 py-2.5 text-sm font-medium')}
                    />
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500"><ShieldCheck aria-hidden="true" size={14} className="text-emerald-600" /> O segredo é protegido pelo cofre do Windows e nunca volta para esta tela, logs, diagnósticos ou backups.</p>
                  </div>
                </div>
              </form>
              <SettingsSaveBar state={effectiveGoogleSaveState} errorMessage={googleSaveError} onSave={() => void handleSaveGoogleCredentials()} onDiscard={discardGoogleChanges} />

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
                        className={`flex items-center gap-2 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-[background-color,color,box-shadow,transform] shadow-sm active:scale-95 ${
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
                          className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 rounded-xl px-5 py-2.5 text-xs font-bold transition-[background-color,border-color,color]"
                        >
                          Desconectar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {googleStatusError && (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    <span>Não foi possível consultar o status da Google Agenda: {googleStatusError}</span>
                    <button type="button" onClick={() => void fetchGoogleStatus()} className="min-h-11 rounded-xl border border-red-300 px-4 font-semibold hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-800">Tentar novamente</button>
                  </div>
                )}

                {!googleStatus.configured && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1.5 font-semibold">
                    <WarningCircle className="w-4 h-4" /> Cadastre o ID e a Chave Secreta acima para poder conectar sua agenda.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'manutencao' && (
            <div className="space-y-6">
              <section className={cn(systemPanelLargeClass, 'space-y-5')} aria-labelledby="maintenance-title">
                <div>
                  <h2 id="maintenance-title" className="flex items-center gap-2 text-lg font-bold text-zinc-950 dark:text-white"><Wrench aria-hidden="true" className="h-5 w-5 text-violet-600" /> Manutenção e diagnóstico</h2>
                  <p className="mt-1 text-sm text-zinc-500">Atalhos para conferir a integridade local e investigar problemas sem procurar em outros menus.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {([
                    ['/pos-atualizacao', 'Verificação pós-atualização', 'Confere banco, arquivos e serviços após uma atualização.', Check],
                    ['/qualidade-dados', 'Qualidade dos dados', 'Localiza cadastros incompletos ou inconsistentes.', WarningCircle],
                    ['/audit-logs', 'Logs de auditoria', 'Mostra alterações importantes e a origem das ações.', FileText],
                    ['/importacao', 'Importação de dados', 'Importe cadastros com validação antes de gravar.', UploadSimple]
                  ] as const).map(([to, title, description, Icon]) => (
                    <RouterLink key={to} to={to} className={systemActionCardClass}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Icon aria-hidden="true" className="h-4 w-4" /></span>
                      <span><strong className="block text-sm text-zinc-950 dark:text-white">{title}</strong><span className="mt-1 block text-xs leading-relaxed text-zinc-500">{description}</span></span>
                    </RouterLink>
                  ))}
                  <button type="button" onClick={() => void openDiagnosticsFolder()} className={systemActionCardClass}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"><FolderOpen aria-hidden="true" className="h-4 w-4" /></span>
                    <span><strong className="block text-sm text-zinc-950 dark:text-white">Abrir diagnóstico local</strong><span className="mt-1 block text-xs leading-relaxed text-zinc-500">Acessa os registros locais usados no suporte.</span></span>
                  </button>
                  <button id="diagnostic-export-title" type="button" onClick={() => void openDiagnosticPreview()} className={systemActionCardClass}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck aria-hidden="true" className="h-4 w-4" /></span>
                    <span><strong className="block text-sm text-zinc-950 dark:text-white">Exportar diagnóstico seguro</strong><span className="mt-1 block text-xs leading-relaxed text-zinc-500">Mostra uma prévia e exclui credenciais e dados pessoais.</span></span>
                  </button>
                </div>
                <details className="group border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
                  <summary className="cursor-pointer rounded-lg font-semibold text-zinc-700 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-zinc-200">Informações técnicas do ambiente</summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div><span className="block text-xs uppercase tracking-wider text-zinc-500">Versão instalada</span><strong className="tabular-nums">GeoGestor {APP_VERSION}</strong></div>
                    <div><span className="block text-xs uppercase tracking-wider text-zinc-500">Ambiente</span><strong>{desktopInfo?.desktop ? 'Desktop gerenciado' : desktopInfo?.mode || 'Local'}</strong></div>
                    <div className="sm:col-span-2"><span className="block text-xs uppercase tracking-wider text-zinc-500">Banco local</span><code className="mt-1 block break-all rounded-lg bg-zinc-50 p-2 text-xs dark:bg-zinc-950">{desktopInfo?.databasePath || 'Não identificado'}</code></div>
                  </div>
                </details>
              </section>

              <section className={cn(systemPanelLargeClass, 'space-y-4')} aria-labelledby="maintenance-history-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="maintenance-history-title" className="text-base font-semibold text-zinc-950 dark:text-white">Histórico operacional</h2>
                    <p className="mt-1 text-xs text-zinc-500">Backups, testes, restaurações, migrações, verificações e diagnósticos em um só lugar.</p>
                  </div>
                  <button type="button" onClick={() => void exportMaintenanceHistory()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><Export aria-hidden="true" size={16} /> Exportar CSV</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="history-type" className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Tipo de operação</label><select id="history-type" value={historyTypeFilter} onChange={(event) => setHistoryTypeFilter(event.target.value)} className={systemCompactFieldClass}><option value="">Todos os tipos</option><option value="backup_database">Backup do banco</option><option value="backup_complete">Backup completo</option><option value="restore_test">Teste de restauração</option><option value="restore">Restauração real</option><option value="data_migration">Migração de dados</option><option value="operational_reset">Limpeza operacional</option><option value="integrity_check">Verificação</option><option value="diagnostic_export">Diagnóstico</option></select></div>
                  <div><label htmlFor="history-status" className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">Resultado</label><select id="history-status" value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value)} className={systemCompactFieldClass}><option value="">Todos os resultados</option><option value="success">Concluído</option><option value="failed">Falhou</option><option value="cancelled">Cancelado</option></select></div>
                </div>
                {historyQuery.isLoading ? <p aria-live="polite" className="py-5 text-center text-sm text-zinc-500">Carregando histórico…</p> : historyQuery.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><span>Não foi possível consultar o histórico.</span><button type="button" onClick={() => void historyQuery.refetch()} className="min-h-10 rounded-xl border border-red-300 px-3 font-semibold focus-visible:ring-2 focus-visible:ring-red-500/40">Tentar novamente</button></div> : historyQuery.data?.items.length ? (
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 overscroll-contain dark:border-zinc-800">
                    <table className="min-w-[760px] w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-950"><tr><th scope="col" className="px-3 py-2.5 font-semibold">Operação</th><th scope="col" className="px-3 py-2.5 font-semibold">Resultado</th><th scope="col" className="px-3 py-2.5 font-semibold">Data</th><th scope="col" className="px-3 py-2.5 font-semibold">Duração</th><th scope="col" className="px-3 py-2.5 font-semibold">Volume</th><th scope="col" className="px-3 py-2.5 font-semibold">Detalhe</th></tr></thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{historyQuery.data.items.map((entry) => {
                        const typeLabel: Record<MaintenanceHistoryEntry['type'], string> = { backup_database: 'Backup do banco', backup_complete: 'Backup completo', restore_test: 'Teste isolado', restore: 'Restauração real', data_migration: 'Migração de dados', operational_reset: 'Limpeza operacional', integrity_check: 'Verificação', diagnostic_export: 'Diagnóstico seguro' };
                        const statusLabel = { success: 'Concluído', failed: 'Falhou', cancelled: 'Cancelado', running: 'Em andamento' }[entry.status];
                        return <tr key={entry.id}><td className="px-3 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{typeLabel[entry.type]}</td><td className="px-3 py-3"><span className={cn('rounded-full px-2 py-1 font-semibold', entry.status === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : entry.status === 'cancelled' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300')}>{statusLabel}</span></td><td className="px-3 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.completedAt))}</td><td className="px-3 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">{entry.durationMs < 1_000 ? `${entry.durationMs} ms` : `${(entry.durationMs / 1_000).toFixed(1)} s`}</td><td className="px-3 py-3 tabular-nums text-zinc-600 dark:text-zinc-300">{entry.files == null ? '—' : `${entry.files.toLocaleString('pt-BR')} arq.`}{entry.bytes == null ? '' : ` • ${formatBytes(entry.bytes)}`}</td><td className="max-w-56 break-words px-3 py-3 text-zinc-600 dark:text-zinc-300">{entry.error || entry.destinationLabel || 'Sem ocorrência'}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                ) : <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">Nenhuma operação corresponde aos filtros selecionados.</div>}
              </section>

              <section className={cn(systemPanelClass, 'space-y-3')} aria-labelledby="local-security-title">
                <h2 id="local-security-title" className="text-base font-semibold text-zinc-950 dark:text-white">Segurança e acesso local</h2>
                <p className="text-sm leading-relaxed text-zinc-500">O GeoGestor mantém a sessão e as credenciais protegidas no computador. Bloqueie o aplicativo quando se afastar e mantenha backups em uma pasta acessível somente a pessoas autorizadas.</p>
                <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">As chaves do Google são exibidas apenas como configuradas ou não configuradas; o segredo salvo nunca é devolvido para esta tela.</p>
              </section>

              <section className="rounded-2xl border border-red-200 bg-red-50/60 p-5 dark:border-red-900/60 dark:bg-red-950/20" aria-labelledby="danger-zone-title">
                <h2 id="danger-zone-title" className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300"><WarningCircle aria-hidden="true" size={19} /> Zona de perigo</h2>
                <p className="mt-2 text-sm leading-relaxed text-red-700 dark:text-red-300">Remove todos os registros operacionais, inclusive viagens, cálculos e planejamento estratégico. Configurações, modelos, alertas e logs de auditoria são preservados. Um backup de recuperação validado é criado antes da exclusão.</p>
                <button type="button" onClick={() => setShowResetModal(true)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-500/50"><Trash aria-hidden="true" size={17} /> Apagar dados operacionais</button>
              </section>
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
                Clientes, projetos, orçamentos, finanças, documentos, viagens, cálculos e planejamento serão removidos. Antes disso, o GeoGestor criará e validará um backup de recuperação. Configurações, modelos e auditoria serão preservados.
              </p>
            </div>

            <div>
              <label htmlFor="reset-confirmation" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Digite <span className="font-mono font-bold text-red-600 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">APAGAR DADOS DO GEOGESTOR</span> para confirmar:
              </label>
              <input
                id="reset-confirmation"
                name="reset_confirmation"
                type="text"
                autoComplete="off"
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
                className="h-9 px-5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs rounded-xl shadow-sm transition-[background-color,opacity] flex items-center gap-2"
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
            {validatingRestore && <p aria-live="polite" className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">Validando integridade, compatibilidade e arquivos do backup…</p>}
            {restoreValidationError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><strong>Backup não aprovado.</strong> {restoreValidationError}</div>}
            {restorePreview && (
              <div className={cn('grid gap-2 rounded-xl border p-3 text-xs sm:grid-cols-2', restorePreview.canProceed ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200')}>
                <strong className="sm:col-span-2">{restorePreview.canProceed ? 'Backup íntegro e compatível' : 'Espaço livre insuficiente para restaurar'}</strong>
                <span>Tipo: {restorePreview.type === 'complete' ? 'Completo' : 'Somente banco'}</span>
                <span>Data: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(restorePreview.createdAt))}</span>
                <span>{restorePreview.totals.files.toLocaleString('pt-BR')} arquivo(s)</span>
                <span>{formatBytes(restorePreview.totals.bytes)} • {restorePreview.encrypted ? 'Criptografado' : 'Formato legado'}</span>
                <span>{restorePreview.checksumFilesVerified.toLocaleString('pt-BR')} checksum(s) conferido(s)</span>
                <span>{restorePreview.credentialsExcluded ? 'Credenciais excluídas do pacote' : 'Backup legado: revise credenciais após restaurar'}</span>
                <span>Necessário: {formatBytes(restorePreview.estimatedRequiredBytes)}</span>
                <span>Livre: {formatBytes(restorePreview.availableBytes)}</span>
              </div>
            )}
            {restorePreview && !restoreTestResult && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">Antes da restauração real, execute o teste isolado. Ele abre uma cópia temporária, confere banco e arquivos e remove essa área ao terminar.</p>}
            {restoreTestResult && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><strong>Teste isolado aprovado.</strong> {restoreTestResult.checksumFilesVerified.toLocaleString('pt-BR')} checksum(s) confirmado(s) em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(restoreTestResult.testedAt))}. Nenhum dado atual foi alterado.</div>}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/20">
              <span className="text-xs text-sky-800 dark:text-sky-200">O teste é seguro e não substitui seus dados atuais.</span>
              <button type="button" onClick={() => void handleTestRestore()} disabled={testingRestore || restoring || !restorePreview?.canProceed} className="min-h-10 rounded-xl bg-sky-700 px-4 text-xs font-bold text-white hover:bg-sky-800 focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-50">{testingRestore ? 'Testando em área isolada…' : restoreTestResult ? 'Testar novamente' : 'Testar restauração'}</button>
            </div>
            <div>
              <label htmlFor="restore-bundle-path" className="mb-2 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Backup selecionado</label>
              <input id="restore-bundle-path" value={restoreBundlePath} readOnly className={systemFieldMonoClass} />
            </div>
            <div>
              <label htmlFor="restore-recovery-code" className="mb-2 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Código de recuperação (se o backup veio de outro computador)</label>
              <input id="restore-recovery-code" name="restore_recovery_code" value={restoreRecoveryCode} onChange={(event) => setRestoreRecoveryCode(event.target.value)} autoComplete="off" spellCheck={false} placeholder="GG-R1-…" className={systemFieldMonoClass} />
              <button type="button" onClick={() => void handleValidateRestore()} disabled={validatingRestore || !restoreBundlePath} className="mt-2 min-h-10 rounded-xl border border-zinc-300 px-4 text-xs font-bold hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Validar novamente</button>
            </div>
            <div className={!restoreTestResult ? 'opacity-60' : undefined}>
              <label htmlFor="restore-confirmation" className="mb-2 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Digite <span className="font-mono font-bold text-amber-700">RESTAURAR BACKUP DO GEOGESTOR</span> para confirmar:
              </label>
              <input
                id="restore-confirmation"
                type="text"
                value={restoreInputText}
                onChange={(event) => setRestoreInputText(event.target.value.toUpperCase())}
                disabled={!restoreTestResult || restoring}
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
                disabled={restoring || testingRestore || !restorePreview?.canProceed || !restoreTestResult || restoreInputText.trim().toUpperCase() !== 'RESTAURAR BACKUP DO GEOGESTOR'}
                className="h-9 rounded-xl bg-amber-600 px-5 text-xs font-bold text-white hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-40"
              >
                {restoring ? 'Restaurando…' : 'Restaurar de verdade'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showDiagnosticModal}
          onClose={() => { if (!creatingDiagnostic) setShowDiagnosticModal(false); }}
          title="Exportar diagnóstico seguro"
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 pt-2">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">Confira o conteúdo antes de criar o arquivo para suporte. O pacote usa apenas informações técnicas agregadas.</p>
            {!diagnosticSummary ? <p aria-live="polite" className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">Preparando prévia segura…</p> : <>
              <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30" aria-labelledby="diagnostic-included-title"><h3 id="diagnostic-included-title" className="font-semibold text-emerald-900 dark:text-emerald-200">Incluído</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-emerald-800 dark:text-emerald-300">{diagnosticSummary.included.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950" aria-labelledby="diagnostic-excluded-title"><h3 id="diagnostic-excluded-title" className="font-semibold text-zinc-900 dark:text-zinc-100">Sempre excluído</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-600 dark:text-zinc-300">{diagnosticSummary.excluded.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><ShieldCheck aria-hidden="true" size={17} /> Sem credenciais e sem dados pessoais.</p>
            </>}
            {createdDiagnostic && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><strong className="block">Arquivo seguro criado</strong><span className="mt-1 block text-xs">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(createdDiagnostic.createdAt))}</span><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void openDiagnosticsFolder()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-800 hover:bg-sky-100 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200"><FolderOpen aria-hidden="true" size={16} /> Abrir pasta</button><button type="button" onClick={() => void copyDiagnosticPath()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200"><ClipboardText aria-hidden="true" size={16} /> Copiar caminho</button></div></div>}
            <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"><button type="button" onClick={() => setShowDiagnosticModal(false)} disabled={creatingDiagnostic} className="min-h-10 rounded-xl px-4 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500/30 dark:text-zinc-300 dark:hover:bg-zinc-800">{createdDiagnostic ? 'Fechar' : 'Cancelar'}</button>{!createdDiagnostic && <button type="button" onClick={() => void createSafeDiagnostic()} disabled={!diagnosticSummary || creatingDiagnostic} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50"><Export aria-hidden="true" size={16} /> {creatingDiagnostic ? 'Criando diagnóstico…' : 'Criar arquivo seguro'}</button>}</div>
          </div>
        </Modal>
    </Layout>
  );
}
