import { ArrowClockwise, CheckCircle, Copy, Eye, FilePdf, PaperPlaneTilt, PencilSimple, Prohibit, SealCheck, XCircle
} from '@phosphor-icons/react';
import { BUDGET_STATUS_LABELS, type BudgetStatus } from '@geogestor/contracts';
import { Modal } from '../../components/Modal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import { FormError, FormField, FormSection, FormSelect } from '../../components/Form';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { formatBasisPoints, formatCurrency, formatDate, formatDateTime } from './budgetForm';
import { generateProfessionalBudgetPdf } from './budgetPdfGenerator';
import type { BudgetDetail, BudgetOptions } from './types';

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
  const [reasonAction, setReasonAction] = useState<ReasonAction>(null);
  const [reason, setReason] = useState('');
  const [showApproval, setShowApproval] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [projectMode, setProjectMode] = useState<'existing' | 'create'>(detail?.projetoId ? 'existing' : 'create');
  const [projectId, setProjectId] = useState(detail?.projetoId || '');
  const [projectName, setProjectName] = useState(detail ? `${detail.descricao || detail.servicoTipo || 'Projeto'} — ${detail.clientName}` : '');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

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
  };

  const transitionMutation = useMutation({
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
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o status.')
  });

  const approveMutation = useMutation({
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
    onError: (error) => setApprovalError(error instanceof Error ? error.message : 'Não foi possível aprovar o orçamento.')
  });

  const cloneMutation = useMutation({
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
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível criar a cópia.')
  });

  const markViewed = async () => {
    if (!detail) return;
    try {
      const updated = await apiClient.post<BudgetDetail>(`/api/orcamentos/${detail.id}/viewed`);
      await invalidate();
      onOpenBudget(updated);
      toast.success('Visualização registrada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a visualização.');
    }
  };

  if (!detail) return null;
  const canApprove = ['emitido', 'enviado', 'em_negociacao'].includes(detail.status);
  const canReject = ['emitido', 'enviado', 'em_negociacao'].includes(detail.status);
  const canCancel = ['rascunho', 'emitido', 'enviado', 'em_negociacao', 'aprovado'].includes(detail.status);
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
      <Modal isOpen={Boolean(detail)} onClose={onClose} title={`${detail.codigoOrcamento || 'Rascunho'} • versão ${detail.versao}`} maxWidth="max-w-[1420px]">
        <div className="space-y-5">
          <header className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-brand-surface-subtle/60 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-bold', statusTone[detail.status])}>{BUDGET_STATUS_LABELS[detail.status]}</span>
              <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight text-text-primary">{detail.descricao || 'Orçamento sem título'}</h2>
              <p className="mt-1 text-sm text-text-secondary">{detail.clientName} • {detail.servicoTipo || 'Serviço não informado'} • validade {formatDate(detail.validadeAte)}</p>
            </div>
            <div className="text-left lg:text-right"><p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Valor total</p><p className="font-mono text-3xl font-bold tabular-nums text-text-primary">{formatCurrency(detail.valorTotal)}</p><p className="mt-1 text-xs text-text-muted">Honorários líquidos previstos: {formatCurrency(detail.honorariosLiquidos)}</p></div>
          </header>

          <div className="flex flex-wrap gap-2" aria-label="Ações do orçamento">
            {detail.status === 'rascunho' && <><button type="button" onClick={() => onEdit(detail)} className={actionClass}><PencilSimple aria-hidden="true" size={17} /> Editar rascunho</button><button type="button" onClick={() => transitionMutation.mutate({ status: 'emitido' })} className={actionClass}><SealCheck aria-hidden="true" size={17} /> Emitir</button></>}
            {detail.status === 'emitido' && <button type="button" onClick={() => transitionMutation.mutate({ status: 'enviado' })} className={actionClass}><PaperPlaneTilt aria-hidden="true" size={17} /> Marcar como enviado</button>}
            {['emitido', 'enviado'].includes(detail.status) && <button type="button" onClick={() => transitionMutation.mutate({ status: 'em_negociacao' })} className={actionClass}><ArrowClockwise aria-hidden="true" size={17} /> Em negociação</button>}
            {canApprove && <button type="button" onClick={() => { setIdempotencyKey(crypto.randomUUID()); setApprovalError(''); setShowApproval(true); }} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-4 text-xs"><CheckCircle aria-hidden="true" size={17} /> Aprovar</button>}
            {canReject && <button type="button" onClick={() => setReasonAction('rejeitado')} className={actionClass}><XCircle aria-hidden="true" size={17} /> Rejeitar</button>}
            {canCancel && <button type="button" onClick={() => setReasonAction('cancelado')} className={cn(actionClass, 'text-brand-red-700 dark:text-brand-red-100')}><Prohibit aria-hidden="true" size={17} /> Cancelar</button>}
            {detail.status === 'aprovado' && <button type="button" onClick={() => setReasonAction('revision')} className={actionClass}><ArrowClockwise aria-hidden="true" size={17} /> Criar revisão</button>}
            {!detail.visualizadoEm && detail.status !== 'rascunho' && <button type="button" onClick={markViewed} className={actionClass}><Eye aria-hidden="true" size={17} /> Registrar visualização</button>}
            <button type="button" onClick={() => cloneMutation.mutate('duplicate')} className={actionClass}><Copy aria-hidden="true" size={17} /> Duplicar</button>
            <button type="button" onClick={() => generateProfessionalBudgetPdf(detail)} className={actionClass}><FilePdf aria-hidden="true" size={17} /> Gerar PDF</button>
          </div>

          <section aria-labelledby="budget-financial-statement-title" className="border-y border-brand-border">
            <div className="flex flex-col gap-1 border-b border-brand-border bg-brand-surface-subtle/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h3 id="budget-financial-statement-title" className="text-sm font-semibold text-text-primary">Demonstrativo financeiro</h3>
                <p className="mt-0.5 text-xs text-text-muted">Composi&ccedil;&atilde;o interna da proposta e resultado estimado.</p>
              </div>
              <p className="text-xs text-text-muted">Valores previstos, sujeitos &agrave; liquida&ccedil;&atilde;o.</p>
            </div>
            <div className="grid divide-y divide-brand-border xl:grid-cols-[1fr_0.85fr_1fr_0.72fr] xl:divide-x xl:divide-y-0">
              {financialGroups.map((group) => (
                <div key={group.title} className="min-w-0 px-4 py-4 sm:px-5">
                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{group.title}</h4>
                  <dl className="mt-2 divide-y divide-brand-border">
                    {group.items.map(([label, value]) => <div key={String(label)} className="flex items-center justify-between gap-4 py-2.5"><dt className="text-xs text-text-secondary">{label}</dt><dd className="whitespace-nowrap font-mono text-sm font-bold tabular-nums text-text-primary">{formatCurrency(value as number | undefined)}</dd></div>)}
                  </dl>
                </div>
              ))}
              <div className="flex min-w-0 flex-col justify-between bg-brand-green-50/55 px-4 py-4 dark:bg-brand-green-500/10 sm:px-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-green-700 dark:text-brand-green-100">Margem estimada</p>
                  <p className="mt-2 font-mono text-3xl font-bold tracking-tight tabular-nums text-text-primary">{formatBasisPoints(detail.margemPontosBase)}</p>
                </div>
                <p className="mt-4 text-xs leading-5 text-text-muted">Rela&ccedil;&atilde;o entre o lucro estimado e o valor total da proposta.</p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <FormSection title="Cliente, imóvel e escopo">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-text-muted">Cliente</dt><dd className="font-semibold text-text-primary">{detail.clientName}</dd></div>
                <div><dt className="text-xs text-text-muted">CPF/CNPJ</dt><dd className="font-semibold text-text-primary">{detail.clientDocument || 'Não informado'}</dd></div>
                <div><dt className="text-xs text-text-muted">Imóvel</dt><dd className="font-semibold text-text-primary">{detail.imovelNome || 'Não informado'} ({detail.imovelTipo || 'sem classificação'})</dd></div>
                <div><dt className="text-xs text-text-muted">Localização</dt><dd className="font-semibold text-text-primary">{[detail.municipio, detail.uf].filter(Boolean).join(' / ') || 'Não informada'}</dd></div>
                <div><dt className="text-xs text-text-muted">Projeto</dt><dd className="font-semibold text-text-primary">{detail.projectName || 'Será definido na aprovação'}</dd></div>
                <div><dt className="text-xs text-text-muted">Responsável técnico</dt><dd className="font-semibold text-text-primary">{detail.responsavelTecnico || 'Não informado'}</dd></div>
              </dl>
              <div><h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Metodologia</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{detail.metodologia || 'Não informada.'}</p></div>
              <div><h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Entregáveis</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{detail.entregaveis || 'Não informados.'}</p></div>
            </FormSection>

            <FormSection title="Contas a receber e caixa" description="Previsão contratada não é receita realizada.">
              <div className="grid gap-3 sm:grid-cols-3"><dl><dt className="text-xs text-text-muted">Previsto</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(totalInstallments)}</dd></dl><dl><dt className="text-xs text-text-muted">Recebido</dt><dd className="font-mono font-bold tabular-nums text-brand-green-700 dark:text-brand-green-100">{formatCurrency(paidInstallments)}</dd></dl><dl><dt className="text-xs text-text-muted">Em aberto</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(totalInstallments - paidInstallments)}</dd></dl></div>
              <div className="space-y-2">{detail.installments.length ? detail.installments.map((installment) => <div key={installment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-border p-3 text-sm"><div><p className="font-semibold">Parcela {installment.numero}</p><p className="text-xs text-text-muted">Vencimento {formatDate(installment.dataVencimento)} • {installment.statusPagamento}</p></div><p className="font-mono font-bold tabular-nums">{formatCurrency(installment.valor)}</p></div>) : <p className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-text-muted">As contas a receber serão criadas somente na aprovação.</p>}</div>
            </FormSection>
          </div>

          <FormSection title="Itens do documento">
            <div className="max-w-full overflow-x-auto rounded-xl border border-brand-border overscroll-contain">
              <table className="min-w-[840px] w-full text-left text-sm"><thead className="bg-brand-surface-subtle text-xs uppercase tracking-wider text-text-muted"><tr><th className="p-3">Descrição</th><th className="p-3">Unidade</th><th className="p-3 text-right">Qtd.</th><th className="p-3 text-right">Preço unit.</th><th className="p-3 text-right">Total</th><th className="p-3">Tipo</th></tr></thead><tbody className="divide-y divide-brand-border">{detail.items.map((item) => <tr key={item.id}><td className="p-3"><p className="font-semibold text-text-primary">{item.description}</p>{item.optional && <span className="text-xs text-text-muted">Opcional</span>}</td><td className="p-3">{item.unit}</td><td className="p-3 text-right font-mono tabular-nums">{item.quantity}</td><td className="p-3 text-right font-mono tabular-nums">{formatCurrency(item.unitPriceCents)}</td><td className="p-3 text-right font-mono font-bold tabular-nums">{formatCurrency(item.totalCents)}</td><td className="p-3">{item.component === 'servico' ? 'Serviço' : item.component === 'despesa' ? 'Despesa' : 'Taxa repassada'}</td></tr>)}</tbody></table>
            </div>
          </FormSection>

          <div className="grid gap-5 xl:grid-cols-2">
            <FormSection title="Impostos previstos">
              {detail.taxes.length ? detail.taxes.map((tax) => <div key={tax.id} className="flex items-center justify-between gap-3 rounded-xl border border-brand-border p-3 text-sm"><div><p className="font-semibold">{tax.name} ({tax.acronym})</p><p className="text-xs text-text-muted">{tax.ratePercent}% • {tax.includedInPrice ? 'incluso no preço' : 'adicionado por fora'} • base {formatCurrency(tax.baseCents)}</p></div><p className="font-mono font-bold tabular-nums">{formatCurrency(tax.amountCents)}</p></div>) : <p className="text-sm text-text-muted">Nenhum imposto configurado.</p>}
            </FormSection>
            <FormSection title="Histórico e auditoria">
              <ol className="space-y-3">{detail.history.map((entry) => <li key={entry.id} className="border-l-2 border-brand-primary-300 pl-3"><p className="text-sm font-semibold text-text-primary">{BUDGET_STATUS_LABELS[entry.statusNovo as BudgetStatus] || entry.statusNovo}</p><p className="text-xs text-text-muted">{formatDateTime(entry.createdAt)} • {entry.usuarioId}</p>{entry.motivo && <p className="mt-1 text-sm text-text-secondary">{entry.motivo}</p>}</li>)}</ol>
            </FormSection>
          </div>

          <FormSection title="Pré-visualização do documento" description="Custos internos, margem e lucro não aparecem nesta visualização destinada ao cliente.">
            <article className="mx-auto max-w-4xl rounded-sm border border-zinc-200 bg-white p-6 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-100 sm:p-10">
              <header className="flex flex-col gap-4 border-b-2 border-indigo-600 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-lg font-bold">GeoGestor — Proposta comercial</p><p className="text-sm text-zinc-500">{detail.clientName}</p></div><div className="sm:text-right"><p className="font-mono font-bold">{detail.codigoOrcamento || 'Rascunho'} v{detail.versao}</p><p className="text-sm text-zinc-500">Validade: {formatDate(detail.validadeAte)}</p></div></header>
              <h3 className="mt-6 text-xl font-bold">{detail.descricao}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{detail.metodologia || 'Metodologia a detalhar.'}</p>
              <div className="mt-6 space-y-2">{detail.items.filter((item) => !item.optional).map((item) => <div key={item.id} className="flex justify-between gap-4 border-b border-zinc-200 py-2 text-sm"><span>{item.description}</span><strong className="font-mono tabular-nums">{formatCurrency(item.totalCents)}</strong></div>)}</div>
              {detail.items.some((item) => item.optional) && <div className="mt-6"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Opcionais — não incluídos no total</p><div className="mt-2 space-y-2">{detail.items.filter((item) => item.optional).map((item) => <div key={item.id} className="flex justify-between gap-4 border-b border-dashed border-zinc-300 py-2 text-sm"><span>{item.description}</span><strong className="font-mono tabular-nums">+ {formatCurrency(item.totalCents)}</strong></div>)}</div></div>}
              <div className="mt-6 flex justify-end"><div className="text-right"><p className="text-xs uppercase tracking-wider text-zinc-500">Investimento total</p><p className="font-mono text-2xl font-bold text-indigo-700 tabular-nums">{formatCurrency(detail.valorTotal)}</p></div></div>
              <p className="mt-8 whitespace-pre-wrap text-xs leading-5 text-zinc-500">{detail.termosCondicoes || 'Termos não informados.'}</p>
            </article>
          </FormSection>
        </div>
      </Modal>

      <Modal isOpen={Boolean(reasonAction)} onClose={() => { if (!cloneMutation.isPending && !transitionMutation.isPending) setReasonAction(null); }} title={reasonAction === 'revision' ? 'Criar revisão formal' : reasonAction === 'rejeitado' ? 'Rejeitar orçamento' : 'Cancelar orçamento'} maxWidth="max-w-lg">
        <div className="space-y-5"><p className="text-sm leading-6 text-text-secondary">{reasonAction === 'revision' ? 'Uma nova versão em rascunho será criada. O orçamento aprovado permanece vigente até a aprovação da revisão.' : reasonAction === 'cancelado' && detail.status === 'aprovado' ? 'Parcelas futuras em aberto serão canceladas, mas pagamentos já recebidos e o histórico serão preservados.' : 'O motivo ficará registrado no histórico e na auditoria.'}</p><FormField htmlFor="budget-reason" label="Motivo" required><textarea id="budget-reason" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className={cn(fieldClass, 'resize-y py-3')} /></FormField><div className="flex justify-end gap-3"><button type="button" onClick={() => setReasonAction(null)} className={actionClass}>Voltar</button><button type="button" disabled={reason.trim().length < 3 || cloneMutation.isPending || transitionMutation.isPending} onClick={() => reasonAction === 'revision' ? cloneMutation.mutate('revision') : transitionMutation.mutate({ status: reasonAction!, reason })} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5 disabled:opacity-50">{cloneMutation.isPending || transitionMutation.isPending ? 'Processando…' : 'Confirmar'}</button></div></div>
      </Modal>

      <Modal isOpen={showApproval} onClose={() => { if (!approveMutation.isPending) setShowApproval(false); }} title="Confirmar aprovação e efeitos financeiros" maxWidth="max-w-2xl">
        <div className="space-y-5"><FormError message={approvalError} /><div className="rounded-xl border border-brand-border bg-brand-surface-subtle/60 p-4"><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-text-muted">Cliente</dt><dd className="font-semibold">{detail.clientName}</dd></div><div><dt className="text-xs text-text-muted">Total contratado</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(detail.valorTotal)}</dd></div><div><dt className="text-xs text-text-muted">Honorários líquidos previstos</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(detail.honorariosLiquidos)}</dd></div><div><dt className="text-xs text-text-muted">Impostos previstos</dt><dd className="font-mono font-bold tabular-nums">{formatCurrency(detail.impostosPrevistos)}</dd></div><div><dt className="text-xs text-text-muted">Parcelas</dt><dd className="font-semibold">{detail.payment?.installments.length || 0}</dd></div><div><dt className="text-xs text-text-muted">Conta financeira</dt><dd className="font-semibold">{detail.payment?.financialAccount || 'Não informada'}</dd></div></dl></div><fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase tracking-wider text-text-muted">Projeto</legend><label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="radio" name="projectMode" checked={projectMode === 'existing'} onChange={() => setProjectMode('existing')} /> Vincular projeto existente</label>{projectMode === 'existing' && <FormSelect aria-label="Projeto existente para vincular" value={projectId} onChange={(event) => setProjectId(event.target.value)} className={fieldClass}><option value="">Selecione…</option>{clientProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</FormSelect>}<label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="radio" name="projectMode" checked={projectMode === 'create'} onChange={() => setProjectMode('create')} /> Criar novo projeto</label>{projectMode === 'create' && <input aria-label="Nome do novo projeto" value={projectName} onChange={(event) => setProjectName(event.target.value)} className={fieldClass} />}</fieldset><p className="rounded-xl border border-brand-turquoise-200 bg-brand-turquoise-50 p-3 text-sm text-brand-turquoise-900 dark:border-brand-turquoise-300/25 dark:bg-brand-turquoise-500/10 dark:text-brand-turquoise-100">A aprovação criará contas a receber previstas. Nenhum valor será registrado como recebido, receita realizada ou entrada de caixa até a liquidação confirmada.</p><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowApproval(false)} className={actionClass}>Voltar</button><button type="button" disabled={approveMutation.isPending || (projectMode === 'existing' ? !projectId : !projectName.trim())} onClick={() => approveMutation.mutate()} className="geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5 disabled:opacity-50">{approveMutation.isPending ? 'Aprovando…' : 'Aprovar e gerar efeitos'}</button></div></div>
      </Modal>
    </>
  );
}
