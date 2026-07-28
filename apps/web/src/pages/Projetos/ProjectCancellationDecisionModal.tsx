import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '../../components/Modal';
import { apiClient } from '../../services/apiClient';
import { invalidateFinancialQueries } from '../../utils/invalidateFinancialQueries';
import { cn } from '../../utils/cn';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';

type ProjectFinancialDecision =
  | 'manter_sem_alteracao'
  | 'cancelar_parcelas_futuras'
  | 'cobranca_parcial'
  | 'registrar_devolucao'
  | 'registrar_credito';

interface ProjectCancellationDecisionModalProps {
  project: { id: string; nome: string };
  onCompleted: () => void;
  onDeferred: () => void;
}

interface ProjectFinancialContext {
  valorOrcado: number;
  valorContratado: number;
  valorFaturado: number;
  valorExecutadoInformado: number | null;
  valorRecebido: number;
  saldoAberto: number;
  despesasLancadas: number;
}

const fieldClass = 'min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';
const labelClass = 'space-y-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300';

const toCents = (value: string) => {
  const parsed = Number(value.trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};

const money = (value: number | null | undefined) => (
  value == null
    ? 'Não informado'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
);

export function ProjectCancellationDecisionModal({
  project,
  onCompleted,
  onDeferred
}: ProjectCancellationDecisionModalProps) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<ProjectFinancialDecision>('manter_sem_alteracao');
  const [reason, setReason] = useState('');
  const [percentage, setPercentage] = useState('');
  const [value, setValue] = useState('');
  const [formError, setFormError] = useState('');

  const { data: context, isLoading } = useQuery<ProjectFinancialContext>({
    queryKey: ['projeto-contexto-financeiro', project.id],
    queryFn: () => apiClient.get<ProjectFinancialContext>(`/api/projetos/${project.id}/contexto-financeiro`)
  });

  const percentageNumber = Number(percentage.replace(',', '.'));
  const suggestedRetention = useMemo(() => (
    context && Number.isFinite(percentageNumber) && percentageNumber >= 0 && percentageNumber <= 100
      ? Math.round(context.valorContratado * percentageNumber / 100)
      : null
  ), [context, percentageNumber]);

  const mutation = useMutation({
    mutationFn: () => apiClient.post(`/api/projetos/${project.id}/decisao-financeira`, {
      tipo: decision,
      motivo: reason.trim(),
      percentualExecutado: decision === 'cobranca_parcial' && percentage
        ? percentageNumber
        : null,
      valorExecutado: ['cobranca_parcial', 'registrar_devolucao', 'registrar_credito'].includes(decision) && value
        ? toCents(value)
        : null
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projeto-contexto-financeiro', project.id] }),
        queryClient.invalidateQueries({ queryKey: ['projeto', project.id] }),
        queryClient.invalidateQueries({ queryKey: ['projetos'] }),
        invalidateFinancialQueries(queryClient)
      ]);
      toast.success('Decisão financeira do cancelamento registrada.');
      onCompleted();
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : 'Não foi possível registrar a decisão financeira.');
    }
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (reason.trim().length < 5) {
      setFormError('Explique a decisão em pelo menos 5 caracteres.');
      window.setTimeout(() => document.getElementById('project-cancellation-reason')?.focus(), 0);
      return;
    }
    if (decision === 'cobranca_parcial' && !value && !percentage) {
      setFormError('Informe o percentual ou o valor efetivamente executado.');
      window.setTimeout(() => document.getElementById('project-cancellation-percentage')?.focus(), 0);
      return;
    }
    if (percentage && (!Number.isFinite(percentageNumber) || percentageNumber < 0 || percentageNumber > 100)) {
      setFormError('O percentual executado deve ficar entre 0% e 100%.');
      window.setTimeout(() => document.getElementById('project-cancellation-percentage')?.focus(), 0);
      return;
    }
    if (['registrar_devolucao', 'registrar_credito'].includes(decision) && toCents(value) <= 0) {
      setFormError('Informe um valor maior que zero para o crédito ou a devolução.');
      window.setTimeout(() => document.getElementById('project-cancellation-value')?.focus(), 0);
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      isOpen
      onClose={() => !mutation.isPending && onDeferred()}
      closeDisabled={mutation.isPending}
      initialFocusId="project-cancellation-decision"
      title="Definir tratamento financeiro do cancelamento"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">{project.nome} foi cancelado.</p>
          <p className="mt-1 leading-6">
            Registre como cobranças e valores já movimentados devem ser tratados. Fechar esta etapa manterá o projeto marcado com decisão financeira pendente.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-zinc-500" role="status">Carregando contexto financeiro…</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Orçado', context?.valorOrcado],
              ['Contratado', context?.valorContratado],
              ['Faturado', context?.valorFaturado],
              ['Recebido', context?.valorRecebido],
              ['Saldo aberto', context?.saldoAberto],
              ['Executado informado', context?.valorExecutadoInformado],
              ['Despesas realizadas', context?.despesasLancadas]
            ].map(([label, amount]) => (
              <div key={String(label)} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
                <dt className="text-[11px] font-semibold text-zinc-500">{label}</dt>
                <dd className="mt-1 font-semibold tabular-nums text-zinc-950 dark:text-white">{money(amount as number | null | undefined)}</dd>
              </div>
            ))}
          </dl>
        )}

        {formError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {formError}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            <span>Decisão financeira</span>
            <select
              id="project-cancellation-decision"
              name="financialDecision"
              value={decision}
              onChange={(event) => setDecision(event.target.value as ProjectFinancialDecision)}
              className={fieldClass}
            >
              <option value="manter_sem_alteracao">Encerrar sem nova movimentação</option>
              <option value="cancelar_parcelas_futuras">Cancelar parcelas futuras em aberto</option>
              <option value="cobranca_parcial">Reter/cobrar proporcionalmente ao executado</option>
              <option value="registrar_credito">Registrar crédito para o cliente</option>
              <option value="registrar_devolucao">Registrar decisão de devolução</option>
            </select>
          </label>

          {decision === 'cobranca_parcial' && (
            <label className={labelClass}>
              <span>Percentual executado</span>
              <input
                id="project-cancellation-percentage"
                name="executedPercentage"
                inputMode="decimal"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
                placeholder="Ex.: 40"
                className={fieldClass}
              />
              {suggestedRetention != null && (
                <span className="block font-normal text-zinc-500">Retenção sugerida: {money(suggestedRetention)}</span>
              )}
            </label>
          )}

          {['cobranca_parcial', 'registrar_devolucao', 'registrar_credito'].includes(decision) && (
            <label className={labelClass}>
              <span>{decision === 'cobranca_parcial' ? 'Valor executado, se diferente da sugestão' : 'Valor'} (R$)</span>
              <input
                id="project-cancellation-value"
                name="executedValue"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="0,00"
                className={fieldClass}
              />
            </label>
          )}
        </div>

        <label className={cn(labelClass, 'block')}>
          <span>Justificativa e memória da decisão</span>
          <textarea
            id="project-cancellation-reason"
            name="financialDecisionReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            minLength={5}
            required
            placeholder="Descreva o que foi executado e como o saldo deve ser tratado."
            className={cn(fieldClass, 'py-3')}
          />
        </label>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onDeferred}
            disabled={mutation.isPending}
            className={secondarySmallActionButtonClass}
          >
            Decidir depois
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || isLoading}
            aria-busy={mutation.isPending}
            className={cn(primarySubmitButtonClass, 'px-5 py-3 disabled:opacity-60')}
          >
            {mutation.isPending ? 'Registrando…' : 'Confirmar decisão financeira'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
