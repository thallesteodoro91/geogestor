import { useCallback, useEffect, useState } from 'react';
import { ArrowCounterClockwise, Eye, FileText, UploadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { SettingsSaveBar, type SettingsSaveState } from '../../components/SettingsSaveBar';
import { DEFAULT_COMPANY_TEMPLATE, loadCompanyTemplate, saveCompanyTemplate } from '../../services/companyTemplate';
import { cn } from '../../utils/cn';
import { geoFieldClass, geoPanelClass } from '../../utils/geoTheme';

const panelClass = cn(
  geoPanelClass,
  'relative overflow-hidden rounded-2xl p-5 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
);
const largePanelClass = cn(
  geoPanelClass,
  'relative overflow-hidden rounded-3xl p-6 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-primary-500 before:via-brand-turquoise-400 before:to-brand-blue-500'
);
const compactFieldClass = cn(geoFieldClass, 'h-9 w-full px-3 text-xs font-medium');

export function DocumentTemplateSettingsPanel() {
  const [applicationLogoBase64, setApplicationLogoBase64] = useState('');
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
        setTemplateCor(template.cor);
        setTemplateTermos(template.termos);
        setSavedTemplateSnapshot(JSON.stringify(template));
        setTemplateError('');
      })
      .catch((error) => setTemplateError(error instanceof Error ? error.message : 'Não foi possível carregar o modelo oficial.'))
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
    setTemplateCor(saved.cor);
    setTemplateTermos(saved.termos);
    setTemplateError('');
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

  const handleSaveTemplate = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setTemplateSaving(true);
    setTemplateError('');
    try {
      await saveCompanyTemplate(currentTemplate);
      setSavedTemplateSnapshot(JSON.stringify(currentTemplate));
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
    reader.onload = () => setLogoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const systemPanelClass = panelClass;
  const systemPanelLargeClass = largePanelClass;
  const systemCompactFieldClass = compactFieldClass;

  return (
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

  );
}

