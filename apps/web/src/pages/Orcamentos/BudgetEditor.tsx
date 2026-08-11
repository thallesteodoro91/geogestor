import { ArrowDown, ArrowUp, CaretDown, CheckCircle, Circle, Copy, FloppyDisk, Plus, Trash, UserPlus, WarningCircle
} from '@phosphor-icons/react';
import { BUDGET_UNITS, isValidBrazilianPhone, isValidCnpj, isValidCpf, percentageToBasisPoints } from '@geogestor/contracts';
import { Modal } from '../../components/Modal';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckboxField, DatePickerField, FormError, FormField, FormFooter, FormSection, FormSelect, NumericInput } from '../../components/Form';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { financialMetricClass, financialValueClass, signedFinancialTone, type FinancialTone } from '../../utils/financialTone';
import { formatCnpj, formatCpf, formatPhoneBR } from '../../utils/formatters';
import {
  calculateForm,
  centsToCurrencyInput,
  createDefaultBudgetForm,
  currencyInputToCents,
  DEFAULT_BUDGET_TERMS,
  detailToForm,
  emptyBudgetItem,
  formatBasisPoints,
  formatCurrency,
  formatDate,
  formToPayload,
  validateBudgetForm,
  type BudgetValidationIssue
} from './budgetForm';
import type {
  BudgetDetail,
  BudgetFormCost,
  BudgetFormItem,
  BudgetFormState,
  BudgetFormTax,
  BudgetOptions
} from './types';
import { useAuxiliaryCatalogs } from '../../hooks/useAuxiliaryCatalogs';

interface BudgetEditorProps {
  isOpen?: boolean;
  onClose: () => void;
  options: BudgetOptions;
  initial?: BudgetDetail | null;
  initialClientId?: string;
  onSaved: (budget: BudgetDetail) => void;
  presentation?: 'modal' | 'page';
}

interface BudgetEditorShellProps {
  children: ReactNode;
  closeDisabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  presentation: 'modal' | 'page';
  title: string;
}

function BudgetEditorShell({ children, closeDisabled, isOpen, onClose, presentation, title }: BudgetEditorShellProps) {
  if (presentation === 'page') {
    return (
      <section aria-label={title} className="min-w-0 max-w-full">
        {children}
      </section>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeDisabled={closeDisabled} title={title} maxWidth="max-w-[1520px]">
      {children}
    </Modal>
  );
}

const fieldClass = cn(geoFieldClass, 'min-h-11 w-full px-3 text-sm dark:border-[#272a31] dark:bg-[#0f1115] dark:text-[#f3f4f6] dark:placeholder:text-zinc-600 dark:hover:border-zinc-600 dark:focus:border-blue-500 dark:focus:ring-blue-500/20');
const compactFieldClass = cn(geoFieldClass, 'h-10 w-full min-w-24 px-2 text-sm dark:border-[#272a31] dark:bg-[#0f1115] dark:text-[#f3f4f6] dark:placeholder:text-zinc-600 dark:hover:border-zinc-600 dark:focus:border-blue-500 dark:focus:ring-blue-500/20');
const iconButtonClass = 'geo-focus-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-zinc-600 transition-[background-color,color,transform] duration-150 hover:bg-brand-surface-subtle hover:text-zinc-950 active:scale-[0.97] dark:border-[#272a31] dark:bg-[#0f1115] dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-[#171a20] dark:hover:text-white';

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

interface AdjustmentInputProps {
  id?: string;
  type: 'fixo' | 'percentual';
  value: string;
  typeAriaLabel: string;
  valueAriaLabel: string;
  onTypeChange: (type: 'fixo' | 'percentual') => void;
  onValueChange: (value: string) => void;
  compact?: boolean;
  invalid?: boolean;
  errorId?: string;
}

function normalizedAdjustmentValue(type: 'fixo' | 'percentual', value: string) {
  if (!value.trim()) return value;
  try {
    if (type === 'fixo') return centsToCurrencyInput(currencyInputToCents(value));
    const basisPoints = percentageToBasisPoints(value);
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(basisPoints / 100);
  } catch {
    return value;
  }
}

function formatSignedCurrency(value: number) {
  if (value === 0) return formatCurrency(0);
  return `${value > 0 ? '+' : '−'} ${formatCurrency(Math.abs(value))}`;
}

function AdjustmentInput({ id, type, value, typeAriaLabel, valueAriaLabel, onTypeChange, onValueChange, compact = false, invalid = false, errorId }: AdjustmentInputProps) {
  const unitName = type === 'percentual' ? 'percentual' : 'valor fixo em reais';
  return (
    <div className="geo-input-group flex w-fit max-w-full items-stretch">
      <FormSelect
        aria-label={`${typeAriaLabel}: ${unitName}`}
        aria-invalid={invalid || undefined}
        aria-describedby={errorId}
        value={type}
        onChange={(event) => onTypeChange(event.target.value as 'fixo' | 'percentual')}
        compactCaret
        wrapperClassName={cn('shrink-0', compact ? 'w-[4.25rem]' : 'w-20')}
        className={cn(
          compact ? 'h-10' : 'min-h-11',
          'justify-center rounded-r-none border-r-0 px-2 pr-2 text-sm font-semibold shadow-none focus:z-10',
          compact ? 'gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5' : 'gap-2'
        )}
      >
        <option value="percentual">%</option>
        <option value="fixo">R$</option>
      </FormSelect>
      <input
        id={id}
        name={id}
        aria-label={`${valueAriaLabel} (${unitName})`}
        aria-invalid={invalid || undefined}
        aria-describedby={errorId}
        inputMode="decimal"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={() => onValueChange(normalizedAdjustmentValue(type, value))}
        className={cn(
          fieldClass,
          compact ? 'h-10 w-24' : 'min-h-11 w-32 sm:w-36',
          'min-w-0 rounded-l-none px-3 text-right font-mono text-sm tabular-nums shadow-none'
        )}
      />
    </div>
  );
}

type EditorSectionId = 'header' | 'client' | 'characterization' | 'items' | 'costs' | 'taxes' | 'fees' | 'payment' | 'summary' | 'notes' | 'document';
type EditorSectionTone = 'complete' | 'progress' | 'empty' | 'optional' | 'error';

interface EditorSectionStatus {
  tone: EditorSectionTone;
  label: string;
}

const editorSections: Array<{ id: EditorSectionId; number: string; label: string }> = [
  { id: 'header', number: '1', label: 'Cabeçalho' },
  { id: 'client', number: '2', label: 'Cliente e imóvel' },
  { id: 'characterization', number: '3', label: 'Caracterização' },
  { id: 'items', number: '4', label: 'Itens' },
  { id: 'costs', number: '5', label: 'Custos internos' },
  { id: 'taxes', number: '6', label: 'Impostos' },
  { id: 'fees', number: '7', label: 'Honorários e margem' },
  { id: 'payment', number: '8–9', label: 'Pagamento' },
  { id: 'summary', number: '10', label: 'Resumo financeiro' },
  { id: 'notes', number: '11', label: 'Observações' },
  { id: 'document', number: '12', label: 'Documento final' }
];

interface EditorSectionProps {
  id: EditorSectionId;
  number: string;
  title: string;
  description: string;
  summary: string;
  isOpen: boolean;
  isActive: boolean;
  isHighlighted?: boolean;
  status: EditorSectionStatus;
  onToggle: () => void;
  onActivate: () => void;
  setRef: (node: HTMLElement | null) => void;
  children: ReactNode;
  className?: string;
}

function EditorSection({ id, number, title, description, summary, isOpen, isActive, isHighlighted = false, status, onToggle, onActivate, setRef, children, className }: EditorSectionProps) {
  const statusIcon = status.tone === 'complete'
    ? <CheckCircle aria-hidden="true" size={14} weight="fill" />
    : status.tone === 'error'
      ? <WarningCircle aria-hidden="true" size={14} weight="fill" />
      : <Circle aria-hidden="true" size={status.tone === 'progress' ? 12 : 11} weight={status.tone === 'progress' ? 'fill' : 'bold'} />;

  return (
    <section
      ref={setRef}
      id={`budget-section-${id}`}
      data-highlighted={isHighlighted || undefined}
      onFocusCapture={onActivate}
      className={cn(
        'scroll-mt-16 overflow-hidden border bg-white transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none dark:bg-[#13151a]',
        isOpen
          ? 'rounded-xl border-l-4 shadow-sm'
          : 'rounded-none border-x-0 border-t-0 border-b border-l-2 !bg-transparent shadow-none',
        isActive
          ? 'border-blue-400 border-l-blue-500 shadow-[0_10px_30px_-22px_rgba(59,130,246,0.65)] dark:border-blue-500/70 dark:border-l-blue-400 dark:bg-[#151922]'
          : 'border-zinc-200 border-l-transparent dark:border-[#272a31] dark:border-l-transparent',
        isHighlighted && !isOpen && 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200 dark:border-emerald-400/40 dark:bg-emerald-500/[0.07] dark:ring-emerald-400/15',
        className
      )}
    >
      <h3 className="contents">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={`budget-section-${id}-content`}
          onClick={onToggle}
          className={cn('geo-focus-ring flex w-full items-start gap-3 px-4 text-left transition-colors duration-150 hover:bg-zinc-50 motion-reduce:transition-none dark:hover:bg-white/[0.025] sm:px-5', isOpen ? 'rounded-xl py-3.5' : 'rounded-lg py-3')}
        >
          <span className={cn('flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold tabular-nums', isActive ? 'border-blue-400/60 bg-blue-500/10 text-blue-700 dark:text-blue-200' : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-[#30343c] dark:bg-[#0f1115] dark:text-zinc-300')}>{number}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-zinc-950 dark:text-[#f3f4f6]">{title}</span>
              <span className={cn(
                'inline-flex items-center gap-1.5 text-[11px] font-semibold',
                status.tone === 'complete' && 'text-emerald-700 dark:text-emerald-300',
                status.tone === 'error' && 'text-rose-700 dark:text-rose-300',
                status.tone === 'progress' && 'text-blue-700 dark:text-blue-300',
                (status.tone === 'empty' || status.tone === 'optional') && 'text-zinc-500 dark:text-[#9ca3af]'
              )}>
                {statusIcon}
                {status.label}
              </span>
            </span>
            <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-[#9ca3af]">{isOpen ? description : summary}</span>
          </span>
          <CaretDown aria-hidden="true" size={18} weight="bold" className={cn('mt-1 shrink-0 text-zinc-400 transition-transform duration-200 motion-reduce:transition-none dark:text-zinc-500', isOpen && 'rotate-180')} />
        </button>
      </h3>
      <div id={`budget-section-${id}-content`} hidden={!isOpen} className="border-t border-zinc-200 px-4 py-5 dark:border-[#272a31] sm:px-5">
        <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
}

const COST_CATEGORIES = [
  'Horas técnicas de campo', 'Horas técnicas de escritório', 'Equipe auxiliar', 'Equipamentos',
  'Depreciação', 'Mobilização e desmobilização', 'Combustível', 'Pedágios', 'Deslocamento',
  'Alimentação', 'Hospedagem', 'Materiais e marcos', 'Processamento de dados',
  'Plantas e memoriais', 'Taxas cartorárias', 'Taxas administrativas', 'ART/RRT/TRT',
  'Serviços terceirizados', 'Contingência', 'Outros custos'
];

function newCost(): BudgetFormCost {
  return {
    id: crypto.randomUUID(),
    category: 'Horas técnicas de campo',
    description: '',
    amount: '0,00',
    classification: 'custo_proprio',
    taxable: false,
    notes: ''
  };
}

function newTax(): BudgetFormTax {
  return {
    id: crypto.randomUUID(),
    name: '',
    acronym: '',
    ratePercent: '0',
    calculationBase: 'tributavel',
    includedInPrice: false,
    cumulative: false,
    manualAdjustment: '0,00',
    adjustmentReason: ''
  };
}

function createEqualInstallments(count: number) {
  const safeCount = Math.min(60, Math.max(1, Math.trunc(count)));
  const baseBasisPoints = Math.floor(10_000 / safeCount);
  return Array.from({ length: safeCount }, (_, index) => {
    const basisPoints = index === safeCount - 1
      ? 10_000 - baseBasisPoints * (safeCount - 1)
      : baseBasisPoints;
    return {
      percentage: `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, '0')}`,
      daysAfterApproval: index * 30,
      label: `Parcela ${index + 1}/${safeCount}`
    };
  });
}

function getBudgetErrorSection(message: string, fallback: EditorSectionId): EditorSectionId {
  const normalizedError = message.toLocaleLowerCase('pt-BR');
  if (normalizedError.includes('cliente')) return 'client';
  if (normalizedError.includes('título') || normalizedError.includes('descrição do orçamento')) return 'header';
  if (normalizedError.includes('item')) return 'items';
  if (normalizedError.includes('parcela')) return 'payment';
  if (normalizedError.includes('imposto') || normalizedError.includes('tribut')) return 'taxes';
  if (normalizedError.includes('custo')) return 'costs';
  if (normalizedError.includes('desconto') || normalizedError.includes('acréscimo') || normalizedError.includes('margem')) return 'fees';
  return fallback;
}

export function BudgetEditor({ isOpen = true, onClose, options, initial, initialClientId, onSaved, presentation = 'modal' }: BudgetEditorProps) {
  const queryClient = useQueryClient();
  const catalogsQuery = useAuxiliaryCatalogs();
  const formRef = useRef<HTMLFormElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState<BudgetFormState>(() => initial ? detailToForm(initial) : createDefaultBudgetForm(initialClientId || ''));
  const [initialFormSnapshot] = useState(() => JSON.stringify(form));
  const [error, setError] = useState('');
  const [validationActive, setValidationActive] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedTaxProfile, setSelectedTaxProfile] = useState('');
  const [selectedPricingParameter, setSelectedPricingParameter] = useState('');
  const [installmentCount, setInstallmentCount] = useState(() => String(initial?.payment?.installments.length || 1));
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClient, setQuickClient] = useState({ tipoPessoa: 'PF' as 'PF' | 'PJ', nome: '', documento: '', email: '', telefone: '', endereco: '' });
  const [openSections, setOpenSections] = useState<Set<EditorSectionId>>(() => new Set(['header']));
  const [activeSection, setActiveSection] = useState<EditorSectionId>('header');
  const [expandedItemDetails, setExpandedItemDetails] = useState<Set<string>>(() => new Set());
  const [isFormScrolled, setIsFormScrolled] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<EditorSectionId | null>(null);
  const sectionRefs = useRef<Partial<Record<EditorSectionId, HTMLElement | null>>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardContinueRef = useRef<HTMLButtonElement | null>(null);
  const allowNavigationRef = useRef(false);
  const hasFocusedInitialFieldRef = useRef(false);
  const isDirty = useMemo(() => JSON.stringify(form) !== initialFormSnapshot, [form, initialFormSnapshot]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    presentation === 'page'
    && isDirty
    && !allowNavigationRef.current
    && `${currentLocation.pathname}${currentLocation.search}` !== `${nextLocation.pathname}${nextLocation.search}`
  ));
  const discardPromptVisible = showDiscardConfirm || blocker.state === 'blocked';
  const serviceTypeOptions = useMemo(() => Array.from(new Set([
    ...(catalogsQuery.data?.services.filter((item) => item.ativo).map((item) => item.nome) ?? []),
    form.serviceType
  ].filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })), [catalogsQuery.data?.services, form.serviceType]);
  const validationIssues = useMemo<BudgetValidationIssue[]>(() => validationActive ? validateBudgetForm(form) : [], [form, validationActive]);
  const validationByField = useMemo(() => new Map(validationIssues.map((issue) => [issue.fieldId, issue.message])), [validationIssues]);
  const validationMessage = validationIssues.length === 1
    ? validationIssues[0].message
    : validationIssues.length > 1
      ? `Revise ${validationIssues.length} campos antes de salvar o rascunho.`
      : '';
  const fieldError = (fieldId: string) => validationByField.get(fieldId);
  const fieldA11y = (fieldId: string) => ({
    'aria-invalid': fieldError(fieldId) ? true : undefined,
    'aria-describedby': fieldError(fieldId) ? `${fieldId}-error` : undefined
  });

  const calculation = useMemo(() => {
    try {
      return { value: calculateForm(form), error: '' };
    } catch (calculationError) {
      return {
        value: null,
        error: calculationError instanceof Error ? calculationError.message : 'Não foi possível calcular a prévia.'
      };
    }
  }, [form]);

  const scrollSectionIntoEditor = (sectionId: EditorSectionId) => {
    const section = sectionRefs.current[sectionId];
    if (presentation === 'page') {
      if (!section) return;
      const stickyNavigationOffset = window.innerWidth < 768 ? 132 : 24;
      window.scrollTo({
        top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - stickyNavigationOffset),
        behavior: preferredScrollBehavior()
      });
      return;
    }
    const scrollContainer = formRef.current?.parentElement;
    if (!section || !scrollContainer) return;
    const sectionRect = section.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const stickyNavigationOffset = window.innerWidth < 1024 ? 72 : 8;
    scrollContainer.scrollTo({
      top: Math.max(0, scrollContainer.scrollTop + sectionRect.top - containerRect.top - stickyNavigationOffset),
      behavior: preferredScrollBehavior()
    });
  };

  const focusErrorSection = (sectionId: EditorSectionId, fieldId?: string) => {
    setActiveSection(sectionId);
    setOpenSections((current) => {
      if (current.has(sectionId)) return current;
      const next = new Set(current);
      next.add(sectionId);
      return next;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const section = sectionRefs.current[sectionId];
      scrollSectionIntoEditor(sectionId);
      const sectionContent = section?.querySelector<HTMLElement>(`#budget-section-${sectionId}-content`);
      const requestedField = fieldId ? document.getElementById(fieldId) : null;
      const firstField = requestedField || sectionContent?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
      firstField?.focus({ preventScroll: true });
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = formToPayload(form);
      return initial
        ? apiClient.patch<BudgetDetail>(`/api/orcamentos/${initial.id}`, payload)
        : apiClient.post<BudgetDetail>('/api/orcamentos', payload);
    },
    onSuccess: async (budget) => {
      toast.success(initial ? 'Orçamento atualizado.' : 'Orçamento criado em rascunho.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-kpis'] })
      ]);
      allowNavigationRef.current = true;
      onSaved(budget);
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Não foi possível salvar o orçamento.';
      setError(message);
      focusErrorSection(getBudgetErrorSection(message, activeSection));
    }
  });

  const quickClientMutation = useMutation({
    mutationFn: () => apiClient.post<{ id: string }>('/api/clientes', {
      ...quickClient,
      cpf: quickClient.tipoPessoa === 'PF' ? quickClient.documento : null,
      cnpj: quickClient.tipoPessoa === 'PJ' ? quickClient.documento : null,
      celular: quickClient.telefone,
      categoria: quickClient.tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica',
      situacao: 'Ativo'
    }),
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: ['budget-options'] });
      setForm((current) => ({ ...current, clientId: client.id, projectId: '', propertyId: '' }));
      setShowQuickClient(false);
      setQuickClient({ tipoPessoa: 'PF', nome: '', documento: '', email: '', telefone: '', endereco: '' });
      toast.success('Cliente cadastrado e selecionado.');
    },
    onError: (mutationError) => toast.error(mutationError instanceof Error ? mutationError.message : 'Não foi possível cadastrar o cliente.')
  });

  const updateItem = (id: string, patch: Partial<BudgetFormItem>) => {
    setForm((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  };

  const applyServiceType = (serviceType: string) => {
    const catalogItem = catalogsQuery.data?.services.find((item) => item.ativo && item.nome === serviceType);
    setForm((current) => {
      const firstItem = current.items[0];
      const canSuggestValue = !initial && catalogItem && catalogItem.valorSugerido > 0 && current.items.length === 1
        && !firstItem.description.trim() && currencyInputToCents(firstItem.unitPrice || '0') === 0;
      return {
        ...current,
        serviceType,
        items: canSuggestValue
          ? [{ ...firstItem, description: catalogItem.nome, unitPrice: centsToCurrencyInput(catalogItem.valorSugerido) }]
          : current.items
      };
    });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= form.items.length) return;
    setForm((current) => {
      const items = [...current.items];
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, items };
    });
  };

  const applyTemplate = () => {
    const template = options.templates.find((item) => item.id === selectedTemplate);
    if (!template) return;
    setForm((current) => {
      const content = template.content;
      return {
        ...current,
        ...content,
        clientId: current.clientId,
        projectId: current.projectId,
        propertyId: current.propertyId,
        items: content.items?.map((item) => ({ ...item, id: crypto.randomUUID() })) || current.items,
        costs: content.costs?.map((cost) => ({ ...cost, id: crypto.randomUUID() })) || current.costs,
        taxes: content.taxes?.map((tax) => ({ ...tax, id: crypto.randomUUID() })) || current.taxes
      };
    });
    toast.success(`Modelo “${template.nome}” aplicado sem alterar o cadastro original.`);
  };

  const saveTemplate = async () => {
    const name = form.serviceType ? `${form.serviceType} — modelo` : 'Modelo de orçamento';
    try {
      await apiClient.post('/api/orcamentos/templates', {
        name,
        serviceType: form.serviceType,
        description: form.description,
        content: { ...form, clientId: '', projectId: '', propertyId: '' }
      });
      await queryClient.invalidateQueries({ queryKey: ['budget-options'] });
      toast.success('Modelo salvo. Alterações futuras não afetarão orçamentos existentes.');
    } catch (templateError) {
      toast.error(templateError instanceof Error ? templateError.message : 'Não foi possível salvar o modelo.');
    }
  };

  const applyTaxProfile = () => {
    const profile = options.taxProfiles.find((item) => item.id === selectedTaxProfile);
    if (!profile) return;
    setForm((current) => ({
      ...current,
      taxes: profile.taxes.map((tax) => ({
        id: crypto.randomUUID(),
        taxId: tax.id,
        name: tax.nome,
        acronym: tax.sigla,
        ratePercent: tax.ratePercent,
        calculationBase: tax.baseCalculo,
        includedInPrice: tax.inclusoNoPreco,
        cumulative: tax.cumulativo,
        manualAdjustment: '0,00',
        adjustmentReason: ''
      }))
    }));
  };

  const saveTaxProfile = async () => {
    if (!form.taxes.length) return;
    try {
      await apiClient.post('/api/orcamentos/tax-profiles', {
        name: `${form.serviceType || 'Orçamento'} — impostos`,
        description: 'Perfil criado a partir de um orçamento. Ajustes excepcionais não são reutilizados.',
        taxes: form.taxes.map((tax) => ({
          name: tax.name,
          acronym: tax.acronym,
          ratePercent: tax.ratePercent,
          calculationBase: tax.calculationBase,
          includedInPrice: tax.includedInPrice,
          cumulative: tax.cumulative
        }))
      });
      await queryClient.invalidateQueries({ queryKey: ['budget-options'] });
      toast.success('Perfil tributário salvo para reutilização.');
    } catch (profileError) {
      toast.error(profileError instanceof Error ? profileError.message : 'Não foi possível salvar o perfil tributário.');
    }
  };

  const savePricingParameter = async (cost: BudgetFormCost) => {
    if (!cost.description.trim()) {
      toast.error('Descreva o custo antes de salvá-lo como parâmetro.');
      return;
    }
    try {
      await apiClient.post('/api/orcamentos/pricing-parameters', {
        key: `custo-${crypto.randomUUID()}`,
        name: cost.description.trim(),
        category: cost.category,
        unit: 'valor padrão',
        valueCents: currencyInputToCents(cost.amount),
        notes: 'Parâmetro criado a partir do editor de orçamentos.'
      });
      await queryClient.invalidateQueries({ queryKey: ['budget-options'] });
      toast.success('Parâmetro de precificação salvo para reutilização.');
    } catch (parameterError) {
      toast.error(parameterError instanceof Error ? parameterError.message : 'Não foi possível salvar o parâmetro.');
    }
  };

  const applyPricingParameter = () => {
    const parameter = options.pricingParameters.find((item) => item.id === selectedPricingParameter);
    if (!parameter) return;
    if (parameter.valorCentavos === null || parameter.valorCentavos === undefined) {
      toast.error('Este parâmetro não possui valor monetário em centavos.');
      return;
    }
    const category = COST_CATEGORIES.includes(parameter.categoria) ? parameter.categoria : 'Outros custos';
    setForm((current) => ({
      ...current,
      costs: [...current.costs, {
        ...newCost(),
        category,
        description: `${parameter.nome}${parameter.unidade ? ` (${parameter.unidade})` : ''}`,
        amount: centsToCurrencyInput(parameter.valorCentavos || 0)
      }]
    }));
    toast.success(`Parâmetro “${parameter.nome}” adicionado aos custos.`);
  };

  const clientProjects = options.projects.filter((project) => project.clientId === form.clientId);
  const clientProperties = options.properties.filter((property) => property.clientId === form.clientId);
  const selectedClientName = options.clients.find((client) => client.id === form.clientId)?.name || 'Não informado';
  const preview = calculation.value;
  const netAdjustmentCents = (preview?.globalAdditionCents || 0) - (preview?.globalDiscountCents || 0);

  const errorSection = useMemo<EditorSectionId | null>(() => {
    if (validationIssues.length) return validationIssues[0].section;
    const currentError = error || calculation.error;
    if (!currentError) return null;
    return getBudgetErrorSection(currentError, activeSection);
  }, [activeSection, calculation.error, error, validationIssues]);

  const sectionSummaries: Record<EditorSectionId, string> = {
    header: `${form.description.trim() || 'Sem título'} · validade ${form.validUntil ? formatDate(form.validUntil) : 'não informada'}`,
    client: `${selectedClientName} · ${form.propertyName.trim() || 'imóvel não informado'}`,
    characterization: `${form.serviceType || 'Serviço não informado'} · ${form.municipality.trim() || 'município não informado'}`,
    items: `${form.items.length} item(ns) · ${formatCurrency(preview?.subtotalServicesCents)}`,
    costs: `${form.costs.length} custo(s) · ${formatCurrency(preview?.estimatedCostCents)}`,
    taxes: `${form.taxes.length} imposto(s) · ${formatCurrency(preview?.estimatedTaxesCents)}`,
    fees: `Margem ${formatBasisPoints(preview?.estimatedMarginBasisPoints)} · lucro ${formatCurrency(preview?.estimatedProfitCents)}`,
    payment: `${form.installments.length} parcela(s) · ${form.paymentDescription.trim() || form.paymentType}`,
    summary: `Total do orçamento ${formatCurrency(preview?.totalCents)}`,
    notes: form.internalNotes.trim() || form.clientNotes.trim() ? 'Observações registradas' : 'Nenhuma observação registrada',
    document: form.terms.trim() ? 'Termos e condições preenchidos' : 'Termos ainda não informados'
  };

  const withError = (id: EditorSectionId, status: EditorSectionStatus): EditorSectionStatus => errorSection === id ? { tone: 'error', label: 'Revisar' } : status;
  const hasBudgetValue = Boolean(preview && preview.totalCents > 0);
  const hasDefaultDocumentTerms = !initial && form.terms.trim() === DEFAULT_BUDGET_TERMS;
  const sectionStatuses: Record<EditorSectionId, EditorSectionStatus> = {
    header: withError('header', form.description.trim() && form.issueDate && form.validUntil ? { tone: 'complete', label: 'Concluído' } : { tone: 'progress', label: 'Em preenchimento' }),
    client: withError('client', form.clientId ? { tone: 'complete', label: 'Concluído' } : { tone: 'empty', label: 'Não informado' }),
    characterization: withError('characterization', form.serviceType && form.municipality.trim() ? { tone: 'complete', label: 'Concluído' } : { tone: 'progress', label: 'Em preenchimento' }),
    items: withError('items', form.items.length && form.items.every((item) => item.description.trim()) ? { tone: 'complete', label: 'Concluído' } : form.items.length ? { tone: 'progress', label: 'Em preenchimento' } : { tone: 'empty', label: 'Sem itens' }),
    costs: withError('costs', !form.costs.length ? { tone: 'optional', label: 'Opcional' } : form.costs.every((cost) => cost.description.trim()) ? { tone: 'complete', label: 'Concluído' } : { tone: 'progress', label: 'Em preenchimento' }),
    taxes: withError('taxes', !form.taxes.length ? { tone: 'optional', label: 'Opcional' } : form.taxes.every((tax) => tax.name.trim()) ? { tone: 'complete', label: 'Concluído' } : { tone: 'progress', label: 'Em preenchimento' }),
    fees: withError('fees', hasBudgetValue ? { tone: 'complete', label: 'Calculado' } : { tone: 'empty', label: 'Aguardando valores' }),
    payment: withError('payment', hasBudgetValue && form.installments.length ? { tone: 'complete', label: 'Configurado' } : form.installments.length ? { tone: 'empty', label: 'Aguardando valores' } : { tone: 'empty', label: 'Não configurado' }),
    summary: withError('summary', hasBudgetValue ? { tone: 'complete', label: 'Atualizado' } : { tone: 'empty', label: 'Sem valores' }),
    notes: withError('notes', form.internalNotes.trim() || form.clientNotes.trim() ? { tone: 'complete', label: 'Concluído' } : { tone: 'optional', label: 'Opcional' }),
    document: withError('document', hasDefaultDocumentTerms
      ? { tone: 'optional', label: 'Pré-preenchido' }
      : form.terms.trim()
        ? { tone: 'complete', label: 'Concluído' }
        : { tone: 'optional', label: 'Opcional' })
  };
  const sectionStatus = (id: EditorSectionId) => sectionStatuses[id];
  const completedSectionCount = editorSections.filter((section) => sectionStatuses[section.id].tone === 'complete').length;
  const completionPercentage = Math.round((completedSectionCount / editorSections.length) * 100);

  const toggleSection = (id: EditorSectionId) => {
    if (openSections.has(id) && sectionStatuses[id].tone === 'complete') {
      setHighlightedSection(id);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedSection((current) => current === id ? null : current);
      }, 1400);
    }
    setActiveSection(id);
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigateToSection = (id: EditorSectionId) => {
    setActiveSection(id);
    setOpenSections((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
    requestAnimationFrame(() => scrollSectionIntoEditor(id));
  };

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (presentation === 'page') {
      const updateActiveSection = () => {
        setIsFormScrolled(window.scrollY > 8);
        const trackingLine = window.innerWidth < 768 ? 140 : 80;
        let currentSection = editorSections[0].id;
        for (const section of editorSections) {
          const element = sectionRefs.current[section.id];
          if (!element) continue;
          if (element.getBoundingClientRect().top <= trackingLine) currentSection = section.id;
          else break;
        }
        setActiveSection((current) => current === currentSection ? current : currentSection);
      };
      updateActiveSection();
      window.addEventListener('scroll', updateActiveSection, { passive: true });
      return () => window.removeEventListener('scroll', updateActiveSection);
    }
    const scrollContainer = formRef.current?.parentElement;
    if (!scrollContainer) return;
    const updateActiveSection = () => {
      setIsFormScrolled(scrollContainer.scrollTop > 8);
      const trackingLine = scrollContainer.getBoundingClientRect().top + 72;
      let currentSection = editorSections[0].id;
      for (const section of editorSections) {
        const element = sectionRefs.current[section.id];
        if (!element) continue;
        if (element.getBoundingClientRect().top <= trackingLine) currentSection = section.id;
        else break;
      }
      setActiveSection((current) => current === currentSection ? current : currentSection);
    };
    updateActiveSection();
    scrollContainer.addEventListener('scroll', updateActiveSection, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', updateActiveSection);
  }, [isOpen, presentation]);

  useEffect(() => {
    const behavior = preferredScrollBehavior();
    const activeButtons = formRef.current?.querySelectorAll<HTMLElement>(`[data-budget-nav-section="${activeSection}"]`);
    activeButtons?.forEach((button) => {
      if (button.offsetParent === null) return;
      const scrollContainer = button.closest<HTMLElement>('[data-budget-nav-scroll]');
      if (!scrollContainer) return;
      const containerRect = scrollContainer.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      if (scrollContainer.dataset.budgetNavScroll === 'horizontal') {
        const isVisible = buttonRect.left >= containerRect.left && buttonRect.right <= containerRect.right;
        if (isVisible) return;
        scrollContainer.scrollTo({
          left: Math.max(0, scrollContainer.scrollLeft + buttonRect.left - containerRect.left - (scrollContainer.clientWidth - buttonRect.width) / 2),
          behavior
        });
        return;
      }
      const isVisible = buttonRect.top >= containerRect.top && buttonRect.bottom <= containerRect.bottom;
      if (isVisible) return;
      scrollContainer.scrollTo({
        top: Math.max(0, scrollContainer.scrollTop + buttonRect.top - containerRect.top - (scrollContainer.clientHeight - buttonRect.height) / 2),
        behavior
      });
    });
  }, [activeSection]);

  useEffect(() => {
    if (!isOpen || !isDirty || allowNavigationRef.current) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty, isOpen]);

  useEffect(() => {
    if (discardPromptVisible) discardContinueRef.current?.focus();
  }, [discardPromptVisible]);

  useEffect(() => {
    if (presentation !== 'page' || !isOpen || hasFocusedInitialFieldRef.current) return;
    hasFocusedInitialFieldRef.current = true;
    window.requestAnimationFrame(() => {
      document.getElementById('budget-description')?.focus({ preventScroll: true });
    });
  }, [isOpen, presentation]);

  const requestClose = () => {
    if (saveMutation.isPending) return;
    if (!isDirty) {
      onClose();
      return;
    }
    setShowDiscardConfirm(true);
  };

  const continueEditing = () => {
    if (blocker.state === 'blocked') blocker.reset();
    setShowDiscardConfirm(false);
  };

  const discardChanges = () => {
    allowNavigationRef.current = true;
    setShowDiscardConfirm(false);
    if (blocker.state === 'blocked') blocker.proceed();
    else onClose();
  };

  const handleSubmit = () => {
    setValidationActive(true);
    const issues = validateBudgetForm(form);
    if (issues.length) {
      setError('');
      const firstIssue = issues[0];
      focusErrorSection(firstIssue.section, firstIssue.fieldId);
      return;
    }
    setError('');
    saveMutation.mutate();
  };

  const renderSectionNavigation = (compact = false) => (
    <nav aria-label="Seções do orçamento" className={compact ? 'flex min-w-max snap-x gap-2' : 'space-y-1'}>
      {editorSections.map((section) => {
        const status = sectionStatus(section.id);
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            data-budget-nav-section={section.id}
            onClick={() => navigateToSection(section.id)}
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'geo-focus-ring inline-flex items-center gap-2 rounded-lg text-left text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
              compact ? 'min-h-10 snap-start px-3' : 'min-h-8 w-full px-2.5',
              isActive ? 'bg-blue-50 text-blue-800 dark:!bg-[#18243a] dark:!text-blue-200 dark:ring-1 dark:ring-inset dark:ring-blue-400/20' : 'text-zinc-600 hover:bg-zinc-100 dark:text-[#9ca3af] dark:hover:bg-white/[0.04] dark:hover:text-zinc-200'
            )}
          >
            <span className="w-6 shrink-0 font-mono text-[10px] font-bold tabular-nums">{section.number}</span>
            {status.tone === 'complete' ? <CheckCircle aria-hidden="true" size={14} weight="fill" className="shrink-0 text-emerald-500" /> : status.tone === 'error' ? <WarningCircle aria-hidden="true" size={14} weight="fill" className="shrink-0 text-rose-500" /> : <Circle aria-hidden="true" size={status.tone === 'progress' ? 12 : 11} weight={status.tone === 'progress' ? 'fill' : 'bold'} className={cn('shrink-0', status.tone === 'progress' ? 'text-blue-400' : 'text-zinc-400')} />}
            <span className={compact ? 'whitespace-nowrap' : 'min-w-0 truncate'}>{section.label}</span>
            {!compact && <span className="sr-only">: {status.label}</span>}
          </button>
        );
      })}
    </nav>
  );

  const visibleFormError = error || validationMessage || calculation.error;

  const renderBudgetSummary = (compact = false) => (
    <section
      aria-label="Resumo do or&ccedil;amento"
      className={cn(
        'relative overflow-hidden border border-zinc-200 bg-white transition-shadow duration-200 motion-reduce:transition-none dark:border-[#2b2f38] dark:bg-[#14161c]',
        compact ? 'rounded-xl px-3 py-2' : 'rounded-2xl px-5 py-4',
        isFormScrolled ? 'shadow-md shadow-black/10 dark:shadow-black/30' : 'shadow-sm'
      )}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-turquoise-500" />

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={cn('text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600 dark:text-[#aeb4c0]', compact && 'xl:whitespace-nowrap')}>
            Resumo do or&ccedil;amento
          </h3>
          {!compact && <p className="mt-1 text-[11px] text-zinc-500 dark:text-[#7f8794]">Pr&eacute;via da proposta</p>}
        </div>
        <span className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
          initial
            ? 'bg-brand-primary-50 text-brand-primary-700 dark:bg-brand-primary-500/15 dark:text-brand-primary-300'
            : 'bg-brand-turquoise-500/12 text-brand-turquoise-700 dark:bg-brand-turquoise-500/15 dark:text-brand-turquoise-300'
        )}>
          {initial ? 'Em edi\u00e7\u00e3o' : 'Novo'}
        </span>
      </header>

      <div className={cn('border-zinc-200/80 dark:border-[#2b2f38]', compact ? 'mt-2 border-t pt-2' : 'mt-4 border-y py-3')}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-[#858d99]">
          Investimento previsto
        </p>
        <p
          className={cn('mt-1 truncate font-extrabold leading-none tracking-[-0.035em] text-zinc-950 tabular-nums dark:text-white', compact ? 'text-lg' : 'text-[1.45rem]')}
          title={formatCurrency(preview?.totalCents)}
        >
          {formatCurrency(preview?.totalCents)}
        </p>
      </div>

      {compact ? (
        <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
          {[
            ['Cliente', selectedClientName],
            ['Servi\u00e7o', form.serviceType || 'N\u00e3o informado']
          ].map(([label, value]) => (
            <div key={label} className="col-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-1">
              <dt className="shrink-0 text-zinc-500 after:content-[':'] dark:text-[#858d99]">{label}</dt>
              <dd className="line-clamp-2 min-w-0 break-words font-semibold leading-4 text-zinc-900 dark:text-[#f3f4f6]" title={`${label}: ${value}`}>{value}</dd>
            </div>
          ))}
          {[
            ['Prazo', form.executionDays ? `${form.executionDays} dias` : '\u2014'],
            ['Validade', form.validUntil ? formatDate(form.validUntil) : 'N\u00e3o informada']
          ].map(([label, value]) => (
            <div key={label} className="flex min-w-0 items-baseline gap-1">
              <dt className="shrink-0 text-zinc-500 after:content-[':'] dark:text-[#858d99]">{label}</dt>
              <dd className="min-w-0 truncate font-semibold leading-4 text-zinc-900 dark:text-[#f3f4f6]" title={`${label}: ${value}`}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className="mt-1 grid grid-cols-2 text-xs">
          {[
            ['Cliente', selectedClientName],
            ['Servi\u00e7o', form.serviceType || 'N\u00e3o informado'],
            ['Prazo', form.executionDays ? `${form.executionDays} dias` : '\u2014'],
            ['Validade', form.validUntil ? formatDate(form.validUntil) : 'N\u00e3o informada']
          ].map(([label, value], index) => (
            <div key={label} className={cn('min-w-0 border-t border-zinc-200/70 py-3 dark:border-[#262a32]', index % 2 === 0 ? 'pr-3' : 'border-l pl-3')}>
              <dt className="shrink-0 text-zinc-500 dark:text-[#858d99]">{label}</dt>
              <dd className="mt-1 line-clamp-2 min-w-0 break-words font-semibold leading-snug text-zinc-900 dark:text-[#f3f4f6]" title={`${label}: ${value}`}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );

  return (
    <BudgetEditorShell isOpen={isOpen} onClose={requestClose} closeDisabled={saveMutation.isPending} title={initial ? 'Editar orçamento em rascunho' : 'Novo orçamento'} presentation={presentation}>
      <form
        ref={formRef}
        onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}
        className={cn('min-h-full rounded-xl bg-zinc-50 p-1 dark:bg-[#0b0c0f]', presentation === 'modal' && '-m-1')}
        noValidate
      >
        <p className="sr-only" role="status" aria-live="polite">
          {saveMutation.isPending ? (initial ? 'Atualizando orçamento…' : 'Criando orçamento…') : ''}
        </p>
        {visibleFormError && (
          <div ref={errorRef} tabIndex={-1} className="mb-5">
            <FormError message={visibleFormError} />
          </div>
        )}

        <div className="mb-5 lg:hidden">{renderBudgetSummary()}</div>
        <div className={cn(
          'sticky z-20 -mx-1 mb-5 border-y border-zinc-200 bg-zinc-50/95 backdrop-blur transition-shadow duration-200 motion-reduce:transition-none dark:border-[#272a31] dark:bg-[#0b0c0f]/95 lg:hidden',
          presentation === 'page' ? 'top-[57px] md:top-0' : 'top-0',
          isFormScrolled && 'shadow-[0_10px_24px_-16px_rgba(0,0,0,0.65)]'
        )}>
          <div
            data-budget-nav-scroll="horizontal"
            className="touch-pan-x overflow-x-auto scroll-smooth px-1 py-2 pr-10 overscroll-x-contain"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(148, 163, 184, 0.32) transparent' }}
          >
            {renderSectionNavigation(true)}
          </div>
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-50 via-zinc-50/90 to-transparent dark:from-[#0b0c0f] dark:via-[#0b0c0f]/90" />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden self-stretch lg:block">
            <div className="sticky top-2 space-y-3">
              {renderBudgetSummary(true)}
              <div
                data-budget-nav-scroll="vertical"
                className={cn(
                  'max-h-[calc(88dvh-19rem)] min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white p-2 [scrollbar-gutter:stable] transition-shadow duration-200 motion-reduce:transition-none dark:border-[#272a31] dark:bg-[#13151a]',
                  isFormScrolled ? 'shadow-lg shadow-black/10 dark:shadow-black/30' : 'shadow-sm'
                )}
              >
                <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-[#9ca3af]">Navegação</p>
                  <p className="text-[10px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">{completedSectionCount} de {editorSections.length} seções</p>
                </div>
                <div
                  className="mx-2 mb-2 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.06]"
                  role="progressbar"
                  aria-label="Progresso de preenchimento do orçamento"
                  aria-valuemin={0}
                  aria-valuemax={editorSections.length}
                  aria-valuenow={completedSectionCount}
                >
                  <span
                    className="block h-full rounded-full bg-blue-500 transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
                {renderSectionNavigation()}
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-3 pb-28">
        <EditorSection
          id="header"
          number="1"
          title="Cabeçalho do orçamento"
          description="Identificação comercial, emissão, validade e responsável técnico."
          summary={sectionSummaries.header}
          isOpen={openSections.has('header')}
          isActive={activeSection === 'header'}
          isHighlighted={highlightedSection === 'header'}
          status={sectionStatus('header')}
          onToggle={() => toggleSection('header')}
          onActivate={() => setActiveSection('header')}
          setRef={(node) => { sectionRefs.current.header = node; }}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            <FormField htmlFor="budget-description" label="Título do orçamento" required error={fieldError('budget-description')} className="xl:col-span-2">
              <input id="budget-description" name="description" autoComplete="off" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={fieldClass} {...fieldA11y('budget-description')} />
            </FormField>
            <FormField htmlFor="budget-issue-date" label="Data de emissão" error={fieldError('budget-issue-date')}>
              <DatePickerField id="budget-issue-date" name="issueDate" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} className={fieldClass} {...fieldA11y('budget-issue-date')} />
            </FormField>
            <FormField htmlFor="budget-valid-until" label="Validade até" error={fieldError('budget-valid-until')}>
              <DatePickerField id="budget-valid-until" name="validUntil" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} className={fieldClass} {...fieldA11y('budget-valid-until')} />
            </FormField>
            <FormField htmlFor="budget-technical-lead" label="Responsável técnico" className="md:col-span-2">
              <input id="budget-technical-lead" name="technicalLead" autoComplete="name" value={form.technicalLead} onChange={(event) => setForm({ ...form, technicalLead: event.target.value })} className={fieldClass} />
            </FormField>
            <FormField htmlFor="budget-source" label="Origem">
              <input id="budget-source" name="source" autoComplete="off" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} className={fieldClass} />
            </FormField>
            <FormField htmlFor="budget-execution-days" label="Prazo previsto (dias)" error={fieldError('budget-execution-days')}>
              <NumericInput id="budget-execution-days" name="executionDays" min="0" inputMode="numeric" value={form.executionDays} onChange={(event) => setForm({ ...form, executionDays: event.target.value })} className={fieldClass} {...fieldA11y('budget-execution-days')} />
            </FormField>
          </div>
        </EditorSection>

        <EditorSection
          id="client"
          number="2"
          title="Cliente e imóvel"
          description="O orçamento usa os cadastros reais do GeoGestor; a emissão cria um snapshot histórico."
          summary={sectionSummaries.client}
          isOpen={openSections.has('client')}
          isActive={activeSection === 'client'}
          isHighlighted={highlightedSection === 'client'}
          status={sectionStatus('client')}
          onToggle={() => toggleSection('client')}
          onActivate={() => setActiveSection('client')}
          setRef={(node) => { sectionRefs.current.client = node; }}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField htmlFor="budget-client" label="Cliente" required error={fieldError('budget-client')} className="xl:col-span-2">
              <div className="flex gap-2">
                <FormSelect id="budget-client" name="clientId" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value, projectId: '', propertyId: '' })} className={fieldClass} {...fieldA11y('budget-client')}>
                  <option value="">Selecione…</option>
                  {options.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </FormSelect>
                <button type="button" onClick={() => setShowQuickClient((value) => !value)} className={iconButtonClass} aria-label="Cadastrar novo cliente"><UserPlus aria-hidden="true" size={18} /></button>
              </div>
            </FormField>
            <FormField htmlFor="budget-property" label="Imóvel cadastrado">
              <FormSelect id="budget-property" name="propertyId" value={form.propertyId} onChange={(event) => {
                const property = clientProperties.find((item) => item.id === event.target.value);
                setForm({ ...form, propertyId: event.target.value, propertyName: property?.name || form.propertyName, municipality: property?.municipality || form.municipality });
              }} className={fieldClass}>
                <option value="">Informar manualmente</option>
                {clientProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
              </FormSelect>
            </FormField>
            <FormField htmlFor="budget-project" label="Projeto existente">
              <FormSelect id="budget-project" name="projectId" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} className={fieldClass}>
                <option value="">Criar/vincular na aprovação</option>
                {clientProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </FormSelect>
            </FormField>
          </div>
          {showQuickClient && (
            <div className="rounded-xl border border-brand-border bg-brand-surface-subtle/60 p-4">
              <h4 className="mb-3 text-sm font-semibold text-text-primary">Cadastro rápido de cliente</h4>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <FormSelect aria-label="Tipo de pessoa do novo cliente" name="tipoPessoa" value={quickClient.tipoPessoa} onChange={(event) => setQuickClient({ ...quickClient, tipoPessoa: event.target.value as 'PF' | 'PJ', documento: '' })} className={fieldClass}>
                  <option value="PF">Pessoa física</option>
                  <option value="PJ">Pessoa jurídica</option>
                </FormSelect>
                <input aria-label="Nome ou razão social do novo cliente" placeholder="Nome ou razão social" autoComplete="name" value={quickClient.nome} onChange={(event) => setQuickClient({ ...quickClient, nome: event.target.value })} className={fieldClass} />
                <input aria-label={`${quickClient.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'} do novo cliente`} placeholder={quickClient.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'} name="documento" autoComplete="off" inputMode="numeric" value={quickClient.documento} onChange={(event) => setQuickClient({ ...quickClient, documento: quickClient.tipoPessoa === 'PF' ? formatCpf(event.target.value) : formatCnpj(event.target.value) })} className={fieldClass} />
                <input aria-label="E-mail do novo cliente" placeholder="E-mail" type="email" name="email" autoComplete="email" spellCheck={false} value={quickClient.email} onChange={(event) => setQuickClient({ ...quickClient, email: event.target.value })} className={fieldClass} />
                <input aria-label="Telefone do novo cliente" placeholder="Telefone" type="tel" name="telefone" autoComplete="tel" inputMode="tel" value={quickClient.telefone} onChange={(event) => setQuickClient({ ...quickClient, telefone: formatPhoneBR(event.target.value) })} className={fieldClass} />
                <button type="button" disabled={quickClientMutation.isPending} onClick={() => {
                  const validDocument = quickClient.tipoPessoa === 'PF' ? isValidCpf(quickClient.documento) : isValidCnpj(quickClient.documento);
                  if (!quickClient.nome.trim() || !validDocument || !isValidBrazilianPhone(quickClient.telefone)) {
                    toast.error('Informe nome, documento válido e telefone com DDD para cadastrar o cliente.');
                    return;
                  }
                  quickClientMutation.mutate();
                }} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-4 disabled:opacity-50">{quickClientMutation.isPending ? 'Cadastrando…' : 'Cadastrar cliente'}</button>
              </div>
            </div>
          )}
        </EditorSection>

        <EditorSection
          id="characterization"
          number="3"
          title="Caracterização do serviço"
          description="Dados técnicos do imóvel, logística e método de levantamento."
          summary={sectionSummaries.characterization}
          isOpen={openSections.has('characterization')}
          isActive={activeSection === 'characterization'}
          isHighlighted={highlightedSection === 'characterization'}
          status={sectionStatus('characterization')}
          onToggle={() => toggleSection('characterization')}
          onActivate={() => setActiveSection('characterization')}
          setRef={(node) => { sectionRefs.current.characterization = node; }}
        >
          <FormSection title="Serviço e imóvel" description="Identificação do trabalho e do imóvel considerado na proposta." className="bg-brand-surface-subtle/30">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField htmlFor="budget-service-type" label="Tipo de serviço" required error={fieldError('budget-service-type')} className="md:col-span-2">
                <FormSelect id="budget-service-type" value={form.serviceType} onChange={(event) => applyServiceType(event.target.value)} className={fieldClass} {...fieldA11y('budget-service-type')}>
                  {serviceTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </FormSelect>
              </FormField>
              <FormField htmlFor="budget-property-type" label="Classificação do imóvel">
                <FormSelect id="budget-property-type" value={form.propertyType} onChange={(event) => setForm({ ...form, propertyType: event.target.value as 'rural' | 'urbano' })} className={fieldClass}><option value="rural">Rural</option><option value="urbano">Urbano</option></FormSelect>
              </FormField>
              <FormField htmlFor="budget-property-name" label="Nome do imóvel">
                <input id="budget-property-name" name="propertyName" autoComplete="off" value={form.propertyName} onChange={(event) => setForm({ ...form, propertyName: event.target.value })} className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-municipality" label="Município">
                <input id="budget-municipality" name="municipality" autoComplete="address-level2" value={form.municipality} onChange={(event) => setForm({ ...form, municipality: event.target.value })} className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-state" label="UF">
                <input id="budget-state" name="state" maxLength={2} autoComplete="address-level1" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value.toUpperCase() })} className={fieldClass} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Dimensionamento e complexidade" description="Estimativas que influenciam esforço de campo, prazo e formação do preço." className="bg-brand-surface-subtle/30">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField htmlFor="budget-area" label="Área estimada">
                <input id="budget-area" name="estimatedArea" inputMode="decimal" autoComplete="off" value={form.characterization.estimatedArea} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, estimatedArea: event.target.value } })} className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-vertices" label="Vértices estimados">
                <NumericInput id="budget-vertices" name="estimatedVertices" min="0" inputMode="numeric" autoComplete="off" value={form.characterization.estimatedVertices} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, estimatedVertices: event.target.value } })} className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-neighbors" label="Confrontantes">
                <NumericInput id="budget-neighbors" name="neighbors" min="0" inputMode="numeric" autoComplete="off" value={form.characterization.neighbors} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, neighbors: event.target.value } })} className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-distance" label="Distância operacional (km)">
                <input id="budget-distance" name="distanceKm" inputMode="decimal" autoComplete="off" value={form.characterization.distanceKm} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, distanceKm: event.target.value } })} className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-complexity" label="Complexidade">
                <FormSelect id="budget-complexity" name="complexity" value={form.characterization.complexity} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, complexity: event.target.value } })} className={fieldClass}><option value="baixa">Baixa</option><option value="média">Média</option><option value="alta">Alta</option></FormSelect>
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Método e infraestrutura de campo" description="Recursos técnicos previstos para executar o levantamento." className="bg-brand-surface-subtle/30">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField htmlFor="budget-method" label="Método de levantamento" className="md:col-span-2">
                <input id="budget-method" name="surveyMethod" autoComplete="off" value={form.characterization.surveyMethod} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, surveyMethod: event.target.value } })} placeholder="Ex.: RTK, Estático, Stop and Go, estação total" className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-ground-control" label="Pontos de apoio ou marcos físicos" hint="Pontos materializados fisicamente no terreno.">
                <input id="budget-ground-control" name="physicalGroundControl" autoComplete="off" value={form.characterization.physicalGroundControl} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, physicalGroundControl: event.target.value } })} className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-gnss-base" label="Estação base eletrônica GNSS" hint="Receptor eletrônico utilizado como estação de referência.">
                <input id="budget-gnss-base" name="gnssElectronicBase" autoComplete="off" value={form.characterization.gnssElectronicBase} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, gnssElectronicBase: event.target.value } })} className={fieldClass} />
              </FormField>
              <FormField htmlFor="budget-equipment" label="Equipamentos previstos" className="md:col-span-2">
                <input id="budget-equipment" name="equipment" autoComplete="off" value={form.characterization.equipment} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, equipment: event.target.value } })} className={fieldClass} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Escopo técnico" description="Metodologia proposta e produtos que serão entregues ao cliente." className="bg-brand-surface-subtle/30">
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField htmlFor="budget-methodology" label="Metodologia">
                <textarea id="budget-methodology" name="methodology" rows={4} value={form.methodology} onChange={(event) => setForm({ ...form, methodology: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} />
              </FormField>
              <FormField htmlFor="budget-deliverables" label="Produtos e entregáveis">
                <textarea id="budget-deliverables" name="deliverables" rows={4} value={form.deliverables} onChange={(event) => setForm({ ...form, deliverables: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Logística prevista" description="Necessidades operacionais que podem gerar custos adicionais." className="bg-brand-surface-subtle/30">
            <fieldset className="flex flex-wrap gap-x-6 gap-y-3">
              <legend className="sr-only">Necessidades de logística</legend>
              {[
                ['travelRequired', 'Necessita deslocamento'], ['lodgingRequired', 'Necessita hospedagem'], ['additionalTeam', 'Necessita ajudante ou equipe adicional']
              ].map(([key, label]) => (
                <CheckboxField
                  key={key}
                  id={`budget-${key}`}
                  label={label}
                  checked={Boolean(form.characterization[key as keyof typeof form.characterization])}
                  onChange={(checked) => setForm({ ...form, characterization: { ...form.characterization, [key]: checked } })}
                  compact
                />
              ))}
            </fieldset>
          </FormSection>
        </EditorSection>

        <EditorSection
          id="items"
          number="4"
          title="Itens do orçamento"
          description="Grade editável. Campos monetários são convertidos em centavos; o backend recalcula e valida o total."
          summary={sectionSummaries.items}
          isOpen={openSections.has('items')}
          isActive={activeSection === 'items'}
          isHighlighted={highlightedSection === 'items'}
          status={sectionStatus('items')}
          onToggle={() => toggleSection('items')}
          onActivate={() => setActiveSection('items')}
          setRef={(node) => { sectionRefs.current.items = node; }}
        >
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <section aria-labelledby="budget-template-tools-title" className="rounded-xl border border-brand-border bg-brand-surface-subtle/35 p-4">
              <div className="mb-3">
                <h4 id="budget-template-tools-title" className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Modelos de itens</h4>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Aplique uma composição existente ou salve a lista atual para reutilização.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_auto_auto] md:items-end">
                <FormField htmlFor="budget-template" label="Modelo salvo">
                  <FormSelect id="budget-template" name="template" value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)} className={fieldClass}><option value="">Selecione um modelo…</option>{options.templates.map((template) => <option key={template.id} value={template.id}>{template.nome}</option>)}</FormSelect>
                </FormField>
                <button type="button" disabled={!selectedTemplate} onClick={applyTemplate} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-50">Usar modelo</button>
                <button type="button" onClick={saveTemplate} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4"><FloppyDisk aria-hidden="true" size={17} /> Salvar como modelo</button>
              </div>
            </section>
            <section aria-labelledby="budget-item-tools-title" className="flex flex-col justify-between rounded-xl border border-brand-border bg-brand-surface-subtle/35 p-4">
              <div>
                <h4 id="budget-item-tools-title" className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Itens</h4>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Inclua uma nova linha na proposta.</p>
              </div>
              <button id="budget-add-item" type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyBudgetItem()] })} className="geo-button-base geo-button-primary geo-focus-ring mt-4 min-h-11 px-4" {...fieldA11y('budget-add-item')}><Plus aria-hidden="true" size={17} /> Adicionar item</button>
            </section>
          </div>
          {fieldError('budget-add-item') && <p id="budget-add-item-error" className="text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError('budget-add-item')}</p>}
          <div className="space-y-3">
            {form.items.map((item, index) => {
              const detailsOpen = expandedItemDetails.has(item.id)
                || Boolean(fieldError(`budget-item-discount-${index}`))
                || Boolean(fieldError(`budget-item-addition-${index}`));
              return (
                <article key={item.id} className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-sm">
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border bg-brand-surface-subtle/45 px-4 py-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white">Item {index + 1}</h4>
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{item.description.trim() || 'Descrição ainda não informada'}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <div className="mr-1 text-right">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total</span>
                        <span className="font-mono text-sm font-bold tabular-nums text-brand-green-800 dark:text-brand-green-100">{preview ? formatCurrency(preview.items[index]?.totalCents) : '—'}</span>
                      </div>
                      <button type="button" className={iconButtonClass} onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Mover item ${index + 1} para cima`}><ArrowUp aria-hidden="true" size={15} /></button>
                      <button type="button" className={iconButtonClass} onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1} aria-label={`Mover item ${index + 1} para baixo`}><ArrowDown aria-hidden="true" size={15} /></button>
                      <button type="button" className={iconButtonClass} onClick={() => setForm({ ...form, items: [...form.items.slice(0, index + 1), { ...item, id: crypto.randomUUID() }, ...form.items.slice(index + 1)] })} aria-label={`Duplicar item ${index + 1}`}><Copy aria-hidden="true" size={16} /></button>
                      <button type="button" className={cn(iconButtonClass, 'text-brand-red-600')} onClick={() => setForm({ ...form, items: form.items.filter((candidate) => candidate.id !== item.id) })} aria-label={`Remover item ${index + 1}`}><Trash aria-hidden="true" size={16} /></button>
                    </div>
                  </header>

                  <div className="space-y-4 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)]">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField htmlFor={`budget-item-code-${index}`} label="Código">
                          <input id={`budget-item-code-${index}`} name={`items.${index}.code`} autoComplete="off" value={item.code} onChange={(event) => updateItem(item.id, { code: event.target.value })} className={compactFieldClass} placeholder="Código" />
                        </FormField>
                        <FormField htmlFor={`budget-item-group-${index}`} label="Grupo">
                          <input id={`budget-item-group-${index}`} name={`items.${index}.group`} autoComplete="off" value={item.group} onChange={(event) => updateItem(item.id, { group: event.target.value })} className={compactFieldClass} placeholder="Grupo" />
                        </FormField>
                      </div>
                      <FormField htmlFor={`budget-item-description-${index}`} label="Descrição" required error={fieldError(`budget-item-description-${index}`)}>
                        <textarea id={`budget-item-description-${index}`} name={`items.${index}.description`} rows={3} value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} className={cn(compactFieldClass, 'min-h-24 resize-y py-2')} {...fieldA11y(`budget-item-description-${index}`)} />
                      </FormField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <FormField htmlFor={`budget-item-unit-${index}`} label="Unidade">
                        <FormSelect id={`budget-item-unit-${index}`} name={`items.${index}.unit`} value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} className={compactFieldClass}>{BUDGET_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</FormSelect>
                      </FormField>
                      <FormField htmlFor={`budget-item-quantity-${index}`} label="Quantidade" required error={fieldError(`budget-item-quantity-${index}`)}>
                        <input id={`budget-item-quantity-${index}`} name={`items.${index}.quantity`} inputMode="decimal" autoComplete="off" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y(`budget-item-quantity-${index}`)} />
                      </FormField>
                      <FormField htmlFor={`budget-item-price-${index}`} label="Preço unitário">
                        <input id={`budget-item-price-${index}`} name={`items.${index}.unitPrice`} inputMode="decimal" autoComplete="off" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} />
                      </FormField>
                      <div className="rounded-lg border border-brand-green-200/70 bg-brand-green-50/70 px-3 py-2 dark:border-brand-green-500/20 dark:bg-brand-green-500/10">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-green-700 dark:text-brand-green-200">Total do item</span>
                        <span className="mt-1 block break-words font-mono text-base font-bold tabular-nums text-brand-green-900 dark:text-brand-green-100">{preview ? formatCurrency(preview.items[index]?.totalCents) : '—'}</span>
                      </div>
                    </div>

                    <section className="overflow-hidden rounded-lg border border-brand-border">
                      <h5>
                        <button
                          type="button"
                          aria-expanded={detailsOpen}
                          aria-controls={`budget-item-details-${index}`}
                          onClick={() => setExpandedItemDetails((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                            return next;
                          })}
                          className="geo-focus-ring flex min-h-11 w-full items-center justify-between gap-3 bg-brand-surface-subtle/40 px-3 py-2 text-left text-xs font-bold text-zinc-700 transition-colors hover:bg-brand-surface-subtle dark:text-zinc-200"
                        >
                          <span>Precificação e classificação</span>
                          <CaretDown aria-hidden="true" size={16} weight="bold" className={cn('shrink-0 transition-transform duration-150 motion-reduce:transition-none', detailsOpen && 'rotate-180')} />
                        </button>
                      </h5>
                      <div id={`budget-item-details-${index}`} hidden={!detailsOpen} className="space-y-4 border-t border-brand-border p-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <FormField htmlFor={`budget-item-cost-${index}`} label="Custo unitário">
                            <input id={`budget-item-cost-${index}`} name={`items.${index}.unitCost`} inputMode="decimal" autoComplete="off" value={item.unitCost} onChange={(event) => updateItem(item.id, { unitCost: event.target.value })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} />
                          </FormField>
                          <FormField htmlFor={`budget-item-discount-${index}`} label="Desconto" error={fieldError(`budget-item-discount-${index}`)}>
                            <AdjustmentInput id={`budget-item-discount-${index}`} compact type={item.discountType} value={item.discountValue} typeAriaLabel={`Tipo de desconto do item ${index + 1}`} valueAriaLabel={`Valor do desconto do item ${index + 1}`} onTypeChange={(discountType) => updateItem(item.id, { discountType })} onValueChange={(discountValue) => updateItem(item.id, { discountValue })} invalid={Boolean(fieldError(`budget-item-discount-${index}`))} errorId={fieldError(`budget-item-discount-${index}`) ? `budget-item-discount-${index}-error` : undefined} />
                          </FormField>
                          <FormField htmlFor={`budget-item-addition-${index}`} label="Acréscimo" error={fieldError(`budget-item-addition-${index}`)}>
                            <AdjustmentInput id={`budget-item-addition-${index}`} compact type={item.additionType} value={item.additionValue} typeAriaLabel={`Tipo de acréscimo do item ${index + 1}`} valueAriaLabel={`Valor do acréscimo do item ${index + 1}`} onTypeChange={(additionType) => updateItem(item.id, { additionType })} onValueChange={(additionValue) => updateItem(item.id, { additionValue })} invalid={Boolean(fieldError(`budget-item-addition-${index}`))} errorId={fieldError(`budget-item-addition-${index}`) ? `budget-item-addition-${index}-error` : undefined} />
                          </FormField>
                          <FormField htmlFor={`budget-item-component-${index}`} label="Componente financeiro">
                            <FormSelect id={`budget-item-component-${index}`} name={`items.${index}.component`} value={item.component} onChange={(event) => updateItem(item.id, { component: event.target.value as BudgetFormItem['component'] })} className={compactFieldClass}><option value="servico">Serviço</option><option value="despesa">Despesa cobrada</option><option value="taxa_repassada">Taxa repassada</option></FormSelect>
                          </FormField>
                        </div>
                        <fieldset className="flex flex-wrap gap-x-6 gap-y-3">
                          <legend className="sr-only">Classificação adicional do item {index + 1}</legend>
                          <CheckboxField id={`budget-item-optional-${index}`} label="Item opcional" checked={item.optional} onChange={(optional) => updateItem(item.id, { optional })} compact />
                          <CheckboxField id={`budget-item-taxable-${index}`} label="Item tributável" checked={item.taxable} onChange={(taxable) => updateItem(item.id, { taxable })} compact />
                        </fieldset>
                      </div>
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
        </EditorSection>

        <div className="space-y-3">
          <EditorSection
            id="costs"
            number="5"
            title="Custos internos"
            description="Custos próprios afetam o lucro; reembolsos e taxas são separados dos honorários."
            summary={sectionSummaries.costs}
            isOpen={openSections.has('costs')}
            isActive={activeSection === 'costs'}
            isHighlighted={highlightedSection === 'costs'}
            status={sectionStatus('costs')}
            onToggle={() => toggleSection('costs')}
            onActivate={() => setActiveSection('costs')}
            setRef={(node) => { sectionRefs.current.costs = node; }}
          >
            <div className="flex flex-wrap gap-2"><FormSelect aria-label="Parâmetro de precificação" value={selectedPricingParameter} onChange={(event) => setSelectedPricingParameter(event.target.value)} wrapperClassName="min-w-64 flex-1" className={fieldClass}><option value="">Parâmetro de precificação…</option>{options.pricingParameters.map((parameter) => <option key={parameter.id} value={parameter.id}>{parameter.nome}{parameter.valorCentavos === null || parameter.valorCentavos === undefined ? '' : ` — ${formatCurrency(parameter.valorCentavos)}`}</option>)}</FormSelect><button type="button" disabled={!selectedPricingParameter} onClick={applyPricingParameter} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-50">Aplicar parâmetro</button><button type="button" onClick={() => setForm({ ...form, costs: [...form.costs, newCost()] })} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4"><Plus aria-hidden="true" size={17} /> Adicionar custo</button></div>
            <div className="space-y-3">
              {form.costs.map((cost, index) => (
                <div key={cost.id} className="grid gap-2 rounded-xl border border-brand-border p-3 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_.7fr_1fr_auto]">
                  <FormSelect aria-label={`Categoria do custo ${index + 1}`} value={cost.category} onChange={(event) => setForm({ ...form, costs: form.costs.map((item) => item.id === cost.id ? { ...item, category: event.target.value } : item) })} className={compactFieldClass}>{COST_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</FormSelect>
                  <div><input id={`budget-cost-description-${index}`} aria-label={`Descrição do custo ${index + 1}`} value={cost.description} onChange={(event) => setForm({ ...form, costs: form.costs.map((item) => item.id === cost.id ? { ...item, description: event.target.value } : item) })} className={compactFieldClass} placeholder="Descrição" {...fieldA11y(`budget-cost-description-${index}`)} />{fieldError(`budget-cost-description-${index}`) && <p id={`budget-cost-description-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-cost-description-${index}`)}</p>}</div>
                  <input aria-label={`Valor do custo ${index + 1}`} inputMode="decimal" value={cost.amount} onChange={(event) => setForm({ ...form, costs: form.costs.map((item) => item.id === cost.id ? { ...item, amount: event.target.value } : item) })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums xl:w-36')} />
                  <FormSelect aria-label={`Classificação do custo ${index + 1}`} value={cost.classification} onChange={(event) => setForm({ ...form, costs: form.costs.map((item) => item.id === cost.id ? { ...item, classification: event.target.value as BudgetFormCost['classification'] } : item) })} className={compactFieldClass}><option value="custo_proprio">Custo próprio</option><option value="despesa_reembolsavel">Despesa reembolsável</option><option value="taxa_repassada">Taxa repassada</option></FormSelect>
                  <div className="flex gap-1"><button type="button" className={iconButtonClass} onClick={() => savePricingParameter(cost)} aria-label={`Salvar custo ${index + 1} como parâmetro de precificação`}><FloppyDisk aria-hidden="true" size={16} /></button><button type="button" className={cn(iconButtonClass, 'text-brand-red-600')} onClick={() => setForm({ ...form, costs: form.costs.filter((item) => item.id !== cost.id) })} aria-label={`Remover custo ${index + 1}`}><Trash aria-hidden="true" size={16} /></button></div>
                </div>
              ))}
              {!form.costs.length && <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-text-muted">Nenhum custo interno configurado.</p>}
            </div>
          </EditorSection>

          <EditorSection
            id="taxes"
            number="6"
            title="Impostos"
            description="Imposto previsto não é imposto pago e não altera o caixa."
            summary={sectionSummaries.taxes}
            isOpen={openSections.has('taxes')}
            isActive={activeSection === 'taxes'}
            isHighlighted={highlightedSection === 'taxes'}
            status={sectionStatus('taxes')}
            onToggle={() => toggleSection('taxes')}
            onActivate={() => setActiveSection('taxes')}
            setRef={(node) => { sectionRefs.current.taxes = node; }}
          >
            <div className="flex flex-wrap gap-2"><FormSelect aria-label="Perfil tributário" value={selectedTaxProfile} onChange={(event) => setSelectedTaxProfile(event.target.value)} wrapperClassName="min-w-64 flex-1" className={fieldClass}><option value="">Selecione um perfil…</option>{options.taxProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nome}</option>)}</FormSelect><button type="button" disabled={!selectedTaxProfile} onClick={applyTaxProfile} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-50">Aplicar perfil</button><button type="button" disabled={!form.taxes.length} onClick={saveTaxProfile} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-50"><FloppyDisk aria-hidden="true" size={17} /> Salvar perfil</button><button type="button" onClick={() => setForm({ ...form, taxes: [...form.taxes, newTax()] })} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4"><Plus aria-hidden="true" size={17} /> Imposto</button></div>
            <div className="space-y-3">
              {form.taxes.map((tax, index) => (
                <div key={tax.id} className="grid gap-2 rounded-xl border border-brand-border p-3 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1.2fr)_7rem_8rem_minmax(12rem,1fr)_auto]">
                  <div><input id={`budget-tax-name-${index}`} aria-label={`Nome do imposto ${index + 1}`} value={tax.name} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, name: event.target.value } : item) })} className={compactFieldClass} placeholder="Nome" {...fieldA11y(`budget-tax-name-${index}`)} />{fieldError(`budget-tax-name-${index}`) && <p id={`budget-tax-name-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-name-${index}`)}</p>}</div>
                  <div><input id={`budget-tax-acronym-${index}`} aria-label={`Sigla do imposto ${index + 1}`} value={tax.acronym} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, acronym: event.target.value } : item) })} className={compactFieldClass} placeholder="Sigla" {...fieldA11y(`budget-tax-acronym-${index}`)} />{fieldError(`budget-tax-acronym-${index}`) && <p id={`budget-tax-acronym-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-acronym-${index}`)}</p>}</div>
                  <div><input id={`budget-tax-rate-${index}`} aria-label={`Alíquota do imposto ${index + 1} em porcentagem`} inputMode="decimal" value={tax.ratePercent} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, ratePercent: event.target.value } : item) })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y(`budget-tax-rate-${index}`)} />{fieldError(`budget-tax-rate-${index}`) && <p id={`budget-tax-rate-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-rate-${index}`)}</p>}</div>
                  <div><FormSelect aria-label={`Base de cálculo do imposto ${index + 1}`} value={tax.calculationBase} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, calculationBase: event.target.value as BudgetFormTax['calculationBase'] } : item) })} className={compactFieldClass}><option value="tributavel">Base tributável</option><option value="servicos">Serviços</option><option value="taxas">Taxas</option><option value="total">Total</option></FormSelect><div className="mt-1 flex flex-wrap gap-x-1"><CheckboxField id={`budget-tax-included-${index}`} label="Incluso no preço" checked={tax.includedInPrice} onChange={(includedInPrice) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, includedInPrice } : item) })} compact /><CheckboxField id={`budget-tax-cumulative-${index}`} label="Cumulativo" checked={tax.cumulative} onChange={(cumulative) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, cumulative } : item) })} compact /></div></div>
                  <button type="button" className={cn(iconButtonClass, 'text-brand-red-600')} onClick={() => setForm({ ...form, taxes: form.taxes.filter((item) => item.id !== tax.id) })} aria-label={`Remover imposto ${index + 1}`}><Trash aria-hidden="true" size={16} /></button>
                  <div className="grid gap-2 md:col-span-2 xl:col-span-5 xl:grid-cols-[.8fr_2fr]"><div><input id={`budget-tax-adjustment-${index}`} aria-label={`Ajuste manual do imposto ${index + 1}`} inputMode="decimal" value={tax.manualAdjustment} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, manualAdjustment: event.target.value } : item) })} className={compactFieldClass} placeholder="Ajuste manual (R$)" {...fieldA11y(`budget-tax-adjustment-${index}`)} />{fieldError(`budget-tax-adjustment-${index}`) && <p id={`budget-tax-adjustment-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-adjustment-${index}`)}</p>}</div><div><input id={`budget-tax-adjustment-reason-${index}`} aria-label={`Justificativa do ajuste do imposto ${index + 1}`} value={tax.adjustmentReason} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, adjustmentReason: event.target.value } : item) })} className={compactFieldClass} placeholder="Justificativa obrigatória quando houver ajuste" {...fieldA11y(`budget-tax-adjustment-reason-${index}`)} />{fieldError(`budget-tax-adjustment-reason-${index}`) && <p id={`budget-tax-adjustment-reason-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-adjustment-reason-${index}`)}</p>}</div></div>
                </div>
              ))}
              {!form.taxes.length && <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-text-muted">Nenhum imposto configurado. Itens tributáveis gerarão um alerta.</p>}
            </div>
          </EditorSection>
        </div>

        <div className="space-y-3">
          <EditorSection
            id="fees"
            number="7"
            title="Honorários, margem e ajustes"
            description="Campos calculados são informativos; ajustes comerciais permanecem editáveis."
            summary={sectionSummaries.fees}
            isOpen={openSections.has('fees')}
            isActive={activeSection === 'fees'}
            isHighlighted={highlightedSection === 'fees'}
            status={sectionStatus('fees')}
            onToggle={() => toggleSection('fees')}
            onActivate={() => setActiveSection('fees')}
            setRef={(node) => { sectionRefs.current.fees = node; }}
          >
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <FormField htmlFor="global-discount" label="Desconto global" error={fieldError('global-discount')} className="w-fit"><AdjustmentInput id="global-discount" type={form.globalDiscountType} value={form.globalDiscountValue} typeAriaLabel="Tipo do desconto global" valueAriaLabel="Valor do desconto global" onTypeChange={(globalDiscountType) => setForm({ ...form, globalDiscountType })} onValueChange={(globalDiscountValue) => setForm({ ...form, globalDiscountValue })} invalid={Boolean(fieldError('global-discount'))} errorId={fieldError('global-discount') ? 'global-discount-error' : undefined} /></FormField>
              <FormField htmlFor="global-addition" label="Acréscimo global" error={fieldError('global-addition')} className="w-fit"><AdjustmentInput id="global-addition" type={form.globalAdditionType} value={form.globalAdditionValue} typeAriaLabel="Tipo do acréscimo global" valueAriaLabel="Valor do acréscimo global" onTypeChange={(globalAdditionType) => setForm({ ...form, globalAdditionType })} onValueChange={(globalAdditionValue) => setForm({ ...form, globalAdditionValue })} invalid={Boolean(fieldError('global-addition'))} errorId={fieldError('global-addition') ? 'global-addition-error' : undefined} /></FormField>
            </div>
            <p className="text-xs font-medium leading-5 text-text-muted">Os ajustes globais são aplicados sobre o subtotal faturável — serviços, despesas e taxas repassadas — antes dos impostos.</p>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
              <div className={financialMetricClass('cost', 'p-3')}><dt className="text-xs text-text-muted">Desconto global</dt><dd className={financialValueClass('cost', 'mt-1 font-mono text-base font-semibold tabular-nums')}>{formatSignedCurrency(-(preview?.globalDiscountCents || 0))}</dd></div>
              <div className={financialMetricClass('revenue', 'p-3')}><dt className="text-xs text-text-muted">Acréscimo global</dt><dd className={financialValueClass('revenue', 'mt-1 font-mono text-base font-semibold tabular-nums')}>{formatSignedCurrency(preview?.globalAdditionCents || 0)}</dd></div>
              <div className={financialMetricClass(signedFinancialTone(netAdjustmentCents), 'p-3')}><dt className="text-xs text-text-muted">Ajuste líquido</dt><dd className={financialValueClass(signedFinancialTone(netAdjustmentCents), 'mt-1 font-mono text-base font-semibold tabular-nums')}>{formatSignedCurrency(netAdjustmentCents)}</dd></div>
              <div className={financialMetricClass('info', 'p-3')}><dt className="text-xs text-text-muted">Total previsto</dt><dd className={financialValueClass('info', 'mt-1 font-mono text-base font-semibold tabular-nums')}>{formatCurrency(preview?.totalCents)}</dd></div>
            </dl>
            {(preview?.globalDiscountCents || 0) > 0 && (preview?.globalAdditionCents || 0) > 0 && <p className="flex items-start gap-2 rounded-lg border border-brand-rajah-300 bg-brand-rajah-50 p-3 text-sm font-medium text-brand-rajah-900 dark:border-brand-rajah-300/25 dark:bg-brand-rajah-500/10 dark:text-brand-rajah-100" role="status"><WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" size={17} />Desconto e acréscimo estão ativos. Confira o ajuste líquido antes de emitir.</p>}
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
              {([
                ['Honorários brutos', preview?.grossFeesCents, 'revenue'], ['Impostos previstos', preview?.estimatedTaxesCents, 'cost'],
                ['Custos estimados', preview?.estimatedCostCents, 'cost'], ['Honorários líquidos', preview?.netFeesCents, 'revenue'], ['Lucro estimado', preview?.estimatedProfitCents, signedFinancialTone(preview?.estimatedProfitCents)]
              ] satisfies Array<[string, number | undefined, FinancialTone]>).map(([label, value, tone]) => <div key={label} className={financialMetricClass(tone, 'p-3')}><dt className="text-xs text-text-muted">{label}</dt><dd className={financialValueClass(tone, 'mt-1 font-mono text-base font-semibold tabular-nums')}>{formatCurrency(value)}</dd></div>)}
              <div className={financialMetricClass(signedFinancialTone(preview?.estimatedMarginBasisPoints), 'p-3')}><dt className="text-xs text-text-muted">Margem estimada</dt><dd className={financialValueClass(signedFinancialTone(preview?.estimatedMarginBasisPoints), 'mt-1 font-mono text-base font-semibold tabular-nums')}>{formatBasisPoints(preview?.estimatedMarginBasisPoints)}</dd></div>
              <div className={financialMetricClass('info', 'p-3')}><dt className="text-xs text-text-muted">Markup</dt><dd className={financialValueClass('info', 'mt-1 font-mono text-base font-semibold tabular-nums')}>{preview?.markupBasisPoints === null || preview?.markupBasisPoints === undefined ? 'Não calculável' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(preview.markupBasisPoints / 10_000)}×`}</dd></div>
            </dl>
          </EditorSection>

          <EditorSection
            id="payment"
            number="8–9"
            title="Condições comerciais e pagamento"
            description="A última parcela absorve deterministicamente diferenças de arredondamento."
            summary={sectionSummaries.payment}
            isOpen={openSections.has('payment')}
            isActive={activeSection === 'payment'}
            isHighlighted={highlightedSection === 'payment'}
            status={sectionStatus('payment')}
            onToggle={() => toggleSection('payment')}
            onActivate={() => setActiveSection('payment')}
            setRef={(node) => { sectionRefs.current.payment = node; }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <FormField htmlFor="payment-type" label="Forma"><FormSelect id="payment-type" value={form.paymentType} onChange={(event) => setForm({ ...form, paymentType: event.target.value })} className={fieldClass}><option value="avista">À vista</option><option value="entrada_saldo">Entrada + saldo</option><option value="etapas">Por etapas</option><option value="parcelas">Parcelas</option></FormSelect></FormField>
              <FormField htmlFor="payment-method" label="Meio de pagamento"><input id="payment-method" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} className={fieldClass} /></FormField>
              <FormField htmlFor="financial-account" label="Conta financeira de destino"><input id="financial-account" value={form.financialAccount} onChange={(event) => setForm({ ...form, financialAccount: event.target.value })} className={fieldClass} /></FormField>
              <FormField htmlFor="payment-description" label="Descrição da condição"><input id="payment-description" value={form.paymentDescription} onChange={(event) => setForm({ ...form, paymentDescription: event.target.value })} className={fieldClass} /></FormField>
            </div>
            <div className="flex flex-wrap items-end gap-2"><FormField htmlFor="installment-count" label="Quantidade de parcelas" error={fieldError('installment-count')}><NumericInput id="installment-count" min="1" max="60" inputMode="numeric" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} className={cn(fieldClass, 'w-36')} {...fieldA11y('installment-count')} /></FormField><button type="button" onClick={() => setForm({ ...form, installments: createEqualInstallments(Number(installmentCount) || 1) })} className="geo-button-base geo-button-secondary geo-focus-ring mb-0 min-h-11 px-4">Distribuir igualmente</button></div>
            <div className="space-y-2">
              {form.installments.map((installment, index) => (
                <div key={`${index}-${installment.label}`} className="grid gap-2 rounded-xl border border-brand-border p-3 md:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto]">
                  <input aria-label={`Descrição da parcela ${index + 1}`} value={installment.label || ''} onChange={(event) => setForm({ ...form, installments: form.installments.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} className={compactFieldClass} />
                  <div><input id={`budget-installment-percentage-${index}`} aria-label={`Percentual da parcela ${index + 1}`} inputMode="decimal" value={installment.percentage || ''} onChange={(event) => setForm({ ...form, installments: form.installments.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: event.target.value, valueCents: null } : item) })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y(`budget-installment-percentage-${index}`)} />{fieldError(`budget-installment-percentage-${index}`) && <p id={`budget-installment-percentage-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-installment-percentage-${index}`)}</p>}</div>
                  <div><NumericInput id={`budget-installment-days-${index}`} aria-label={`Dias após aprovação da parcela ${index + 1}`} min="0" inputMode="numeric" value={installment.daysAfterApproval || 0} onChange={(event) => setForm({ ...form, installments: form.installments.map((item, itemIndex) => itemIndex === index ? { ...item, daysAfterApproval: Number(event.target.value), dueDate: null } : item) })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y(`budget-installment-days-${index}`)} />{fieldError(`budget-installment-days-${index}`) && <p id={`budget-installment-days-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-installment-days-${index}`)}</p>}</div>
                  <button type="button" className={cn(iconButtonClass, 'text-brand-red-600')} onClick={() => setForm({ ...form, installments: form.installments.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remover parcela ${index + 1}`}><Trash aria-hidden="true" size={16} /></button>
                </div>
              ))}
            </div>
          </EditorSection>
        </div>

        <EditorSection
          id="summary"
          number="10"
          title="Resumo financeiro"
          description="O total do orçamento não representa honorários líquidos. Receita realizada só existirá após pagamento confirmado."
          summary={sectionSummaries.summary}
          isOpen={openSections.has('summary')}
          isActive={activeSection === 'summary'}
          isHighlighted={highlightedSection === 'summary'}
          status={sectionStatus('summary')}
          onToggle={() => toggleSection('summary')}
          onActivate={() => setActiveSection('summary')}
          setRef={(node) => { sectionRefs.current.summary = node; }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
            {([
              ['Serviços', preview?.subtotalServicesCents, 'revenue'], ['Despesas cobradas', preview?.subtotalExpensesCents, 'cost'], ['Taxas repassadas', preview?.subtotalFeesCents, 'adjustment'],
              ['Base tributável', preview?.taxableBaseCents, 'info'], ['Impostos previstos', preview?.estimatedTaxesCents, 'cost'], ['Reembolsável', preview?.reimbursableCents, 'adjustment'],
              ['Não tributável', preview?.nonTaxableCents, 'info'], ['Total do orçamento', preview?.totalCents, 'revenue']
            ] satisfies Array<[string, number | undefined, FinancialTone]>).map(([label, value, tone], index) => <div key={label} className={financialMetricClass(tone, cn('p-4', index === 7 && 'bg-emerald-50/70 dark:bg-emerald-500/10'))}><dt className="text-xs font-semibold text-text-muted">{label}</dt><dd className={financialValueClass(tone, 'mt-1 font-mono text-lg font-bold tabular-nums')}>{formatCurrency(value)}</dd></div>)}
          </div>
          {preview?.warnings.length ? <div className="space-y-2" role="status">{preview.warnings.map((warning) => <p key={warning} className="flex items-start gap-2 rounded-lg border border-brand-rajah-300 bg-brand-rajah-50 p-3 text-sm font-medium text-brand-rajah-900 dark:border-brand-rajah-300/25 dark:bg-brand-rajah-500/10 dark:text-brand-rajah-100"><WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />{warning}</p>)}</div> : null}
        </EditorSection>

        <div className="space-y-3">
          <EditorSection
            id="notes"
            number="11"
            title="Observações e auditoria"
            description="Observações internas não são exibidas ao cliente."
            summary={sectionSummaries.notes}
            isOpen={openSections.has('notes')}
            isActive={activeSection === 'notes'}
            isHighlighted={highlightedSection === 'notes'}
            status={sectionStatus('notes')}
            onToggle={() => toggleSection('notes')}
            onActivate={() => setActiveSection('notes')}
            setRef={(node) => { sectionRefs.current.notes = node; }}
          >
            <FormField htmlFor="internal-notes" label="Observações internas"><textarea id="internal-notes" rows={4} value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} /></FormField>
            <FormField htmlFor="client-notes" label="Observações visíveis ao cliente"><textarea id="client-notes" rows={4} value={form.clientNotes} onChange={(event) => setForm({ ...form, clientNotes: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} /></FormField>
          </EditorSection>
          <EditorSection
            id="document"
            number="12"
            title="Documento final"
            description="Custos internos, margem e lucro ficam ocultos no PDF enviado ao cliente."
            summary={sectionSummaries.document}
            isOpen={openSections.has('document')}
            isActive={activeSection === 'document'}
            isHighlighted={highlightedSection === 'document'}
            status={sectionStatus('document')}
            onToggle={() => toggleSection('document')}
            onActivate={() => setActiveSection('document')}
            setRef={(node) => { sectionRefs.current.document = node; }}
          >
            <FormField htmlFor="budget-terms" label="Termos e condições"><textarea id="budget-terms" rows={9} value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} /></FormField>
          </EditorSection>
        </div>

          </div>
        </div>

        <FormFooter className={cn(
          '-mx-1 flex-wrap rounded-b-xl border-zinc-200 bg-white/95 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 transition-shadow duration-200 motion-reduce:transition-none dark:border-[#272a31] dark:bg-[#13151a]/95 sm:flex-nowrap sm:px-4',
          isFormScrolled && 'shadow-[0_-10px_24px_-16px_rgba(0,0,0,0.65)]'
        )}>
          {discardPromptVisible ? (
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-sm font-semibold text-brand-rajah-900 dark:text-brand-rajah-100" role="alert">
                Existem altera&ccedil;&otilde;es n&atilde;o salvas. Deseja descart&aacute;-las?
              </p>
              <button ref={discardContinueRef} type="button" onClick={continueEditing} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4">
                Continuar editando
              </button>
              <button type="button" onClick={discardChanges} className="geo-button-base geo-focus-ring min-h-11 border border-red-200 bg-red-50 px-4 text-red-700 hover:bg-red-100 dark:border-red-400/25 dark:bg-red-950/35 dark:text-red-100 dark:hover:bg-red-950/55">
                Descartar altera&ccedil;&otilde;es
              </button>
            </div>
          ) : (
            <>
              <p className="w-full text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:mr-auto sm:w-auto" aria-live="polite">
                {isDirty ? 'Alterações não salvas' : initial ? 'Nenhuma alteração pendente' : 'O orçamento será criado como rascunho'}
              </p>
              <button type="button" onClick={requestClose} disabled={saveMutation.isPending} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 flex-1 px-5 disabled:opacity-50 sm:flex-none">Cancelar</button>
              <button type="submit" disabled={saveMutation.isPending} aria-busy={saveMutation.isPending} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 flex-1 px-6 disabled:opacity-50 sm:flex-none">
                {saveMutation.isPending ? (initial ? 'Atualizando…' : 'Criando…') : (initial ? 'Atualizar orçamento' : 'Criar orçamento')}
              </button>
            </>
          )}
        </FormFooter>
      </form>
    </BudgetEditorShell>
  );
}
