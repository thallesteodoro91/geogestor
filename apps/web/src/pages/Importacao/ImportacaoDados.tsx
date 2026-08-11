import { FormSelect } from '../../components/Form';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  FileCsv,
  FileXls,
  Gear,
  Table,
  UploadSimple,
  WarningCircle
} from '@phosphor-icons/react';
import Papa from 'papaparse';
import { Layout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { apiClient } from '../../services/apiClient';
import { persistOperationalSetting } from '../../services/operationalSettings';
import { secondaryActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';
import { FullMigrationReview, FullMigrationResultView } from './FullMigrationReview';
import { ImportGuidance } from './ImportGuidance';
import { SimpleImportResultView } from './SimpleImportResultView';
import { ProjectClientAssociationReview } from './ProjectClientAssociationReview';
import { validateSimpleClientPayload, type SimpleImportResult } from './simpleImport';
import {
  applyProjectAssociationOverride,
  canConfirmProjectImport,
  replaceProjectPreviewRow,
  type ProjectAssociationOverride,
  type ProjectImportPreview
} from './projectImport';
import {
  detectHeaderRowIndex,
  selectBestWorkbookSheet,
  sha256File,
  uniqueSpreadsheetHeaders,
  validateSpreadsheetDimensions,
  validateSpreadsheetFile,
  type FullMigrationPayload,
  type FullMigrationPreview,
  type FullMigrationQueued,
  type FullMigrationRun,
  type FullMigrationResult
} from './fullMigration';

type EntityKey = 'clientes' | 'projetos' | 'contatos';
type ImportMode = 'complete' | 'simple';
type ImportPhase = 'idle' | 'reading' | 'identifying' | 'analyzing' | 'validating' | 'preview_ready' | 'blocked' | 'saving' | 'completed' | 'partial' | 'failed';

type EntityField = {
  key: string;
  label: string;
  required: boolean;
};

const entityOptions: Record<EntityKey, { label: string; description: string; route: string }> = {
  clientes: {
    label: 'Clientes',
    description: 'Cadastros e relacionamento',
    route: '/clientes'
  },
  projetos: {
    label: 'Projetos',
    description: 'Projetos topográficos e obras',
    route: '/projetos'
  },
  contatos: {
    label: 'Contatos',
    description: 'Leads e CRM',
    route: '/crm?view=leads'
  }
};

const entityFields: Record<EntityKey, EntityField[]> = {
  clientes: [
    { key: 'nome', label: 'Nome / Razão Social', required: true },
    { key: 'tipoPessoa', label: 'Tipo de pessoa (PF ou PJ)', required: false },
    { key: 'cpf', label: 'CPF', required: false },
    { key: 'cnpj', label: 'CNPJ', required: false },
    { key: 'email', label: 'E-mail comercial', required: false },
    { key: 'telefone', label: 'Telefone / WhatsApp', required: true },
    { key: 'endereco', label: 'Endereço completo', required: false }
  ],
  projetos: [
    { key: 'nome', label: 'Nome do projeto topográfico', required: true },
    { key: 'clienteReferencia', label: 'Cliente (nome exato ou CPF/CNPJ)', required: true },
    { key: 'status', label: 'Status operacional', required: false },
    { key: 'cidade', label: 'Cidade / UF', required: false },
    { key: 'areaHa', label: 'Área total (ha)', required: false }
  ],
  contatos: [
    { key: 'nome', label: 'Nome completo', required: true },
    { key: 'email', label: 'E-mail', required: false },
    { key: 'telefone', label: 'Telefone', required: false },
    { key: 'empresa', label: 'Empresa', required: false },
    { key: 'cidade', label: 'Cidade', required: false },
    { key: 'observacoes', label: 'Observações', required: false },
    { key: 'origem', label: 'Origem do lead', required: false }
  ]
};

const stepItems = [
  { num: 1, label: 'Arquivo', description: 'Escolha o destino e envie a planilha' },
  { num: 2, label: 'Mapeamento', description: 'Conecte colunas aos campos' },
  { num: 3, label: 'Concluído', description: 'Confira o resultado final' }
];

const phaseLabels: Record<ImportPhase, string> = {
  idle: 'Aguardando arquivo', reading: 'Lendo arquivo…', identifying: 'Identificando cabeçalho…',
  analyzing: 'Analisando colunas…', validating: 'Validando registros…', preview_ready: 'Prévia pronta para conferência',
  blocked: 'Importação bloqueada', saving: 'Gravando registros…', completed: 'Importação concluída',
  partial: 'Importação concluída parcialmente', failed: 'Importação não realizada'
};

const simpleFieldAliases: Partial<Record<EntityKey, Record<string, string[]>>> = {
  clientes: { nome: ['cliente', 'nome do cliente', 'razao social'], tipoPessoa: ['tipo de pessoa', 'pf pj'], cpf: ['cpf'], cnpj: ['cnpj'], telefone: ['telefone', 'celular', 'whatsapp'] },
  projetos: { nome: ['projeto', 'nome do projeto'], clienteReferencia: ['cliente', 'cliente vinculado', 'cpf', 'cnpj'] },
  contatos: { nome: ['contato', 'nome', 'nome completo'] }
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatCell = (value: unknown) => String(value ?? '').trim();

export function ImportacaoDados() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Array<Record<string, unknown>>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [entity, setEntity] = useState<EntityKey>('clientes');
  const [importMode, setImportMode] = useState<ImportMode>('complete');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isRefreshingFullPreview, setIsRefreshingFullPreview] = useState(false);
  const [parseError, setParseError] = useState('');
  const [formError, setFormError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fullPayload, setFullPayload] = useState<FullMigrationPayload | null>(null);
  const [fullPreview, setFullPreview] = useState<FullMigrationPreview | null>(null);
  const [fullResult, setFullResult] = useState<FullMigrationResult | null>(null);
  const [simpleResult, setSimpleResult] = useState<SimpleImportResult | null>(null);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [projectPreview, setProjectPreview] = useState<ProjectImportPreview | null>(null);
  const [projectOverrides, setProjectOverrides] = useState<Record<number, ProjectAssociationOverride>>({});
  const [isPreviewingProjects, setIsPreviewingProjects] = useState(false);
  const [refreshingProjectRow, setRefreshingProjectRow] = useState<number | null>(null);
  const [fullImportProgress, setFullImportProgress] = useState('');
  const simpleIdempotencyKey = useRef(crypto.randomUUID());

  const selectedEntity = entityOptions[entity];
  const currentFields = entityFields[entity];
  const requiredFields = currentFields.filter(field => field.required);
  const simplePayload = useMemo(() => data.map(row => {
    const item: Record<string, string> = {};
    Object.keys(mapping).forEach(key => {
      const sourceHeader = mapping[key];
      if (sourceHeader) item[key] = formatCell(row[sourceHeader]);
    });
    if (entity === 'clientes') {
      const declaredType = normalizeText(item.tipoPessoa || '');
      item.tipoPessoa = declaredType === 'pj' || declaredType.includes('juridica') || Boolean(item.cnpj) ? 'PJ' : 'PF';
    }
    return item;
  }), [data, entity, mapping]);
  const simplePreflightIssues = useMemo(
    () => importMode === 'simple' && entity === 'clientes' ? validateSimpleClientPayload(simplePayload) : [],
    [entity, importMode, simplePayload]
  );
  const effectiveSimplePayload = useMemo(
    () => entity === 'projetos'
      ? simplePayload.map((row, index) => applyProjectAssociationOverride(row, projectOverrides[index]))
      : simplePayload,
    [entity, projectOverrides, simplePayload]
  );
  const isSimpleProjectImport = importMode === 'simple' && entity === 'projetos';
  const projectConfirmationReady = !isSimpleProjectImport || canConfirmProjectImport(projectPreview, isPreviewingProjects || refreshingProjectRow !== null);

  useEffect(() => {
    if (step !== 2 || importPhase !== 'blocked') return;
    const animationFrame = requestAnimationFrame(() => {
      const firstProjectPending = projectPreview?.rows.find(row => row.status === 'pending');
      const targetId = importMode === 'simple' && entity === 'projetos' && firstProjectPending
        ? `project-association-pending-${firstProjectPending.index}`
        : 'migration-first-blocking-issue';
      document.getElementById(targetId)?.focus();
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [entity, importMode, importPhase, projectPreview, step, fullPreview?.importId]);

  useEffect(() => {
    const hasRequiredMapping = entityFields.projetos.filter(field => field.required).every(field => Boolean(mapping[field.key]));
    if (step !== 2 || importMode !== 'simple' || entity !== 'projetos' || !hasRequiredMapping || simplePayload.length === 0) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setIsPreviewingProjects(true);
      setImportPhase('validating');
      setReviewAcknowledged(false);
      try {
        const preview = await apiClient.post<ProjectImportPreview>('/api/projetos/lote/preview', simplePayload, { timeoutMs: 60_000 });
        if (!active) return;
        setProjectPreview(preview);
        setProjectOverrides({});
        setImportPhase(preview.status === 'ready' ? 'preview_ready' : 'blocked');
      } catch (error) {
        if (!active) return;
        setProjectPreview(null);
        setImportPhase('failed');
        setFormError(error instanceof Error ? `Não foi possível validar os clientes dos projetos: ${error.message}` : 'Não foi possível validar os clientes dos projetos.');
      } finally {
        if (active) setIsPreviewingProjects(false);
      }
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [entity, importMode, mapping, simplePayload, step]);

  const applyParsedRows = (rows: Array<Record<string, unknown>>) => {
    setImportPhase('analyzing');
    const normalizedRows = rows.map(row =>
      Object.fromEntries(
        Object.entries(row)
          .map(([key, value]) => [key.trim(), value] as const)
          .filter(([key]) => key.length > 0)
      )
    );

    const nonEmptyRows = normalizedRows.filter(row =>
      Object.values(row).some(value => value !== null && value !== undefined && String(value).trim() !== '')
    );

    if (nonEmptyRows.length === 0) {
      throw new Error('O arquivo não contém registros para importar.');
    }

    const detectedHeaders = Array.from(new Set(nonEmptyRows.flatMap(row => Object.keys(row))));

    if (detectedHeaders.length === 0) {
      throw new Error('Não foi possível identificar colunas no arquivo.');
    }
    const dimensionError = validateSpreadsheetDimensions(nonEmptyRows.length, detectedHeaders.length);
    if (dimensionError) throw new Error(dimensionError);
    if (importMode === 'simple' && nonEmptyRows.length > 500) {
      throw new Error(`A importação simples aceita até 500 linhas por lote. Este arquivo possui ${nonEmptyRows.length.toLocaleString('pt-BR')} linhas. Divida-o em lotes menores.`);
    }

    const autoMap: Record<string, string> = {};
    currentFields.forEach(field => {
      const normalizedKey = normalizeText(field.key);
      const normalizedLabel = normalizeText(field.label);
      const aliases = (simpleFieldAliases[entity]?.[field.key] ?? []).map(normalizeText);
      const match = detectedHeaders.find(header => {
        const normalizedHeader = normalizeText(header);
        return normalizedHeader.includes(normalizedKey) || normalizedLabel.includes(normalizedHeader) || aliases.some(alias => normalizedHeader === alias || normalizedHeader.includes(alias));
      });

      if (match) {
        autoMap[field.key] = match;
      }
    });

    setHeaders(detectedHeaders);
    setData(nonEmptyRows);
    setMapping(autoMap);
    setParseError('');
    setFormError('');
    setReviewAcknowledged(false);
    setStep(2);
    return { rows: nonEmptyRows, headers: detectedHeaders };
  };

  const prepareCompleteMigration = async (
    selectedFile: File,
    parsed: { rows: Array<Record<string, unknown>>; headers: string[] },
    source?: { sheetName?: string; firstDataRow?: number; readingMs?: number }
  ) => {
    setImportPhase('validating');
    const hashingStartedAt = performance.now();
    const fileHash = await sha256File(selectedFile);
    const payload: FullMigrationPayload = {
      fileName: selectedFile.name,
      fileHash,
      headers: parsed.headers,
      rows: parsed.rows,
      sheetName: source?.sheetName,
      firstDataRow: source?.firstDataRow,
      clientTimings: {
        readingMs: Math.round(source?.readingMs ?? 0),
        hashingMs: Math.round(performance.now() - hashingStartedAt)
      }
    };
    const preview = await apiClient.post<FullMigrationPreview>(
      '/api/importacoes/migracao-completa/preview',
      payload,
      { timeoutMs: 60_000 }
    );
    setFullPayload(payload);
    setFullPreview(preview);
    setImportPhase(preview.status === 'ready' ? 'preview_ready' : 'blocked');
  };

  const parseCsv = (selectedFile: File) =>
    new Promise<unknown[][]>((resolve, reject) => {
      Papa.parse<unknown[]>(selectedFile, {
        header: false,
        skipEmptyLines: true,
        complete: results => {
          if (results.errors.length > 0) {
            reject(new Error(results.errors[0].message));
            return;
          }
          resolve(results.data);
        },
        error: error => reject(error)
      });
    });

  const processFile = async (selectedFile: File) => {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase() ?? '';
    const readingStartedAt = performance.now();

    setFile(selectedFile);
    setParseError('');
    setFormError('');
    setIsParsingFile(true);
    setImportPhase('reading');
    setReviewAcknowledged(false);
    setSimpleResult(null);

    try {
      const fileError = validateSpreadsheetFile(selectedFile.name, selectedFile.size);
      if (fileError) throw new Error(fileError);

      if (extension === 'csv') {
        const csvRows = await parseCsv(selectedFile);
        setImportPhase('identifying');
        const headerIndex = detectHeaderRowIndex(csvRows);
        const headerRow = csvRows[headerIndex];
        if (!headerRow?.length) throw new Error('Não foi possível identificar o cabeçalho do arquivo CSV.');
        const csvHeaders = uniqueSpreadsheetHeaders(headerRow);
        const rows = csvRows.slice(headerIndex + 1).map(row =>
          Object.fromEntries(csvHeaders.map((header, index) => [header, row[index] ?? '']))
        );
        const parsed = applyParsedRows(rows);
        if (importMode === 'complete') await prepareCompleteMigration(selectedFile, parsed, { firstDataRow: headerIndex + 2, readingMs: performance.now() - readingStartedAt });
        else setImportPhase('preview_ready');
        return;
      }

      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const workbook = await readXlsxFile(selectedFile);
      setImportPhase('identifying');
      const selectedSheet = selectBestWorkbookSheet(workbook);
      const sheetRows = selectedSheet?.data ?? [];
      const headerIndex = detectHeaderRowIndex(sheetRows);
      const headerRow = sheetRows[headerIndex];
      const bodyRows = sheetRows.slice(headerIndex + 1);

      if (!headerRow || headerRow.length === 0) {
        throw new Error('A planilha não possui abas legíveis.');
      }

      const sheetHeaders = uniqueSpreadsheetHeaders(headerRow);
      const rows = bodyRows.map((row: unknown[]) =>
        Object.fromEntries(sheetHeaders.map((header: string, index: number) => [header, row[index] ?? '']))
      ) as Array<Record<string, unknown>>;

      const parsed = applyParsedRows(rows);
      if (importMode === 'complete') await prepareCompleteMigration(selectedFile, parsed, {
        sheetName: selectedSheet?.sheet,
        firstDataRow: headerIndex + 2,
        readingMs: performance.now() - readingStartedAt
      });
      else setImportPhase('preview_ready');
    } catch (error) {
      setStep(1);
      setHeaders([]);
      setData([]);
      setMapping({});
      setFullPayload(null);
      setFullPreview(null);
      setImportPhase('failed');
      setParseError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo. Revise o formato e tente novamente.');
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    await processFile(selectedFile);
    event.target.value = '';
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (isParsingFile) return;

    const selectedFile = event.dataTransfer.files?.[0];
    if (selectedFile) {
      await processFile(selectedFile);
    }
  };

  const handleMappingChange = (fieldKey: string, headerName: string) => {
    setFormError('');
    setReviewAcknowledged(false);
    setProjectOverrides({});
    setProjectPreview(null);
    setMapping(prev => ({
      ...prev,
      [fieldKey]: headerName
    }));
  };

  const revalidateProjectRow = async (index: number, override?: ProjectAssociationOverride) => {
    const sourceRow = simplePayload[index];
    if (!sourceRow || !projectPreview) return;
    const nextOverrides = { ...projectOverrides };
    if (override) nextOverrides[index] = override;
    else delete nextOverrides[index];
    setProjectOverrides(nextOverrides);
    setRefreshingProjectRow(index);
    setReviewAcknowledged(false);
    setFormError('');
    try {
      const rowPayload = applyProjectAssociationOverride(sourceRow, override);
      const refreshed = await apiClient.post<ProjectImportPreview>('/api/projetos/lote/preview', [rowPayload], { timeoutMs: 60_000 });
      const replacement = refreshed.rows[0];
      if (!replacement) throw new Error('O servidor não retornou a validação da linha.');
      const next = replaceProjectPreviewRow(projectPreview, index, replacement);
      setProjectPreview(next);
      setImportPhase(next.status === 'ready' ? 'preview_ready' : 'blocked');
    } catch (error) {
      setImportPhase('failed');
      setFormError(error instanceof Error ? `Não foi possível revalidar a linha ${index + 2}: ${error.message}` : `Não foi possível revalidar a linha ${index + 2}.`);
    } finally {
      setRefreshingProjectRow(null);
    }
  };

  const handleProjectAssociation = (index: number, clientId: string | null, keepPending: boolean) => {
    void revalidateProjectRow(index, keepPending ? { keepPending: true } : clientId ? { clientId } : undefined);
  };

  const handleProjectAssociationReset = (index: number) => {
    void revalidateProjectRow(index);
  };

  const handleFullMappingChange = async (source: string, field: string | null) => {
    if (!fullPayload || isRefreshingFullPreview) return;
    const nextPayload: FullMigrationPayload = {
      ...fullPayload,
      mappingOverrides: {
        ...(fullPayload.mappingOverrides ?? {}),
        [source]: field
      }
    };
    setFullPayload(nextPayload);
    setIsRefreshingFullPreview(true);
    setImportPhase('validating');
    setReviewAcknowledged(false);
    setFormError('');
    try {
      const preview = await apiClient.post<FullMigrationPreview>(
        '/api/importacoes/migracao-completa/preview',
        nextPayload,
        { timeoutMs: 60_000 }
      );
      setFullPreview(preview);
      setImportPhase(preview.status === 'ready' ? 'preview_ready' : 'blocked');
    } catch (error) {
      setImportPhase('failed');
      setFormError(error instanceof Error ? `Não foi possível recalcular a prévia: ${error.message}` : 'Não foi possível recalcular a prévia.');
    } finally {
      setIsRefreshingFullPreview(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async (payload: Array<Record<string, unknown>>) => {
      const result = await apiClient.post<SimpleImportResult>(`/api/${entity}/lote`, payload, {
        headers: { 'Idempotency-Key': simpleIdempotencyKey.current }
      });

      const schemaToSave = {
        id: crypto.randomUUID(),
        name: `Esquema ${selectedEntity.label} - ${file?.name ?? 'arquivo'}`,
        entity,
        mapping,
        date: new Date().toISOString()
      };

      const savedSchemas = JSON.parse(localStorage.getItem('import_schemas') || '[]');
      savedSchemas.push(schemaToSave);
      void persistOperationalSetting('import_schemas', savedSchemas).catch(() => undefined);
      return result;
    },
    onMutate: () => setImportPhase('saving'),
    onSuccess: result => {
      if (result.imported > 0) queryClient.invalidateQueries({ queryKey: [entity] });
      setSimpleResult(result);
      setImportPhase(result.status === 'completed' || result.status === 'completed_with_warnings' ? 'completed' : result.status === 'partial' ? 'partial' : 'failed');
      setFormError('');
      setStep(3);
    },
    onError: (err: Error) => {
      setImportPhase('failed');
      setFormError(`Erro na importação: ${err.message}. Revise os dados e tente novamente.`);
    }
  });

  const fullImportMutation = useMutation({
    mutationFn: async (payload: FullMigrationPayload) => {
      if (!fullPreview?.previewId) throw new Error('A prévia não possui um identificador válido. Gere uma nova prévia.');
      const queued = await apiClient.post<FullMigrationQueued>(
        '/api/importacoes/migracao-completa/confirmar',
        { ...payload, previewId: fullPreview.previewId },
        { timeoutMs: 60_000 }
      );

      for (let attempt = 0; attempt < 1_200; attempt += 1) {
        const run = await apiClient.get<FullMigrationRun>(queued.pollUrl, { timeoutMs: 30_000 });
        setFullImportProgress(`${run.stage} · ${run.progress}%`);
        if (run.status === 'failed' || run.status === 'cancelled') {
          throw new Error(run.error?.message || 'O processamento foi interrompido. Consulte o histórico da importação.');
        }
        if (['completed', 'partial', 'completed_with_warnings'].includes(run.status) && run.result) {
          return run.result;
        }
        await new Promise<void>(resolve => window.setTimeout(resolve, 750));
      }
      throw new Error('A importação continua em processamento. Consulte o histórico para acompanhar a conclusão.');
    },
    onMutate: () => {
      setImportPhase('saving');
      setFullImportProgress('Recebido · 0%');
    },
    onSuccess: result => {
      if (fullPreview && file) {
        const reusableMapping = Object.fromEntries(
          Object.entries(fullPreview.columns.selectedMapping).filter((entry): entry is [string, string] => Boolean(entry[1]))
        );
        const savedSchemas = JSON.parse(localStorage.getItem('import_schemas') || '[]');
        savedSchemas.push({
          id: crypto.randomUUID(),
          name: `Mapeamento completo - ${fullPayload?.sheetName ?? file.name}`,
          entity: 'migração completa',
          mapping: reusableMapping,
          date: new Date().toISOString()
        });
        void persistOperationalSetting('import_schemas', savedSchemas).catch(() => undefined);
      }
      setFullResult(result);
      setImportPhase('completed');
      setFormError('');
      setStep(3);
      setFullImportProgress('');
      queryClient.invalidateQueries();
    },
    onError: (err: Error) => {
      setImportPhase('failed');
      setFullImportProgress('');
      setFormError(`A migração não foi concluída: ${err.message}`);
    }
  });
  const operationInProgress = isParsingFile || isRefreshingFullPreview || isPreviewingProjects || refreshingProjectRow !== null || importMutation.isPending || fullImportMutation.isPending;

  const handleImport = () => {
    if (!file) return;

    if (!reviewAcknowledged) {
      setFormError('Confirme que revisou o mapeamento, as pendências e os totais antes de prosseguir.');
      return;
    }

    if (importMode === 'complete') {
      if (!fullPayload || !fullPreview) {
        setFormError('Gere novamente a prévia antes de confirmar a migração.');
        return;
      }
      if (fullPreview.status !== 'ready' || fullPreview.counts.blocking > 0) {
        setFormError('Corrija os erros impeditivos indicados na prévia antes de confirmar.');
        return;
      }
      fullImportMutation.mutate(fullPayload);
      return;
    }

    const missingRequired = requiredFields.filter(field => !mapping[field.key]);
    if (missingRequired.length > 0) {
      setFormError(`Mapeie os campos obrigatórios antes de concluir: ${missingRequired.map(field => field.label).join(', ')}.`);
      return;
    }
    if (entity === 'clientes' && !mapping.cpf && !mapping.cnpj) {
      setFormError('Mapeie ao menos uma coluna de CPF ou CNPJ para importar clientes pelo modo simples.');
      return;
    }
    if (entity === 'projetos' && !canConfirmProjectImport(projectPreview, isPreviewingProjects || refreshingProjectRow !== null)) {
      setFormError('Resolva todas as associações de clientes pendentes antes de confirmar a importação dos projetos.');
      const firstPending = projectPreview?.rows.find(row => row.status === 'pending');
      if (firstPending) document.getElementById(`project-association-pending-${firstPending.index}`)?.focus();
      return;
    }

    importMutation.mutate(effectiveSimplePayload);
  };

  const resetFlow = () => {
    setFile(null);
    setStep(1);
    setMapping({});
    setHeaders([]);
    setData([]);
    setParseError('');
    setFormError('');
    setFullPayload(null);
    setFullPreview(null);
    setFullResult(null);
    setSimpleResult(null);
    setProjectPreview(null);
    setProjectOverrides({});
    setIsPreviewingProjects(false);
    setRefreshingProjectRow(null);
    setReviewAcknowledged(false);
    setImportPhase('idle');
    setFullImportProgress('');
    simpleIdempotencyKey.current = crypto.randomUUID();
  };

  return (
    <Layout>
      <PageHeader
        eyebrow="Configurações"
        title="Importação de dados"
        description="Envie uma planilha, confirme o mapeamento das colunas e grave os registros em lote."
        className="mb-4"
        descriptionClassName="max-w-none"
        navigationClassName="mt-4"
        action={
          <Link
            to="/importacao/esquemas"
            className={cn(
              secondaryActionButtonClass,
              'h-11 min-h-11 gap-2 px-4 py-0',
            )}
          >
            <Gear weight="bold" size={20} aria-hidden="true" />
            Esquemas salvos
          </Link>
        }
      />

      <ol
        aria-label="Etapas da importação"
        className="mb-4 grid gap-3 md:grid-cols-3"
      >
        {stepItems.map(item => {
          const isCurrent = step === item.num;
          const isDone = step > item.num;

          return (
            <li
              key={item.num}
              aria-current={isCurrent ? 'step' : undefined}
              className={`rounded-xl border px-4 py-3 transition-colors ${
                isCurrent
                  ? 'border-brand-turquoise-200 bg-gradient-to-r from-brand-turquoise-50 via-brand-blue-50 to-brand-green-50 text-brand-turquoise-900 dark:border-brand-turquoise-300/20 dark:from-brand-turquoise-400/15 dark:via-brand-blue-400/10 dark:to-brand-green-400/15 dark:text-brand-turquoise-100'
                  : isDone
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100'
                    : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-brand-turquoise-700 text-white dark:bg-brand-turquoise-300 dark:text-zinc-950'
                      : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {isDone ? <CheckCircle size={16} weight="bold" aria-hidden="true" /> : item.num}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`mt-0.5 block text-xs leading-5 ${isCurrent ? 'text-brand-turquoise-800/75 dark:text-brand-turquoise-100/70' : 'opacity-75'}`}>
                    {isDone ? 'Concluído' : item.description}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {step === 1 && <div className="mb-4"><ImportGuidance /></div>}

      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
            <aside className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <label htmlFor="import-mode" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Tipo de importação
              </label>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Use a migração completa para planilhas amplas vindas do Excel.
              </p>
              <div className="relative mt-3">
                <FormSelect
                  id="import-mode"
                  name="tipo-importacao"
                  value={importMode}
                  onChange={event => {
                    resetFlow();
                    setImportMode(event.target.value as ImportMode);
                  }}
                  className="h-10 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-sm font-semibold text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/35 dark:[color-scheme:dark] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="complete">Migração completa de planilha</option>
                  <option value="simple">Importação simples por cadastro</option>
                </FormSelect>
                <CaretDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              </div>

              <div className={importMode === 'simple' ? 'mt-5' : 'hidden'}>
              <label htmlFor="import-entity" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Entidade de destino
              </label>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Escolha onde os registros serão gravados.
              </p>

              <div className="relative mt-3">
                <FormSelect
                  id="import-entity"
                  name="entidade"
                  value={entity}
                  onChange={event => setEntity(event.target.value as EntityKey)}
                  className="h-10 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-sm font-semibold text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/35 dark:[color-scheme:dark] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600"
                >
                  {Object.entries(entityOptions).map(([value, option]) => (
                    <option key={value} value={value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </FormSelect>
                <CaretDown
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
              </div>
              </div>

              <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Campos esperados</p>
                {importMode === 'complete' && (
                  <div className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <p><strong>64 campos possíveis</strong> no catálogo do GeoGestor.</p>
                    <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">A planilha não precisa seguir um modelo: o sistema interpreta as colunas disponíveis e você confirma as associações.</p>
                    <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Prévia obrigatória</span>
                  </div>
                )}
                {importMode === 'simple' && <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {currentFields.slice(0, 5).map(field => (
                    <li key={field.key} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{field.label}</span>
                      {field.required && (
                        <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          Obrigatório
                        </span>
                      )}
                    </li>
                  ))}
                </ul>}
              </div>
            </aside>

            <div
              onDragOver={event => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border border-dashed p-5 transition-colors md:p-6 ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30'
                  : 'border-zinc-300 bg-white hover:border-emerald-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-950/50'
              }`}
            >
              <input
                id="import-file"
                name="arquivo-importacao"
                type="file"
                accept=".csv,.xlsx"
                className="peer sr-only"
                onChange={handleFileUpload}
                aria-describedby="import-file-help import-status"
                disabled={isParsingFile}
              />

              <label
                htmlFor="import-file"
                className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg px-4 py-8 text-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/45 peer-disabled:cursor-wait peer-disabled:opacity-75"
              >
                {isParsingFile ? (
                  <>
                    <ArrowsClockwise
                      size={42}
                      aria-hidden="true"
                      className="mb-4 text-emerald-600 motion-safe:animate-spin motion-reduce:animate-none"
                    />
                    <span className="text-base font-bold text-zinc-950 dark:text-zinc-100">Lendo planilha…</span>
                    <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Estamos detectando colunas e registros neste computador.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <UploadSimple size={30} weight="bold" aria-hidden="true" />
                    </span>
                    <span className="text-base font-bold text-zinc-950 dark:text-zinc-100">
                      Clique para escolher ou solte a planilha aqui
                    </span>
                    <span id="import-file-help" className="mt-1 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      Use arquivos CSV ou XLSX. Você revisa o mapeamento antes da gravação.
                    </span>
                    <span className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950">
                        <FileCsv size={14} aria-hidden="true" />
                        .CSV
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950">
                        <FileXls size={14} aria-hidden="true" />
                        .XLSX
                      </span>
                    </span>
                  </>
                )}
              </label>

              <p id="import-status" aria-live="polite" className="sr-only">
                {isParsingFile ? phaseLabels[importPhase] : file ? `Arquivo selecionado: ${file.name}.` : 'Nenhum arquivo selecionado.'}
              </p>

              {parseError && (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                >
                  <WarningCircle size={18} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>{parseError}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div aria-live="polite" className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${importPhase === 'blocked' || importPhase === 'failed' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200' : importPhase === 'preview_ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200'}`}>
              <span className="flex items-center gap-2">{operationInProgress && <ArrowsClockwise size={17} className="motion-safe:animate-spin motion-reduce:animate-none" aria-hidden="true" />}{phaseLabels[importPhase]}</span>
              {importPhase === 'blocked' && (fullPreview || projectPreview) && <button type="button" onClick={() => { const firstProjectPending = projectPreview?.rows.find(row => row.status === 'pending'); const targetId = isSimpleProjectImport && firstProjectPending ? `project-association-pending-${firstProjectPending.index}` : 'migration-first-blocking-issue'; const target = document.getElementById(targetId); target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); target?.focus(); }} className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-900 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:border-red-800 dark:bg-red-950">Ir ao primeiro erro ({isSimpleProjectImport ? projectPreview?.counts.pending ?? 0 : fullPreview?.counts.blocking ?? 0})</button>}
            </div>
            <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {file?.name.toLowerCase().endsWith('.xlsx') ? (
                    <FileXls size={24} weight="fill" aria-hidden="true" />
                  ) : (
                    <FileCsv size={24} weight="fill" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-zinc-950 dark:text-zinc-100">{file?.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {data.length} registros encontrados {importMode === 'complete' ? 'para migração completa' : `para ${selectedEntity.label.toLowerCase()}`}.
                    {importMode === 'complete' && fullPayload?.sheetName ? ` Aba analisada: ${fullPayload.sheetName}.` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  {headers.length} colunas
                </span>
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {importMode === 'complete' ? `${fullPreview?.columns.recognized.length ?? 0} reconhecidas` : `${Object.values(mapping).filter(Boolean).length} mapeadas`}
                </span>
              </div>
            </div>

            {formError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
              >
                <WarningCircle size={18} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{formError}</span>
              </p>
            )}

            {importMode === 'complete' && fullPreview && (
              <FullMigrationReview
                preview={fullPreview}
                onMappingChange={handleFullMappingChange}
                isRefreshing={isRefreshingFullPreview}
              />
            )}

            {importMode === 'simple' && <>
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">Mapeamento de campos</h3>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Conecte cada campo do GeoGestor à coluna correspondente da planilha.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {currentFields.map(field => {
                  const isMapped = Boolean(mapping[field.key]);
                  const fieldId = `field-map-${field.key}`;

                  return (
                    <div
                      key={field.key}
                      className={`rounded-lg border p-4 transition-colors ${
                        isMapped
                          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/20'
                          : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40'
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <label htmlFor={fieldId} className="min-w-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          <span className="break-words">{field.label}</span>
                          {field.required && (
                            <>
                              <span aria-hidden="true" className="ml-1 text-red-600 dark:text-red-400">*</span>
                              <span className="sr-only"> obrigatório</span>
                            </>
                          )}
                        </label>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                            isMapped
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {isMapped ? 'Mapeado' : 'Pendente'}
                        </span>
                      </div>
                      <div className="relative">
                        <FormSelect
                          id={fieldId}
                          name={`mapeamento-${field.key}`}
                          value={mapping[field.key] || ''}
                          onChange={event => handleMappingChange(field.key, event.target.value)}
                          className="h-10 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-9 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/35 dark:[color-scheme:dark] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          <option value="">Ignorar coluna</option>
                          {headers.map(header => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </FormSelect>
                        <CaretDown
                          size={15}
                          aria-hidden="true"
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {entity === 'projetos' && projectPreview && (
              <ProjectClientAssociationReview
                preview={projectPreview}
                refreshingRow={refreshingProjectRow}
                onAssociate={handleProjectAssociation}
                onReset={handleProjectAssociationReset}
              />
            )}

            {simplePreflightIssues.length > 0 && (
              <section aria-labelledby="simple-preflight-title" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                <h3 id="simple-preflight-title" className="text-sm font-bold">Linhas com erros antes do envio</h3>
                <p className="mt-1 text-xs leading-5">{simplePreflightIssues.length} linha(s) deverão ser rejeitadas se não forem corrigidas. Se prosseguir, apenas as linhas válidas poderão ser importadas.</p>
                <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-sm">
                  {simplePreflightIssues.map(issue => <li key={issue.row} className="rounded-md border border-amber-200 bg-white/70 px-3 py-2 dark:border-amber-900 dark:bg-zinc-950/30"><strong>Linha {issue.row}:</strong> {issue.errors.join(' ')}</li>)}
                </ul>
              </section>
            )}

            {data.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-zinc-100">
                      <Table size={16} weight="bold" aria-hidden="true" />
                      Prévia dos dados
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Mostrando os 5 primeiros registros detectados.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                      <tr>
                        {headers.map(header => (
                          <th key={header} scope="col" className="px-3 py-2.5">
                            <span className="block max-w-48 truncate">{header}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {data.slice(0, 5).map((row, index) => (
                        <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/70">
                          {headers.map(header => (
                            <td key={header} className="px-3 py-2.5 text-zinc-700 dark:text-zinc-200">
                              <span className="block max-w-48 truncate" title={formatCell(row[header])}>
                                {formatCell(row[header]) || '-'}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            </>}

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                <input type="checkbox" name="confirmacao-conferencia-importacao" checked={reviewAcknowledged} disabled={!projectConfirmationReady} onChange={event => { setReviewAcknowledged(event.target.checked); setFormError(''); }} className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60" />
                <span>Revisei o mapeamento, as pendências e os totais apresentados. Estou ciente de que a importação automatizada pode exigir correções posteriores.</span>
              </label>
              {importMode === 'simple' && <p className="mt-2 pl-7 text-xs text-zinc-500 dark:text-zinc-400">Linhas inválidas poderão ser rejeitadas. O resultado final mostrará exatamente o que foi ou não gravado.</p>}
              {isSimpleProjectImport && !projectConfirmationReady && <p className="mt-2 pl-7 text-xs font-semibold text-amber-800 dark:text-amber-200">A conferência final será liberada depois que todas as linhas tiverem um cliente associado.</p>}
              {importMode === 'complete' && fullPreview?.status === 'blocked' && <p className="mt-2 pl-7 text-xs font-semibold text-red-700 dark:text-red-300">A importação não está processando. Ela foi bloqueada por {fullPreview.counts.blocking} erro(s) que precisam ser corrigidos.</p>}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setFormError('');
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/45 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ArrowLeft size={16} weight="bold" aria-hidden="true" />
                Voltar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!reviewAcknowledged || !projectConfirmationReady || (importMode === 'complete' ? fullImportMutation.isPending || isRefreshingFullPreview || fullPreview?.status !== 'ready' : importMutation.isPending || isPreviewingProjects || refreshingProjectRow !== null)}
                aria-busy={importMode === 'complete' ? fullImportMutation.isPending : importMutation.isPending || isPreviewingProjects || refreshingProjectRow !== null}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500/45 disabled:bg-emerald-900/60 disabled:text-emerald-50 ${(importMode === 'complete' ? fullImportMutation.isPending || isRefreshingFullPreview : importMutation.isPending || isPreviewingProjects || refreshingProjectRow !== null) ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'}`}
              >
                {(importMode === 'complete' ? fullImportMutation.isPending : importMutation.isPending) ? (
                  <>
                    <ArrowsClockwise size={16} aria-hidden="true" className="motion-safe:animate-spin motion-reduce:animate-none" />
                    {importMode === 'complete' && fullImportProgress ? fullImportProgress : 'Gravando registros…'}
                  </>
                ) : (
                  <>
                    {importMode === 'complete' ? 'Confirmar migração completa' : 'Concluir importação'}
                    <CaretRight weight="bold" size={16} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={`mx-auto py-10 ${importMode === 'complete' ? 'max-w-6xl' : 'max-w-4xl'}`}>
            {importMode === 'complete' && fullResult ? (
              <>
                <FullMigrationResultView result={fullResult} />
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={resetFlow} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/45 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">Nova importação</button>
                  <button type="button" onClick={() => navigate('/financeiro')} className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-500/45 dark:bg-white dark:text-zinc-950">Conferir financeiro</button>
                </div>
              </>
            ) : simpleResult ? <>
              <SimpleImportResultView result={simpleResult} />
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={resetFlow} className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/45 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">Nova importação</button>
                {simpleResult.imported > 0 && <button type="button" onClick={() => navigate(selectedEntity.route)} className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-500/45 dark:bg-white dark:text-zinc-950">Conferir {selectedEntity.label}</button>}
              </div>
            </> : null}
          </div>
        )}
      </section>
    </Layout>
  );
}
