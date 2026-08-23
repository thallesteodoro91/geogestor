import { Buildings, CaretDown, Check, CheckCircle, ClipboardText, Handshake, IdentificationCard, MapPin, NotePencil, Phone, User, WarningCircle, WhatsappLogo
} from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { isValidBrazilianPhone, isValidCep, isValidCnpj, isValidCpf } from '@geogestor/contracts';
import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { FormSelect, SwitchField } from '../../components/Form';
import { formatCnpj, formatCpf, formatPhoneBR, onlyDigits } from '../../utils/formatters';
import { geoFieldClass } from '../../utils/geoTheme';
import {
  CLIENT_PRIMARY_ORIGIN_OPTIONS,
  CLIENT_PROFILE_OPTIONS,
  CLIENT_SERVICOS_BY_CATEGORY,
  CLIENT_STATUS_OPTIONS
} from '../../utils/clientTags';
import { formatCep, type ClientFormErrors, type ClientFormState } from './clientForm';
import { ClientFormSection } from './ClientFormSection';

interface ClienteFormFieldsProps {
  form: ClientFormState;
  setForm: Dispatch<SetStateAction<ClientFormState>>;
  errors: ClientFormErrors;
  activeSection: 'basico' | 'notas';
  editing: boolean;
  onClearErrors: (...fields: Array<keyof ClientFormState>) => void;
}

const fieldClass = cn(
  geoFieldClass,
  'min-h-11 w-full px-3.5 py-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-primary-400'
);
const labelClass = 'mb-1.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-200';
const selectionGridClass = 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3';

const ErrorMessage = ({ field, errors }: { field: keyof ClientFormState; errors: ClientFormErrors }) => {
  const message = errors[field];
  return message ? <p id={`client-${field}-error`} className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-300">{message}</p> : null;
};

type FeedbackTone = 'success' | 'warning';

interface FieldFeedbackValue {
  message: string;
  tone: FeedbackTone;
}

const describedBy = (
  field: keyof ClientFormState,
  errors: ClientFormErrors,
  feedback?: FieldFeedbackValue | null
) => [
  errors[field] ? `client-${field}-error` : '',
  feedback && !errors[field] ? `client-${field}-feedback` : ''
].filter(Boolean).join(' ') || undefined;

const FIELD_LABELS: Partial<Record<keyof ClientFormState, string>> = {
  tipoPessoa: 'Tipo de pessoa',
  nome: 'Nome completo ou razão social',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  celular: 'Celular ou telefone',
  telefone: 'Telefone adicional',
  celularWhatsapp: 'WhatsApp',
  cep: 'CEP',
  uf: 'UF',
  indicadoPor: 'Quem indicou',
  origemDetalhe: 'Descrição da origem'
};

type ClientFormSectionId = 'client-section-identification' | 'client-section-contact' | 'client-section-address' | 'client-section-commercial' | 'client-section-admin';

interface ClientFormNavigationItem {
  id: ClientFormSectionId;
  label: string;
  fields: Array<keyof ClientFormState>;
}

const BASE_FORM_SECTIONS: ClientFormNavigationItem[] = [
  { id: 'client-section-identification', label: 'Identificação', fields: ['tipoPessoa', 'nome', 'cpf', 'cnpj', 'rg', 'inscricaoEstadual', 'perfis'] },
  { id: 'client-section-contact', label: 'Contato', fields: ['email', 'celular', 'telefone', 'celularWhatsapp'] },
  { id: 'client-section-address', label: 'Endereço', fields: ['cep', 'endereco', 'numero', 'semNumero', 'complemento', 'bairro', 'municipio', 'uf'] },
  { id: 'client-section-commercial', label: 'Comercial', fields: ['origemPrincipal', 'indicadoPor', 'origemDetalhe', 'servicos'] }
];

const ADMIN_FORM_SECTION: ClientFormNavigationItem = {
  id: 'client-section-admin',
  label: 'Administrativo',
  fields: ['situacao']
};

function FieldFeedback({
  field,
  feedback,
  hasError
}: {
  field: keyof ClientFormState;
  feedback?: FieldFeedbackValue | null;
  hasError: boolean;
}) {
  if (!feedback || hasError) return null;
  const success = feedback.tone === 'success';

  return (
    <p
      id={`client-${field}-feedback`}
      className={cn(
        'mt-1.5 flex items-center gap-1.5 text-xs font-semibold',
        success ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
      )}
    >
      {success
        ? <CheckCircle aria-hidden="true" weight="fill" className="h-4 w-4 shrink-0" />
        : <WarningCircle aria-hidden="true" weight="fill" className="h-4 w-4 shrink-0" />}
      {feedback.message}
    </p>
  );
}

const documentFeedback = (
  value: string,
  expectedDigits: number,
  valid: boolean,
  label: 'CPF' | 'CNPJ'
): FieldFeedbackValue | null => {
  if (!value) return null;
  const digitCount = onlyDigits(value).length;
  if (valid) return { message: `${label} válido.`, tone: 'success' };
  if (digitCount < expectedDigits) return { message: `${label} incompleto: ${digitCount} de ${expectedDigits} dígitos.`, tone: 'warning' };
  return { message: `Revise os dígitos do ${label}.`, tone: 'warning' };
};

const phoneFeedback = (value: string, label: string): FieldFeedbackValue | null => {
  if (!value) return null;
  return isValidBrazilianPhone(value)
    ? { message: `${label} com DDD completo.`, tone: 'success' }
    : { message: `${label} incompleto: inclua o DDD e 10 ou 11 dígitos.`, tone: 'warning' };
};

const emailFeedback = (value: string): FieldFeedbackValue | null => {
  if (!value) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? { message: 'Formato de e-mail válido.', tone: 'success' }
    : { message: 'Complete o e-mail no formato nome@dominio.com.', tone: 'warning' };
};

const cepFeedback = (value: string): FieldFeedbackValue | null => {
  if (!value) return null;
  return isValidCep(value)
    ? { message: 'Formato de CEP completo.', tone: 'success' }
    : { message: `CEP incompleto: ${onlyDigits(value).length} de 8 dígitos.`, tone: 'warning' };
};

interface PersonTypeOptionProps {
  value: 'PF' | 'PJ';
  label: string;
  description: string;
  icon: ReactNode;
  checked: boolean;
  onChange: () => void;
}

function PersonTypeOption({ value, label, description, icon, checked, onChange }: PersonTypeOptionProps) {
  return (
    <label className="relative min-w-0 cursor-pointer">
      <input
        id={`client-tipo-${value.toLowerCase()}`}
        type="radio"
        name="tipoPessoa"
        value={value}
        checked={checked}
        onChange={onChange}
        required
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex min-h-14 items-center gap-3 rounded-lg border bg-brand-surface px-3 py-2.5 text-left transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-indigo-300 hover:bg-indigo-50/40 active:scale-[0.99] peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-400/10 dark:peer-focus-visible:ring-offset-zinc-900',
          checked
            ? 'border-indigo-400 bg-indigo-50/80 text-indigo-950 shadow-sm dark:border-indigo-300/45 dark:bg-indigo-400/15 dark:text-indigo-100'
            : 'border-brand-border text-zinc-700 dark:text-zinc-200'
        )}
      >
        <span aria-hidden="true" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', checked ? 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-indigo-950' : 'bg-brand-surface-subtle text-zinc-500 dark:text-zinc-300')}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{label}</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
        </span>
        <CheckCircle aria-hidden="true" weight={checked ? 'fill' : 'regular'} className={cn('h-5 w-5 shrink-0', checked ? 'text-indigo-600 dark:text-indigo-300' : 'text-zinc-300 dark:text-zinc-600')} />
      </span>
    </label>
  );
}

interface CheckCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  tone?: 'indigo' | 'emerald';
}

function CheckCard({ name, value, checked, onChange, tone = 'indigo' }: CheckCardProps) {
  const selectedClass = tone === 'emerald'
    ? 'border-emerald-500 bg-emerald-100 text-emerald-950 shadow-sm dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100'
    : 'border-indigo-500 bg-indigo-100 text-indigo-950 shadow-sm dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-100';
  const indicatorClass = tone === 'emerald'
    ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950'
    : 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-indigo-950';
  const focusClass = tone === 'emerald'
    ? 'peer-focus-visible:ring-emerald-500'
    : 'peer-focus-visible:ring-indigo-500';

  return (
    <label className="relative min-w-0 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex min-h-11 items-center gap-2.5 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm font-semibold text-zinc-700 transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-brand-primary-300/70 hover:bg-brand-surface-subtle active:scale-[0.99] peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 dark:text-zinc-200 dark:peer-focus-visible:ring-offset-zinc-900',
          focusClass,
          checked && selectedClass
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border bg-brand-surface text-transparent',
            checked ? indicatorClass : 'border-brand-border-strong dark:border-zinc-500'
          )}
        >
          {checked && <Check weight="bold" className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 break-words leading-snug">{value}</span>
      </span>
    </label>
  );
}

interface ServiceCategoryProps {
  category: string;
  services: string[];
  selectedServices: string[];
  open: boolean;
  onToggle: () => void;
  onServiceToggle: (service: string) => void;
}

function ServiceCategory({
  category,
  services,
  selectedServices,
  open,
  onToggle,
  onServiceToggle
}: ServiceCategoryProps) {
  const categoryId = `client-services-${category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const selectedCount = services.filter((service) => selectedServices.includes(service)).length;

  return (
    <fieldset className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface-subtle/35">
      <legend className="sr-only">{category}</legend>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={categoryId}
        onClick={onToggle}
        className="geo-focus-ring flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-[background-color,color] duration-150 hover:bg-brand-surface-subtle"
      >
        <span className="min-w-0 flex-1 text-sm font-bold text-zinc-800 dark:text-zinc-100">{category}</span>
        <span className={cn(
          'rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
          selectedCount > 0
            ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-100'
            : 'border-brand-border bg-brand-surface text-zinc-500 dark:text-zinc-400'
        )}>
          {selectedCount > 0 ? `${selectedCount} selecionado${selectedCount === 1 ? '' : 's'}` : 'Nenhum selecionado'}
        </span>
        <CaretDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={categoryId} className={cn(selectionGridClass, 'border-t border-brand-border p-3')}>
          {services.map((service) => (
            <CheckCard
              key={service}
              name="servicos"
              value={service}
              checked={selectedServices.includes(service)}
              onChange={() => onServiceToggle(service)}
              tone="emerald"
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

export function ClienteFormFields({ form, setForm, errors, activeSection, editing, onClearErrors }: ClienteFormFieldsProps) {
  const formSections = useMemo(
    () => editing ? [...BASE_FORM_SECTIONS, ADMIN_FORM_SECTION] : BASE_FORM_SECTIONS,
    [editing]
  );
  const [activeFormSection, setActiveFormSection] = useState<ClientFormSectionId>('client-section-identification');
  const [openServiceCategories, setOpenServiceCategories] = useState<Set<string>>(() => {
    const selectedCategories = Object.entries(CLIENT_SERVICOS_BY_CATEGORY)
      .filter(([, services]) => services.some((service) => form.servicos.includes(service)))
      .map(([category]) => category);
    return new Set(selectedCategories.length > 0 ? selectedCategories : [Object.keys(CLIENT_SERVICOS_BY_CATEGORY)[0]]);
  });

  const update = <K extends keyof ClientFormState>(field: K, value: ClientFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    onClearErrors(field);
  };

  const toggleArrayValue = (field: 'perfis' | 'servicos', value: string) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value]
    }));
  };

  const scrollToFormSection = (sectionId: ClientFormSectionId, focusTarget?: HTMLElement | null) => {
    const scrollRegion = document.getElementById('client-form-scroll-region');
    const section = document.getElementById(sectionId);
    if (!scrollRegion || !section) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const regionRect = scrollRegion.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const targetTop = scrollRegion.scrollTop + sectionRect.top - regionRect.top - 64;
    focusTarget?.focus({ preventScroll: true });
    scrollRegion.scrollTo({ top: Math.max(0, targetTop), behavior: reduceMotion ? 'auto' : 'smooth' });
    setActiveFormSection(sectionId);
  };

  const focusErrorField = (field: keyof ClientFormState) => {
    const section = formSections.find((item) => item.fields.includes(field));
    if (!section) return;
    const fieldId = field === 'tipoPessoa' ? 'client-tipo-pf' : `client-${field}`;
    scrollToFormSection(section.id, document.getElementById(fieldId));
  };

  useEffect(() => {
    if (activeSection !== 'basico') return;
    const scrollRegion = document.getElementById('client-form-scroll-region');
    if (!scrollRegion) return;
    let animationFrame = 0;

    const updateActiveSection = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const activationLine = scrollRegion.getBoundingClientRect().top + 112;
        let current = formSections[0].id;
        formSections.forEach((item) => {
          const section = document.getElementById(item.id);
          if (section && section.getBoundingClientRect().top <= activationLine) current = item.id;
        });
        setActiveFormSection(current);
      });
    };

    updateActiveSection();
    scrollRegion.addEventListener('scroll', updateActiveSection, { passive: true });
    return () => {
      window.cancelAnimationFrame(animationFrame);
      scrollRegion.removeEventListener('scroll', updateActiveSection);
    };
  }, [activeSection, formSections]);

  if (activeSection === 'notas') {
    return (
      <ClientFormSection
        sectionId="client-section-notes"
        title="Anotações fixas"
        description="Registre informações comerciais permanentes sobre o relacionamento."
        icon={<NotePencil className="h-5 w-5" weight="duotone" />}
        tone="slate"
        optional
      >
        <div>
          <label htmlFor="client-anotacoes" className={labelClass}>Observações</label>
          <textarea
            id="client-anotacoes"
            name="anotacoes"
            value={form.anotacoes}
            onChange={(event) => update('anotacoes', event.target.value)}
            rows={9}
            placeholder="Ex.: prefere contato pela manhã e solicita cópia digital dos documentos"
            className={cn(fieldClass, 'resize-y leading-relaxed')}
          />
        </div>
      </ClientFormSection>
    );
  }

  const isBusiness = form.tipoPessoa === 'PJ';
  const profileOptions = Array.from(new Set([...CLIENT_PROFILE_OPTIONS, ...form.perfis]));
  const knownServices = Object.values(CLIENT_SERVICOS_BY_CATEGORY).flat();
  const legacyServices = form.servicos.filter((service) => !knownServices.includes(service));
  const cpfStatus = documentFeedback(form.cpf, 11, isValidCpf(form.cpf), 'CPF');
  const cnpjStatus = documentFeedback(form.cnpj, 14, isValidCnpj(form.cnpj), 'CNPJ');
  const emailStatus = emailFeedback(form.email);
  const celularStatus = phoneFeedback(form.celular, 'Celular');
  const telefoneStatus = phoneFeedback(form.telefone, 'Telefone');
  const cepStatus = cepFeedback(form.cep);
  const errorEntries = Object.entries(errors) as Array<[keyof ClientFormState, string]>;

  return (
    <div className="space-y-4">
      <nav
        aria-label="Seções do cadastro do cliente"
        className="sticky top-0 z-20 -mx-1 overflow-x-auto border-y border-brand-border bg-brand-surface/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-brand-surface/85"
      >
        <div className="flex w-max min-w-full gap-1.5 sm:min-w-0">
          {formSections.map((section) => {
            const sectionErrorCount = section.fields.filter((field) => Boolean(errors[field])).length;
            const active = activeFormSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={active ? 'location' : undefined}
                onClick={() => scrollToFormSection(section.id)}
                className={cn(
                  'geo-focus-ring inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold transition-[background-color,border-color,color] duration-150',
                  active
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-300/30 dark:bg-indigo-400/15 dark:text-indigo-100'
                    : 'border-transparent text-zinc-600 hover:border-brand-border hover:bg-brand-surface-subtle hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white'
                )}
              >
                <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-indigo-600 dark:bg-indigo-300' : 'bg-zinc-300 dark:bg-zinc-600')} />
                {section.label}
                {sectionErrorCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] text-white" aria-label={`${sectionErrorCount} erro${sectionErrorCount === 1 ? '' : 's'}`}>
                    {sectionErrorCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <p className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface-subtle/55 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        <span aria-hidden="true" className="text-indigo-600 dark:text-indigo-300">*</span>
        Campos obrigatórios
      </p>

      {errorEntries.length > 0 && (
        <div role="alert" aria-label="Resumo de erros do formulário" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-950 dark:border-red-300/25 dark:bg-red-500/10 dark:text-red-100">
          <div className="flex items-start gap-3">
            <WarningCircle aria-hidden="true" weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Revise {errorEntries.length} {errorEntries.length === 1 ? 'campo' : 'campos'} antes de salvar.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {errorEntries.map(([field, message]) => (
                  <li key={field}>
                    <button
                      type="button"
                      onClick={() => focusErrorField(field)}
                      className="geo-focus-ring rounded-md border border-red-200 bg-white/80 px-2.5 py-1.5 text-left text-xs font-semibold text-red-800 transition-[background-color,border-color] hover:bg-white dark:border-red-300/25 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-950/50"
                      title={message}
                    >
                      {FIELD_LABELS[field] || field}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <ClientFormSection
        sectionId="client-section-identification"
        title="Identificação"
        description="Defina o tipo de pessoa, os documentos e o perfil comercial."
        icon={<IdentificationCard className="h-5 w-5" weight="duotone" />}
        tone="indigo"
      >
        <fieldset>
          <legend className={labelClass}>Tipo de pessoa *</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <PersonTypeOption
              value="PF"
              label="Pessoa física"
              description="CPF e RG"
              icon={<User className="h-5 w-5" weight="duotone" />}
              checked={form.tipoPessoa === 'PF'}
              onChange={() => {
                update('tipoPessoa', 'PF');
                onClearErrors('cpf', 'cnpj');
              }}
            />
            <PersonTypeOption
              value="PJ"
              label="Pessoa jurídica"
              description="CNPJ e inscrição estadual"
              icon={<Buildings className="h-5 w-5" weight="duotone" />}
              checked={form.tipoPessoa === 'PJ'}
              onChange={() => {
                update('tipoPessoa', 'PJ');
                onClearErrors('cpf', 'cnpj');
              }}
            />
          </div>
          <ErrorMessage field="tipoPessoa" errors={errors} />
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="sm:col-span-2 md:col-span-2">
            <label htmlFor="client-nome" className={labelClass}>{isBusiness ? 'Razão social' : 'Nome completo'} *</label>
            <input
              id="client-nome"
              name="nome"
              type="text"
              autoComplete={isBusiness ? 'organization' : 'name'}
              value={form.nome}
              onChange={(event) => update('nome', event.target.value)}
              placeholder={isBusiness ? 'Ex.: SkyGeo Serviços Geográficos Ltda.' : 'Ex.: Maria de Souza'}
              aria-invalid={Boolean(errors.nome)}
              aria-describedby={describedBy('nome', errors)}
              className={fieldClass}
            />
            <ErrorMessage field="nome" errors={errors} />
          </div>
          {isBusiness ? (
            <>
              <div>
                <label htmlFor="client-cnpj" className={labelClass}>CNPJ *</label>
                <input id="client-cnpj" name="cnpj" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} value={form.cnpj} onChange={(event) => update('cnpj', formatCnpj(event.target.value))} placeholder="00.000.000/0000-00" maxLength={18} aria-invalid={Boolean(errors.cnpj)} aria-describedby={describedBy('cnpj', errors, cnpjStatus)} className={fieldClass} />
                <ErrorMessage field="cnpj" errors={errors} />
                <FieldFeedback field="cnpj" feedback={cnpjStatus} hasError={Boolean(errors.cnpj)} />
              </div>
              <div>
                <label htmlFor="client-inscricaoEstadual" className={labelClass}>Inscrição Estadual</label>
                <input id="client-inscricaoEstadual" name="inscricaoEstadual" type="text" autoComplete="off" spellCheck={false} value={form.inscricaoEstadual} onChange={(event) => update('inscricaoEstadual', event.target.value)} placeholder="Ex.: 123.456.789" className={fieldClass} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="client-cpf" className={labelClass}>CPF *</label>
                <input id="client-cpf" name="cpf" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} value={form.cpf} onChange={(event) => update('cpf', formatCpf(event.target.value))} placeholder="000.000.000-00" maxLength={14} aria-invalid={Boolean(errors.cpf)} aria-describedby={describedBy('cpf', errors, cpfStatus)} className={fieldClass} />
                <ErrorMessage field="cpf" errors={errors} />
                <FieldFeedback field="cpf" feedback={cpfStatus} hasError={Boolean(errors.cpf)} />
              </div>
              <div>
                <label htmlFor="client-rg" className={labelClass}>RG</label>
                <input id="client-rg" name="rg" type="text" autoComplete="off" spellCheck={false} value={form.rg} onChange={(event) => update('rg', event.target.value)} placeholder="Ex.: 12.345.678-9" className={fieldClass} />
              </div>
            </>
          )}
        </div>

        <fieldset>
          <legend className={labelClass}>Perfil do cliente</legend>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">Selecione todos os perfis comerciais aplicáveis.</p>
          <div className={selectionGridClass}>
            {profileOptions.map((profile) => (
              <CheckCard
                key={profile}
                name="perfis"
                value={profile}
                checked={form.perfis.includes(profile)}
                onChange={() => toggleArrayValue('perfis', profile)}
              />
            ))}
          </div>
        </fieldset>
      </ClientFormSection>

      <ClientFormSection
        sectionId="client-section-contact"
        title="Contato"
        description="Informe ao menos um celular ou telefone adicional para contato."
        icon={<Phone className="h-5 w-5" weight="duotone" />}
        tone="cyan"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="client-email" className={labelClass}>E-mail</label>
            <input id="client-email" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="nome@exemplo.com" aria-invalid={Boolean(errors.email)} aria-describedby={describedBy('email', errors, emailStatus)} className={fieldClass} />
            <ErrorMessage field="email" errors={errors} />
            <FieldFeedback field="email" feedback={emailStatus} hasError={Boolean(errors.email)} />
          </div>
          <div>
            <label htmlFor="client-celular" className={labelClass}>Celular</label>
            <input id="client-celular" name="celular" type="tel" inputMode="tel" autoComplete="tel-national" value={form.celular} onChange={(event) => {
              const celular = formatPhoneBR(event.target.value);
              setForm((current) => ({ ...current, celular, celularWhatsapp: celular ? current.celularWhatsapp : false }));
              onClearErrors('celular', 'telefone', 'celularWhatsapp');
            }} placeholder="(48) 99999-9999" maxLength={15} aria-invalid={Boolean(errors.celular)} aria-describedby={describedBy('celular', errors, celularStatus)} className={fieldClass} />
            <ErrorMessage field="celular" errors={errors} />
            <FieldFeedback field="celular" feedback={celularStatus} hasError={Boolean(errors.celular)} />
          </div>
          <div>
            <label htmlFor="client-telefone" className={labelClass}>Telefone adicional</label>
            <input id="client-telefone" name="telefone" type="tel" inputMode="tel" autoComplete="tel" value={form.telefone} onChange={(event) => {
              update('telefone', formatPhoneBR(event.target.value));
              onClearErrors('celular');
            }} placeholder="(48) 3333-3333" maxLength={15} aria-invalid={Boolean(errors.telefone)} aria-describedby={describedBy('telefone', errors, telefoneStatus)} className={fieldClass} />
            <ErrorMessage field="telefone" errors={errors} />
            <FieldFeedback field="telefone" feedback={telefoneStatus} hasError={Boolean(errors.telefone)} />
          </div>
          <div className="flex items-end">
            <SwitchField
              id="client-celularWhatsapp"
              name="celularWhatsapp"
              label="Este número possui WhatsApp"
              checked={form.celularWhatsapp}
              disabled={!form.celular}
              disabledHint="Informe um celular para habilitar"
              onChange={(checked) => update('celularWhatsapp', checked)}
              tone="emerald"
              icon={<WhatsappLogo className="h-5 w-5" weight="fill" />}
            />
          </div>
        </div>
      </ClientFormSection>

      <ClientFormSection
        sectionId="client-section-address"
        title="Endereço"
        description="Preencha pelo CEP ou edite os dados manualmente."
        icon={<MapPin className="h-5 w-5" weight="duotone" />}
        tone="amber"
        optional
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="client-cep" className={labelClass}>CEP</label>
            <input id="client-cep" name="cep" type="text" inputMode="numeric" autoComplete="postal-code" value={form.cep} onChange={(event) => update('cep', formatCep(event.target.value))} placeholder="88000-000" maxLength={9} aria-invalid={Boolean(errors.cep)} aria-describedby={describedBy('cep', errors, cepStatus)} className={fieldClass} />
            <ErrorMessage field="cep" errors={errors} />
            <FieldFeedback field="cep" feedback={cepStatus} hasError={Boolean(errors.cep)} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="client-endereco" className={labelClass}>Logradouro</label>
            <input id="client-endereco" name="endereco" type="text" autoComplete="address-line1" value={form.endereco} onChange={(event) => update('endereco', event.target.value)} placeholder="Ex.: Rua das Araucárias" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="client-numero" className={labelClass}>Número</label>
            <input id="client-numero" name="numero" type="text" inputMode="numeric" autoComplete="address-line2" disabled={form.semNumero} value={form.numero} onChange={(event) => update('numero', event.target.value)} placeholder="Ex.: 120" className={fieldClass} />
          </div>
        </div>
        <SwitchField
          id="client-semNumero"
          name="semNumero"
          label="Sem número"
          checked={form.semNumero}
          onChange={(checked) => update('semNumero', checked)}
          compact
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="client-complemento" className={labelClass}>Complemento</label>
            <input id="client-complemento" name="complemento" type="text" autoComplete="address-line2" value={form.complemento} onChange={(event) => update('complemento', event.target.value)} placeholder="Ex.: Sala 4, bloco B" className={fieldClass} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="client-bairro" className={labelClass}>Bairro</label>
            <input id="client-bairro" name="bairro" type="text" autoComplete="address-level3" value={form.bairro} onChange={(event) => update('bairro', event.target.value)} placeholder="Ex.: Centro" className={fieldClass} />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="client-municipio" className={labelClass}>Município</label>
            <input id="client-municipio" name="municipio" type="text" autoComplete="address-level2" value={form.municipio} onChange={(event) => update('municipio', event.target.value)} placeholder="Ex.: Florianópolis" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="client-uf" className={labelClass}>UF</label>
            <input id="client-uf" name="uf" type="text" autoComplete="address-level1" spellCheck={false} value={form.uf} onChange={(event) => update('uf', event.target.value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase())} placeholder="SC" maxLength={2} aria-invalid={Boolean(errors.uf)} aria-describedby={describedBy('uf', errors)} className={fieldClass} />
            <ErrorMessage field="uf" errors={errors} />
          </div>
        </div>
      </ClientFormSection>

      <ClientFormSection
        sectionId="client-section-commercial"
        title="Relacionamento comercial"
        description="Registre a origem principal e os serviços que despertaram interesse."
        icon={<Handshake className="h-5 w-5" weight="duotone" />}
        tone="emerald"
        optional
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="client-origemPrincipal" className={labelClass}>Origem do cliente</label>
            <FormSelect id="client-origemPrincipal" name="origemPrincipal" autoComplete="off" value={form.origemPrincipal} onChange={(event) => {
              update('origemPrincipal', event.target.value);
              onClearErrors('indicadoPor', 'origemDetalhe');
            }} className={cn(fieldClass, 'geo-native-select')}>
              <option value="">Selecione uma origem</option>
              {CLIENT_PRIMARY_ORIGIN_OPTIONS.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
            </FormSelect>
          </div>
          {form.origemPrincipal === 'Indicação' && (
            <div>
              <label htmlFor="client-indicadoPor" className={labelClass}>Quem indicou? *</label>
              <input id="client-indicadoPor" name="indicadoPor" type="text" autoComplete="off" value={form.indicadoPor} onChange={(event) => update('indicadoPor', event.target.value)} placeholder="Nome da pessoa ou empresa" aria-invalid={Boolean(errors.indicadoPor)} aria-describedby={describedBy('indicadoPor', errors)} className={fieldClass} />
              <ErrorMessage field="indicadoPor" errors={errors} />
            </div>
          )}
          {form.origemPrincipal === 'Outro' && (
            <div>
              <label htmlFor="client-origemDetalhe" className={labelClass}>Descrição da origem *</label>
              <input id="client-origemDetalhe" name="origemDetalhe" type="text" autoComplete="off" value={form.origemDetalhe} onChange={(event) => update('origemDetalhe', event.target.value)} placeholder="Ex.: Feira regional" aria-invalid={Boolean(errors.origemDetalhe)} aria-describedby={describedBy('origemDetalhe', errors)} className={fieldClass} />
              <ErrorMessage field="origemDetalhe" errors={errors} />
            </div>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Serviços de interesse</legend>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Marque todos os serviços relacionados ao cliente.</p>
          <div className="mt-3 space-y-3">
            {Object.entries(CLIENT_SERVICOS_BY_CATEGORY).map(([category, services]) => (
              <ServiceCategory
                key={category}
                category={category}
                services={services}
                selectedServices={form.servicos}
                open={openServiceCategories.has(category)}
                onToggle={() => setOpenServiceCategories((current) => {
                  const next = new Set(current);
                  if (next.has(category)) next.delete(category);
                  else next.add(category);
                  return next;
                })}
                onServiceToggle={(service) => toggleArrayValue('servicos', service)}
              />
            ))}
            {legacyServices.length > 0 && (
              <ServiceCategory
                category="Outros interesses já cadastrados"
                services={legacyServices}
                selectedServices={form.servicos}
                open={openServiceCategories.has('Outros interesses já cadastrados')}
                onToggle={() => setOpenServiceCategories((current) => {
                  const next = new Set(current);
                  const category = 'Outros interesses já cadastrados';
                  if (next.has(category)) next.delete(category);
                  else next.add(category);
                  return next;
                })}
                onServiceToggle={(service) => toggleArrayValue('servicos', service)}
              />
            )}
          </div>
        </fieldset>
      </ClientFormSection>

      {editing && (
        <ClientFormSection
          sectionId="client-section-admin"
          title="Informações administrativas"
          description="Altere a situação somente quando houver uma decisão administrativa."
          icon={<ClipboardText className="h-5 w-5" weight="duotone" />}
          tone="slate"
        >
          <div className="max-w-sm">
            <label htmlFor="client-situacao" className={labelClass}>Situação</label>
            <FormSelect id="client-situacao" name="situacao" autoComplete="off" value={form.situacao} onChange={(event) => update('situacao', event.target.value)} className={cn(fieldClass, 'geo-native-select')}>
              {CLIENT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </FormSelect>
          </div>
        </ClientFormSection>
      )}
    </div>
  );
}
