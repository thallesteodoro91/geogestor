import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  Database,
  FileCsv,
  FileXls,
  Gear,
  Table,
  UploadSimple,
  WarningCircle
} from '@phosphor-icons/react';
import Papa from 'papaparse';
import { Layout } from '../../components/Layout';
import { apiClient } from '../../services/apiClient';

type EntityKey = 'clientes' | 'projetos' | 'contatos';

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
    route: '/contatos'
  }
};

const entityFields: Record<EntityKey, EntityField[]> = {
  clientes: [
    { key: 'nome', label: 'Nome / Razão Social', required: true },
    { key: 'documento', label: 'CPF / CNPJ', required: false },
    { key: 'email', label: 'E-mail comercial', required: false },
    { key: 'telefone', label: 'Telefone / WhatsApp', required: false },
    { key: 'endereco', label: 'Endereço completo', required: false }
  ],
  projetos: [
    { key: 'nome', label: 'Nome do projeto topográfico', required: true },
    { key: 'clienteId', label: 'Cliente vinculado', required: true },
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

const acceptedExtensions = ['csv', 'xlsx'];

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
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');
  const [formError, setFormError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const selectedEntity = entityOptions[entity];
  const currentFields = entityFields[entity];
  const requiredFields = currentFields.filter(field => field.required);

  const applyParsedRows = (rows: Array<Record<string, unknown>>) => {
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

    const autoMap: Record<string, string> = {};
    currentFields.forEach(field => {
      const normalizedKey = normalizeText(field.key);
      const normalizedLabel = normalizeText(field.label);
      const match = detectedHeaders.find(header => {
        const normalizedHeader = normalizeText(header);
        return normalizedHeader.includes(normalizedKey) || normalizedLabel.includes(normalizedHeader);
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
    setStep(2);
  };

  const parseCsv = (selectedFile: File) =>
    new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(selectedFile, {
        header: true,
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

    setFile(selectedFile);
    setParseError('');
    setFormError('');
    setIsParsingFile(true);

    try {
      if (!acceptedExtensions.includes(extension)) {
        throw new Error('Formato não suportado. Envie um arquivo CSV ou XLSX.');
      }

      if (extension === 'csv') {
        applyParsedRows(await parseCsv(selectedFile));
        return;
      }

      const { readSheet } = await import('read-excel-file/browser');
      const sheetRows = await readSheet(selectedFile);
      const [headerRow, ...bodyRows] = sheetRows;

      if (!headerRow || headerRow.length === 0) {
        throw new Error('A planilha não possui abas legíveis.');
      }

      const sheetHeaders = headerRow.map((cell: unknown) => String(cell ?? '').trim());
      const rows = bodyRows.map((row: unknown[]) =>
        Object.fromEntries(sheetHeaders.map((header: string, index: number) => [header, row[index] ?? '']))
      ) as Array<Record<string, unknown>>;

      applyParsedRows(rows);
    } catch (error) {
      setStep(1);
      setHeaders([]);
      setData([]);
      setMapping({});
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
    setMapping(prev => ({
      ...prev,
      [fieldKey]: headerName
    }));
  };

  const importMutation = useMutation({
    mutationFn: async (payload: Array<Record<string, string>>) => {
      await apiClient.post(`/api/${entity}/lote`, payload);

      const schemaToSave = {
        id: crypto.randomUUID(),
        name: `Esquema ${selectedEntity.label} - ${file?.name ?? 'arquivo'}`,
        entity,
        mapping,
        date: new Date().toISOString()
      };

      const savedSchemas = JSON.parse(localStorage.getItem('import_schemas') || '[]');
      savedSchemas.push(schemaToSave);
      localStorage.setItem('import_schemas', JSON.stringify(savedSchemas));
      return { success: true, count: payload.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entity] });
      setFormError('');
      setStep(3);
    },
    onError: (err: Error) => {
      setFormError(`Erro na importação: ${err.message}. Revise os dados e tente novamente.`);
    }
  });

  const handleImport = () => {
    if (!file) return;

    const missingRequired = requiredFields.filter(field => !mapping[field.key]);
    if (missingRequired.length > 0) {
      setFormError(`Mapeie os campos obrigatórios antes de concluir: ${missingRequired.map(field => field.label).join(', ')}.`);
      return;
    }

    const payload = data.map(row => {
      const obj: Record<string, string> = {};
      Object.keys(mapping).forEach(key => {
        const sourceHeader = mapping[key];
        if (sourceHeader) {
          obj[key] = formatCell(row[sourceHeader]);
        }
      });
      return obj;
    });

    importMutation.mutate(payload);
  };

  const resetFlow = () => {
    setFile(null);
    setStep(1);
    setMapping({});
    setHeaders([]);
    setData([]);
    setParseError('');
    setFormError('');
  };

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Database size={14} weight="bold" aria-hidden="true" />
              Importador local
            </span>
            <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              CSV e XLSX
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight text-zinc-950 dark:text-white md:text-[28px]">
            Importação de dados
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Envie uma planilha, confirme o mapeamento das colunas e grave os registros em lote.
          </p>
        </div>

        <Link
          to="/importacao/esquemas"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/45 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <Gear weight="bold" size={16} aria-hidden="true" />
          Esquemas salvos
        </Link>
      </div>

      <ol
        aria-label="Etapas da importação"
        className="mb-6 grid gap-3 md:grid-cols-3"
      >
        {stepItems.map(item => {
          const isCurrent = step === item.num;
          const isDone = step > item.num;

          return (
            <li
              key={item.num}
              aria-current={isCurrent ? 'step' : undefined}
              className={`rounded-xl border px-4 py-3 ${
                isCurrent
                  ? 'border-zinc-900 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-white dark:text-zinc-950'
                  : isDone
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100'
                    : 'border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white'
                      : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {isDone ? <CheckCircle size={16} weight="bold" aria-hidden="true" /> : item.num}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`mt-0.5 block text-xs leading-5 ${isCurrent ? 'text-zinc-200 dark:text-zinc-600' : 'opacity-75'}`}>
                    {isDone ? 'Concluído' : item.description}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="mx-auto max-w-5xl rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-6">
        {step === 1 && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
            <aside className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <label htmlFor="import-entity" className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Entidade de destino
              </label>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Escolha onde os registros serão gravados.
              </p>

              <div className="relative mt-3">
                <select
                  id="import-entity"
                  name="entidade"
                  value={entity}
                  onChange={event => setEntity(event.target.value as EntityKey)}
                  className="h-11 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-sm font-semibold text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/35 dark:[color-scheme:dark] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600"
                >
                  {Object.entries(entityOptions).map(([value, option]) => (
                    <option key={value} value={value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
              </div>

              <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Campos esperados</p>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
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
                </ul>
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
                {isParsingFile ? 'Lendo planilha.' : file ? `Arquivo selecionado: ${file.name}.` : 'Nenhum arquivo selecionado.'}
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
                    {data.length} registros encontrados para {selectedEntity.label.toLowerCase()}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  {headers.length} colunas
                </span>
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {Object.values(mapping).filter(Boolean).length} mapeadas
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
                        <select
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
                        </select>
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
                disabled={importMutation.isPending}
                aria-busy={importMutation.isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500/45 disabled:cursor-wait disabled:bg-emerald-900/60 disabled:text-emerald-50"
              >
                {importMutation.isPending ? (
                  <>
                    <ArrowsClockwise size={16} aria-hidden="true" className="motion-safe:animate-spin motion-reduce:animate-none" />
                    Gravando registros…
                  </>
                ) : (
                  <>
                    Concluir importação
                    <CaretRight weight="bold" size={16} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mx-auto max-w-xl py-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-8 ring-emerald-500/10 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle weight="fill" size={42} aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-950 dark:text-zinc-100">Lote cadastrado com sucesso</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Os registros foram incorporados ao banco local e já aparecem nas listagens de {selectedEntity.label.toLowerCase()}.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={resetFlow}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500/45 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Nova importação
              </button>
              <button
                type="button"
                onClick={() => navigate(selectedEntity.route)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-500/45 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Acessar {selectedEntity.label}
              </button>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}
