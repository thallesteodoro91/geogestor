import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode
} from 'react';
import type {
  StrategicCheckin,
  StrategicCycle,
  StrategicDecision,
  StrategicInitiative,
  StrategicKeyResult,
  StrategicObjective,
  StrategicPillar,
  StrategicPlanningSnapshot,
  StrategicRisk,
  StrategicSourceOption
} from '@geogestor/contracts';
import { Modal } from '../../components/Modal';
import { DatePickerField, FormSelect, NumericInput } from '../../components/Form';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { geoFieldClass } from '../../utils/geoTheme';
import { cn } from '../../utils/cn';
import { validatePlanningForm, type PlanningFormErrors } from './planningFormValidation';

export type StrategicOptions = {
  fontes: StrategicSourceOption[];
  projetos: Array<{ id: string; nome: string; status: string }>;
  tarefas: Array<{ id: string; titulo: string; status: string; projetoId: string | null }>;
};

export type PlanningDialog =
  | { kind: 'cycle'; initial?: StrategicCycle; parentId?: never }
  | { kind: 'pillar'; initial?: StrategicPillar; parentId?: never }
  | { kind: 'objective'; initial?: StrategicObjective; parentId?: string }
  | { kind: 'keyResult'; initial?: StrategicKeyResult; parentId?: string }
  | { kind: 'initiative'; initial?: StrategicInitiative; parentId?: string }
  | { kind: 'checkin'; initial?: StrategicCheckin; parentId?: string }
  | { kind: 'decision'; initial?: StrategicDecision; parentId?: string }
  | { kind: 'risk'; initial?: StrategicRisk; parentId?: string };

type Props = {
  dialog: PlanningDialog | null;
  cycleId: string | null;
  snapshot?: StrategicPlanningSnapshot;
  options?: StrategicOptions;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
};

const today = new Date().toISOString().slice(0, 10);

function defaultEndDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

const FormErrorsContext = createContext<PlanningFormErrors>({});

function Field({
  label,
  htmlFor,
  hint,
  children,
  className
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const errors = useContext(FormErrorsContext);
  const error = errors[htmlFor];
  const describedBy = [hint ? `${htmlFor}-hint` : '', error ? `${htmlFor}-error` : ''].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy
    })
    : children;
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      {control}
      {hint ? <p id={`${htmlFor}-hint`} className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
      {error ? <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">{error}</p> : null}
    </div>
  );
}

const inputClass = cn(geoFieldClass, 'min-h-11 w-full rounded-lg px-3 text-sm');
const textareaClass = cn(geoFieldClass, 'min-h-28 w-full resize-y rounded-lg px-3 py-2.5 text-sm');

function asNullable(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function initialState(dialog: PlanningDialog, cycleId: string | null): Record<string, string> {
  if (dialog.kind === 'cycle') {
    const initial = dialog.initial;
    return {
      nome: initial?.nome || '',
      dataInicio: initial?.dataInicio || today,
      dataFim: initial?.dataFim || defaultEndDate(),
      visao: initial?.visao || '',
      status: initial?.status || 'rascunho',
      proximaRevisao: initial?.proximaRevisao || ''
    };
  }
  if (dialog.kind === 'pillar') {
    const initial = dialog.initial;
    return {
      cicloId: cycleId || '',
      nome: initial?.nome || '',
      descricao: initial?.descricao || '',
      ordem: String(initial?.ordem ?? 0)
    };
  }
  if (dialog.kind === 'objective') {
    const initial = dialog.initial;
    return {
      cicloId: cycleId || '',
      pilarId: initial?.pilarId || dialog.parentId || '',
      titulo: initial?.titulo || '',
      descricao: initial?.descricao || '',
      responsavel: initial?.responsavel || '',
      dataLimite: initial?.dataLimite || defaultEndDate(),
      status: initial?.status || 'nao_iniciado',
      prioridade: initial?.prioridade || 'media',
      ordem: String(initial?.ordem ?? 0)
    };
  }
  if (dialog.kind === 'keyResult') {
    const initial = dialog.initial;
    const sourceKey = initial?.fonteTipo && initial.fonteTipo !== 'manual'
      ? `${initial.fonteTipo}:${initial.fonteCodigo || ''}`
      : 'manual';
    return {
      objetivoId: initial?.objetivoId || dialog.parentId || '',
      titulo: initial?.titulo || '',
      descricao: initial?.descricao || '',
      linhaBase: String(initial?.linhaBase ?? ''),
      meta: String(initial?.meta ?? ''),
      valorAtual: String(initial?.valorAtual ?? ''),
      unidade: initial?.unidade || '%',
      direcao: initial?.direcao || 'aumentar',
      sourceKey,
      frequencia: initial?.frequencia || 'mensal',
      confianca: initial?.confianca || 'media'
    };
  }
  if (dialog.kind === 'initiative') {
    const initial = dialog.initial;
    return {
      objetivoId: initial?.objetivoId || dialog.parentId || '',
      titulo: initial?.titulo || '',
      descricao: initial?.descricao || '',
      responsavel: initial?.responsavel || '',
      dataLimite: initial?.dataLimite || defaultEndDate(),
      progresso: String(initial?.progresso ?? 0),
      status: initial?.status || 'planejada',
      orcamento: initial?.orcamentoCentavos != null ? String(initial.orcamentoCentavos / 100) : '',
      dependencias: initial?.dependencias || '',
      proximoMarco: initial?.proximoMarco || '',
      projetoId: initial?.projetoId || '',
      tarefaId: initial?.tarefaId || ''
    };
  }
  if (dialog.kind === 'checkin') {
    const initial = dialog.initial;
    return {
      cicloId: cycleId || '',
      objetivoId: initial?.objetivoId || dialog.parentId || '',
      data: initial?.data || today,
      status: initial?.status || 'no_rumo',
      narrativa: initial?.narrativa || '',
      confianca: initial?.confianca || 'media',
      bloqueios: initial?.bloqueios || '',
      decisoes: initial?.decisoes || '',
      decisoesPendentes: initial?.decisoesPendentes || '',
      proximosPassos: initial?.proximosPassos || '',
      proximaRevisao: initial?.proximaRevisao || ''
    };
  }
  if (dialog.kind === 'decision') {
    const initial = dialog.initial;
    return {
      cicloId: cycleId || '',
      checkinId: initial?.checkinId || '',
      objetivoId: initial?.objetivoId || dialog.parentId || '',
      descricao: initial?.descricao || '',
      responsavel: initial?.responsavel || '',
      dataLimite: initial?.prazo || defaultEndDate(),
      status: initial?.status || 'pendente',
      dataConclusao: initial?.concluidaEm?.slice(0, 10) || '',
      notaConclusao: initial?.observacaoEncerramento || ''
    };
  }
  const initial = dialog.initial;
  return {
    cicloId: cycleId || '',
    objetivoId: initial?.objetivoId || '',
    iniciativaId: initial?.iniciativaId || '',
    descricao: initial?.descricao || '',
    impacto: initial?.impacto || 'medio',
    probabilidade: initial?.probabilidade || 'medio',
    mitigacao: initial?.mitigacao || '',
    responsavel: initial?.responsavel || '',
    status: initial?.status || 'aberto'
  };
}

const titles: Record<PlanningDialog['kind'], { create: string; edit: string }> = {
  cycle: { create: 'Criar planejamento estratégico', edit: 'Editar ciclo estratégico' },
  pillar: { create: 'Novo pilar estratégico', edit: 'Editar pilar estratégico' },
  objective: { create: 'Novo objetivo estratégico', edit: 'Editar objetivo estratégico' },
  keyResult: { create: 'Novo resultado-chave', edit: 'Editar resultado-chave' },
  initiative: { create: 'Nova iniciativa', edit: 'Editar iniciativa' },
  checkin: { create: 'Registrar revisão estratégica', edit: 'Editar revisão estratégica' },
  decision: { create: 'Nova decisão estratégica', edit: 'Editar decisão estratégica' },
  risk: { create: 'Novo risco estratégico', edit: 'Editar risco estratégico' }
};

export function StrategicPlanningFormModal(props: Props) {
  if (!props.dialog) return null;
  return <MountedForm key={`${props.dialog.kind}-${props.dialog.initial?.id || 'new'}`} {...props} dialog={props.dialog} />;
}

function MountedForm(props: Omit<Props, 'dialog'> & { dialog: PlanningDialog }) {
  const { dialog, snapshot, options, pending, onClose, onSubmit } = props;
  const [state, setState] = useState<Record<string, string>>(() => initialState(dialog, props.cycleId));
  const [initialFingerprint] = useState(() => JSON.stringify(state));
  const [errors, setErrors] = useState<PlanningFormErrors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const editing = Boolean(dialog.initial?.id);
  const dirty = JSON.stringify(state) !== initialFingerprint;
  const selectedSource = useMemo(() => {
    if (state.sourceKey === 'manual') return null;
    return options?.fontes.find((item) => `${item.tipo}:${item.codigo}` === state.sourceKey) || null;
  }, [options?.fontes, state.sourceKey]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (confirmDiscard) document.getElementById('planning-confirm-discard')?.focus();
  }, [confirmDiscard]);

  const set = (key: string, value: string) => {
    setErrors({});
    setConfirmDiscard(false);
    setState((current) => ({ ...current, [key]: value }));
  };

  const requestClose = () => {
    if (pending) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validatePlanningForm(dialog.kind, state, {
      editing,
      hasAutomaticSource: Boolean(selectedSource)
    });
    setErrors(nextErrors);
    const firstErrorId = Object.keys(nextErrors)[0];
    if (firstErrorId) {
      requestAnimationFrame(() => document.getElementById(firstErrorId)?.focus());
      return;
    }
    if (dialog.kind === 'cycle') {
      onSubmit({
        nome: state.nome,
        dataInicio: state.dataInicio,
        dataFim: state.dataFim,
        visao: state.visao,
        status: state.status,
        proximaRevisao: asNullable(state.proximaRevisao)
      });
      return;
    }
    if (dialog.kind === 'pillar') {
      onSubmit({
        ...(editing ? {} : { cicloId: props.cycleId }),
        nome: state.nome,
        descricao: asNullable(state.descricao),
        ordem: Number(state.ordem)
      });
      return;
    }
    if (dialog.kind === 'objective') {
      onSubmit({
        ...(editing ? {} : { cicloId: props.cycleId }),
        pilarId: state.pilarId,
        titulo: state.titulo,
        descricao: asNullable(state.descricao),
        responsavel: state.responsavel,
        dataLimite: state.dataLimite,
        status: state.status,
        prioridade: state.prioridade,
        ordem: Number(state.ordem)
      });
      return;
    }
    if (dialog.kind === 'keyResult') {
      onSubmit({
        ...(editing ? {} : { objetivoId: state.objetivoId }),
        titulo: state.titulo,
        descricao: asNullable(state.descricao),
        linhaBase: Number(state.linhaBase.replace(',', '.')),
        meta: Number(state.meta.replace(',', '.')),
        valorAtual: selectedSource ? null : numberOrNull(state.valorAtual),
        unidade: selectedSource?.unidade || state.unidade,
        direcao: state.direcao,
        fonteTipo: selectedSource?.tipo || 'manual',
        fonteCodigo: selectedSource?.codigo || null,
        fonteRegra: selectedSource?.regra || 'Valor informado pelo responsável.',
        fontePeriodo: selectedSource?.periodo || 'Atualização manual',
        fonteRota: selectedSource?.rota || null,
        frequencia: state.frequencia,
        ultimaAtualizacao: selectedSource ? null : new Date().toISOString(),
        confianca: state.confianca
      });
      return;
    }
    if (dialog.kind === 'initiative') {
      const budget = numberOrNull(state.orcamento);
      onSubmit({
        ...(editing ? {} : { objetivoId: state.objetivoId }),
        titulo: state.titulo,
        descricao: asNullable(state.descricao),
        responsavel: state.responsavel,
        dataLimite: state.dataLimite,
        progresso: Number(state.progresso),
        status: state.status,
        orcamentoCentavos: budget === null ? null : Math.round(budget * 100),
        dependencias: asNullable(state.dependencias),
        proximoMarco: asNullable(state.proximoMarco),
        projetoId: asNullable(state.projetoId),
        tarefaId: asNullable(state.tarefaId)
      });
      return;
    }
    if (dialog.kind === 'checkin') {
      onSubmit({
        ...(editing ? {} : { cicloId: props.cycleId }),
        objetivoId: asNullable(state.objetivoId),
        data: state.data,
        status: state.status,
        narrativa: state.narrativa,
        confianca: state.confianca,
        bloqueios: asNullable(state.bloqueios),
        decisoes: asNullable(state.decisoes),
        decisoesPendentes: null,
        proximosPassos: asNullable(state.proximosPassos),
        proximaRevisao: asNullable(state.proximaRevisao)
      });
      return;
    }
    if (dialog.kind === 'decision') {
      const completedAt = state.status === 'concluida'
        ? new Date(`${state.dataConclusao || today}T12:00:00.000Z`).toISOString()
        : null;
      onSubmit({
        ...(editing ? {} : { cicloId: props.cycleId }),
        checkinId: asNullable(state.checkinId),
        objetivoId: asNullable(state.objetivoId),
        descricao: state.descricao,
        responsavel: state.responsavel,
        prazo: state.dataLimite,
        status: state.status,
        concluidaEm: completedAt,
        observacaoEncerramento: state.status === 'concluida' ? asNullable(state.notaConclusao) : null
      });
      return;
    }
    onSubmit({
      ...(editing ? {} : { cicloId: props.cycleId }),
      objetivoId: asNullable(state.objetivoId),
      iniciativaId: asNullable(state.iniciativaId),
      descricao: state.descricao,
      impacto: state.impacto,
      probabilidade: state.probabilidade,
      mitigacao: asNullable(state.mitigacao),
      responsavel: state.responsavel,
      status: state.status
    });
  };

  return (
    <Modal
      isOpen
      onClose={requestClose}
      closeDisabled={pending}
      title={titles[dialog.kind][editing ? 'edit' : 'create']}
      maxWidth="max-w-3xl"
      initialFocusId={`planning-${dialog.kind}-first`}
    >
      <FormErrorsContext.Provider value={errors}>
      <form onSubmit={submit} noValidate className="space-y-5" aria-busy={pending}>
        {dialog.kind === 'cycle' ? (
          <>
            <Field label="Nome do ciclo" htmlFor="planning-cycle-first">
              <input id="planning-cycle-first" name="nome" autoComplete="off" required maxLength={160} value={state.nome} onChange={(event) => set('nome', event.target.value)} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data inicial" htmlFor="cycle-start">
                <DatePickerField id="cycle-start" name="dataInicio" required autoComplete="off" value={state.dataInicio} onChange={(event) => set('dataInicio', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Data final" htmlFor="cycle-end">
                <DatePickerField id="cycle-end" name="dataFim" required autoComplete="off" min={state.dataInicio} value={state.dataFim} onChange={(event) => set('dataFim', event.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Direcionamento estratégico" htmlFor="cycle-vision" hint="Descreva o estado que a empresa pretende alcançar ao final deste ciclo.">
              <textarea id="cycle-vision" name="visao" required maxLength={2000} value={state.visao} onChange={(event) => set('visao', event.target.value)} className={textareaClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Situação" htmlFor="cycle-status">
                <FormSelect id="cycle-status" name="status" value={state.status} onChange={(event) => set('status', event.target.value)} className={inputClass}>
                  <option value="rascunho">Rascunho</option>
                  <option value="ativo">Ativo</option>
                  <option value="em_revisao">Em revisão</option>
                  <option value="encerrado">Encerrado</option>
                </FormSelect>
              </Field>
              <Field label="Próxima revisão" htmlFor="cycle-review">
                <DatePickerField id="cycle-review" name="proximaRevisao" autoComplete="off" value={state.proximaRevisao} onChange={(event) => set('proximaRevisao', event.target.value)} className={inputClass} />
              </Field>
            </div>
          </>
        ) : null}

        {dialog.kind === 'pillar' ? (
          <>
            <Field label="Nome do pilar" htmlFor="planning-pillar-first">
              <input id="planning-pillar-first" name="nome" autoComplete="off" required maxLength={120} value={state.nome} onChange={(event) => set('nome', event.target.value)} className={inputClass} />
            </Field>
            <Field label="Descrição" htmlFor="pillar-description">
              <textarea id="pillar-description" name="descricao" maxLength={1000} value={state.descricao} onChange={(event) => set('descricao', event.target.value)} className={textareaClass} />
            </Field>
            <Field label="Ordem de exibição" htmlFor="pillar-order">
              <NumericInput id="pillar-order" name="ordem" min="0" max="999" inputMode="numeric" required value={state.ordem} onChange={(event) => set('ordem', event.target.value)} className={inputClass} />
            </Field>
          </>
        ) : null}

        {dialog.kind === 'objective' ? (
          <>
            <Field label="Título do objetivo" htmlFor="planning-objective-first">
              <input id="planning-objective-first" name="titulo" autoComplete="off" required maxLength={180} value={state.titulo} onChange={(event) => set('titulo', event.target.value)} className={inputClass} />
            </Field>
            <Field label="Pilar estratégico" htmlFor="objective-pillar">
              <FormSelect id="objective-pillar" name="pilarId" required value={state.pilarId} onChange={(event) => set('pilarId', event.target.value)} className={inputClass}>
                <option value="">Selecione um pilar</option>
                {snapshot?.pilares.map((pillar) => <option key={pillar.id} value={pillar.id}>{pillar.nome}</option>)}
              </FormSelect>
            </Field>
            <Field label="Descrição" htmlFor="objective-description">
              <textarea id="objective-description" name="descricao" maxLength={2000} value={state.descricao} onChange={(event) => set('descricao', event.target.value)} className={textareaClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Responsável" htmlFor="objective-owner">
                <input id="objective-owner" name="responsavel" autoComplete="name" required maxLength={160} value={state.responsavel} onChange={(event) => set('responsavel', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Prazo" htmlFor="objective-deadline">
                <DatePickerField id="objective-deadline" name="dataLimite" required autoComplete="off" value={state.dataLimite} onChange={(event) => set('dataLimite', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Situação" htmlFor="objective-status">
                <FormSelect id="objective-status" name="status" value={state.status} onChange={(event) => set('status', event.target.value)} className={inputClass}>
                  <option value="nao_iniciado">Não iniciado</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="em_risco">Em risco</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </FormSelect>
              </Field>
              <Field label="Prioridade" htmlFor="objective-priority">
                <FormSelect id="objective-priority" name="prioridade" value={state.prioridade} onChange={(event) => set('prioridade', event.target.value)} className={inputClass}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </FormSelect>
              </Field>
              <Field label="Ordem de exibição" htmlFor="objective-order">
                <NumericInput id="objective-order" name="ordem" min="0" max="999" inputMode="numeric" required value={state.ordem} onChange={(event) => set('ordem', event.target.value)} className={inputClass} />
              </Field>
            </div>
          </>
        ) : null}

        {dialog.kind === 'keyResult' ? (
          <>
            <Field label="Título do resultado-chave" htmlFor="planning-keyResult-first">
              <input id="planning-keyResult-first" name="titulo" autoComplete="off" required maxLength={180} value={state.titulo} onChange={(event) => set('titulo', event.target.value)} className={inputClass} />
            </Field>
            {!dialog.parentId && !editing ? (
              <Field label="Objetivo relacionado" htmlFor="key-result-objective">
                <FormSelect id="key-result-objective" name="objetivoId" required value={state.objetivoId} onChange={(event) => set('objetivoId', event.target.value)} className={inputClass}>
                  <option value="">Selecione um objetivo</option>
                  {snapshot?.objetivos.map((objective) => <option key={objective.id} value={objective.id}>{objective.titulo}</option>)}
                </FormSelect>
              </Field>
            ) : null}
            <Field label="Descrição" htmlFor="key-result-description">
              <textarea id="key-result-description" name="descricao" maxLength={1000} value={state.descricao} onChange={(event) => set('descricao', event.target.value)} className={textareaClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Linha de base" htmlFor="key-result-baseline">
                <NumericInput id="key-result-baseline" name="linhaBase" step="any" inputMode="decimal" required value={state.linhaBase} onChange={(event) => set('linhaBase', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Meta" htmlFor="key-result-target">
                <NumericInput id="key-result-target" name="meta" step="any" inputMode="decimal" required value={state.meta} onChange={(event) => set('meta', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Direção desejada" htmlFor="key-result-direction">
                <FormSelect id="key-result-direction" name="direcao" value={state.direcao} onChange={(event) => set('direcao', event.target.value)} className={inputClass}>
                  <option value="aumentar">Aumentar</option>
                  <option value="reduzir">Reduzir</option>
                  <option value="manter">Manter</option>
                </FormSelect>
              </Field>
            </div>
            <Field label="Fonte do indicador" htmlFor="key-result-source" hint={selectedSource?.regra || 'O responsável informará e revisará o valor atual.'}>
              <FormSelect id="key-result-source" name="sourceKey" value={state.sourceKey} onChange={(event) => {
                const value = event.target.value;
                set('sourceKey', value);
                const option = options?.fontes.find((item) => `${item.tipo}:${item.codigo}` === value);
                if (option) set('unidade', option.unidade);
              }} className={inputClass}>
                <option value="manual">Atualização manual</option>
                {options?.fontes.map((source) => <option key={`${source.tipo}:${source.codigo}`} value={`${source.tipo}:${source.codigo}`}>{source.nome}</option>)}
              </FormSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {selectedSource ? (
                <div className="rounded-lg border border-brand-turquoise-200 bg-brand-turquoise-50/60 p-4 text-sm text-brand-turquoise-900 dark:border-brand-turquoise-400/20 dark:bg-brand-turquoise-400/10 dark:text-brand-turquoise-100">
                  <p className="font-semibold">{selectedSource.nome}</p>
                  <p className="mt-1 text-xs leading-5">{selectedSource.periodo} · Unidade {selectedSource.unidade}</p>
                </div>
              ) : (
                <Field label="Valor atual" htmlFor="key-result-current">
                  <NumericInput id="key-result-current" name="valorAtual" step="any" inputMode="decimal" required value={state.valorAtual} onChange={(event) => set('valorAtual', event.target.value)} className={inputClass} />
                </Field>
              )}
              <Field label="Unidade" htmlFor="key-result-unit">
                <input id="key-result-unit" name="unidade" autoComplete="off" required maxLength={40} disabled={Boolean(selectedSource)} value={selectedSource?.unidade || state.unidade} onChange={(event) => set('unidade', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Frequência" htmlFor="key-result-frequency">
                <FormSelect id="key-result-frequency" name="frequencia" value={state.frequencia} onChange={(event) => set('frequencia', event.target.value)} className={inputClass}>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </FormSelect>
              </Field>
              <Field label="Confiança" htmlFor="key-result-confidence">
                <FormSelect id="key-result-confidence" name="confianca" value={state.confianca} onChange={(event) => set('confianca', event.target.value)} className={inputClass}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </FormSelect>
              </Field>
            </div>
          </>
        ) : null}

        {dialog.kind === 'initiative' ? (
          <>
            <Field label="Título da iniciativa" htmlFor="planning-initiative-first">
              <input id="planning-initiative-first" name="titulo" autoComplete="off" required maxLength={180} value={state.titulo} onChange={(event) => set('titulo', event.target.value)} className={inputClass} />
            </Field>
            {!dialog.parentId && !editing ? (
              <Field label="Objetivo relacionado" htmlFor="initiative-objective">
                <FormSelect id="initiative-objective" name="objetivoId" required value={state.objetivoId} onChange={(event) => set('objetivoId', event.target.value)} className={inputClass}>
                  <option value="">Selecione um objetivo</option>
                  {snapshot?.objetivos.map((objective) => <option key={objective.id} value={objective.id}>{objective.titulo}</option>)}
                </FormSelect>
              </Field>
            ) : null}
            <Field label="Descrição" htmlFor="initiative-description">
              <textarea id="initiative-description" name="descricao" maxLength={2000} value={state.descricao} onChange={(event) => set('descricao', event.target.value)} className={textareaClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Responsável" htmlFor="initiative-owner">
                <input id="initiative-owner" name="responsavel" autoComplete="name" required maxLength={160} value={state.responsavel} onChange={(event) => set('responsavel', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Prazo" htmlFor="initiative-deadline">
                <DatePickerField id="initiative-deadline" name="dataLimite" required autoComplete="off" value={state.dataLimite} onChange={(event) => set('dataLimite', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Progresso (%)" htmlFor="initiative-progress">
                <NumericInput id="initiative-progress" name="progresso" min="0" max="100" step="1" inputMode="numeric" required value={state.progresso} onChange={(event) => set('progresso', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Situação" htmlFor="initiative-status">
                <FormSelect id="initiative-status" name="status" value={state.status} onChange={(event) => set('status', event.target.value)} className={inputClass}>
                  <option value="planejada">Planejada</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="bloqueada">Bloqueada</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </FormSelect>
              </Field>
              <Field label="Orçamento previsto (R$)" htmlFor="initiative-budget">
                <NumericInput id="initiative-budget" name="orcamento" min="0" step="0.01" inputMode="decimal" value={state.orcamento} onChange={(event) => set('orcamento', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Próximo marco" htmlFor="initiative-milestone">
                <input id="initiative-milestone" name="proximoMarco" autoComplete="off" maxLength={500} value={state.proximoMarco} onChange={(event) => set('proximoMarco', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Projeto vinculado" htmlFor="initiative-project">
                <FormSelect id="initiative-project" name="projetoId" value={state.projetoId} onChange={(event) => set('projetoId', event.target.value)} className={inputClass}>
                  <option value="">Nenhum projeto</option>
                  {options?.projetos.map((project) => <option key={project.id} value={project.id}>{project.nome} · {project.status}</option>)}
                </FormSelect>
              </Field>
              <Field label="Tarefa vinculada" htmlFor="initiative-task">
                <FormSelect id="initiative-task" name="tarefaId" value={state.tarefaId} onChange={(event) => set('tarefaId', event.target.value)} className={inputClass}>
                  <option value="">Nenhuma tarefa</option>
                  {options?.tarefas.map((task) => <option key={task.id} value={task.id}>{task.titulo} · {task.status}</option>)}
                </FormSelect>
              </Field>
            </div>
            <Field label="Dependências" htmlFor="initiative-dependencies">
              <textarea id="initiative-dependencies" name="dependencias" maxLength={1000} value={state.dependencias} onChange={(event) => set('dependencias', event.target.value)} className={textareaClass} />
            </Field>
          </>
        ) : null}

        {dialog.kind === 'checkin' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data da revisão" htmlFor="planning-checkin-first">
                <DatePickerField id="planning-checkin-first" name="data" required autoComplete="off" value={state.data} onChange={(event) => set('data', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Objetivo relacionado" htmlFor="checkin-objective">
                <FormSelect id="checkin-objective" name="objetivoId" value={state.objetivoId} onChange={(event) => set('objetivoId', event.target.value)} className={inputClass}>
                  <option value="">Revisão geral do ciclo</option>
                  {snapshot?.objetivos.map((objective) => <option key={objective.id} value={objective.id}>{objective.titulo}</option>)}
                </FormSelect>
              </Field>
              <Field label="Situação" htmlFor="checkin-status">
                <FormSelect id="checkin-status" name="status" value={state.status} onChange={(event) => set('status', event.target.value)} className={inputClass}>
                  <option value="no_rumo">No rumo</option>
                  <option value="atencao">Atenção</option>
                  <option value="critico">Crítico</option>
                </FormSelect>
              </Field>
              <Field label="Confiança" htmlFor="checkin-confidence">
                <FormSelect id="checkin-confidence" name="confianca" value={state.confianca} onChange={(event) => set('confianca', event.target.value)} className={inputClass}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </FormSelect>
              </Field>
            </div>
            <Field label="Leitura executiva" htmlFor="checkin-narrative">
              <textarea id="checkin-narrative" name="narrativa" required maxLength={4000} value={state.narrativa} onChange={(event) => set('narrativa', event.target.value)} className={textareaClass} />
            </Field>
            <Field label="Bloqueios" htmlFor="checkin-blockers">
              <textarea id="checkin-blockers" name="bloqueios" maxLength={2000} value={state.bloqueios} onChange={(event) => set('bloqueios', event.target.value)} className={textareaClass} />
            </Field>
            <Field label="Decisões tomadas" htmlFor="checkin-decisions">
              <textarea id="checkin-decisions" name="decisoes" maxLength={2000} value={state.decisoes} onChange={(event) => set('decisoes', event.target.value)} className={textareaClass} />
            </Field>
            <p className="rounded-lg border border-brand-border bg-brand-background/60 px-4 py-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Registre pendências em <strong>Nova decisão</strong>. Assim cada decisão terá responsável, prazo, situação e histórico próprios.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Próximos passos" htmlFor="checkin-next-steps">
                <textarea id="checkin-next-steps" name="proximosPassos" maxLength={2000} value={state.proximosPassos} onChange={(event) => set('proximosPassos', event.target.value)} className={textareaClass} />
              </Field>
              <Field label="Próxima revisão" htmlFor="checkin-next-review">
                <DatePickerField id="checkin-next-review" name="proximaRevisao" autoComplete="off" min={state.data} value={state.proximaRevisao} onChange={(event) => set('proximaRevisao', event.target.value)} className={inputClass} />
              </Field>
            </div>
          </>
        ) : null}

        {dialog.kind === 'decision' ? (
          <>
            <Field label="Decisão ou encaminhamento" htmlFor="planning-decision-first" hint="Descreva o que precisa ser decidido ou executado de forma verificável.">
              <textarea id="planning-decision-first" name="descricao" required maxLength={2000} value={state.descricao} onChange={(event) => set('descricao', event.target.value)} className={textareaClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Responsável" htmlFor="decision-owner">
                <input id="decision-owner" name="responsavel" autoComplete="name" required maxLength={160} value={state.responsavel} onChange={(event) => set('responsavel', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Prazo" htmlFor="decision-deadline">
                <DatePickerField id="decision-deadline" name="prazo" required autoComplete="off" value={state.dataLimite} onChange={(event) => set('dataLimite', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Situação" htmlFor="decision-status">
                <FormSelect id="decision-status" name="status" value={state.status} onChange={(event) => set('status', event.target.value)} className={inputClass}>
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </FormSelect>
              </Field>
              <Field label="Objetivo relacionado" htmlFor="decision-objective">
                <FormSelect id="decision-objective" name="objetivoId" value={state.objetivoId} onChange={(event) => set('objetivoId', event.target.value)} className={inputClass}>
                  <option value="">Decisão geral do ciclo</option>
                  {snapshot?.objetivos.map((objective) => <option key={objective.id} value={objective.id}>{objective.titulo}</option>)}
                </FormSelect>
              </Field>
              <Field label="Revisão de origem" htmlFor="decision-checkin">
                <FormSelect id="decision-checkin" name="checkinId" value={state.checkinId} onChange={(event) => set('checkinId', event.target.value)} className={inputClass}>
                  <option value="">Sem revisão vinculada</option>
                  {snapshot?.checkins.map((checkin) => <option key={checkin.id} value={checkin.id}>{checkin.data} · {checkin.narrativa.slice(0, 70)}</option>)}
                </FormSelect>
              </Field>
            </div>
            {state.status === 'concluida' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data da conclusão" htmlFor="decision-completion-date">
                  <DatePickerField id="decision-completion-date" name="dataConclusao" autoComplete="off" value={state.dataConclusao || today} onChange={(event) => set('dataConclusao', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Resultado da decisão" htmlFor="decision-completion-note" hint="Explique o desfecho para preservar o contexto histórico.">
                  <textarea id="decision-completion-note" name="notaConclusao" required maxLength={2000} value={state.notaConclusao} onChange={(event) => set('notaConclusao', event.target.value)} className={textareaClass} />
                </Field>
              </div>
            ) : null}
          </>
        ) : null}

        {dialog.kind === 'risk' ? (
          <>
            <Field label="Descrição do risco" htmlFor="planning-risk-first">
              <textarea id="planning-risk-first" name="descricao" required maxLength={2000} value={state.descricao} onChange={(event) => set('descricao', event.target.value)} className={textareaClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Objetivo relacionado" htmlFor="risk-objective">
                <FormSelect id="risk-objective" name="objetivoId" value={state.objetivoId} onChange={(event) => set('objetivoId', event.target.value)} className={inputClass}>
                  <option value="">Risco geral do ciclo</option>
                  {snapshot?.objetivos.map((objective) => <option key={objective.id} value={objective.id}>{objective.titulo}</option>)}
                </FormSelect>
              </Field>
              <Field label="Iniciativa relacionada" htmlFor="risk-initiative">
                <FormSelect id="risk-initiative" name="iniciativaId" value={state.iniciativaId} onChange={(event) => set('iniciativaId', event.target.value)} className={inputClass}>
                  <option value="">Nenhuma iniciativa</option>
                  {snapshot?.iniciativas.map((initiative) => <option key={initiative.id} value={initiative.id}>{initiative.titulo}</option>)}
                </FormSelect>
              </Field>
              <Field label="Impacto" htmlFor="risk-impact">
                <FormSelect id="risk-impact" name="impacto" value={state.impacto} onChange={(event) => set('impacto', event.target.value)} className={inputClass}>
                  <option value="baixo">Baixo</option>
                  <option value="medio">Médio</option>
                  <option value="alto">Alto</option>
                  <option value="critico">Crítico</option>
                </FormSelect>
              </Field>
              <Field label="Probabilidade" htmlFor="risk-probability">
                <FormSelect id="risk-probability" name="probabilidade" value={state.probabilidade} onChange={(event) => set('probabilidade', event.target.value)} className={inputClass}>
                  <option value="baixo">Baixa</option>
                  <option value="medio">Média</option>
                  <option value="alto">Alta</option>
                  <option value="critico">Crítica</option>
                </FormSelect>
              </Field>
              <Field label="Responsável" htmlFor="risk-owner">
                <input id="risk-owner" name="responsavel" autoComplete="name" required maxLength={160} value={state.responsavel} onChange={(event) => set('responsavel', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Situação" htmlFor="risk-status">
                <FormSelect id="risk-status" name="status" value={state.status} onChange={(event) => set('status', event.target.value)} className={inputClass}>
                  <option value="aberto">Aberto</option>
                  <option value="mitigando">Em mitigação</option>
                  <option value="resolvido">Resolvido</option>
                  <option value="aceito">Aceito</option>
                </FormSelect>
              </Field>
            </div>
            <Field label="Plano de mitigação" htmlFor="risk-mitigation">
              <textarea id="risk-mitigation" name="mitigacao" maxLength={2000} value={state.mitigacao} onChange={(event) => set('mitigacao', event.target.value)} className={textareaClass} />
            </Field>
          </>
        ) : null}

        {confirmDiscard ? (
          <section role="alertdialog" aria-labelledby="discard-title" className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
            <p id="discard-title" className="font-semibold text-amber-950 dark:text-amber-100">Descartar alterações não salvas?</p>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">Os dados preenchidos neste formulário serão perdidos.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button id="planning-confirm-discard" type="button" onClick={onClose} className={primarySubmitButtonClass}>Descartar alterações</button>
              <button type="button" onClick={() => setConfirmDiscard(false)} className={secondarySmallActionButtonClass}>Continuar editando</button>
            </div>
          </section>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-brand-border pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={requestClose} disabled={pending} className={secondarySmallActionButtonClass}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={primarySubmitButtonClass}>
            {pending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar'}
          </button>
        </div>
      </form>
      </FormErrorsContext.Provider>
    </Modal>
  );
}
