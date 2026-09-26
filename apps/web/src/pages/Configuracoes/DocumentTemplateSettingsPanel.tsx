import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, Eye, FileText, UploadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { SettingsSaveBar, type SettingsSaveState } from '../../components/SettingsSaveBar';
import {
  CompanyTemplateSaveSchema,
  DEFAULT_COMPANY_TEMPLATE,
  loadCompanyTemplate,
  saveCompanyTemplate
} from '../../services/companyTemplate';
import { cn } from '../../utils/cn';
import { geoFieldClass, geoPanelClass } from '../../utils/geoTheme';
import { DOCUMENT_ACCENT_OPTIONS, documentTextColorForBackground } from '../../utils/documentContrast';

const panelClass = cn(
  geoPanelClass,
  'relative overflow-hidden rounded-2xl p-5 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
);
const largePanelClass = cn(
  geoPanelClass,
  'relative overflow-hidden rounded-3xl p-6 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
);
const compactFieldClass = cn(geoFieldClass, 'min-h-11 w-full px-3 text-sm font-medium');
const fieldLabelClass = 'mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300';
const fieldErrorClass = 'mt-1.5 text-xs font-medium text-red-600 dark:text-red-300';

type TemplateField = 'razao' | 'cnpj' | 'telefone' | 'email' | 'endereco' | 'conselhoProfissional' | 'registroProfissional' | 'termos';
type TemplateFieldErrors = Partial<Record<TemplateField, string>>;

const fieldIds: Record<TemplateField, string> = {
  razao: 'template-company-name',
  cnpj: 'template-document',
  telefone: 'template-phone',
  email: 'template-email',
  endereco: 'template-address',
  conselhoProfissional: 'template-professional-council',
  registroProfissional: 'template-professional-registration',
  termos: 'template-terms'
};

export function DocumentTemplateSettingsPanel() {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [applicationLogoBase64, setApplicationLogoBase64] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [templateRazaoSocial, setTemplateRazaoSocial] = useState('');
  const [templateCnpj, setTemplateCnpj] = useState('');
  const [templateTelefone, setTemplateTelefone] = useState('');
  const [templateEmail, setTemplateEmail] = useState('');
  const [templateEndereco, setTemplateEndereco] = useState('');
  const [templateConselhoProfissional, setTemplateConselhoProfissional] = useState('');
  const [templateRegistroProfissional, setTemplateRegistroProfissional] = useState('');
  const [templateCor, setTemplateCor] = useState('#059669');
  const [templateTermos, setTemplateTermos] = useState('Validade da proposta: 15 dias úteis.\nPagamento: 50% na aprovação e 50% na entrega técnica.');
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaveState, setTemplateSaveState] = useState<SettingsSaveState>('saved');
  const [templateError, setTemplateError] = useState('');
  const [templateLoadError, setTemplateLoadError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<TemplateFieldErrors>({});
  const [savedTemplateSnapshot, setSavedTemplateSnapshot] = useState('');

  useEffect(() => {
    let active = true;
    loadCompanyTemplate()
      .then((template) => {
        if (!active) return;
        setApplicationLogoBase64(template.appLogo);
        setLogoBase64(template.logo);
        setTemplateRazaoSocial(template.razao);
        setTemplateCnpj(template.cnpj);
        setTemplateTelefone(template.telefone);
        setTemplateEmail(template.email);
        setTemplateEndereco(template.endereco);
        setTemplateConselhoProfissional(template.conselhoProfissional);
        setTemplateRegistroProfissional(template.registroProfissional);
        setTemplateCor(template.cor);
        setTemplateTermos(template.termos);
        setSavedTemplateSnapshot(JSON.stringify(template));
        setTemplateError('');
        setTemplateLoadError('');
      })
      .catch((error) => setTemplateLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o modelo oficial.'))
      .finally(() => { if (active) setTemplateLoading(false); });
    return () => { active = false; };
  }, []);

  const currentTemplate = {
    version: 1 as const,
    appLogo: applicationLogoBase64,
    logo: logoBase64,
    razao: templateRazaoSocial,
    cnpj: templateCnpj,
    telefone: templateTelefone,
    email: templateEmail,
    endereco: templateEndereco,
    conselhoProfissional: templateConselhoProfissional,
    registroProfissional: templateRegistroProfissional,
    cor: templateCor,
    termos: templateTermos
  };
  const templateDirty = Boolean(savedTemplateSnapshot) && JSON.stringify(currentTemplate) !== savedTemplateSnapshot;
  const effectiveTemplateSaveState: SettingsSaveState = templateSaving
    ? 'saving'
    : templateDirty && templateSaveState !== 'error'
      ? 'dirty'
      : templateSaveState;

  const discardTemplateChanges = useCallback(() => {
    if (!savedTemplateSnapshot) return;
    const saved = JSON.parse(savedTemplateSnapshot) as typeof DEFAULT_COMPANY_TEMPLATE;
    setApplicationLogoBase64(saved.appLogo);
    setLogoBase64(saved.logo);
    setTemplateRazaoSocial(saved.razao);
    setTemplateCnpj(saved.cnpj);
    setTemplateTelefone(saved.telefone);
    setTemplateEmail(saved.email);
    setTemplateEndereco(saved.endereco);
    setTemplateConselhoProfissional(saved.conselhoProfissional);
    setTemplateRegistroProfissional(saved.registroProfissional);
    setTemplateCor(saved.cor);
    setTemplateTermos(saved.termos);
    setTemplateError('');
    setFieldErrors({});
    setTemplateSaveState('saved');
  }, [savedTemplateSnapshot]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('geogestor:settings-section-state', {
      detail: { section: 'modelos', state: effectiveTemplateSaveState }
    }));
  }, [effectiveTemplateSaveState]);

  useEffect(() => {
    const discard = (event: Event) => {
      const section = (event as CustomEvent<{ section?: string }>).detail?.section;
      if (section === 'modelos') discardTemplateChanges();
    };
    window.addEventListener('geogestor:settings-discard', discard);
    return () => window.removeEventListener('geogestor:settings-discard', discard);
  }, [discardTemplateChanges]);

  const clearFieldError = (field: TemplateField) => {
    setFieldErrors((current) => current[field] ? { ...current, [field]: undefined } : current);
    if (templateSaveState === 'error') {
      setTemplateError('');
      setTemplateSaveState('saved');
    }
  };

  const handleSaveTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = CompanyTemplateSaveSchema.safeParse(currentTemplate);
    if (!validation.success) {
      const nextErrors: TemplateFieldErrors = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as TemplateField;
        if (field in fieldIds && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      setTemplateError('Revise os campos destacados antes de salvar.');
      setTemplateSaveState('error');
      const firstField = (Object.keys(fieldIds) as TemplateField[]).find((field) => nextErrors[field]);
      window.requestAnimationFrame(() => {
        if (firstField) document.getElementById(fieldIds[firstField])?.focus();
      });
      return;
    }

    setTemplateSaving(true);
    setTemplateError('');
    setFieldErrors({});
    try {
      await saveCompanyTemplate(validation.data);
      setSavedTemplateSnapshot(JSON.stringify(validation.data));
      setTemplateSaveState('success');
      window.setTimeout(() => setTemplateSaveState('saved'), 1800);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o modelo. Tente novamente.';
      setTemplateError(message);
      setTemplateSaveState('error');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Use uma imagem PNG, JPG ou WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoBase64(reader.result as string);
      setTemplateError('');
      setTemplateSaveState('saved');
    };
    reader.readAsDataURL(file);
  };

  const systemPanelClass = panelClass;
  const systemPanelLargeClass = largePanelClass;
  const systemCompactFieldClass = compactFieldClass;

  const fieldProps = (field: TemplateField) => ({
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `${fieldIds[field]}-error` : undefined
  });
  const previewAccentText = documentTextColorForBackground(templateCor);

  return (
    <form noValidate onSubmit={handleSaveTemplate} className="space-y-6" aria-busy={templateLoading || templateSaving}>
      {templateLoading && <p aria-live="polite" className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">Carregando o modelo oficial…</p>}
      {templateLoadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{templateLoadError} Verifique se o serviço local está disponível e tente novamente.</div>}

      <div className={cn(systemPanelLargeClass, 'p-4 sm:p-6 md:p-8')}>
        <div className="mb-6 flex flex-col gap-4 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="flex items-start gap-2 text-lg font-bold text-zinc-950 dark:text-white">
              <FileText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <span className="text-pretty">Padrão visual dos PDFs</span>
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">Defina a identidade aplicada aos orçamentos e relatórios exportados pelo GeoGestor.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Restaurar os padrões do modelo?\n\nLogo, dados corporativos, cor e termos voltarão ao modelo inicial. Você poderá revisar antes de salvar.')) return;
              setLogoBase64(DEFAULT_COMPANY_TEMPLATE.logo);
              setTemplateRazaoSocial(DEFAULT_COMPANY_TEMPLATE.razao);
              setTemplateCnpj(DEFAULT_COMPANY_TEMPLATE.cnpj);
              setTemplateTelefone(DEFAULT_COMPANY_TEMPLATE.telefone);
              setTemplateEmail(DEFAULT_COMPANY_TEMPLATE.email);
              setTemplateEndereco(DEFAULT_COMPANY_TEMPLATE.endereco);
              setTemplateConselhoProfissional(DEFAULT_COMPANY_TEMPLATE.conselhoProfissional);
              setTemplateRegistroProfissional(DEFAULT_COMPANY_TEMPLATE.registroProfissional);
              setTemplateCor(DEFAULT_COMPANY_TEMPLATE.cor);
              setTemplateTermos(DEFAULT_COMPANY_TEMPLATE.termos);
              setFieldErrors({});
              setTemplateError('');
              setTemplateSaveState('saved');
            }}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <ArrowCounterClockwise aria-hidden="true" size={16} /> Restaurar padrões
          </button>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="relative flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 p-5 text-center transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/30 md:col-span-1">
            <input
              ref={logoInputRef}
              id="template-logo-file"
              name="company_logo"
              type="file"
              tabIndex={-1}
              aria-label="Selecionar arquivo de logotipo"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoUpload}
              className="sr-only"
            />
            {logoBase64 ? (
              <div className="w-full">
                <img src={logoBase64} alt="Logotipo selecionado para os PDFs" width="160" height="96" className="mx-auto mb-3 max-h-24 w-auto max-w-full object-contain" />
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => logoInputRef.current?.click()} aria-describedby="template-logo-help" className="min-h-11 rounded-xl px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-950/30">Substituir imagem</button>
                  <button type="button" onClick={() => { setLogoBase64(''); setTemplateSaveState('saved'); }} className="min-h-11 rounded-xl px-3 text-xs font-bold text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-300 dark:hover:bg-red-950/30">Remover logotipo</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => logoInputRef.current?.click()} aria-describedby="template-logo-help" className="geo-focus-ring flex min-h-11 w-full flex-col items-center justify-center rounded-xl px-3 py-4 text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/50">
                <UploadSimple aria-hidden="true" className="mb-2 h-8 w-8 text-zinc-500 dark:text-zinc-400" />
                <span className="text-sm font-bold">Enviar logotipo</span>
              </button>
            )}
            <p id="template-logo-help" className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">PNG, JPG ou WebP, até 2 MB. Prefira fundo transparente.</p>
          </div>

          <div className="space-y-4 md:col-span-2">
            <div>
              <label htmlFor="template-company-name" className={fieldLabelClass}>Razão social / nome no PDF</label>
              <input id="template-company-name" name="template_company_name" autoComplete="organization" type="text" maxLength={200} value={templateRazaoSocial} onChange={(event) => { setTemplateRazaoSocial(event.target.value); clearFieldError('razao'); }} placeholder="Ex.: SkyGeo Topografia e Georreferenciamento" className={cn(systemCompactFieldClass, 'px-3.5 font-semibold', fieldErrors.razao && 'border-red-500 ring-1 ring-red-500/30')} {...fieldProps('razao')} />
              {fieldErrors.razao && <p id="template-company-name-error" role="alert" className={fieldErrorClass}>{fieldErrors.razao}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="template-document" className={fieldLabelClass}>CNPJ / CPF oficial</label>
                <input id="template-document" name="template_document" autoComplete="off" inputMode="numeric" type="text" maxLength={18} value={templateCnpj} onChange={(event) => { setTemplateCnpj(event.target.value); clearFieldError('cnpj'); }} placeholder="00.000.000/0001-00" className={cn(systemCompactFieldClass, fieldErrors.cnpj && 'border-red-500 ring-1 ring-red-500/30')} {...fieldProps('cnpj')} />
                {fieldErrors.cnpj && <p id="template-document-error" role="alert" className={fieldErrorClass}>{fieldErrors.cnpj}</p>}
              </div>
              <div>
                <label htmlFor="template-phone" className={fieldLabelClass}>Telefone / WhatsApp</label>
                <input id="template-phone" name="template_phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={templateTelefone} onChange={(event) => { setTemplateTelefone(event.target.value); clearFieldError('telefone'); }} placeholder="(48) 99999-9999" className={cn(systemCompactFieldClass, fieldErrors.telefone && 'border-red-500 ring-1 ring-red-500/30')} {...fieldProps('telefone')} />
                {fieldErrors.telefone && <p id="template-phone-error" role="alert" className={fieldErrorClass}>{fieldErrors.telefone}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <label htmlFor="template-email" className={fieldLabelClass}>E-mail comercial</label>
            <input id="template-email" name="template_email" type="email" autoComplete="email" spellCheck={false} maxLength={254} value={templateEmail} onChange={(event) => { setTemplateEmail(event.target.value); clearFieldError('email'); }} placeholder="orcamentos@empresa.com.br" className={cn(systemCompactFieldClass, 'px-3.5', fieldErrors.email && 'border-red-500 ring-1 ring-red-500/30')} {...fieldProps('email')} />
            {fieldErrors.email && <p id="template-email-error" role="alert" className={fieldErrorClass}>{fieldErrors.email}</p>}
          </div>
          <fieldset>
            <legend className={fieldLabelClass}>Cor de destaque dos PDFs</legend>
            <div className={cn(geoFieldClass, 'flex min-h-14 flex-wrap items-center gap-1.5 px-2 py-1.5')}>
              {DOCUMENT_ACCENT_OPTIONS.map((color) => (
                <button key={color.hex} type="button" onClick={() => setTemplateCor(color.hex)} className={cn('h-11 w-11 rounded-xl transition-transform focus-visible:ring-2 focus-visible:ring-brand-primary-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:focus-visible:ring-offset-zinc-900', templateCor === color.hex ? 'scale-105 ring-2 ring-brand-primary-500 ring-offset-2 dark:ring-brand-primary-300 dark:ring-offset-zinc-900' : 'opacity-80 hover:scale-105 hover:opacity-100')} style={{ backgroundColor: color.hex }} title={color.name} aria-label={`Usar a cor ${color.name}`} aria-pressed={templateCor === color.hex} />
              ))}
              <output aria-label="Código hexadecimal da cor selecionada" className="ml-auto break-all px-1 text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300">{templateCor}</output>
            </div>
          </fieldset>
        </div>

        <div className="mb-6">
          <label htmlFor="template-address" className={fieldLabelClass}>Endereço completo exibido no cabeçalho</label>
          <input id="template-address" name="template_address" autoComplete="street-address" type="text" maxLength={500} value={templateEndereco} onChange={(event) => { setTemplateEndereco(event.target.value); clearFieldError('endereco'); }} placeholder="Rua, número, complemento, cidade e estado" className={cn(systemCompactFieldClass, 'px-3.5', fieldErrors.endereco && 'border-red-500 ring-1 ring-red-500/30')} {...fieldProps('endereco')} />
          {fieldErrors.endereco && <p id="template-address-error" role="alert" className={fieldErrorClass}>{fieldErrors.endereco}</p>}
        </div>

        <fieldset className="mb-6">
          <legend className={fieldLabelClass}>Identificação do responsável técnico nos PDFs</legend>
          <p className="mb-3 text-xs leading-5 text-zinc-600 dark:text-zinc-300">Preencha somente os dados profissionais oficiais. Campos vazios não serão exibidos.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="template-professional-council" className={fieldLabelClass}>Conselho profissional</label>
              <input id="template-professional-council" name="template_professional_council" autoComplete="off" maxLength={30} value={templateConselhoProfissional} onChange={(event) => { setTemplateConselhoProfissional(event.target.value); clearFieldError('conselhoProfissional'); }} placeholder="Ex.: CREA-SC" className={cn(systemCompactFieldClass, fieldErrors.conselhoProfissional && 'border-red-500 ring-1 ring-red-500/30')} {...fieldProps('conselhoProfissional')} />
              {fieldErrors.conselhoProfissional && <p id="template-professional-council-error" role="alert" className={fieldErrorClass}>{fieldErrors.conselhoProfissional}</p>}
            </div>
            <div>
              <label htmlFor="template-professional-registration" className={fieldLabelClass}>Número de registro</label>
              <input id="template-professional-registration" name="template_professional_registration" autoComplete="off" maxLength={60} value={templateRegistroProfissional} onChange={(event) => { setTemplateRegistroProfissional(event.target.value); clearFieldError('registroProfissional'); }} placeholder="Informe somente se disponível" className={cn(systemCompactFieldClass, fieldErrors.registroProfissional && 'border-red-500 ring-1 ring-red-500/30')} {...fieldProps('registroProfissional')} />
              {fieldErrors.registroProfissional && <p id="template-professional-registration-error" role="alert" className={fieldErrorClass}>{fieldErrors.registroProfissional}</p>}
            </div>
          </div>
        </fieldset>

        <div>
          <label htmlFor="template-terms" className={fieldLabelClass}>Termos, prazos e condições da seção final</label>
          <textarea id="template-terms" name="template_terms" rows={5} maxLength={10_000} value={templateTermos} onChange={(event) => { setTemplateTermos(event.target.value); clearFieldError('termos'); }} placeholder="Descreva as condições contratuais, dados bancários, PIX ou observações legais." className={cn(geoFieldClass, 'w-full resize-y p-3 text-sm font-medium leading-relaxed', fieldErrors.termos && 'border-red-500 ring-1 ring-red-500/30')} {...fieldProps('termos')} />
          <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
            {fieldErrors.termos ? <p id="template-terms-error" role="alert" className={fieldErrorClass}>{fieldErrors.termos}</p> : <span />}
            <span className="ml-auto text-xs tabular-nums text-zinc-600 dark:text-zinc-300">{templateTermos.length.toLocaleString('pt-BR')} / 10.000</span>
          </div>
        </div>
      </div>

      <section className={cn(systemPanelClass, 'space-y-4 p-4 sm:p-5')} aria-labelledby="template-preview-title">
        <div>
          <h2 id="template-preview-title" className="flex items-center gap-2 text-base font-semibold"><Eye aria-hidden="true" size={19} /> Prévia do documento</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Simulação da identidade aplicada a uma página exportada.</p>
        </div>
        <div aria-label="Prévia do modelo de PDF" className="overflow-hidden rounded-xl border border-zinc-300 bg-white text-zinc-900 shadow-sm dark:border-zinc-600" style={{ borderTopColor: templateCor, borderTopWidth: 6 }}>
          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {logoBase64 ? <img src={logoBase64} alt="Prévia do logotipo da empresa" width="112" height="72" className="h-[72px] w-28 shrink-0 object-contain" /> : <div className="flex h-[72px] w-28 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-medium text-zinc-700">Sem logotipo</div>}
              <div className="min-w-0 flex-1">
                <strong className="block break-words text-lg">{templateRazaoSocial || 'Nome da empresa'}</strong>
                <span className="block break-words text-xs text-zinc-600">{[templateCnpj, templateTelefone, templateEmail].filter(Boolean).join(' • ') || 'CNPJ/CPF • telefone • e-mail'}</span>
                <span className="mt-1 block break-words text-xs text-zinc-600">{templateEndereco || 'Endereço da empresa'}</span>
                {(templateConselhoProfissional || templateRegistroProfissional) && <span className="mt-1 block break-words text-xs text-zinc-600">Responsável técnico: {[templateConselhoProfissional, templateRegistroProfissional].filter(Boolean).join(' ')}</span>}
              </div>
              <div className="shrink-0 sm:text-right">
                <strong className="block text-sm text-zinc-900">DOCUMENTO EXPORTADO</strong>
                <span className="text-xs text-zinc-600">Prévia visual</span>
              </div>
            </div>

            <div className="my-5 h-0.5" style={{ backgroundColor: templateCor }} />
            <div className="space-y-4">
              <div><span className="text-xs font-bold uppercase tracking-wider text-zinc-800">Resumo</span><div className="mt-2 h-2.5 w-full rounded bg-zinc-200" /><div className="mt-2 h-2.5 w-4/5 rounded bg-zinc-100" /></div>
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-xs font-bold" style={{ backgroundColor: templateCor, color: previewAccentText }}><span>Descrição</span><span>Valor</span></div>
                <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 text-xs text-zinc-700"><span>Serviço técnico demonstrativo</span><span className="tabular-nums">R$ 0,00</span></div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-zinc-200 pt-3 text-xs text-zinc-700"><span>Subtotal faturável</span><span className="tabular-nums">R$ 0,00</span><strong>Investimento total</strong><strong className="tabular-nums">R$ 0,00</strong></div>
            </div>
          </div>
          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-6">
            <strong className="block text-[11px] uppercase tracking-wider text-zinc-700">Termos e condições</strong>
            <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-zinc-700">{templateTermos || 'Os termos e as condições configurados serão exibidos nesta área.'}</p>
          </div>
        </div>
      </section>

      <SettingsSaveBar state={effectiveTemplateSaveState} errorMessage={templateError} saveDisabled={templateLoading} submit onDiscard={discardTemplateChanges} />
    </form>
  );
}
