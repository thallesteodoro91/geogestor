import { BUDGET_EDITOR_GROUPS, budgetEditorGroup, budgetIssuesByGroup, type BudgetEditorGroupId } from './budgetEditorGroups';
import './budget-editor.css';
import { budgetRequestError } from './budgetRequestError';
import './budget-workspace.css';
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
import { financialValueClass, signedFinancialTone, type FinancialTone } from '../../utils/financialTone';
import { formatCnpj, formatCpf, formatPhoneBR } from '../../utils/formatters';
import {
  calculateForm,
  centsToCurrencyInput,
  createDefaultBudgetForm,
  currencyInputToCents,
  detailToForm,
  emptyBudgetItem,
  formatBasisPoints,
  formatCurrency,
  formatDate,
  paymentTypeLabel,
  formToPayload,
  validateBudgetForm,
  type BudgetValidationIssue,
  type BudgetValidationSection
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
import { commercialReviewWarnings, executionDeadlineText, installmentAmounts } from './budgetPresentation';

interface BudgetEditorProps {
  isOpen?: boolean;
  onClose: () => void;
  options: BudgetOptions;
  initial?: BudgetDetail | null;
  initialClientId?: string;
  initialTerms?: string | null;
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
const iconButtonClass = 'geo-focus-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-zinc-600 transition-[background-color,color,transform] duration-150 hover:bg-brand-surface-subtle hover:text-zinc-950 active:scale-[0.97] dark:border-[#272a31] dark:bg-[#0f1115] dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-[#171a20] dark:hover:text-white';

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function itemDetailsPopulated(item: BudgetFormItem) {
  return Boolean(item.code.trim() || item.group.trim() || item.component !== 'servico' || item.optional || item.taxable
    || [item.unitCost, item.discountValue, item.additionValue].some(value => /[1-9]/.test(value)));
}

function BudgetSubgroup({ id, title, summary, hasError = false, initiallyOpen = false, children }: {
  id: string; title: string; summary: string; hasError?: boolean; initiallyOpen?: boolean; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(initiallyOpen);
  const open = expanded || hasError;
  return <section className="budget-editor-subgroup">
    <h4><button type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setExpanded(value => !value)} className="geo-focus-ring budget-editor-subgroup-toggle">
      <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block break-words text-xs font-normal text-text-secondary">{hasError ? 'Revisar · ' : ''}{summary}</span></span><CaretDown aria-hidden="true" size={18} className={cn('shrink-0', open && 'rotate-180')} />
    </button></h4>
    <div id={`${id}-content`} hidden={!open} className="budget-editor-subgroup-content">{children}</div>
  </section>;
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

type EditorSectionId = BudgetEditorGroupId;
type EditorSectionTone = 'complete' | 'progress' | 'empty' | 'optional' | 'error';

interface EditorSectionStatus {
  tone: EditorSectionTone;
  label: string;
}

const editorSections = BUDGET_EDITOR_GROUPS;

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
      data-budget-group={id}
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
  if (normalizedError.includes('cliente')) return 'header';
  if (normalizedError.includes('título') || normalizedError.includes('descrição do orçamento')) return 'header';
  if (normalizedError.includes('item')) return 'items';
  if (normalizedError.includes('parcela')) return 'payment';
  if (normalizedError.includes('imposto') || normalizedError.includes('tribut')) return 'fees';
  if (normalizedError.includes('custo')) return 'fees';
  if (normalizedError.includes('desconto') || normalizedError.includes('acréscimo') || normalizedError.includes('margem')) return 'fees';
  return fallback;
}

export function BudgetEditor({ isOpen = true, onClose, options, initial, initialClientId, initialTerms, onSaved, presentation = 'modal' }: BudgetEditorProps) {
  const queryClient = useQueryClient();
  const catalogsQuery = useAuxiliaryCatalogs();
  const formRef = useRef<HTMLFormElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState<BudgetFormState>(() => initial ? detailToForm(initial) : createDefaultBudgetForm(initialClientId || '', initialTerms));
  const [initialFormSnapshot] = useState(() => JSON.stringify(form));
  const [error, setError] = useState('');
  const [validationActive, setValidationActive] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedTaxProfile, setSelectedTaxProfile] = useState('');
  const [selectedPricingParameter, setSelectedPricingParameter] = useState('');
  const [installmentCount, setInstallmentCount] = useState(() => String(initial?.payment?.installments.length || 1));
  const [summaryOpen, setSummaryOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1440px)').matches);
  const navigationRef = useRef<HTMLDivElement>(null);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClient, setQuickClient] = useState({ tipoPessoa: '' as '' | 'PF' | 'PJ', nome: '', documento: '', email: '', telefone: '', endereco: '' });
  const [openSections, setOpenSections] = useState<Set<EditorSectionId>>(() => new Set(['header']));
  const [activeSection, setActiveSection] = useState<EditorSectionId>('header');
  const [expandedItemDetails, setExpandedItemDetails] = useState<Set<string>>(() => new Set());
  const [isFormScrolled, setIsFormScrolled] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<EditorSectionId | null>(null);
  const sectionRefs = useRef<Partial<Record<EditorSectionId, HTMLElement | null>>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardContinueRef = useRef<HTMLButtonElement | null>(null);
  const allowNavigationRef = useRef(false);
  const saveLock = useRef(false);
  const savingStatusRef = useRef<HTMLParagraphElement>(null);
  const hasFocusedInitialFieldRef = useRef(false);
  const isDirty = useMemo(() => JSON.stringify(form) !== initialFormSnapshot, [form, initialFormSnapshot]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    presentation === 'page'
    && (isDirty || saveLock.current)
    && !allowNavigationRef.current
    && `${currentLocation.pathname}${currentLocation.search}` !== `${nextLocation.pathname}${nextLocation.search}`
  ));
  const discardPromptVisible = showDiscardConfirm || blocker.state === 'blocked';
  const serviceTypeOptions = useMemo(() => Array.from(new Set([
    ...(catalogsQuery.data?.services.filter((item) => item.ativo).map((item) => item.nome) ?? []),
    form.serviceType
  ].filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })), [catalogsQuery.data?.services, form.serviceType]);
  const pendingIssues = useMemo(() => validateBudgetForm(form), [form]);
  const validationIssues = useMemo<BudgetValidationIssue[]>(() => validationActive ? pendingIssues : [], [pendingIssues, validationActive]);
  const groupedIssues = budgetIssuesByGroup(pendingIssues);
  const groupHasErrors = (id: EditorSectionId) => validationActive && groupedIssues.some(group => group.id === id && group.issues.length > 0);
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
      const stickyNavigationOffset = (navigationRef.current?.offsetHeight || 80) + (window.innerWidth < 768 ? 76 : 20);
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
    const stickyNavigationOffset = (navigationRef.current?.offsetHeight || 80) + 16;
    scrollContainer.scrollTo({
      top: Math.max(0, scrollContainer.scrollTop + sectionRect.top - containerRect.top - stickyNavigationOffset),
      behavior: preferredScrollBehavior()
    });
  };

  const focusErrorSection = (legacySection: BudgetValidationSection, fieldId?: string) => {
    const sectionId = budgetEditorGroup(legacySection, fieldId);
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
      firstField?.scrollIntoView({ block: 'center', behavior: preferredScrollBehavior() });
      firstField?.focus({ preventScroll: true });
    }));
  };

  const saveMutation = useMutation({
    retry: false,
    onSettled: () => { saveLock.current = false; },
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
      await onSaved(budget);
    },
    onError: (mutationError) => {
      const message = budgetRequestError(mutationError);
      setError(message);
    }
  });

  useEffect(() => {
    if (saveMutation.isPending) savingStatusRef.current?.focus({ preventScroll: true });
  }, [saveMutation.isPending]);

  useEffect(() => {
    if (!error || saveMutation.isPending) return;
    const frame = window.requestAnimationFrame(() => {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [error, saveMutation.isPending]);

  const quickClientMutation = useMutation({
    mutationFn: () => apiClient.post<{ id: string }>('/api/clientes', {
      ...quickClient,
      cpf: quickClient.tipoPessoa === 'PF' ? quickClient.documento : null,
      cnpj: quickClient.tipoPessoa === 'PJ' ? quickClient.documento : null,
      celular: quickClient.telefone,
      situacao: 'Ativo'
    }),
    onSuccess: async (client) => {
      await queryClient.invalidateQueries({ queryKey: ['budget-options'] });
      setForm((current) => ({ ...current, clientId: client.id, projectId: '', propertyId: '' }));
      setShowQuickClient(false);
      setQuickClient({ tipoPessoa: '', nome: '', documento: '', email: '', telefone: '', endereco: '' });
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
      const canSuggestValue = !initial && catalogItem && catalogItem.valorSugerido >= 0 && current.items.length === 1
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
  const installmentPreviewAmounts = useMemo(() => preview ? installmentAmounts(preview.totalCents, form.installments) : [], [preview, form.installments]);
  const commercialWarnings = commercialReviewWarnings(form);
  const netAdjustmentCents = (preview?.globalAdditionCents || 0) - (preview?.globalDiscountCents || 0);

  const errorSection = useMemo<EditorSectionId | null>(() => {
    if (validationIssues.length) return budgetEditorGroup(validationIssues[0].section, validationIssues[0].fieldId);
    // A service failure belongs to the persistent notice, not to an arbitrary field group.
    const currentError = calculation.error;
    if (!currentError) return null;
    return getBudgetErrorSection(currentError, activeSection);
  }, [activeSection, calculation.error, validationIssues]);

  const sectionSummaries: Record<EditorSectionId, string> = {
    header: `${form.description || 'Sem título'} · ${selectedClientName}`,
    characterization: `${form.serviceType || 'Serviço não informado'} · ${form.municipality || 'Município não informado'}`,
    items: `${form.items.length} ${form.items.length === 1 ? 'item' : 'itens'} · ${formatCurrency(preview?.subtotalServicesCents)}`,
    fees: `${form.costs.length} custos · ${form.taxes.length} impostos · Ajuste ${formatSignedCurrency(netAdjustmentCents)}`,
    payment: `${form.installments.length} ${form.installments.length === 1 ? 'parcela' : 'parcelas'} · ${paymentTypeLabel(form.paymentType)}`,
    document: `${form.internalNotes.trim() || form.clientNotes.trim() ? 'Observações registradas' : 'Sem observações'} · ${form.terms.trim() ? 'Termos preenchidos' : 'Termos opcionais'}`
  };
  const sectionStatus = (id: EditorSectionId): EditorSectionStatus => {
    const count = groupedIssues.find(group => group.id === id)?.issues.length || 0;
    if (groupHasErrors(id) || errorSection === id) return { tone: 'error', label: 'Revisar' };
    if (count) return { tone: 'progress', label: `${count} ${count === 1 ? 'pendência' : 'pendências'}` };
    if (id === 'fees' && !form.costs.length && !form.taxes.length) return { tone: 'optional', label: 'Sem pendências' };
    if (id === 'document') return { tone: 'optional', label: 'Revisão e complementos' };
    return { tone: 'complete', label: 'Sem pendências' };
  };
  const toggleSection = (id: EditorSectionId) => {
    if (openSections.has(id) && sectionStatus(id).tone === 'complete') {
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
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollSectionIntoEditor(id);
      sectionRefs.current[id]?.querySelector<HTMLButtonElement>('h3 > button')?.focus({ preventScroll: true });
    }));
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
        const trackingLine = (navigationRef.current?.getBoundingClientRect().bottom || 80) + 24;
        let currentSection: EditorSectionId = editorSections[0].id;
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
      let currentSection: EditorSectionId = editorSections[0].id;
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
    if (!isOpen || (!isDirty && !saveMutation.isPending) || allowNavigationRef.current) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty, isOpen, saveMutation.isPending]);

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

  useEffect(() => {
    if (!isOpen) return;
    void window.electronAPI?.setLicenseDraftState?.('budget-editor', { dirty: isDirty, saving: saveMutation.isPending });
    return () => { void window.electronAPI?.setLicenseDraftState?.('budget-editor', { dirty: false, saving: false }); };
  }, [isDirty, isOpen, saveMutation.isPending]);

  const requestClose = () => {
    if (saveLock.current) return;
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
    if (saveLock.current) return;
    allowNavigationRef.current = true;
    setShowDiscardConfirm(false);
    if (blocker.state === 'blocked') blocker.proceed();
    else onClose();
  };

  const handleSubmit = () => {
    if (saveLock.current) return;
    setValidationActive(true);
    const issues = validateBudgetForm(form);
    if (issues.length) {
      setError('');
      const firstIssue = issues[0];
      focusErrorSection(firstIssue.section, firstIssue.fieldId);
      return;
    }
    setError('');
    saveLock.current = true;
    saveMutation.mutate();
  };

  const renderSectionNavigation = () => (
    <nav aria-label="Grupos do orçamento" className="budget-editor-group-links">
      {editorSections.map(section => <button key={section.id} type="button" data-budget-nav-section={section.id} onClick={() => navigateToSection(section.id)} aria-current={activeSection === section.id ? 'location' : undefined} className="geo-focus-ring budget-editor-group-link">
        <span className="budget-editor-group-number">{section.number}</span><span>{section.label}</span><span className="sr-only"> · {sectionStatus(section.id).label}</span>{groupHasErrors(section.id) && <WarningCircle aria-hidden="true" size={16} className="text-rose-600 dark:text-rose-300" />}
      </button>)}
    </nav>
  );

  const visibleFormError = error || validationMessage || calculation.error;

  const renderBudgetSummary = () => (
    <section aria-label="Resumo do orçamento" className="budget-editor-summary">
      <p className="text-xs font-semibold text-text-secondary">{initial ? 'Rascunho em edição' : 'Nova proposta em rascunho'}</p>
      <details open={summaryOpen} onToggle={event => setSummaryOpen(event.currentTarget.open)} className="budget-editor-summary-details">
        <summary className="geo-focus-ring rounded-lg"><span className="block text-xs text-text-muted">Total da proposta</span><span className="my-2 block break-words font-mono text-2xl font-bold tabular-nums">{formatCurrency(preview?.totalCents)}</span><span className="flex items-center gap-2 text-xs font-semibold text-text-secondary">Cliente e condições <CaretDown aria-hidden="true" size={16} /></span></summary>
        <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-text-muted">Cliente</dt><dd className="break-words font-semibold">{selectedClientName}</dd></div><div><dt className="text-xs text-text-muted">Serviço</dt><dd className="break-words">{form.serviceType || 'Não informado'}</dd></div><div><dt className="text-xs text-text-muted">Validade</dt><dd className="tabular-nums">{formatDate(form.validUntil)}</dd></div><div><dt className="text-xs text-text-muted">Prazo</dt><dd className="break-words">{form.executionDays ? executionDeadlineText(Number(form.executionDays), form.characterization.executionStart) : 'Não informado'}</dd></div><div><dt className="text-xs text-text-muted">Forma de pagamento</dt><dd className="break-words">{paymentTypeLabel(form.paymentType)}{form.paymentMethod ? ` · ${form.paymentMethod}` : ''} · {form.installments.length} {form.installments.length === 1 ? 'parcela' : 'parcelas'}</dd></div></dl>
      </details>
      <details className="budget-internal-analysis"><summary className="geo-focus-ring rounded-lg py-3 text-sm font-semibold">Análise interna</summary><p className="mb-3 text-xs leading-5 text-text-secondary">Indicadores calculados para a gestão. Custos, margem e lucro não compõem o documento do cliente.</p>
        <dl className="space-y-2">{([
          ['Serviços', formatCurrency(preview?.subtotalServicesCents), 'revenue'],
          ['Despesas cobradas', formatCurrency(preview?.subtotalExpensesCents), 'cost'],
          ['Taxas repassadas', formatCurrency(preview?.subtotalFeesCents), 'adjustment'],
          ['Desconto global', formatSignedCurrency(-(preview?.globalDiscountCents || 0)), 'cost'],
          ['Acréscimo global', formatSignedCurrency(preview?.globalAdditionCents || 0), 'revenue'],
          ['Ajuste líquido', formatSignedCurrency(netAdjustmentCents), signedFinancialTone(netAdjustmentCents)],
          ['Total do orçamento', formatCurrency(preview?.totalCents), 'info'],
          ['Base tributável', formatCurrency(preview?.taxableBaseCents), 'info'],
          ['Impostos previstos', formatCurrency(preview?.estimatedTaxesCents), 'cost'],
          ['Reembolsável', formatCurrency(preview?.reimbursableCents), 'adjustment'],
          ['Não tributável', formatCurrency(preview?.nonTaxableCents), 'info'],
          ['Honorários brutos', formatCurrency(preview?.grossFeesCents), 'revenue'],
          ['Custos estimados', formatCurrency(preview?.estimatedCostCents), 'cost'],
          ['Honorários líquidos', formatCurrency(preview?.netFeesCents), 'revenue'],
          ['Lucro estimado', formatCurrency(preview?.estimatedProfitCents), signedFinancialTone(preview?.estimatedProfitCents)],
          ['Margem estimada', formatBasisPoints(preview?.estimatedMarginBasisPoints), signedFinancialTone(preview?.estimatedMarginBasisPoints)],
          ['Markup', preview?.markupBasisPoints == null ? 'Não calculável' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(preview.markupBasisPoints / 10_000)}×`, 'info']
        ] satisfies Array<[string, string, FinancialTone]>).map(([label, value, tone]) => <div key={label}><dt className="text-xs text-text-secondary">{label}</dt><dd className={financialValueClass(tone, 'mt-1 font-mono font-semibold tabular-nums')}>{value}</dd></div>)}</dl>
      </details>
    </section>
  );
  return (
    <BudgetEditorShell isOpen={isOpen} onClose={requestClose} closeDisabled={saveMutation.isPending} title={initial ? 'Editar orçamento em rascunho' : 'Novo orçamento'} presentation={presentation}>
      <form
        ref={formRef}
        onKeyDownCapture={(event) => { if (saveLock.current && event.key === 'Tab') { event.preventDefault(); savingStatusRef.current?.focus({ preventScroll: true }); } }}
        onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}
        className={cn('budget-editor min-h-full rounded-xl bg-zinc-50 p-1 dark:bg-[#0b0c0f]', presentation === 'modal' && '-m-1')}
        noValidate
      >
        <p ref={savingStatusRef} tabIndex={-1} className="sr-only" role="status" aria-live="polite">
          {saveMutation.isPending ? (initial ? 'Atualizando orçamento…' : 'Criando orçamento…') : ''}
        </p>
        <fieldset disabled={saveMutation.isPending} className="m-0 min-w-0 border-0 p-0">
        {visibleFormError && (
          <div ref={errorRef} tabIndex={-1} className="geo-focus-ring mb-5 scroll-mt-28 rounded-lg">
            <FormError message={visibleFormError} />
          </div>
        )}
        {!!commercialWarnings.length && <aside aria-label="Revisão das condições comerciais" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100" aria-live="polite">
          <p className="font-semibold">Revise as condições comerciais</p>
          <p className="mt-1">Possíveis divergências detectadas. Seus textos e dados foram preservados.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{commercialWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        </aside>}

<div ref={navigationRef} className="budget-editor-navigation">
 <div className="budget-editor-navigation-heading"><p className="text-sm font-semibold">Preenchimento da proposta</p><p className="text-xs text-text-secondary" aria-label="Pendências do orçamento">{pendingIssues.length ? `${pendingIssues.length} ${pendingIssues.length === 1 ? 'pendência' : 'pendências'} de validação` : 'Nenhuma pendência de validação'} · Informações complementares são opcionais</p></div>
 <div className="budget-editor-nav-wide">{renderSectionNavigation()}</div>
 <div className="budget-editor-nav-compact"><p aria-hidden="true" className="mb-2 text-xs text-text-secondary">6 grupos · {pendingIssues.length ? `${pendingIssues.length} ${pendingIssues.length === 1 ? 'pendência' : 'pendências'}` : 'Sem pendências'}</p><label htmlFor="budget-group" className="sr-only">Ir para o grupo</label><FormSelect id="budget-group" value={activeSection} onChange={event => navigateToSection(event.target.value as EditorSectionId)} className="w-full min-h-11">{editorSections.map(group => <option key={group.id} value={group.id}>{group.number} de 6 · {group.label}{groupHasErrors(group.id) ? ' · Revisar' : ''}</option>)}</FormSelect></div>
 </div>
 <div className="budget-editor-layout"><aside className="budget-editor-aside">{renderBudgetSummary()}</aside><div className="budget-editor-content"><EditorSection id="header" number="1" title="Dados da proposta" description="Identifique a proposta e selecione o cliente e seus vínculos." summary={sectionSummaries.header} isOpen={openSections.has('header') || groupHasErrors('header')} isActive={activeSection === 'header'} isHighlighted={highlightedSection === 'header'} status={sectionStatus('header')} onToggle={() => toggleSection('header')} onActivate={() => setActiveSection('header')} setRef={node => { sectionRefs.current.header = node; }}>
          <div className="budget-basic-fields">
            <FormField htmlFor="budget-description" label="Título da proposta" hint="Identifique a proposta. Descreva o trabalho no campo de escopo técnico." required error={fieldError('budget-description')} className="col-span-full">
              <input id="budget-description" name="description" autoComplete="off" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={fieldClass} {...fieldA11y('budget-description')} />
            </FormField>
            <FormField htmlFor="budget-issue-date" label="Data de emissão" error={fieldError('budget-issue-date')}>
              <DatePickerField id="budget-issue-date" name="issueDate" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} className={fieldClass} {...fieldA11y('budget-issue-date')} />
            </FormField>
            <FormField htmlFor="budget-valid-until" label="Validade até" error={fieldError('budget-valid-until')}>
              <DatePickerField id="budget-valid-until" name="validUntil" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} className={fieldClass} {...fieldA11y('budget-valid-until')} />
            </FormField>
            
            <FormField htmlFor="budget-source" label="Origem">
              <input id="budget-source" name="source" autoComplete="off" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} className={fieldClass} />
            </FormField>
            
            
            
          </div>
        <FormSection headingLevel={4} title="Cliente e vínculos">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <FormField htmlFor="budget-client" label="Cliente" required error={fieldError('budget-client')} className="2xl:col-span-2">
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
              <div className="budget-quick-client">
                <FormSelect aria-label="Tipo de pessoa do novo cliente" name="tipoPessoa" value={quickClient.tipoPessoa} onChange={(event) => setQuickClient({ ...quickClient, tipoPessoa: event.target.value as '' | 'PF' | 'PJ', documento: '' })} className={fieldClass}>
                  <option value="">Selecione o tipo de pessoa</option>
                  <option value="PF">Pessoa física</option>
                  <option value="PJ">Pessoa jurídica</option>
                </FormSelect>
                <input aria-label="Nome ou razão social do novo cliente" placeholder="Nome ou razão social" autoComplete="name" value={quickClient.nome} onChange={(event) => setQuickClient({ ...quickClient, nome: event.target.value })} className={fieldClass} />
                <input aria-label={`${quickClient.tipoPessoa === 'PF' ? 'CPF' : quickClient.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF ou CNPJ'} do novo cliente`} placeholder={quickClient.tipoPessoa === 'PF' ? 'CPF' : quickClient.tipoPessoa === 'PJ' ? 'CNPJ' : 'Selecione o tipo'} name="documento" autoComplete="off" inputMode="numeric" disabled={!quickClient.tipoPessoa} value={quickClient.documento} onChange={(event) => setQuickClient({ ...quickClient, documento: quickClient.tipoPessoa === 'PF' ? formatCpf(event.target.value) : formatCnpj(event.target.value) })} className={fieldClass} />
                <input aria-label="E-mail do novo cliente" placeholder="E-mail" type="email" name="email" autoComplete="email" spellCheck={false} value={quickClient.email} onChange={(event) => setQuickClient({ ...quickClient, email: event.target.value })} className={fieldClass} />
                <input aria-label="Telefone do novo cliente" placeholder="Telefone" type="tel" name="telefone" autoComplete="tel" inputMode="tel" value={quickClient.telefone} onChange={(event) => setQuickClient({ ...quickClient, telefone: formatPhoneBR(event.target.value) })} className={fieldClass} />
                <button type="button" disabled={quickClientMutation.isPending} onClick={() => {
                  const validDocument = quickClient.tipoPessoa === 'PF' ? isValidCpf(quickClient.documento) : quickClient.tipoPessoa === 'PJ' ? isValidCnpj(quickClient.documento) : false;
                  if (!quickClient.tipoPessoa || !quickClient.nome.trim() || !validDocument || !isValidBrazilianPhone(quickClient.telefone)) {
                    toast.error('Selecione o tipo de pessoa e informe nome, documento válido e telefone com DDD.');
                    return;
                  }
                  quickClientMutation.mutate();
                }} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-4 disabled:opacity-50">{quickClientMutation.isPending ? 'Cadastrando…' : 'Cadastrar cliente'}</button>
              </div>
            </div>
          )}
        </FormSection></EditorSection>
<EditorSection id="characterization" number="2" title="Escopo técnico" description="Defina o serviço, os prazos e as condições técnicas da execução." summary={sectionSummaries.characterization} isOpen={openSections.has('characterization') || groupHasErrors('characterization')} isActive={activeSection === 'characterization'} isHighlighted={highlightedSection === 'characterization'} status={sectionStatus('characterization')} onToggle={() => toggleSection('characterization')} onActivate={() => setActiveSection('characterization')} setRef={node => { sectionRefs.current.characterization = node; }}><FormSection headingLevel={4} title="Responsável e prazos" description="Informe quem responde pelo trabalho e como o prazo de execução será contado."><div className="budget-basic-fields"><FormField htmlFor="budget-technical-lead" label="Responsável técnico" className="col-span-full">
              <input id="budget-technical-lead" name="technicalLead" autoComplete="name" value={form.technicalLead} onChange={(event) => setForm({ ...form, technicalLead: event.target.value })} className={fieldClass} />
            </FormField>
<FormField htmlFor="budget-execution-days" label="Prazo de execução (dias)" error={fieldError('budget-execution-days')}>
              <NumericInput id="budget-execution-days" name="executionDays" min="0" inputMode="numeric" value={form.executionDays} onChange={(event) => setForm({ ...form, executionDays: event.target.value })} className={fieldClass} {...fieldA11y('budget-execution-days')} />
            </FormField>
<FormField htmlFor="budget-execution-start" label="Início do prazo de execução" hint="Escolha a condição a partir da qual o prazo será contado." className="col-span-full">
              <FormSelect id="budget-execution-start" name="executionStart" value={form.characterization.executionStart?.type || ''} onChange={(event) => {
                const type = event.target.value;
                const executionStart = type === 'approval' || type === 'initial_payment' ? { type } as const
                  : type === 'custom' ? { type: 'custom' as const, description: '' } : undefined;
                setForm({ ...form, characterization: { ...form.characterization, executionStart } });
              }} className={fieldClass}>
                <option value="">Não definido</option>
                <option value="approval">Aprovação da proposta</option>
                <option value="initial_payment">Pagamento inicial</option>
                <option value="custom">Outra condição</option>
              </FormSelect>
            </FormField>
{form.characterization.executionStart?.type === 'custom' && <FormField htmlFor="budget-execution-start-description" label="Condição de início do prazo" required error={fieldError('budget-execution-start-description')} className="col-span-full">
              <textarea id="budget-execution-start-description" name="executionStartDescription" rows={2} value={form.characterization.executionStart.description} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, executionStart: { type: 'custom', description: event.target.value } } })} className={cn(fieldClass, 'resize-y py-3')} {...fieldA11y('budget-execution-start-description')} />
            </FormField>}</div></FormSection>
          <BudgetSubgroup id="technical-service" title="Serviço e imóvel" summary={`${form.serviceType || 'Serviço não informado'} · ${form.propertyName || 'Imóvel não informado'}`} hasError={validationActive && validationIssues.some(issue => issue.section === 'characterization')} initiallyOpen={true}>
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
          </BudgetSubgroup>

          <BudgetSubgroup id="technical-dimensions" title="Dimensionamento e complexidade" summary={`${[form.characterization.estimatedArea, form.characterization.estimatedVertices, form.characterization.neighbors, form.characterization.distanceKm].filter(Boolean).length} informações · complexidade ${form.characterization.complexity}`} hasError={false} initiallyOpen={false}>
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
          </BudgetSubgroup>

          <BudgetSubgroup id="technical-method" title="Método e infraestrutura de campo" summary={[form.characterization.surveyMethod, form.characterization.equipment, form.characterization.physicalGroundControl, form.characterization.gnssElectronicBase].filter(Boolean).length + ' informações preenchidas'} hasError={false} initiallyOpen={false}>
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
          </BudgetSubgroup>

          <BudgetSubgroup id="technical-scope" title="Escopo técnico" summary={`${[form.characterization.scopeDescription, form.methodology, form.deliverables].filter(value => value.trim()).length} textos preenchidos`} hasError={false} initiallyOpen={false}>
            <FormField htmlFor="budget-scope" label="Descrição do escopo" hint="Descreva o serviço e seus limites. Este texto será incluído no PDF.">
              <textarea id="budget-scope" name="scopeDescription" rows={3} value={form.characterization.scopeDescription || ''} onChange={(event) => setForm({ ...form, characterization: { ...form.characterization, scopeDescription: event.target.value } })} className={cn(fieldClass, 'resize-y py-3')} />
            </FormField>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField htmlFor="budget-methodology" label="Metodologia">
                <textarea id="budget-methodology" name="methodology" rows={4} value={form.methodology} onChange={(event) => setForm({ ...form, methodology: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} />
              </FormField>
              <FormField htmlFor="budget-deliverables" label="Produtos e entregáveis">
                <textarea id="budget-deliverables" name="deliverables" rows={4} value={form.deliverables} onChange={(event) => setForm({ ...form, deliverables: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} />
              </FormField>
            </div>
          </BudgetSubgroup>

          <BudgetSubgroup id="technical-logistics" title="Logística prevista" summary={`${[form.characterization.travelRequired, form.characterization.lodgingRequired, form.characterization.additionalTeam].filter(Boolean).length} necessidades selecionadas`} hasError={false} initiallyOpen={false}>
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
          </BudgetSubgroup>
        </EditorSection>
<EditorSection id="items" number="3" title="Itens e preços" description="Descreva os serviços e confira quantidades, preços e totais." summary={sectionSummaries.items} isOpen={openSections.has('items') || groupHasErrors('items')} isActive={activeSection === 'items'} isHighlighted={highlightedSection === 'items'} status={sectionStatus('items')} onToggle={() => toggleSection('items')} onActivate={() => setActiveSection('items')} setRef={node => { sectionRefs.current.items = node; }}>
          <div className="budget-item-tools">
            <section aria-labelledby="budget-template-tools-title" className="rounded-xl border border-brand-border bg-brand-surface-subtle/35 p-4">
              <div className="mb-3">
                <h4 id="budget-template-tools-title" className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Modelos de itens</h4>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Aplique uma composição existente ou salve a lista atual para reutilização.</p>
              </div>
              <div className="budget-template-actions">
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
          <div className="budget-items-list space-y-3">
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
                      
                      <button type="button" className={iconButtonClass} onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Mover item ${index + 1} para cima`}><ArrowUp aria-hidden="true" size={15} /></button>
                      <button type="button" className={iconButtonClass} onClick={() => moveItem(index, 1)} disabled={index === form.items.length - 1} aria-label={`Mover item ${index + 1} para baixo`}><ArrowDown aria-hidden="true" size={15} /></button>
                      <button type="button" className={iconButtonClass} onClick={() => setForm({ ...form, items: [...form.items.slice(0, index + 1), { ...item, id: crypto.randomUUID() }, ...form.items.slice(index + 1)] })} aria-label={`Duplicar item ${index + 1}`}><Copy aria-hidden="true" size={16} /></button>
                      <button type="button" className={cn(iconButtonClass, 'text-brand-red-600')} onClick={() => setForm({ ...form, items: form.items.filter((candidate) => candidate.id !== item.id) })} aria-label={`Remover item ${index + 1}`}><Trash aria-hidden="true" size={16} /></button>
                    </div>
                  </header>

                  <div className="space-y-4 p-4">
<div className="budget-item-basic"><FormField htmlFor={`budget-item-description-${index}`} label="Descrição" required error={fieldError(`budget-item-description-${index}`)}>
                        <textarea id={`budget-item-description-${index}`} name={`items.${index}.description`} rows={2} value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} className={cn(compactFieldClass, 'min-h-11 resize-y py-2')} {...fieldA11y(`budget-item-description-${index}`)} />
                      </FormField>
<FormField htmlFor={`budget-item-quantity-${index}`} label="Quantidade" required error={fieldError(`budget-item-quantity-${index}`)}>
                        <input id={`budget-item-quantity-${index}`} name={`items.${index}.quantity`} inputMode="decimal" autoComplete="off" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y(`budget-item-quantity-${index}`)} />
                      </FormField>
<FormField htmlFor={`budget-item-unit-${index}`} label="Unidade">
                        <FormSelect id={`budget-item-unit-${index}`} name={`items.${index}.unit`} value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} className={compactFieldClass}>{BUDGET_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</FormSelect>
                      </FormField>
<FormField htmlFor={`budget-item-price-${index}`} label="Preço unitário">
                        <input id={`budget-item-price-${index}`} name={`items.${index}.unitPrice`} inputMode="decimal" autoComplete="off" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} />
                      </FormField><div className="rounded-lg border border-brand-green-200/70 bg-brand-green-50/70 px-3 py-2 dark:border-brand-green-500/20 dark:bg-brand-green-500/10">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-green-700 dark:text-brand-green-200">Total do item</span>
                        <span className="mt-1 block break-words font-mono text-base font-bold tabular-nums text-brand-green-900 dark:text-brand-green-100">{preview ? formatCurrency(preview.items[index]?.totalCents) : '—'}</span>
                      </div></div>
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
                          <span>Detalhes do item{itemDetailsPopulated(item) ? ' · Configurado' : ' · Opcional'}</span>
                          <CaretDown aria-hidden="true" size={16} weight="bold" className={cn('shrink-0 transition-transform duration-150 motion-reduce:transition-none', detailsOpen && 'rotate-180')} />
                        </button>
                      </h5>
                      <div id={`budget-item-details-${index}`} hidden={!detailsOpen} className="space-y-4 border-t border-brand-border p-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><FormField htmlFor={`budget-item-code-${index}`} label="Código">
                          <input id={`budget-item-code-${index}`} name={`items.${index}.code`} autoComplete="off" value={item.code} onChange={(event) => updateItem(item.id, { code: event.target.value })} className={compactFieldClass} placeholder="Código" />
                        </FormField><FormField htmlFor={`budget-item-group-${index}`} label="Grupo">
                          <input id={`budget-item-group-${index}`} name={`items.${index}.group`} autoComplete="off" value={item.group} onChange={(event) => updateItem(item.id, { group: event.target.value })} className={compactFieldClass} placeholder="Grupo" />
                        </FormField>
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
<EditorSection id="fees" number="4" title="Formação do preço" description="Organize os custos internos, os impostos e os ajustes comerciais." summary={sectionSummaries.fees} isOpen={openSections.has('fees') || groupHasErrors('fees')} isActive={activeSection === 'fees'} isHighlighted={highlightedSection === 'fees'} status={sectionStatus('fees')} onToggle={() => toggleSection('fees')} onActivate={() => setActiveSection('fees')} setRef={node => { sectionRefs.current.fees = node; }}><BudgetSubgroup id="pricing-costs" title="Custos internos" summary={`${form.costs.length} ${form.costs.length === 1 ? 'custo' : 'custos'} · ${formatCurrency(preview?.estimatedCostCents)}`} hasError={validationIssues.some(issue => issue.section === 'costs')} initiallyOpen={false}>
            <div className="flex flex-wrap gap-2"><FormSelect aria-label="Parâmetro de precificação" value={selectedPricingParameter} onChange={(event) => setSelectedPricingParameter(event.target.value)} wrapperClassName="min-w-64 flex-1" className={fieldClass}><option value="">Parâmetro de precificação…</option>{options.pricingParameters.map((parameter) => <option key={parameter.id} value={parameter.id}>{parameter.nome}{parameter.valorCentavos === null || parameter.valorCentavos === undefined ? '' : ` — ${formatCurrency(parameter.valorCentavos)}`}</option>)}</FormSelect><button type="button" disabled={!selectedPricingParameter} onClick={applyPricingParameter} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-50">Aplicar parâmetro</button><button type="button" onClick={() => setForm({ ...form, costs: [...form.costs, newCost()] })} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4"><Plus aria-hidden="true" size={17} /> Adicionar custo</button></div>
            <div className="space-y-3">
              {form.costs.map((cost, index) => (
                <div key={cost.id} className="budget-cost-row grid gap-3 rounded-xl border border-brand-border p-3">
                  <FormSelect aria-label={`Categoria do custo ${index + 1}`} value={cost.category} onChange={(event) => setForm({ ...form, costs: form.costs.map((item) => item.id === cost.id ? { ...item, category: event.target.value } : item) })} className={compactFieldClass}>{COST_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</FormSelect>
                  <div><input id={`budget-cost-description-${index}`} aria-label={`Descrição do custo ${index + 1}`} value={cost.description} onChange={(event) => setForm({ ...form, costs: form.costs.map((item) => item.id === cost.id ? { ...item, description: event.target.value } : item) })} className={compactFieldClass} placeholder="Descrição" {...fieldA11y(`budget-cost-description-${index}`)} />{fieldError(`budget-cost-description-${index}`) && <p id={`budget-cost-description-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-cost-description-${index}`)}</p>}</div>
                  <input aria-label={`Valor do custo ${index + 1}`} inputMode="decimal" value={cost.amount} onChange={(event) => setForm({ ...form, costs: form.costs.map((item) => item.id === cost.id ? { ...item, amount: event.target.value } : item) })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums xl:w-36')} />
                  <FormSelect aria-label={`Classificação do custo ${index + 1}`} value={cost.classification} onChange={(event) => setForm({ ...form, costs: form.costs.map((item) => item.id === cost.id ? { ...item, classification: event.target.value as BudgetFormCost['classification'] } : item) })} className={compactFieldClass}><option value="custo_proprio">Custo próprio</option><option value="despesa_reembolsavel">Despesa reembolsável</option><option value="taxa_repassada">Taxa repassada</option></FormSelect>
                  <div className="flex gap-1"><button type="button" className={iconButtonClass} onClick={() => savePricingParameter(cost)} aria-label={`Salvar custo ${index + 1} como parâmetro de precificação`}><FloppyDisk aria-hidden="true" size={16} /></button><button type="button" className={cn(iconButtonClass, 'text-brand-red-600')} onClick={() => setForm({ ...form, costs: form.costs.filter((item) => item.id !== cost.id) })} aria-label={`Remover custo ${index + 1}`}><Trash aria-hidden="true" size={16} /></button></div>
                </div>
              ))}
              {!form.costs.length && <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-text-muted">Nenhum custo interno configurado.</p>}
            </div>
          </BudgetSubgroup><BudgetSubgroup id="pricing-taxes" title="Impostos" summary={`${form.taxes.length} ${form.taxes.length === 1 ? 'imposto' : 'impostos'} · ${formatCurrency(preview?.estimatedTaxesCents)}`} hasError={validationIssues.some(issue => issue.section === 'taxes')} initiallyOpen={false}>
            <div className="flex flex-wrap gap-2"><FormSelect aria-label="Perfil tributário" value={selectedTaxProfile} onChange={(event) => setSelectedTaxProfile(event.target.value)} wrapperClassName="min-w-64 flex-1" className={fieldClass}><option value="">Selecione um perfil…</option>{options.taxProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nome}</option>)}</FormSelect><button type="button" disabled={!selectedTaxProfile} onClick={applyTaxProfile} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-50">Aplicar perfil</button><button type="button" disabled={!form.taxes.length} onClick={saveTaxProfile} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 disabled:opacity-50"><FloppyDisk aria-hidden="true" size={17} /> Salvar perfil</button><button type="button" onClick={() => setForm({ ...form, taxes: [...form.taxes, newTax()] })} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4"><Plus aria-hidden="true" size={17} /> Imposto</button></div>
            <div className="budget-tax-list space-y-3">
              {form.taxes.map((tax, index) => (
                <div key={tax.id} className="grid gap-2 rounded-xl border border-brand-border p-3 budget-tax-fields">
                  <div><input id={`budget-tax-name-${index}`} aria-label={`Nome do imposto ${index + 1}`} value={tax.name} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, name: event.target.value } : item) })} className={compactFieldClass} placeholder="Nome" {...fieldA11y(`budget-tax-name-${index}`)} />{fieldError(`budget-tax-name-${index}`) && <p id={`budget-tax-name-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-name-${index}`)}</p>}</div>
                  <div><input id={`budget-tax-acronym-${index}`} aria-label={`Sigla do imposto ${index + 1}`} value={tax.acronym} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, acronym: event.target.value } : item) })} className={compactFieldClass} placeholder="Sigla" {...fieldA11y(`budget-tax-acronym-${index}`)} />{fieldError(`budget-tax-acronym-${index}`) && <p id={`budget-tax-acronym-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-acronym-${index}`)}</p>}</div>
                  <div><input id={`budget-tax-rate-${index}`} aria-label={`Alíquota do imposto ${index + 1} em porcentagem`} inputMode="decimal" value={tax.ratePercent} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, ratePercent: event.target.value } : item) })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y(`budget-tax-rate-${index}`)} />{fieldError(`budget-tax-rate-${index}`) && <p id={`budget-tax-rate-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-rate-${index}`)}</p>}</div>
                  <div><FormSelect aria-label={`Base de cálculo do imposto ${index + 1}`} value={tax.calculationBase} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, calculationBase: event.target.value as BudgetFormTax['calculationBase'] } : item) })} className={compactFieldClass}><option value="tributavel">Base tributável</option><option value="servicos">Serviços</option><option value="taxas">Taxas</option><option value="total">Total</option></FormSelect><div className="mt-1 flex flex-wrap gap-x-1"><CheckboxField id={`budget-tax-included-${index}`} label="Incluso no preço" checked={tax.includedInPrice} onChange={(includedInPrice) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, includedInPrice } : item) })} compact /><CheckboxField id={`budget-tax-cumulative-${index}`} label="Cumulativo" checked={tax.cumulative} onChange={(cumulative) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, cumulative } : item) })} compact /></div></div>
                  <button type="button" className={cn(iconButtonClass, 'budget-tax-remove text-brand-red-600')} onClick={() => setForm({ ...form, taxes: form.taxes.filter((item) => item.id !== tax.id) })} aria-label={`Remover imposto ${index + 1}`}><Trash aria-hidden="true" size={16} /></button>
                  <div className="grid gap-2 col-span-full sm:grid-cols-[.8fr_2fr]"><div><input id={`budget-tax-adjustment-${index}`} aria-label={`Ajuste manual do imposto ${index + 1}`} inputMode="decimal" value={tax.manualAdjustment} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, manualAdjustment: event.target.value } : item) })} className={compactFieldClass} placeholder="Ajuste manual (R$)" {...fieldA11y(`budget-tax-adjustment-${index}`)} />{fieldError(`budget-tax-adjustment-${index}`) && <p id={`budget-tax-adjustment-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-adjustment-${index}`)}</p>}</div><div><input id={`budget-tax-adjustment-reason-${index}`} aria-label={`Justificativa do ajuste do imposto ${index + 1}`} value={tax.adjustmentReason} onChange={(event) => setForm({ ...form, taxes: form.taxes.map((item) => item.id === tax.id ? { ...item, adjustmentReason: event.target.value } : item) })} className={compactFieldClass} placeholder="Justificativa obrigatória quando houver ajuste" {...fieldA11y(`budget-tax-adjustment-reason-${index}`)} />{fieldError(`budget-tax-adjustment-reason-${index}`) && <p id={`budget-tax-adjustment-reason-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-tax-adjustment-reason-${index}`)}</p>}</div></div>
                </div>
              ))}
              {!form.taxes.length && <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-text-muted">Nenhum imposto configurado. Itens tributáveis gerarão um alerta.</p>}
            </div>
          </BudgetSubgroup><BudgetSubgroup id="pricing-adjustments" title="Descontos e acréscimos globais" summary={`Desconto ${form.globalDiscountValue} · Acréscimo ${form.globalAdditionValue}`} hasError={validationIssues.some(issue => issue.section === 'fees')} initiallyOpen={true}>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <FormField htmlFor="global-discount" label="Desconto global" error={fieldError('global-discount')} className="w-fit"><AdjustmentInput id="global-discount" type={form.globalDiscountType} value={form.globalDiscountValue} typeAriaLabel="Tipo do desconto global" valueAriaLabel="Valor do desconto global" onTypeChange={(globalDiscountType) => setForm({ ...form, globalDiscountType })} onValueChange={(globalDiscountValue) => setForm({ ...form, globalDiscountValue })} invalid={Boolean(fieldError('global-discount'))} errorId={fieldError('global-discount') ? 'global-discount-error' : undefined} /></FormField>
              <FormField htmlFor="global-addition" label="Acréscimo global" error={fieldError('global-addition')} className="w-fit"><AdjustmentInput id="global-addition" type={form.globalAdditionType} value={form.globalAdditionValue} typeAriaLabel="Tipo do acréscimo global" valueAriaLabel="Valor do acréscimo global" onTypeChange={(globalAdditionType) => setForm({ ...form, globalAdditionType })} onValueChange={(globalAdditionValue) => setForm({ ...form, globalAdditionValue })} invalid={Boolean(fieldError('global-addition'))} errorId={fieldError('global-addition') ? 'global-addition-error' : undefined} /></FormField>
            </div>
            <p className="text-xs font-medium leading-5 text-text-muted">Os ajustes globais são aplicados sobre o subtotal faturável — serviços, despesas e taxas repassadas — antes dos impostos.</p>
            
            {(preview?.globalDiscountCents || 0) > 0 && (preview?.globalAdditionCents || 0) > 0 && <p className="flex items-start gap-2 rounded-lg border border-brand-rajah-300 bg-brand-rajah-50 p-3 text-sm font-medium text-brand-rajah-900 dark:border-brand-rajah-300/25 dark:bg-brand-rajah-500/10 dark:text-brand-rajah-100" role="status"><WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" size={17} />Desconto e acréscimo estão ativos. Confira o ajuste líquido antes de emitir.</p>}
            
          </BudgetSubgroup></EditorSection>
<EditorSection id="payment" number="5" title="Pagamento" description="Confira a forma, as parcelas e os vencimentos da proposta." summary={sectionSummaries.payment} isOpen={openSections.has('payment') || groupHasErrors('payment')} isActive={activeSection === 'payment'} isHighlighted={highlightedSection === 'payment'} status={sectionStatus('payment')} onToggle={() => toggleSection('payment')} onActivate={() => setActiveSection('payment')} setRef={node => { sectionRefs.current.payment = node; }}>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField htmlFor="payment-type" label="Forma"><FormSelect id="payment-type" value={form.paymentType} onChange={(event) => setForm({ ...form, paymentType: event.target.value })} className={fieldClass}><option value="avista">À vista</option><option value="entrada_saldo">Entrada + saldo</option><option value="etapas">Por etapas</option><option value="parcelas">Parcelas</option></FormSelect></FormField>
              <FormField htmlFor="payment-method" label="Meio de pagamento visível ao cliente"><input id="payment-method" name="paymentMethod" autoComplete="off" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} className={fieldClass} placeholder="Ex.: PIX, transferência ou boleto" /></FormField>
              <FormField htmlFor="financial-account" label="Conta financeira interna (não exportada)" hint="Usada somente nos efeitos financeiros do GeoGestor."><input id="financial-account" name="financialAccount" autoComplete="off" value={form.financialAccount} onChange={(event) => setForm({ ...form, financialAccount: event.target.value })} className={fieldClass} /></FormField>
              <FormField htmlFor="payment-description" label="Condição complementar" hint="Use para acordos adicionais. Forma, percentuais e vencimentos vêm das parcelas."><input id="payment-description" name="paymentDescription" autoComplete="off" value={form.paymentDescription} onChange={(event) => setForm({ ...form, paymentDescription: event.target.value })} className={fieldClass} /></FormField>
            </div>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Encargos e benefícios comerciais</legend>
              <p className="mb-3 text-xs leading-5 text-text-muted">Informe percentuais de 0% a 100%. Somente valores diferentes de zero aparecem no documento do cliente.</p>
              <div className="budget-payment-charges">
                <FormField htmlFor="payment-interest" label="Juros (%)" error={fieldError('payment-interest')}>
                  <input id="payment-interest" name="interestPercent" inputMode="decimal" value={form.interestBasisPoints} onChange={(event) => setForm({ ...form, interestBasisPoints: event.target.value })} className={cn(fieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y('payment-interest')} />
                </FormField>
                <FormField htmlFor="payment-fine" label="Multa (%)" error={fieldError('payment-fine')}>
                  <input id="payment-fine" name="finePercent" inputMode="decimal" value={form.fineBasisPoints} onChange={(event) => setForm({ ...form, fineBasisPoints: event.target.value })} className={cn(fieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y('payment-fine')} />
                </FormField>
                <FormField htmlFor="payment-early-discount" label="Desconto por antecipação (%)" error={fieldError('payment-early-discount')}>
                  <input id="payment-early-discount" name="earlyDiscountPercent" inputMode="decimal" value={form.earlyDiscountBasisPoints} onChange={(event) => setForm({ ...form, earlyDiscountBasisPoints: event.target.value })} className={cn(fieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y('payment-early-discount')} />
                </FormField>
              </div>
            </fieldset>
            <div className="budget-payment-count flex flex-wrap items-end gap-2"><FormField htmlFor="installment-count" label="Quantidade de parcelas" error={fieldError('installment-count')}><NumericInput id="installment-count" min="1" max="60" inputMode="numeric" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} className={cn(fieldClass, 'w-36')} {...fieldA11y('installment-count')} /></FormField><button type="button" onClick={() => setForm({ ...form, installments: createEqualInstallments(Number(installmentCount) || 1) })} className="geo-button-base geo-button-secondary geo-focus-ring mb-0 min-h-11 px-4">Distribuir igualmente</button></div>
            <div className="budget-payment-installments space-y-2">
              {form.installments.map((installment, index) => (
                <div key={`${index}-${installment.label}`} className="grid gap-2 rounded-xl border border-brand-border p-3 budget-installment-fields">
                  <input aria-label={`Descrição da parcela ${index + 1}`} value={installment.label || ''} onChange={(event) => setForm({ ...form, installments: form.installments.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} className={compactFieldClass} />
                  <div><input id={`budget-installment-percentage-${index}`} aria-label={`Percentual da parcela ${index + 1}`} inputMode="decimal" value={installment.percentage || ''} onChange={(event) => setForm({ ...form, installments: form.installments.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: event.target.value, valueCents: null } : item) })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y(`budget-installment-percentage-${index}`)} /><p className="mt-1 text-right text-xs font-semibold text-text-primary tabular-nums" aria-label={`Valor da parcela ${index + 1}`} aria-live="polite">{installmentPreviewAmounts[index] != null ? formatCurrency(installmentPreviewAmounts[index]) : 'Valor a calcular'}</p>{fieldError(`budget-installment-percentage-${index}`) && <p id={`budget-installment-percentage-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-installment-percentage-${index}`)}</p>}</div>
                  <div>{installment.dueDate ? <DatePickerField id={`budget-installment-date-${index}`} aria-label={`Vencimento da parcela ${index + 1}`} value={installment.dueDate} onChange={(event) => setForm({ ...form, installments: form.installments.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value || null } : item) })} className={compactFieldClass} /> : <NumericInput id={`budget-installment-days-${index}`} aria-label={`Dias após aprovação da parcela ${index + 1}`} min="0" inputMode="numeric" value={installment.daysAfterApproval || 0} onChange={(event) => setForm({ ...form, installments: form.installments.map((item, itemIndex) => itemIndex === index ? { ...item, daysAfterApproval: Number(event.target.value), dueDate: null } : item) })} className={cn(compactFieldClass, 'text-right font-mono tabular-nums')} {...fieldA11y(`budget-installment-days-${index}`)} />}{fieldError(`budget-installment-days-${index}`) && <p id={`budget-installment-days-${index}-error`} className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300" role="alert">{fieldError(`budget-installment-days-${index}`)}</p>}</div>
                  <button type="button" className={cn(iconButtonClass, 'budget-installment-remove text-brand-red-600')} onClick={() => setForm({ ...form, installments: form.installments.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remover parcela ${index + 1}`}><Trash aria-hidden="true" size={16} /></button>
                </div>
              ))}
            </div>
          </EditorSection>
<EditorSection id="document" number="6" title="Revisão e documento" description="Revise os dados e complete as informações destinadas ao cliente." summary={sectionSummaries.document} isOpen={openSections.has('document') || groupHasErrors('document')} isActive={activeSection === 'document'} isHighlighted={highlightedSection === 'document'} status={sectionStatus('document')} onToggle={() => toggleSection('document')} onActivate={() => setActiveSection('document')} setRef={node => { sectionRefs.current.document = node; }}><div className="budget-review-overview"><p className="text-sm font-semibold text-text-primary">Confira antes de salvar o rascunho</p><p className="mt-2 break-words text-sm text-text-secondary">{selectedClientName} · {form.description || 'Título ainda não informado'}</p><p className="mt-2 text-sm tabular-nums">{formatCurrency(preview?.totalCents)} · {paymentTypeLabel(form.paymentType)} · {form.installments.length} {form.installments.length === 1 ? 'parcela' : 'parcelas'}</p><p className="mt-2 text-sm text-text-secondary">O orçamento será salvo como rascunho. Contas a receber e recebimentos seguem os fluxos existentes de aprovação e pagamento.</p></div>{preview?.warnings.length ? <div className="space-y-2" role="status">{preview.warnings.map((warning) => <p key={warning} className="flex items-start gap-2 rounded-lg border border-brand-rajah-300 bg-brand-rajah-50 p-3 text-sm font-medium text-brand-rajah-900 dark:border-brand-rajah-300/25 dark:bg-brand-rajah-500/10 dark:text-brand-rajah-100"><WarningCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />{warning}</p>)}</div> : null}
        <FormSection headingLevel={4} title="Observações" description="Mantenha separadas as informações internas e as que serão apresentadas ao cliente.">
            <FormField htmlFor="internal-notes" label="Observações internas"><textarea id="internal-notes" rows={4} value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} /></FormField>
            <FormField htmlFor="client-notes" label="Observações visíveis ao cliente"><textarea id="client-notes" rows={4} value={form.clientNotes} onChange={(event) => setForm({ ...form, clientNotes: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} /></FormField>
          </FormSection><FormSection headingLevel={4} title="Termos da proposta" description="Custos internos, margem e lucro ficam na gestão; os termos compõem o documento do cliente.">
            <FormField htmlFor="budget-terms" label="Termos e condições" hint="Reserve para condições complementares de execução e escopo. A validade e o pagamento já constam no resumo comercial."><textarea id="budget-terms" name="terms" rows={9} value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} className={cn(fieldClass, 'resize-y py-3')} /></FormField>
          </FormSection></EditorSection></div></div>
        </fieldset>
        <FormFooter className={cn(
          'budget-editor-footer -mx-1 flex-wrap rounded-b-xl border-zinc-200 bg-white/95 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 transition-shadow duration-200 motion-reduce:transition-none dark:border-[#272a31] dark:bg-[#13151a]/95 sm:flex-nowrap sm:px-4',
          isFormScrolled && 'shadow-[0_-10px_24px_-16px_rgba(0,0,0,0.65)]'
        )}>
          {discardPromptVisible ? (
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-sm font-semibold text-brand-rajah-900 dark:text-brand-rajah-100" role="alert">
                Existem altera&ccedil;&otilde;es n&atilde;o salvas. Deseja descart&aacute;-las?
              </p>
              <button ref={discardContinueRef} type="button" onClick={continueEditing} disabled={saveMutation.isPending} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4">
                Continuar editando
              </button>
              <button type="button" onClick={discardChanges} disabled={saveMutation.isPending} className="geo-button-base geo-focus-ring min-h-11 border border-red-200 bg-red-50 px-4 text-red-700 hover:bg-red-100 dark:border-red-400/25 dark:bg-red-950/35 dark:text-red-100 dark:hover:bg-red-950/55">
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
                <span className="budget-stable-label"><span aria-hidden="true" className={saveMutation.isPending ? 'invisible' : ''}>{initial ? 'Atualizar orçamento' : 'Criar orçamento'}</span><span className={saveMutation.isPending ? '' : 'sr-only'}>{saveMutation.isPending ? 'Salvando…' : initial ? 'Atualizar orçamento' : 'Criar orçamento'}</span></span>
              </button>
            </>
          )}
        </FormFooter>
      </form>
    </BudgetEditorShell>
  );
}
