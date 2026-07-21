import { CONDITION_STATUSES, ConditionPayloadSchema, type ConditionPayload, type LicenseCondition
} from '@geogestor/contracts';
import { Modal } from '../../components/Modal';
import { useState } from 'react';
import { DatePickerField, FormError, FormField, FormFooter, FormSelect } from '../../components/Form';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';

interface ConditionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ConditionPayload) => Promise<void>;
  condition?: LicenseCondition | null;
  loading?: boolean;
}

type FormState = {
  titulo: string; descricao: string; dataLimite: string; periodicidade: string;
  responsavel: string; status: ConditionPayload['status']; dataCumprimento: string;
  observacoes: string; comprovante: string;
};
type FormErrors = Partial<Record<keyof FormState, string>>;
const emptyForm = (): FormState => ({ titulo: '', descricao: '', dataLimite: '', periodicidade: '', responsavel: '', status: 'Pendente', dataCumprimento: '', observacoes: '', comprovante: '' });
const formFromCondition = (condition?: LicenseCondition | null): FormState => condition ? {
  titulo: condition.titulo,
  descricao: condition.descricao || '',
  dataLimite: condition.dataLimite || '',
  periodicidade: condition.periodicidade || '',
  responsavel: condition.responsavel || '',
  status: condition.status,
  dataCumprimento: condition.dataCumprimento || '',
  observacoes: condition.observacoes || '',
  comprovante: condition.comprovante || ''
} : emptyForm();
const fieldClass = cn(geoFieldClass, 'h-11 w-full px-3 text-sm');
const localToday = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function ConditionFormModalContent({ isOpen, onClose, onSubmit, condition, loading = false }: ConditionFormModalProps) {
  const [form, setForm] = useState<FormState>(() => formFromCondition(condition));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); };
  const updateStatus = (status: FormState['status']) => {
    setForm((current) => ({
      ...current,
      status,
      dataCumprimento: status === 'Cumprida' ? current.dataCumprimento || localToday() : ''
    }));
    setErrors((current) => ({ ...current, dataCumprimento: undefined }));
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = ConditionPayloadSchema.safeParse({
      titulo: form.titulo, descricao: form.descricao || null, dataLimite: form.dataLimite || null, periodicidade: form.periodicidade || null, responsavel: form.responsavel || null, status: form.status, dataCumprimento: form.dataCumprimento || null, observacoes: form.observacoes || null, comprovante: form.comprovante || null
    });
    if (!result.success) {
      const next: FormErrors = {};
      result.error.issues.forEach((issue) => { const field = issue.path[0] as keyof FormState; if (field && !next[field]) next[field] = issue.message; });
      setErrors(next); setFormError('Revise os campos destacados antes de salvar.');
      window.setTimeout(() => document.getElementById(`condition-${Object.keys(next)[0]}`)?.focus(), 0);
      return;
    }
    try { await onSubmit(result.data); } catch (error) { setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a condicionante.'); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeDisabled={loading} title={condition ? 'Editar condicionante' : 'Nova condicionante'} maxWidth="max-w-3xl" initialFocusId="condition-titulo">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormError message={formError} />
        <FormField htmlFor="condition-titulo" label="Título" required error={errors.titulo}><input id="condition-titulo" name="titulo" type="text" autoComplete="off" value={form.titulo} onChange={(event) => update('titulo', event.target.value)} aria-invalid={Boolean(errors.titulo)} className={fieldClass} /></FormField>
        <FormField htmlFor="condition-descricao" label="Descrição"><textarea id="condition-descricao" name="descricao" rows={3} value={form.descricao} onChange={(event) => update('descricao', event.target.value)} className={cn(geoFieldClass, 'w-full resize-y px-3 py-2 text-sm')} /></FormField>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField htmlFor="condition-dataLimite" label="Data limite"><DatePickerField id="condition-dataLimite" name="dataLimite" autoComplete="off" value={form.dataLimite} onChange={(event) => update('dataLimite', event.target.value)} className={fieldClass} /></FormField>
          <FormField htmlFor="condition-periodicidade" label="Periodicidade"><input id="condition-periodicidade" name="periodicidade" type="text" autoComplete="off" value={form.periodicidade} onChange={(event) => update('periodicidade', event.target.value)} placeholder="Ex.: Semestral" className={fieldClass} /></FormField>
          <FormField htmlFor="condition-responsavel" label="Responsável"><input id="condition-responsavel" name="responsavel" type="text" autoComplete="name" value={form.responsavel} onChange={(event) => update('responsavel', event.target.value)} className={fieldClass} /></FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField htmlFor="condition-status" label="Status"><FormSelect id="condition-status" name="status" autoComplete="off" value={form.status} onChange={(event) => updateStatus(event.target.value as FormState['status'])} className={cn(fieldClass, 'geo-native-select')}>{CONDITION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</FormSelect></FormField>
          <FormField htmlFor="condition-dataCumprimento" label="Data de cumprimento" error={errors.dataCumprimento}><DatePickerField id="condition-dataCumprimento" name="dataCumprimento" autoComplete="off" value={form.dataCumprimento} onChange={(event) => update('dataCumprimento', event.target.value)} aria-invalid={Boolean(errors.dataCumprimento)} className={fieldClass} /></FormField>
        </div>
        <FormField htmlFor="condition-comprovante" label="Comprovante ou referência documental"><input id="condition-comprovante" name="comprovante" type="text" autoComplete="off" value={form.comprovante} onChange={(event) => update('comprovante', event.target.value)} placeholder="Caminho, protocolo ou nome do documento" className={fieldClass} /></FormField>
        <FormField htmlFor="condition-observacoes" label="Observações"><textarea id="condition-observacoes" name="observacoes" rows={3} value={form.observacoes} onChange={(event) => update('observacoes', event.target.value)} className={cn(geoFieldClass, 'w-full resize-y px-3 py-2 text-sm')} /></FormField>
        <FormFooter><button type="button" onClick={onClose} disabled={loading} className={secondarySmallActionButtonClass}>Cancelar</button><button type="submit" disabled={loading} aria-busy={loading} className={primarySubmitButtonClass}>{loading ? 'Salvando…' : 'Salvar condicionante'}</button></FormFooter>
      </form>
    </Modal>
  );
}

export function ConditionFormModal(props: ConditionFormModalProps) {
  if (!props.isOpen) return null;
  return <ConditionFormModalContent key={props.condition?.id || 'new-condition'} {...props} />;
}
