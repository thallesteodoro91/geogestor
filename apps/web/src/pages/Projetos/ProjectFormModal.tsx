import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ProjetoPayload } from '@geogestor/contracts';
import { Modal } from '../../components/Modal';
import { FormFooter } from '../../components/Form';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { geoTabButtonClass, geoTabListClass } from '../../utils/geoTheme';
import { invalidateFinancialQueries } from '../../utils/invalidateFinancialQueries';
import { ProjetoFormFields } from './ProjetoFormFields';
import { ProjectCancellationDecisionModal } from './ProjectCancellationDecisionModal';
import { QuickClientModal, type CreatedProjectClient } from './QuickClientModal';
import {
  createEmptyProjectForm,
  projectFieldTab,
  projectFormFingerprint,
  projectRecordToForm,
  resolveProjectFormCopy,
  validateProjectForm,
  type ProjectFormErrors,
  type ProjectFormState,
  type ProjectModalContext,
  type ProjectModalTab,
  type ProjectRecordForForm
} from './projectForm';

export interface ProjectFormClientOption {
  id: string;
  nome: string;
}

export interface ProjectFormSavedRecord extends ProjectRecordForForm {
  id: string;
  tipo?: string | null;
}

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientes?: ProjectFormClientOption[];
  context?: ProjectModalContext;
  project?: ProjectFormSavedRecord | null;
  initialClientId?: string;
  initialTab?: ProjectModalTab;
  onSaved?: (project: ProjectFormSavedRecord, context: ProjectModalContext) => void;
}

const projectTabOrder: ProjectModalTab[] = ['projeto', 'propriedade', 'geoloc'];

function ProjectFormModalContent({
  onClose,
  clientes = [],
  context = 'projeto',
  project = null,
  initialClientId = '',
  initialTab = 'projeto',
  onSaved
}: ProjectFormModalProps) {
  const queryClient = useQueryClient();
  const initialForm = project ? projectRecordToForm(project) : createEmptyProjectForm(context, initialClientId);
  const [form, setForm] = useState<ProjectFormState>(initialForm);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [activeTab, setActiveTab] = useState<ProjectModalTab>(initialTab);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [pendingCancellationProject, setPendingCancellationProject] = useState<ProjectFormSavedRecord | null>(null);
  const [initialFingerprint, setInitialFingerprint] = useState(projectFormFingerprint(initialForm));
  const dirty = projectFormFingerprint(form) !== initialFingerprint;
  const effectiveContext: ProjectModalContext = project?.tipo === 'Ambiental'
    ? 'ambiental'
    : project?.tipo === 'Licenciamento'
      ? 'licenciamento'
      : context;
  const copy = resolveProjectFormCopy(effectiveContext, form.tipo || project?.tipo);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const saveMutation = useMutation({
    mutationFn: (payload: ProjetoPayload) => (
      project
        ? apiClient.patch<ProjectFormSavedRecord>(`/api/projetos/${project.id}`, payload)
        : apiClient.post<ProjectFormSavedRecord>('/api/projetos', payload)
    ),
    onSuccess: async (savedProject) => {
      const feedback = project ? copy.updateSuccess : copy.createSuccess;
      const cancellationStarted = Boolean(
        project
        && project.status !== 'Cancelado'
        && savedProject.status === 'Cancelado'
      );
      setInitialFingerprint(projectFormFingerprint(form));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projetos'] }),
        queryClient.invalidateQueries({ queryKey: ['stats-geral'] }),
        queryClient.invalidateQueries({ queryKey: ['projetos-notificacoes'] }),
        queryClient.invalidateQueries({ queryKey: ['ambiental-demandas'] }),
        invalidateFinancialQueries(queryClient)
      ]);
      if (cancellationStarted) {
        setPendingCancellationProject(savedProject);
        toast.warning('Projeto cancelado. Defina agora o tratamento financeiro.');
        return;
      }
      toast.success(feedback);
      onClose();
      onSaved?.(savedProject, effectiveContext);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : project ? 'Erro ao atualizar o registro.' : 'Erro ao criar o registro.');
    }
  });

  const clearErrors = (...fields: Array<keyof ProjectFormState>) => {
    setErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  };

  const activateTab = (tab: ProjectModalTab, moveFocus = false) => {
    setActiveTab(tab);
    window.setTimeout(() => {
      const scrollRegion = document.getElementById('project-form-scroll-region');
      if (scrollRegion) scrollRegion.scrollTop = 0;
      if (moveFocus) document.getElementById(`project-tab-${tab}`)?.focus();
    }, 0);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentTab: ProjectModalTab) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = projectTabOrder.indexOf(currentTab);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? projectTabOrder.length - 1
        : event.key === 'ArrowRight'
          ? (currentIndex + 1) % projectTabOrder.length
          : (currentIndex - 1 + projectTabOrder.length) % projectTabOrder.length;
    activateTab(projectTabOrder[nextIndex], true);
  };

  const close = () => {
    if (dirty && !saveMutation.isPending && !window.confirm(copy.discardMessage)) return;
    setShowQuickClientModal(false);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateProjectForm(form);
    if (activeTab !== 'geoloc') {
      const currentTabErrors = Object.entries(validation.errors).filter(([field]) => (
        projectFieldTab[field as keyof ProjectFormState] === activeTab
      ));
      if (currentTabErrors.length) {
        setErrors(validation.errors);
        const [firstField] = currentTabErrors[0] as [keyof ProjectFormState, string];
        window.setTimeout(() => document.getElementById(`project-${firstField}`)?.focus(), 0);
        return;
      }
      activateTab(projectTabOrder[projectTabOrder.indexOf(activeTab) + 1]);
      return;
    }

    setErrors(validation.errors);
    if (!validation.valid) {
      const firstField = Object.keys(validation.errors)[0] as keyof ProjectFormState | undefined;
      const firstTab = firstField ? projectFieldTab[firstField] || 'projeto' : 'projeto';
      activateTab(firstTab);
      window.setTimeout(() => document.getElementById(firstField ? `project-${firstField}` : 'project-nome')?.focus(), 0);
      return;
    }
    if (project && validation.payload.clienteId !== project.clienteId) {
      try {
        const impact = await apiClient.get<{
          allowed: boolean;
          hasFinancialDependencies: boolean;
          dependencies: Array<{ label: string; count: number; financial: boolean }>;
        }>(`/api/projetos/${project.id}/reassignment-impact?clienteId=${validation.payload.clienteId}`);
        const dependencySummary = impact.dependencies.length
          ? impact.dependencies.map((item) => `${item.label}: ${item.count}${item.financial ? ' (financeiro)' : ''}`).join('\n')
          : 'Nenhuma dependência vinculada.';
        if (impact.hasFinancialDependencies) {
          toast.error(`Reatribuição bloqueada. Dependências financeiras encontradas:\n${dependencySummary}`);
          return;
        }
        const confirmed = window.confirm([
          'Reatribuir este projeto para outro cliente?', '', dependencySummary, '',
          impact.dependencies.length
            ? 'As dependências editáveis e os metadados de arquivos serão atualizados em uma única transação.'
            : 'O projeto não possui dependências vinculadas.'
        ].join('\n'));
        if (!confirmed) return;
        if (impact.dependencies.length) {
          await apiClient.post(`/api/projetos/${project.id}/reassign-client`, {
            clienteId: validation.payload.clienteId,
            confirmation: `REATRIBUIR ${project.id} PARA ${validation.payload.clienteId}`
          });
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível analisar a reatribuição.');
        return;
      }
    }
    saveMutation.mutate(validation.payload);
  };

  const handleQuickClientCreated = (client: CreatedProjectClient) => {
    setForm((current) => ({ ...current, clienteId: client.id }));
    clearErrors('clienteId');
    setShowQuickClientModal(false);
    window.setTimeout(() => document.getElementById('project-clienteId')?.focus(), 80);
  };

  const tabLabels: Record<ProjectModalTab, string> = {
    projeto: effectiveContext === 'projeto' ? 'Dados essenciais' : 'Dados da demanda',
    propriedade: 'Imóvel e documentação',
    geoloc: 'Localização e notas'
  };

  return (
    <>
      <Modal
        isOpen={!showQuickClientModal && !pendingCancellationProject}
        onClose={close}
        closeDisabled={saveMutation.isPending}
        title={(
          <span className="flex flex-wrap items-center gap-2">
            <span>{project ? copy.editTitle : copy.createTitle}</span>
            {dirty && <span className="geo-badge-base geo-badge-unsaved px-2.5 py-1 text-[11px] font-bold leading-none">Alterações não salvas</span>}
          </span>
        )}
        maxWidth="max-w-[960px]"
        panelClassName="h-[min(760px,88dvh)]"
        contentScrollable={false}
        initialFocusId="project-nome"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative mb-4 shrink-0">
            <div className="overflow-x-auto pb-1">
              <div role="tablist" aria-label="Etapas do formulário" className={cn(geoTabListClass, 'flex w-max min-w-full gap-1.5 sm:min-w-0')}>
                {projectTabOrder.map((tab, index) => {
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      id={`project-tab-${tab}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`project-panel-${tab}`}
                      tabIndex={active ? 0 : -1}
                      onClick={() => activateTab(tab)}
                      onKeyDown={(event) => handleTabKeyDown(event, tab)}
                      className={geoTabButtonClass(active, 'system', 'px-3.5 py-2')}
                    >
                      <span aria-hidden="true" className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ring-1', active ? 'bg-brand-primary-600 text-white ring-brand-primary-500/50' : 'bg-brand-surface-subtle text-zinc-500 ring-brand-border dark:text-zinc-300')}>{index + 1}</span>
                      {tabLabels[tab]}
                    </button>
                  );
                })}
              </div>
            </div>
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-brand-surface to-transparent sm:hidden" />
          </div>

          <form id={`project-panel-${activeTab}`} role="tabpanel" aria-labelledby={`project-tab-${activeTab}`} onSubmit={submit} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div id="project-form-scroll-region" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-5 pr-1">
              <ProjetoFormFields
                form={form}
                setForm={setForm}
                errors={errors}
                activeTab={activeTab}
                context={effectiveContext}
                clientes={clientes}
                propriedades={[]}
                onClearErrors={clearErrors}
                onCreateClient={() => setShowQuickClientModal(true)}
              />
            </div>

            <FormFooter className="relative z-0 mt-0 flex-shrink-0 flex-wrap py-4 sm:flex-nowrap">
              <p className="mr-auto w-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:w-auto" role="status" aria-live="polite">
                {activeTab === 'projeto' ? 'Campos obrigatórios marcados com *' : 'Preenchimento opcional nesta etapa'}
              </p>
              <button type="button" onClick={close} disabled={saveMutation.isPending} className={secondarySmallActionButtonClass}>Cancelar</button>
              {activeTab !== 'projeto' && (
                <button type="button" onClick={() => activateTab(projectTabOrder[projectTabOrder.indexOf(activeTab) - 1])} disabled={saveMutation.isPending} className={secondarySmallActionButtonClass}>Voltar</button>
              )}
              <button type="submit" disabled={saveMutation.isPending} aria-busy={saveMutation.isPending} className={cn(primarySubmitButtonClass, 'px-6 py-3 disabled:cursor-wait disabled:opacity-70')}>
                {saveMutation.isPending ? 'Salvando…' : activeTab === 'geoloc' ? project ? 'Salvar alterações' : copy.createAction : 'Continuar'}
              </button>
            </FormFooter>
          </form>

          {projectTabOrder.filter((tab) => tab !== activeTab).map((tab) => (
            <div key={tab} id={`project-panel-${tab}`} role="tabpanel" aria-labelledby={`project-tab-${tab}`} hidden />
          ))}
        </div>
      </Modal>

      <QuickClientModal
        isOpen={showQuickClientModal}
        onClose={() => {
          setShowQuickClientModal(false);
          window.setTimeout(() => document.getElementById('project-create-client')?.focus(), 80);
        }}
        onCreated={handleQuickClientCreated}
        contextLabel={effectiveContext === 'ambiental' ? 'demanda ambiental' : effectiveContext === 'licenciamento' ? 'processo de licenciamento' : 'projeto'}
      />
      {pendingCancellationProject && (
        <ProjectCancellationDecisionModal
          project={{ id: pendingCancellationProject.id, nome: pendingCancellationProject.nome || 'Projeto sem nome' }}
          onCompleted={() => {
            const savedProject = pendingCancellationProject;
            setPendingCancellationProject(null);
            onClose();
            onSaved?.(savedProject, effectiveContext);
          }}
          onDeferred={() => {
            const savedProject = pendingCancellationProject;
            setPendingCancellationProject(null);
            toast.warning('O projeto permanece com decisão financeira pendente.');
            onClose();
            onSaved?.(savedProject, effectiveContext);
          }}
        />
      )}
    </>
  );
}

export function ProjectFormModal(props: ProjectFormModalProps) {
  if (!props.isOpen) return null;
  return <ProjectFormModalContent {...props} />;
}
