import { LICENSE_STATUSES, LicensePayloadSchema, normalizeLicenseStatus, type LicenseListItem, type LicensePayload
} from '@geogestor/contracts';
import { Modal } from '../../components/Modal';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Buildings, CalendarBlank, IdentificationCard, NotePencil } from '@phosphor-icons/react';
import { DatePickerField, FormError, FormField, FormFooter, FormSection, FormSelect } from '../../components/Form';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { geoFieldClass } from '../../utils/geoTheme';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';

interface ProjectOption {
  id: string;
  nome: string;
  clienteId: string;
  clienteNome?: string | null;
  tipo?: string | null;
}

interface LicenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: LicensePayload) => Promise<void>;
  license?: LicenseListItem | null;
  loading?: boolean;
}

type FormState = {
  projetoId: string;
  numero: string;
  protocolo: string;
  orgao: string;
  tipoLicenca: string;
  dataEmissao: string;
  dataVencimento: string;
  status: LicensePayload['status'];
  observacoes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm = (): FormState => ({
  projetoId: '',
  numero: '',
  protocolo: '',
  orgao: '',
  tipoLicenca: '',
  dataEmissao: '',
  dataVencimento: '',
  status: 'Em análise',
  observacoes: ''
});

const formFromLicense = (license?: LicenseListItem | null): FormState => license ? {
  projetoId: license.projetoId,
  numero: license.numero,
  protocolo: license.protocolo || '',
  orgao: license.orgao,
  tipoLicenca: license.tipoLicenca || '',
  dataEmissao: license.dataEmissao || '',
  dataVencimento: license.dataVencimento,
  status: normalizeLicenseStatus(license.statusRegistrado),
  observacoes: license.observacoes || ''
} : emptyForm();

const fieldClass = cn(geoFieldClass, 'h-11 w-full px-3 text-sm');

function LicenseFormModalContent({ isOpen, onClose, onSubmit, license, loading = false }: LicenseFormModalProps) {
  const [form, setForm] = useState<FormState>(() => formFromLicense(license));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const projectsQuery = useQuery<ProjectOption[]>({
    queryKey: ['license-project-options'],
    queryFn: () => apiClient.get<ProjectOption[]>('/api/projetos?limit=500'),
    enabled: isOpen
  });

  const selectedProject = useMemo(
    () => projectsQuery.data?.find((project) => project.id === form.projetoId),
    [form.projetoId, projectsQuery.data]
  );

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = {
      projetoId: form.projetoId,
      clienteId: selectedProject?.clienteId || license?.clienteId || null,
      numero: form.numero,
      protocolo: form.protocolo || null,
      orgao: form.orgao,
      tipoLicenca: form.tipoLicenca,
      dataEmissao: form.dataEmissao || null,
      dataVencimento: form.dataVencimento,
      status: form.status,
      observacoes: form.observacoes || null
    };
    const result = LicensePayloadSchema.safeParse(candidate);
    if (!result.success) {
      const nextErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormState;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      });
      setErrors(nextErrors);
      setFormError('Revise os campos destacados antes de salvar.');
      window.setTimeout(() => document.getElementById(`license-${Object.keys(nextErrors)[0]}`)?.focus(), 0);
      return;
    }
    try {
      await onSubmit(result.data);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a licença.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeDisabled={loading} title={license ? 'Editar licença ambiental' : 'Nova licença ambiental'} maxWidth="max-w-4xl" initialFocusId="license-projetoId">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormError message={formError || (projectsQuery.isError ? 'Não foi possível carregar os projetos. Feche a janela e tente novamente.' : '')} />
        <FormSection sectionId="license-enterprise" title="Empreendimento e vínculo" description="Associe a licença ao projeto e ao cliente responsáveis pelo processo." icon={<Buildings className="h-5 w-5" weight="duotone" />} tone="cyan">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField htmlFor="license-projetoId" label="Projeto ou empreendimento" required error={errors.projetoId}>
              <FormSelect id="license-projetoId" name="projetoId" autoComplete="off" disabled={projectsQuery.isLoading || Boolean(license)} value={form.projetoId} onChange={(event) => update('projetoId', event.target.value)} aria-invalid={Boolean(errors.projetoId)} aria-describedby={errors.projetoId ? 'license-projetoId-error' : undefined} className={cn(fieldClass, 'geo-native-select')}>
                <option value="">{projectsQuery.isLoading ? 'Carregando projetos…' : 'Selecione…'}</option>
                {projectsQuery.data?.map((project) => <option key={project.id} value={project.id}>{project.nome} — {project.clienteNome || 'cliente não informado'}</option>)}
              </FormSelect>
            </FormField>
            <FormField htmlFor="license-cliente" label="Cliente">
              <input id="license-cliente" name="cliente" type="text" value={selectedProject?.clienteNome || license?.clienteNome || ''} readOnly aria-readonly="true" placeholder="Definido pelo projeto" className={cn(fieldClass, 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection sectionId="license-identification" title="Identificação da licença" description="Registre o tipo, o número oficial, o protocolo e o órgão ambiental emissor." icon={<IdentificationCard className="h-5 w-5" weight="duotone" />} tone="cyan">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField htmlFor="license-tipoLicenca" label="Tipo da licença" required error={errors.tipoLicenca}>
              <FormSelect id="license-tipoLicenca" name="tipoLicenca" autoComplete="off" value={form.tipoLicenca} onChange={(event) => update('tipoLicenca', event.target.value)} aria-invalid={Boolean(errors.tipoLicenca)} aria-describedby={errors.tipoLicenca ? 'license-tipoLicenca-error' : undefined} className={cn(fieldClass, 'geo-native-select')}>
                <option value="">Selecione…</option><option value="LP">Licença Prévia — LP</option><option value="LI">Licença de Instalação — LI</option><option value="LO">Licença de Operação — LO</option><option value="Renovação">Renovação</option><option value="Outros">Outros</option>
              </FormSelect>
            </FormField>
            <FormField htmlFor="license-numero" label="Número da licença" required error={errors.numero}>
              <input id="license-numero" name="numero" type="text" autoComplete="off" spellCheck={false} value={form.numero} onChange={(event) => update('numero', event.target.value)} placeholder="Ex.: LAO 1234/2026" aria-invalid={Boolean(errors.numero)} aria-describedby={errors.numero ? 'license-numero-error' : undefined} className={fieldClass} />
            </FormField>
            <FormField htmlFor="license-protocolo" label="Processo ou protocolo">
              <input id="license-protocolo" name="protocolo" type="text" autoComplete="off" spellCheck={false} value={form.protocolo} onChange={(event) => update('protocolo', event.target.value)} placeholder="Ex.: IMA 000123/2026" className={fieldClass} />
            </FormField>
            <FormField htmlFor="license-orgao" label="Órgão ambiental" required error={errors.orgao}>
              <input id="license-orgao" name="orgao" type="text" autoComplete="organization" value={form.orgao} onChange={(event) => update('orgao', event.target.value)} placeholder="Ex.: IMA, IBAMA" aria-invalid={Boolean(errors.orgao)} aria-describedby={errors.orgao ? 'license-orgao-error' : undefined} className={fieldClass} />
            </FormField>
          </div>
        </FormSection>

        <FormSection sectionId="license-validity" title="Validade e situação" description="Controle a emissão, o vencimento e a situação administrativa atual." icon={<CalendarBlank className="h-5 w-5" weight="duotone" />} tone="cyan">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField htmlFor="license-dataEmissao" label="Data de emissão">
              <DatePickerField id="license-dataEmissao" name="dataEmissao" autoComplete="off" value={form.dataEmissao} onChange={(event) => update('dataEmissao', event.target.value)} className={fieldClass} />
            </FormField>
            <FormField htmlFor="license-dataVencimento" label="Data de vencimento" required error={errors.dataVencimento}>
              <DatePickerField id="license-dataVencimento" name="dataVencimento" autoComplete="off" min={form.dataEmissao || undefined} value={form.dataVencimento} onChange={(event) => update('dataVencimento', event.target.value)} aria-invalid={Boolean(errors.dataVencimento)} aria-describedby={errors.dataVencimento ? 'license-dataVencimento-error' : undefined} className={fieldClass} />
            </FormField>
            <FormField htmlFor="license-status" label="Situação atual">
              <FormSelect id="license-status" name="status" autoComplete="off" value={form.status} onChange={(event) => update('status', event.target.value as FormState['status'])} className={cn(fieldClass, 'geo-native-select')}>
                {LICENSE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </FormSelect>
            </FormField>
          </div>
        </FormSection>

        <FormSection sectionId="license-notes" title="Observações e referências" description="Registre restrições, orientações para renovação e referências documentais." icon={<NotePencil className="h-5 w-5" weight="duotone" />} tone="cyan" optional>
          <FormField htmlFor="license-observacoes" label="Observações">
            <textarea id="license-observacoes" name="observacoes" rows={4} maxLength={2000} value={form.observacoes} onChange={(event) => update('observacoes', event.target.value)} placeholder="Restrições, informações de renovação e referências documentais." className={cn(geoFieldClass, 'w-full resize-y px-3 py-2 text-sm')} />
          </FormField>
        </FormSection>
        <FormFooter>
          <button type="button" onClick={onClose} disabled={loading} className={secondarySmallActionButtonClass}>Cancelar</button>
          <button type="submit" disabled={loading || projectsQuery.isLoading} aria-busy={loading} className={primarySubmitButtonClass}>{loading ? 'Salvando…' : license ? 'Salvar alterações' : 'Criar licença'}</button>
        </FormFooter>
      </form>
    </Modal>
  );
}

export function LicenseFormModal(props: LicenseFormModalProps) {
  if (!props.isOpen) return null;
  return <LicenseFormModalContent key={props.license?.id || 'new-license'} {...props} />;
}
