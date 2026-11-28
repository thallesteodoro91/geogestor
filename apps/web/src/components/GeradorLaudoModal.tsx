import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DatePickerField, FormSelect } from './Form';
import { Modal } from './Modal';
import { FilePdf } from '@phosphor-icons/react';
import type { LaudoOptions } from '../utils/laudoPdfGenerator';
import { EnvironmentalDocumentInputSchema, type EnvironmentalDocumentInput, type EnvironmentalDocumentIssue, type EnvironmentalDocumentPreview } from '@geogestor/contracts/src/environmental-documents';
import { environmentalPdfUrl, downloadEnvironmentalPdf, prepareEnvironmentalDocumentLogo } from '../utils/environmentalDocumentFile';
import { apiClient } from '../services/apiClient';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../utils/actionStyles';
import { geoFieldClass } from '../utils/geoTheme';
import { cn } from '../utils/cn';

interface GeradorLaudoModalProps {
  isOpen: boolean; onClose: () => void; projetoId: string; projetoNome: string; clienteNome?: string; tipoDemanda?: string;
  propriedadeNome?: string | null; protocolo?: string | null; orgaoAmbiental?: string | null;
  situacaoTrabalho?: string | null; faseAmbiental?: string | null;
  onDraftStateChange: (state: { dirty: boolean; saving: boolean }) => void;
  revision?: { id: string; options: LaudoOptions } | null;
}
const documentTypes = {
  acompanhamento: ['Acompanhamento Documental', 'Relatório para comunicação com o cliente e registro do acompanhamento.'],
  vistoria: ['Vistoria Técnica', 'Laudo com as informações de vistoria fornecidas pelo responsável.'],
  fauna: ['Monitoramento de Fauna', 'Relatório com as informações de monitoramento fornecidas pelo responsável.'],
  flora: ['Inventário Florestal', 'Documento com as informações de inventário fornecidas pelo responsável.'],
  outros: ['Laudo Ambiental Genérico', 'Documento com identificação e observações revisadas pelo responsável.']
} as const;
const ids: Record<keyof EnvironmentalDocumentInput, string> = {
  projetoNome: 'laudo-projeto', clienteNome: 'laudo-cliente', tipoLaudo: 'laudo-tipo', dataVistoria: 'laudo-data', tecnicoResponsavel: 'laudo-tecnico',
  observacoes: 'laudo-observacoes', tipoDemanda: 'laudo-servico', propriedadeNome: 'laudo-propriedade', protocolo: 'laudo-protocolo', orgaoAmbiental: 'laudo-orgao',
  finalidade: 'laudo-finalidade', documentosConsiderados: 'laudo-documentos', proximosPassos: 'laudo-proximos-passos', situacaoTrabalho: 'laudo-situacao-trabalho',
  faseAmbiental: 'laudo-fase-ambiental', sintese: 'laudo-sintese'
};
const fieldClass = cn(geoFieldClass, 'min-h-11 w-full px-3 py-2.5 text-base');
const primary = cn(primarySmallActionButtonClass, 'min-h-11 whitespace-normal');
const secondary = cn(secondarySmallActionButtonClass, 'min-h-11 whitespace-normal');
const errorClass = 'text-sm text-red-700 dark:text-red-300';
type Preview = EnvironmentalDocumentPreview & { options: EnvironmentalDocumentInput; inputKey: string; draftKey: string; logo: { renderedLogo?: string; sourceLogoHash?: string } };

export function GeradorLaudoModal(props: GeradorLaudoModalProps) {
  const { isOpen, onClose, projetoId, onDraftStateChange, revision } = props;
  const initial: Partial<LaudoOptions> = revision?.options ?? {
    projetoNome: props.projetoNome, clienteNome: props.clienteNome === 'Cliente não informado' ? '' : props.clienteNome || '',
    tipoDemanda: props.tipoDemanda || '', propriedadeNome: props.propriedadeNome || '', protocolo: props.protocolo || '', orgaoAmbiental: props.orgaoAmbiental || '',
    situacaoTrabalho: props.situacaoTrabalho || '', faseAmbiental: props.faseAmbiental || '', tipoLaudo: 'acompanhamento', dataVistoria: '',
    observacoes: '', finalidade: '', documentosConsiderados: '', proximosPassos: '', sintese: ''
  };
  const draftKey = revision?.id || 'new';
  const [drafts, setDrafts] = useState<Record<string, Partial<LaudoOptions>>>({});
  const formData = { ...initial, ...drafts[draftKey] };
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof EnvironmentalDocumentInput, string>>>({});
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [issued, setIssued] = useState<(EnvironmentalDocumentIssue & { draftKey: string }) | null>(null);
  const queryClient = useQueryClient();
  const config = useQuery<{ adminNome?: string }>({ queryKey: ['laudo-responsavel-configurado'], queryFn: () => apiClient.get('/api/configuracoes'), enabled: isOpen });
  const responsible = formData.tecnicoResponsavel ?? config.data?.adminNome ?? '';
  const inputKey = JSON.stringify({ ...formData, tecnicoResponsavel: responsible });
  const activePreview = preview?.draftKey === draftKey ? preview : null;
  const activeIssue = issued?.draftKey === draftKey ? issued : null;
  const dirty = Object.entries(drafts).some(([key, draft]) => key === draftKey ? JSON.stringify({ ...initial, ...draft }) !== JSON.stringify(initial) : Object.keys(draft).length > 0);
  const documentary = formData.tipoLaudo === 'acompanhamento';
  useEffect(() => { onDraftStateChange({ dirty, saving: busy }); }, [dirty, busy, onDraftStateChange]);
  useEffect(() => () => onDraftStateChange({ dirty: false, saving: false }), [onDraftStateChange]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const change = (field: keyof EnvironmentalDocumentInput, value: string) => {
    setDrafts(current => ({ ...current, [draftKey]: { ...current[draftKey], [field]: value } }));
    setErrors(current => ({ ...current, [field]: undefined })); setError('');
  };
  const generate = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current) return;
    const parsed = EnvironmentalDocumentInputSchema.safeParse({ ...formData, tecnicoResponsavel: responsible });
    if (!parsed.success) {
      const next: typeof errors = {};
      parsed.error.issues.forEach(issue => {
        const key = issue.path[0] as keyof EnvironmentalDocumentInput;
        if (!next[key]) next[key] = key === 'tipoLaudo' ? 'Selecione o tipo de documento adequado ao serviço.' : key === 'dataVistoria' ? 'Informe a data de referência do documento.' : issue.code === 'too_big' ? 'Use no máximo ' + new Intl.NumberFormat('pt-BR').format(Number(issue.maximum)) + ' caracteres.' : 'Preencha este campo antes de preparar a prévia.';
      });
      setErrors(next);
      const target = document.getElementById(ids[Object.keys(next)[0] as keyof EnvironmentalDocumentInput]);
      target?.closest('details')?.setAttribute('open', ''); target?.focus(); return;
    }
    setErrors({}); lock.current = true; setBusy(true); setError('');
    try {
      const options = { ...parsed.data, ...(documentary ? {} : { finalidade: '', documentosConsiderados: '', proximosPassos: '', sintese: '' }) };
      const settings = await apiClient.get<Record<string, unknown>>('/api/dados-operacionais/configuracoes-operacionais');
      const company = settings.geogestor_empresa_template as { logo?: unknown } | undefined;
      const logo = await prepareEnvironmentalDocumentLogo(company?.logo);
      const result = await apiClient.post<EnvironmentalDocumentPreview>('/api/ambiental/' + projetoId + '/documentos/previa', { options, ...logo }, { timeoutMs: 120000 });
      setPreviewUrl(environmentalPdfUrl(result.pdfBase64)); setPreview({ ...result, options, inputKey, draftKey, logo }); setIssued(null);
      window.requestAnimationFrame(() => document.getElementById('laudo-voltar-preenchimento')?.focus());
    } catch (failure) { setError((failure instanceof Error ? failure.message : 'Não foi possível gerar a prévia.') + ' Seu preenchimento foi preservado. Tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const emit = async () => {
    if (lock.current || !activePreview || activePreview.inputKey !== inputKey) return;
    lock.current = true; setBusy(true); setError('');
    const signature = JSON.stringify({ options: activePreview.options, previewHash: activePreview.previewHash, revisionOf: revision?.id, ...activePreview.logo });
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await apiClient.post<EnvironmentalDocumentIssue>('/api/ambiental/' + projetoId + '/documentos/emitir', {
        options: activePreview.options, previewHash: activePreview.previewHash, requestId: attempt.current!.id, ...activePreview.logo, ...(revision ? { revisionOf: revision.id } : {})
      }, { timeoutMs: 120000 });
      setIssued({ ...result, draftKey }); setPreview(null); setPreviewUrl('');
      attempt.current = null;
      setDrafts(current => { const next = { ...current }; delete next[draftKey]; return next; });
      void queryClient.invalidateQueries({ queryKey: ['environmental-documents', projetoId] });
      toast.success('Emissão registrada. O PDF e os dados desta versão foram preservados.');
      window.requestAnimationFrame(() => document.getElementById('laudo-baixar-emissao')?.focus());
    } catch (failure) { setError((failure instanceof Error ? failure.message : 'Não foi possível registrar a emissão.') + ' Seu preenchimento foi preservado. Tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const download = async () => {
    if (!activeIssue || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const file = await apiClient.get<{ pdfBase64: string }>('/api/ambiental/' + projetoId + '/documentos/' + activeIssue.id);
      downloadEnvironmentalPdf(file.pdfBase64, activeIssue.fileName);
    } catch { setError('A emissão está registrada, mas não foi possível baixar o PDF. Tente novamente ou consulte as emissões na demanda.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const field = (key: keyof EnvironmentalDocumentInput, label: string, limit = 200, multiline = false, hint?: string) => <div key={key}>
    <label htmlFor={ids[key]} className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</label>
    {key === 'dataVistoria' ? <DatePickerField id={ids[key]} name={key} value={formData[key] || ''} onChange={event => change(key, event.target.value)} required disabled={busy} aria-invalid={Boolean(errors[key])} aria-describedby={ids[key] + '-error'} className={fieldClass} /> :
    multiline ? <textarea id={ids[key]} name={key} autoComplete="off" rows={3} maxLength={limit} disabled={busy} value={formData[key] || ''} onChange={event => change(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={ids[key] + '-error'} className={cn(fieldClass, 'resize-y')} /> :
    <input id={ids[key]} name={key} autoComplete="off" type="text" required={['projetoNome', 'clienteNome', 'tecnicoResponsavel'].includes(key)} maxLength={limit} disabled={busy} value={key === 'tecnicoResponsavel' ? responsible : formData[key] || ''} onChange={event => change(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={ids[key] + '-error'} className={fieldClass} />}
    <p id={ids[key] + '-error'} role={errors[key] ? 'alert' : undefined} className={errorClass}>{errors[key]}</p>
    {hint && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{hint}</p>}
  </div>;
  const close = () => { if (activeIssue) { setIssued(null); attempt.current = null; } onClose(); };
  return <Modal isOpen={isOpen} onClose={close} title="Gerar documento para o cliente" initialFocusId={revision ? 'laudo-projeto' : 'laudo-tipo'} closeDisabled={busy} maxWidth={activePreview ? 'max-w-4xl' : 'max-w-xl'}>
    {activeIssue ? <div className="space-y-4">
      <p role="status" className="font-semibold text-emerald-800 dark:text-emerald-200">Emissão registrada</p>
      <p className="break-words text-sm text-zinc-700 dark:text-zinc-300">{activeIssue.codigo} · Revisão {activeIssue.revisao}. O PDF e os dados utilizados estão preservados nesta demanda.</p>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={close} disabled={busy} className={secondary}>Fechar</button><button id="laudo-baixar-emissao" type="button" onClick={() => void download()} disabled={busy} className={primary}>{busy ? 'Baixando PDF…' : 'Baixar PDF'}</button>{!revision && <button type="button" disabled={busy} onClick={() => { setIssued(null); attempt.current = null; }} className={secondary}>Novo preenchimento</button>}</div>
    </div> : activePreview ? <div className="space-y-4">
      <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">Pré-visualização. A emissão ainda não foi registrada. Identificação, revisão e data de emissão serão confirmadas ao registrar.</p>
      <iframe title="Pré-visualização do relatório" src={previewUrl} tabIndex={0} className="geo-focus-ring h-[50vh] w-full rounded border border-zinc-300" />
      {!window.electronAPI && <a href={previewUrl} target="_blank" rel="noreferrer" className="geo-focus-ring inline-flex min-h-11 items-center text-sm font-semibold text-sky-800 underline dark:text-sky-200">Abrir prévia em nova aba</a>}
      {activePreview.inputKey !== inputKey && <p role="alert" className={errorClass}>Os dados mudaram. Volte ao preenchimento e atualize a prévia antes de emitir.</p>}
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button id="laudo-voltar-preenchimento" type="button" disabled={busy} onClick={() => { setPreview(null); setPreviewUrl(''); setError(''); window.requestAnimationFrame(() => document.getElementById('laudo-tipo')?.focus()); }} className={secondary}>Voltar ao preenchimento</button><button type="button" onClick={() => void emit()} disabled={busy || activePreview.inputKey !== inputKey} aria-busy={busy} className={primary}><span aria-live="polite">{busy ? 'Registrando emissão…' : 'Registrar emissão'}</span></button></div>
    </div> : <form noValidate onSubmit={event => void generate(event)} className="space-y-4">
      <p className="break-words text-sm text-zinc-600 dark:text-zinc-400">{revision ? 'Nova revisão: confira os dados preservados da emissão anterior.' : 'Rascunho: prepare o registro para o cliente. A prévia não cria uma emissão.'} Os dados da empresa vêm das configurações e serão conferidos na prévia.</p>
      <div><label htmlFor="laudo-tipo" className="mb-1.5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Tipo de documento</label>
        <FormSelect id="laudo-tipo" name="tipoLaudo" autoComplete="off" disabled={busy || Boolean(revision)} value={formData.tipoLaudo || ''} onChange={event => change('tipoLaudo', event.target.value)} aria-invalid={Boolean(errors.tipoLaudo)} aria-describedby="laudo-scope laudo-tipo-error" className={fieldClass}>
          <option value="">Selecione o tipo de documento…</option>{Object.entries(documentTypes).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
        </FormSelect><p id="laudo-tipo-error" role={errors.tipoLaudo ? 'alert' : undefined} className={errorClass}>{errors.tipoLaudo}</p>
        <p id="laudo-scope" className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{formData.tipoLaudo ? documentTypes[formData.tipoLaudo][1] : 'Selecione o tipo adequado ao serviço.'} O documento não declara aprovação do CAR nem conformidade regulatória.</p>
      </div>
      {field('projetoNome', 'Nome do trabalho')}{field('clienteNome', 'Cliente')}
      {field('tecnicoResponsavel', 'Responsável pelo documento', 200, false, revision ? 'Responsável preservado da emissão anterior. Revise para esta versão.' : config.isError ? 'Informe o responsável; não foi possível consultar as configurações.' : 'Revise o responsável configurado para este documento.')}
      {field('dataVistoria', formData.tipoLaudo === 'vistoria' ? 'Data da vistoria' : 'Data de referência')}
      {documentary && field('sintese', 'Síntese do acompanhamento (opcional)', 1000, true, 'Resuma o que foi realizado e o próximo encaminhamento conhecido. O bloco será omitido se estiver vazio.')}
      {field('observacoes', documentary ? 'Registros do acompanhamento (opcional)' : 'Observações técnicas (opcional)', 5000, true)}
      {documentary && <details className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
        <summary className="geo-focus-ring flex min-h-11 cursor-pointer items-center rounded text-sm font-semibold text-zinc-800 dark:text-zinc-200">Detalhar documentos e próximos passos</summary>
        <div className="mt-3 space-y-3">
          {field('finalidade', 'Finalidade específica do registro (opcional)', 3000, true, 'Se vazio, usamos a finalidade de comunicação com o cliente e histórico do trabalho.')}
          {field('documentosConsiderados', 'Documentos considerados (opcional)', 3000, true, 'Identifique somente os documentos efetivamente consultados.')}
          {field('proximosPassos', 'Pendências e próximos passos (opcional)', 3000, true, 'Informe somente ações, responsáveis e prazos conhecidos.')}
        </div>
      </details>}
      <details className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
        <summary className="geo-focus-ring flex min-h-11 cursor-pointer items-center rounded text-sm font-semibold text-zinc-800 dark:text-zinc-200">Revisar dados complementares da demanda</summary>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Situação e fase descrevem o trabalho no GeoGestor. Ajustes deste formulário valem somente para esta emissão.</p>
        <div className="mt-3 space-y-3">{field('tipoDemanda', 'Serviço (opcional)')}{field('propriedadeNome', 'Propriedade (opcional)')}{field('protocolo', 'Protocolo ou processo (opcional)')}{field('orgaoAmbiental', 'Órgão ambiental (opcional)')}{documentary && <>{field('situacaoTrabalho', 'Situação do trabalho no GeoGestor (opcional)')}{field('faseAmbiental', 'Fase ambiental registrada (opcional)')}</>}</div>
      </details>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className={secondary}>Fechar</button><button type="submit" disabled={busy} aria-busy={busy} className={primary}><FilePdf aria-hidden="true" className="h-4 w-4" /><span aria-live="polite">{busy ? 'Preparando prévia…' : 'Pré-visualizar PDF'}</span></button></div>
    </form>}
  </Modal>;
}
