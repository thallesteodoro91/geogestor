import { budgetRequestError } from './budgetRequestError';
import './budget-workspace.css';
import { ArrowClockwise, CheckCircle, Copy, Eye, FilePdf, PaperPlaneTilt, PencilSimple, Prohibit, SealCheck, XCircle
} from '@phosphor-icons/react';
import { BUDGET_STATUS_LABELS, type BudgetStatus } from '@geogestor/contracts';
import { Modal } from '../../components/Modal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FormError, FormField, FormSection, FormSelect } from '../../components/Form';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { formatBasisPoints, formatCurrency, formatDate, formatDateTime, formatQuantity } from './budgetForm';
import { budgetPdfErrorMessage, generateProfessionalBudgetPdf } from './budgetPdfGenerator';
import type { BudgetDetail, BudgetOptions } from './types';
import { invalidateFinancialQueries } from '../../utils/invalidateFinancialQueries';
import { BudgetMoreActions } from './BudgetMoreActions';
import { commercialRows, installmentTexts, scopeDescription } from './budgetPresentation';
import { getCachedCompanyTemplate, loadCompanyTemplate } from '../../services/companyTemplate';

interface BudgetDetailsProps {
  detail: BudgetDetail | null;
  options: BudgetOptions;
  onClose: () => void;
  onEdit: (detail: BudgetDetail) => void;
  onOpenBudget: (detail: BudgetDetail) => void;
}

const fieldClass = cn(geoFieldClass, 'min-h-11 w-full px-3 text-sm');
const actionClass = 'geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-xs';

const statusTone: Record<BudgetStatus, string> = {
  rascunho: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  emitido: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200',
  enviado: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200',
  em_negociacao: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100',
  aprovado: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-100',
  rejeitado: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-100',
  expirado: 'bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-100',
  cancelado: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  substituido: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-100'
};

type ReasonAction = 'rejeitado' | 'cancelado' | 'revision' | null;

export function BudgetDetails({ detail, options, onClose, onEdit, onOpenBudget }: BudgetDetailsProps) {
  const queryClient = useQueryClient();
  const actionLock = useRef(false);
  const [actionError, setActionError] = useState('');
  const runAction = (action: () => void) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionError('');
    setApprovalError('');
    action();
  };
  const { data: company = getCachedCompanyTemplate() } = useQuery({ queryKey: ['company-template'], queryFn: loadCompanyTemplate, enabled: Boolean(detail) });
  const [reasonAction, setReasonAction] = useState<ReasonAction>(null);
  const [reason, setReason] = useState('');
  const [showApproval, setShowApproval] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [projectMode, setProjectMode] = useState<'existing' | 'create'>(detail?.projetoId ? 'existing' : 'create');
  const [projectId, setProjectId] = useState(detail?.projetoId || '');
  const [projectName, setProjectName] = useState(detail ? `${detail.descricao || detail.servicoTipo || 'Projeto'} — ${detail.clientName}` : '');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfInProgress = useRef(false);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [pdfNotice, setPdfNotice] = useState('');
  const [pdfContext, setPdfContext] = useState({ id: detail?.id, updatedAt: detail?.updatedAt });
  const currentPdfFeedback = pdfContext.id === detail?.id && pdfContext.updatedAt === detail?.updatedAt;
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  const pdfOpening = useRef(false);
  const selectedBudgetId = useRef(detail?.id);
  useEffect(() => {
    selectedBudgetId.current = detail?.id;
  }, [detail?.id]);
  const [showDraftPdfConfirm, setShowDraftPdfConfirm] = useState(false);
  const [isMarkingViewed, setIsMarkingViewed] = useState(false);
  const viewedInProgress = useRef(false);

  const clientProjects = useMemo(() => options.projects.filter((project) => project.clientId === detail?.clienteId), [detail?.clienteId, options.projects]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['budget-kpis'] }),
      queryClient.invalidateQueries({ queryKey: ['budget-status-kpis'] }),
      queryClient.invalidateQueries({ queryKey: ['budget-detail', detail?.id] }),
      queryClient.invalidateQueries({ queryKey: ['financeiro-resumo'] }),
      queryClient.invalidateQueries({ queryKey: ['parcelas'] }),
      queryClient.invalidateQueries({ queryKey: ['projetos'] })
    ]);
    await invalidateFinancialQueries(queryClient);
  };

  const downloadPdf = async () => {
    if (!detail || pdfInProgress.current) return;
    pdfInProgress.current = true;
    setIsGeneratingPdf(true);
    setPdfContext({ id: detail.id, updatedAt: detail.updatedAt });
    setSavedPdfPath(null);
    setPdfError('');
    setPdfNotice('');
    const exportingId = detail.id;
    try {
      const destination = await generateProfessionalBudgetPdf(detail);
      if (destination && selectedBudgetId.current === exportingId) setSavedPdfPath(destination);
      if (selectedBudgetId.current === exportingId) setPdfNotice(destination === null ? 'Exportação cancelada. Nenhum arquivo foi salvo.' : destination === undefined ? 'PDF gerado. Confira o arquivo nos downloads.' : '');
    } catch (error) {
      if (selectedBudgetId.current === exportingId) setPdfError(budgetPdfErrorMessage(error));
    } finally {
      pdfInProgress.current = false;
      setIsGeneratingPdf(false);
    }
  };

  const openPdf = async () => {
    if (!currentPdfFeedback || !savedPdfPath || pdfOpening.current || !window.electronAPI?.openBudgetPdf) return;
    pdfOpening.current = true;
    setIsOpeningPdf(true);
    setPdfError('');
    const openingId = detail?.id;
    try {
      await window.electronAPI.openBudgetPdf(savedPdfPath);
    } catch (error) {
      if (selectedBudgetId.current === openingId) setPdfError(budgetPdfErrorMessage(error, 'open'));
    } finally {
      pdfOpening.current = false;
      setIsOpeningPdf(false);
    }
  };

  const generatePdf = () => {
    if (!detail || isGeneratingPdf) return;
    if (detail.status === 'rascunho') {
      setShowDraftPdfConfirm(true);
      return;
    }
    void downloadPdf();
  };

  const transitionMutation = useMutation({
    retry: false,
    onSettled: () => { actionLock.current = false; },
    mutationFn: async ({ status, reason: transitionReason }: { status: BudgetStatus; reason?: string }) => {
      if (!detail) throw new Error('Orçamento não selecionado.');
      if (status === 'emitido') return apiClient.post<BudgetDetail>(`/api/orcamentos/${detail.id}/emit`);
      return apiClient.post<BudgetDetail>(`/api/orcamentos/${detail.id}/transitions`, { status, reason: transitionReason || null });
    },
    onSuccess: async (updated) => {
      await invalidate();
      onOpenBudget(updated);
      setReasonAction(null);
      setReason('');
      toast.success(`Orçamento marcado como ${BUDGET_STATUS_LABELS[updated.status].toLocaleLowerCase('pt-BR')}.`);
    },
    onError: (error) => setActionError(budgetRequestError(error))
  });

  const approveMutation = useMutation({
    retry: false,
    onSettled: () => { actionLock.current = false; },
    mutationFn: async () => {
      if (!detail) throw new Error('Orçamento não selecionado.');
      return apiClient.post<{ projectId: string; installmentIds: string[]; idempotent: boolean }>(`/api/orcamentos/${detail.id}/approve`, {
        idempotencyKey,
        project: { mode: projectMode, projectId: projectMode === 'existing' ? projectId : null, name: projectMode === 'create' ? projectName : null }
      });
    },
    onSuccess: async (result) => {
      await invalidate();
      const updated = await apiClient.get<BudgetDetail>(`/api/orcamentos/${detail!.id}`);
      onOpenBudget(updated);
      setShowApproval(false);
      setApprovalError('');
      toast.success(result.idempotent ? 'Aprovação já concluída; nenhum registro foi duplicado.' : 'Orçamento aprovado e contas a receber previstas geradas.');
    },
    onError: (error) => setApprovalError(budgetRequestError(error))
  });

  const cloneMutation = useMutation({
    retry: false,
    onSettled: () => { actionLock.current = false; },
    mutationFn: async (mode: 'duplicate' | 'revision') => {
      if (!detail) throw new Error('Orçamento não selecionado.');
      if (mode === 'revision') return apiClient.post<BudgetDetail>(`/api/orcamentos/${detail.id}/revisions`, { reason });
      return apiClient.post<BudgetDetail>(`/api/orcamentos/${detail.id}/duplicate`);
    },
    onSuccess: async (created) => {
      await invalidate();
      setReasonAction(null);
      setReason('');
      onOpenBudget(created);
      toast.success('Novo rascunho criado sem alterar o orçamento original.');
    },
    onError: (error) => setActionError(budgetRequestError(error))
  });

  const markViewed = async () => {
    if (!detail || viewedInProgress.current) return;
    viewedInProgress.current = true;
    setIsMarkingViewed(true);
    try {
      const updated = await apiClient.post<BudgetDetail>(`/api/orcamentos/${detail.id}/viewed`);
      await invalidate();
      onOpenBudget(updated);
      toast.success('Visualização registrada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a visualização.');
    } finally {
      viewedInProgress.current = false;
      setIsMarkingViewed(false);
    }
  };

  if (!detail) return null;
  const negativeMargin = typeof detail.margemPontosBase === 'number' && detail.margemPontosBase < 0;
  const canApprove = ['emitido', 'enviado', 'em_negociacao'].includes(detail.status);
  const canReject = ['emitido', 'enviado', 'em_negociacao'].includes(detail.status);
  const canCancel = ['rascunho', 'emitido', 'enviado', 'em_negociacao', 'aprovado'].includes(detail.status);
  const actionPending = transitionMutation.isPending || cloneMutation.isPending || approveMutation.isPending || isMarkingViewed;
  const documentActions = [
    ...(detail.status === 'rascunho' ? [{ label: isGeneratingPdf ? 'Gerando PDF…' : 'Gerar PDF', icon: <FilePdf aria-hidden="true" size={17} />, onClick: generatePdf, disabled: isGeneratingPdf }] : []),
    { label: cloneMutation.isPending ? 'Duplicando…' : 'Duplicar', icon: <Copy aria-hidden="true" size={17} />, onClick: () => runAction(() => cloneMutation.mutate('duplicate')), disabled: actionPending },
    ...(detail.status === 'aprovado' ? [{ label: 'Criar revisão', icon: <ArrowClockwise aria-hidden="true" size={17} />, onClick: () => setReasonAction('revision'), disabled: actionPending }] : [])
  ];
  const commercialActions = [
    ...(['emitido', 'enviado'].includes(detail.status) ? [{ label: 'Em negociação', icon: <ArrowClockwise aria-hidden="true" size={17} />, onClick: () => runAction(() => transitionMutation.mutate({ status: 'em_negociacao' })), disabled: actionPending }] : []),
    ...(!detail.visualizadoEm && detail.status !== 'rascunho' ? [{ label: 'Registrar visualização', icon: <Eye aria-hidden="true" size={17} />, onClick: () => void markViewed(), disabled: actionPending }] : []),
    ...(canReject ? [{ label: 'Rejeitar', icon: <XCircle aria-hidden="true" size={17} />, onClick: () => setReasonAction('rejeitado'), disabled: actionPending }] : []),
    ...(canCancel ? [{ label: 'Cancelar orçamento', icon: <Prohibit aria-hidden="true" size={17} />, onClick: () => setReasonAction('cancelado'), disabled: actionPending }] : [])
  ];
  const totalInstallments = detail.installments.reduce((sum, installment) => sum + installment.valor, 0);
  const paidInstallments = detail.installments.reduce((sum, installment) => sum + (installment.valorPago || 0), 0);
  const financialGroups = [
    {
      title: 'Composi\u00e7\u00e3o do valor',
      items: [
        ['Honor\u00e1rios brutos', detail.honorariosBrutos],
        ['Despesas reembols\u00e1veis', detail.valorReembolsavel],
        ['Taxas repassadas', detail.subtotalTaxas]
      ]
    },
    {
      title: 'Custos e impostos',
      items: [
        ['Impostos previstos', detail.impostosPrevistos],
        ['Custos operacionais', detail.custoTotalEstimado]
      ]
    },
    {
      title: 'Resultado financeiro',
      items: [
        ['Honor\u00e1rios l\u00edquidos', detail.honorariosLiquidos],
        ['Lucro estimado', detail.lucroEstimado]
      ]
    }
  ];

  return (
    <>
      <Modal isOpen={Boolean(detail)} onClose={onClose} closeDisabled={actionPending || isGeneratingPdf || isOpeningPdf} title={`${detail.codigoOrcamento || 'Rascunho'} • versão ${detail.versao}`} maxWidth="max-w-[1420px]">
        <div className="space-y-5">
          <header className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-brand-surface-subtle/60 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-bold', statusTone[detail.status])}>{BUDGET_STATUS_LABELS[detail.status]}</span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">Proposta comercial</h2>
            </div>
          </header>

          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <div role="group" aria-label="Documento" className="space-y-2">
              <p className="text-xs font-semibold text-text-secondary">Documento</p>
              <div className="flex flex-wrap gap-2">
                {detail.status === 'rascunho' ? <>
                  <button type="button" disabled={actionPending || isGeneratingPdf} onClick={() => onEdit(detail)} className={actionClass}><PencilSimple aria-hidden="true" size={17} /> Editar orçamento</button>
                  <button type="button" disabled={actionPending || isGeneratingPdf} aria-busy={transitionMutation.isPending} onClick={() => runAction(() => transitionMutation.mutate({ status: 'emitido' }))} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-4 text-xs disabled:opacity-60"><SealCheck aria-hidden="true" size={17} /> <span className="budget-stable-label"><span aria-hidden="true" className={transitionMutation.isPending ? 'invisible' : ''}>Emitir orçamento</span><span className={transitionMutation.isPending ? '' : 'sr-only'}>{transitionMutation.isPending ? 'Emitindo…' : 'Emitir orçamento'}</span></span></button>
                </> : <button type="button" onClick={generatePdf} disabled={isGeneratingPdf || actionPending} aria-busy={isGeneratingPdf} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-4 text-xs disabled:cursor-wait disabled:opacity-60"><FilePdf aria-hidden="true" size={17} /> {isGeneratingPdf ? 'Gerando PDF…' : 'Gerar PDF'}</button>}
                <BudgetMoreActions actions={documentActions} disabled={actionPending || isGeneratingPdf} />
              </div>
            </div>
            {(canCancel || canApprove || (!detail.visualizadoEm && detail.status !== 'rascunho')) && <div role="group" aria-label="Andamento comercial" className="space-y-2">
              <p className="text-xs font-semibold text-text-secondary">Andamento comercial</p>
              <div className="flex flex-wrap gap-2">
                {detail.status === 'emitido' && <button type="button" disabled={actionPending || isGeneratingPdf} onClick={() => runAction(() => transitionMutation.mutate({ status: 'enviado' }))} className={actionClass}><PaperPlaneTilt aria-hidden="true" size={17} /> Marcar como enviado</button>}
                {canApprove && <button type="button" disabled={actionPending || isGeneratingPdf} onClick={() => { setIdempotencyKey(crypto.randomUUID()); setApprovalError(''); setShowApproval(true); }} className={actionClass}><CheckCircle aria-hidden="true" size={17} /> Aprovar</button>}
                <BudgetMoreActions label="Mais ações comerciais" actions={commercialActions} disabled={actionPending || isGeneratingPdf} />
              </div>
            </div>}
          </div>

          <div aria-live="polite" aria-atomic="true">
            {actionError && <FormError message={actionError} />}
            {currentPdfFeedback && pdfError && <FormError message={pdfError} />}
            {currentPdfFeedback && pdfNotice && <p className="text-sm text-text-secondary">{pdfNotice}</p>}
            {currentPdfFeedback && savedPdfPath && <div className="flex flex-wrap items-center gap-3 text-sm"><p>Orçamento salvo em PDF.</p><button type="button" onClick={() => void openPdf()} disabled={isOpeningPdf} aria-busy={isOpeningPdf} className={actionClass}>{isOpeningPdf ? 'Abrindo arquivo…' : 'Abrir arquivo'}</button></div>}
          </div>

          <FormSection headingLevel={3} title="Resumo da proposta ao cliente" description="Confira as informações comerciais essenciais. A apresentação completa está no PDF; custos internos, margem e lucro ficam na gestão." className="[&>div:first-child>p]:text-text-secondary">
            <article className="budget-client-summary mx-auto max-w-4xl rounded-sm border p-6 sm:p-8">
              <header className="flex flex-col gap-4 border-b-2 border-indigo-600 pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words text-lg font-bold" translate="no">{company.razao || 'GeoGestor — Serviços técnicos'}</p>{company.logo && <img src={company.logo} alt={`Logo de ${company.razao || 'empresa'}`} width={120} height={56} className="mt-2 h-14 w-[120px] object-contain object-left" />}</div><div className="shrink-0 sm:text-right"><p className="font-mono font-bold">{detail.codigoOrcamento || 'Rascunho'} v{detail.versao}</p>{detail.dataEmissao && <p className="text-sm budget-paper-secondary">Emissão: {formatDate(detail.dataEmissao)}</p>}</div></header>
              <h4 className="mt-6 break-words text-xl font-bold">{detail.descricao || 'Proposta comercial'}</h4>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="budget-paper-secondary">Cliente</dt><dd className="break-words">{detail.clientName}</dd></div>
                {detail.clientDocument && <div><dt className="budget-paper-secondary">CPF / CNPJ</dt><dd>{detail.clientDocument}</dd></div>}
                {(detail.clientPhone || detail.clientEmail) && <div><dt className="budget-paper-secondary">Contato</dt><dd className="break-words">{[detail.clientPhone, detail.clientEmail].filter(Boolean).join(' · ')}</dd></div>}
                {detail.servicoTipo && <div><dt className="budget-paper-secondary">Tipo de serviço</dt><dd className="break-words">{detail.servicoTipo}</dd></div>}
                {detail.imovelNome && <div><dt className="budget-paper-secondary">Imóvel</dt><dd className="break-words">{detail.imovelNome}</dd></div>}
                {(detail.municipio || detail.uf) && <div><dt className="budget-paper-secondary">Localização</dt><dd>{[detail.municipio, detail.uf].filter(Boolean).join(' / ')}</dd></div>}
              </dl>
              <h5 className="mt-6 text-sm font-bold">Resumo comercial</h5>
              <dl className="mt-3 grid gap-4 border-y budget-paper-border py-4 text-sm sm:grid-cols-2">
                {commercialRows(detail).map(([label, value]) => <div key={label}><dt className="budget-paper-secondary">{label}</dt><dd className={cn('whitespace-pre-wrap break-words', label === 'Investimento total' && 'font-mono text-2xl font-bold budget-paper-accent tabular-nums')}>{value}</dd></div>)}
              </dl>
              {!!detail.payment?.installments.length && <ol className="mt-4 space-y-2 text-sm tabular-nums">{installmentTexts(detail.valorTotal, detail.payment.installments).map((text, index) => <li key={index} className="whitespace-pre-wrap break-words">{text}</li>)}</ol>}
              {detail.payment?.description?.trim() && <div className="mt-4 text-sm"><p className="font-semibold">Condição complementar</p><p className="whitespace-pre-wrap break-words budget-paper-secondary">{detail.payment.description}</p></div>}
              {detail.observacoesCliente && <p className="mt-5 whitespace-pre-wrap break-words text-sm budget-paper-secondary">{detail.observacoesCliente}</p>}
              {detail.termosCondicoes?.trim() && <div className="mt-5 text-sm"><h5 className="font-semibold">Termos e condições</h5><p className="mt-1 whitespace-pre-wrap break-words leading-6 budget-paper-secondary">{detail.termosCondicoes}</p></div>}
            </article>
          </FormSection>

          <section aria-labelledby="budget-financial-statement-title" className="border-y border-brand-border">
            <div className="flex flex-col gap-1 border-b border-brand-border bg-brand-surface-subtle/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h3 id="budget-financial-statement-title" className="text-sm font-semibold text-text-primary">Demonstrativo financeiro</h3>
                <p className="mt-0.5 text-xs text-text-secondary">Composi&ccedil;&atilde;o interna da proposta e resultado estimado.</p>
              </div>
              <p className="text-xs text-text-secondary">Valores previstos, sujeitos &agrave; liquida&ccedil;&atilde;o.</p>
            </div>
            <div className="grid divide-y divide-brand-border xl:grid-cols-[1fr_0.85fr_1fr_0.72fr] xl:divide-x xl:divide-y-0">
              {financialGroups.map((group) => (
                <div key={group.title} className="min-w-0 px-4 py-4 sm:px-5">
                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{group.title}</h4>
                  <dl className="mt-2 divide-y divide-brand-border">
                    {group.items.map(([label, value]) => <div key={String(label)} className="flex items-center justify-between gap-4 py-2.5"><dt className="text-xs text-text-secondary">{label}</dt><dd className="whitespace-nowrap font-mono text-sm font-bold tabular-nums text-text-primary">{formatCurrency(value as number | undefined)}</dd></div>)}
                  </dl>
                </div>
              ))}
              <div className={cn('flex min-w-0 flex-col justify-between px-4 py-4 sm:px-5', negativeMargin ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-brand-green-50/55 dark:bg-brand-green-500/10')}>
                <div>
                  <p className={cn('text-xs font-semibold', negativeMargin ? 'text-rose-800 dark:text-rose-200' : 'text-brand-green-700 dark:text-brand-green-100')}>Margem estimada</p>
                  <p className="mt-2 font-mono text-3xl font-bold tracking-tight tabular-nums text-text-primary">{formatBasisPoints(detail.margemPontosBase)}</p>
                </div>
                <p className="mt-4 text-xs leading-5 text-text-muted">{negativeMargin ? 'Margem negativa: o resultado estimado está abaixo de zero. Informação para revisão, sem bloquear a proposta.' : 'Relação entre o lucro estimado e o valor total da proposta.'}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <FormSection headingLevel={3} title="Dados técnicos e vínculo interno">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-text-muted">Projeto</dt><dd className="font-semibold text-text-primary">{detail.projectName || 'Será definido na aprovação'}</dd></div>
                <div><dt className="text-xs text-text-muted">Responsável técnico</dt><dd className="font-semibold text-text-primary">{detail.responsavelTecnico || 'Não informado'}</dd></div>
              </dl>
              {scopeDescription(detail) && <div><h4 className="text-xs font-semibold text-text-secondary">Descrição do escopo</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{scopeDescription(detail)}</p></div>}
              <div><h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Metodologia</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{detail.metodologia || 'Não informada.'}</p></div>
              <div><h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Entregáveis</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{detail.entregaveis || 'Não informados.'}</p></div>
            </FormSection>

            <FormSection headingLevel={3} title="Contas a receber e caixa" description="Previsão contratada não é receita realizada.">
              <div className="grid gap-3 sm:grid-cols-3"><dl><dt className="text-xs text-text-muted">Previsto</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(totalInstallments)}</dd></dl><dl><dt className="text-xs text-text-muted">Recebido</dt><dd className="font-mono font-bold tabular-nums text-brand-green-700 dark:text-brand-green-100">{formatCurrency(paidInstallments)}</dd></dl><dl><dt className="text-xs text-text-muted">Em aberto</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(totalInstallments - paidInstallments)}</dd></dl></div>
              <div className="space-y-2">{detail.installments.length ? detail.installments.map((installment) => <div key={installment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-border p-3 text-sm"><div><p className="font-semibold">Parcela {installment.numero}</p><p className="text-xs text-text-muted">Vencimento {formatDate(installment.dataVencimento)} • {installment.statusPagamento}</p></div><p className="font-mono font-bold tabular-nums">{formatCurrency(installment.valor)}</p></div>) : <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-text-muted">As contas a receber serão criadas somente na aprovação.</p>}</div>
            </FormSection>
          </div>

          <FormSection headingLevel={3} title="Itens do documento">
            <div className="max-w-full overflow-x-auto rounded-xl border border-brand-border overscroll-contain">
              <table className="min-w-[840px] w-full text-left text-sm"><thead className="bg-brand-surface-subtle text-xs font-semibold uppercase tracking-wider text-text-primary"><tr><th scope="col" className="p-3">Descrição</th><th scope="col" className="p-3">Unidade</th><th scope="col" className="p-3 text-right">Qtd.</th><th scope="col" className="p-3 text-right">Preço unit.</th><th scope="col" className="p-3 text-right">Total</th><th scope="col" className="p-3">Tipo</th></tr></thead><tbody className="divide-y divide-brand-border">{detail.items.map((item) => <tr key={item.id}><td className="p-3"><p className="font-semibold text-text-primary">{item.description}</p>{item.optional && <span className="text-xs text-text-muted">Opcional</span>}</td><td className="p-3">{item.unit}</td><td className="p-3 text-right font-mono tabular-nums">{formatQuantity(item.quantity)}</td><td className="p-3 text-right font-mono tabular-nums">{formatCurrency(item.unitPriceCents)}</td><td className="p-3 text-right font-mono font-bold tabular-nums">{formatCurrency(item.totalCents)}</td><td className="p-3">{item.component === 'servico' ? 'Serviço' : item.component === 'despesa' ? 'Despesa' : 'Taxa repassada'}</td></tr>)}</tbody></table>
            </div>
          </FormSection>

          <div className="grid gap-5 xl:grid-cols-2">
            <FormSection headingLevel={3} title="Impostos previstos">
              {detail.taxes.length ? detail.taxes.map((tax) => <div key={tax.id} className="flex items-center justify-between gap-3 rounded-xl border border-brand-border p-3 text-sm"><div><p className="font-semibold">{tax.name} ({tax.acronym})</p><p className="text-xs text-text-muted">{formatQuantity(tax.ratePercent)}% • {tax.includedInPrice ? 'incluso no preço' : 'adicionado por fora'} • base {formatCurrency(tax.baseCents)}</p></div><p className="font-mono font-bold tabular-nums">{formatCurrency(tax.amountCents)}</p></div>) : <p className="text-sm text-text-muted">Nenhum imposto configurado.</p>}
            </FormSection>
            <FormSection headingLevel={3} title="Histórico e auditoria">
              <ol className="space-y-3">{detail.history.map((entry) => <li key={entry.id} className="border-l-2 border-brand-primary-300 pl-3"><p className="text-sm font-semibold text-text-primary">{BUDGET_STATUS_LABELS[entry.statusNovo as BudgetStatus] || entry.statusNovo}</p><p className="text-xs text-text-muted">{formatDateTime(entry.createdAt)} • {entry.usuarioId}</p>{entry.motivo && <p className="mt-1 text-sm text-text-secondary">{entry.motivo}</p>}</li>)}</ol>
            </FormSection>
          </div>


        </div>
      </Modal>

      <Modal closeDisabled={actionPending} isOpen={Boolean(reasonAction)} onClose={() => { if (!cloneMutation.isPending && !transitionMutation.isPending) setReasonAction(null); }} title={reasonAction === 'revision' ? 'Criar revisão formal' : reasonAction === 'rejeitado' ? 'Rejeitar orçamento' : 'Cancelar orçamento'} maxWidth="max-w-lg">
        <div className="space-y-5"><FormError message={actionError} /><p className="text-sm leading-6 text-text-secondary">{reasonAction === 'revision' ? 'Uma nova versão em rascunho será criada. O orçamento aprovado permanece vigente até a aprovação da revisão.' : reasonAction === 'cancelado' && detail.status === 'aprovado' ? 'Parcelas futuras em aberto serão canceladas, mas pagamentos já recebidos e o histórico serão preservados.' : 'O motivo ficará registrado no histórico e na auditoria.'}</p><FormField htmlFor="budget-reason" label="Motivo" required><textarea disabled={actionPending} id="budget-reason" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className={cn(fieldClass, 'resize-y py-3')} /></FormField><div className="flex justify-end gap-3"><button type="button" onClick={() => setReasonAction(null)} disabled={actionPending} className={actionClass}>Voltar</button><button type="button" disabled={reason.trim().length < 3 || cloneMutation.isPending || transitionMutation.isPending} onClick={() => runAction(() => reasonAction === 'revision' ? cloneMutation.mutate('revision') : transitionMutation.mutate({ status: reasonAction!, reason }))} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5 disabled:opacity-50"><span className="budget-stable-label"><span aria-hidden="true" className={cloneMutation.isPending || transitionMutation.isPending ? 'invisible' : ''}>Confirmar</span><span className={cloneMutation.isPending || transitionMutation.isPending ? '' : 'sr-only'}>{cloneMutation.isPending || transitionMutation.isPending ? 'Processando…' : 'Confirmar'}</span></span></button></div></div>
      </Modal>

      <Modal closeDisabled={actionPending} isOpen={showApproval} onClose={() => { if (!approveMutation.isPending) setShowApproval(false); }} title="Confirmar aprovação e efeitos financeiros" maxWidth="max-w-2xl">
        <div className="space-y-5"><FormError message={approvalError} /><div className="rounded-xl border border-brand-border bg-brand-surface-subtle/60 p-4"><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-text-muted">Cliente</dt><dd className="font-semibold">{detail.clientName}</dd></div><div><dt className="text-xs text-text-muted">Total contratado</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(detail.valorTotal)}</dd></div><div><dt className="text-xs text-text-muted">Honorários líquidos previstos</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(detail.honorariosLiquidos)}</dd></div><div><dt className="text-xs text-text-muted">Impostos previstos</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(detail.impostosPrevistos)}</dd></div><div><dt className="text-xs text-text-muted">Parcelas</dt><dd className="font-semibold">{detail.payment?.installments.length || 0}</dd></div><div><dt className="text-xs text-text-muted">Conta financeira</dt><dd className="font-semibold">{detail.payment?.financialAccount || 'Não informada'}</dd></div></dl></div><fieldset disabled={actionPending} className="space-y-3"><legend className="text-xs font-semibold uppercase tracking-wider text-text-muted">Projeto</legend><label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="radio" name="projectMode" checked={projectMode === 'existing'} onChange={() => setProjectMode('existing')} /> Vincular projeto existente</label>{projectMode === 'existing' && <FormSelect aria-label="Projeto existente para vincular" value={projectId} onChange={(event) => setProjectId(event.target.value)} className={fieldClass}><option value="">Selecione…</option>{clientProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</FormSelect>}<label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="radio" name="projectMode" checked={projectMode === 'create'} onChange={() => setProjectMode('create')} /> Criar novo projeto</label>{projectMode === 'create' && <input aria-label="Nome do novo projeto" value={projectName} onChange={(event) => setProjectName(event.target.value)} className={fieldClass} />}</fieldset><p className="rounded-xl border border-brand-turquoise-200 bg-brand-turquoise-50 p-3 text-sm text-brand-turquoise-900 dark:border-brand-turquoise-300/25 dark:bg-brand-turquoise-500/10 dark:text-brand-turquoise-100">A aprovação criará contas a receber previstas. Nenhum valor será registrado como recebido, receita realizada ou entrada de caixa até a liquidação confirmada.</p><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowApproval(false)} disabled={actionPending} className={actionClass}>Voltar</button><button type="button" disabled={approveMutation.isPending || (projectMode === 'existing' ? !projectId : !projectName.trim())} onClick={() => runAction(() => approveMutation.mutate())} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5 disabled:opacity-50"><span className="budget-stable-label"><span aria-hidden="true" className={approveMutation.isPending ? 'invisible' : ''}>Aprovar e gerar efeitos</span><span className={approveMutation.isPending ? '' : 'sr-only'}>{approveMutation.isPending ? 'Aprovando…' : 'Aprovar e gerar efeitos'}</span></span></button></div></div>
      </Modal>

      <Modal isOpen={showDraftPdfConfirm} onClose={() => { if (!isGeneratingPdf) setShowDraftPdfConfirm(false); }} title="Exportar orçamento em rascunho" maxWidth="max-w-lg">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-text-secondary">Este orçamento ainda não foi emitido. O PDF terá a marca-d’água “RASCUNHO — NÃO ENVIAR” em todas as páginas para evitar envio acidental ao cliente.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setShowDraftPdfConfirm(false)} disabled={isGeneratingPdf} className={actionClass}>Continuar editando</button>
            <button type="button" onClick={() => { setShowDraftPdfConfirm(false); void downloadPdf(); }} disabled={isGeneratingPdf} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5 disabled:cursor-wait disabled:opacity-60">Exportar com marca-d’água</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
