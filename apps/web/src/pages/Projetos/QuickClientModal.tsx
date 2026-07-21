import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '../../components/Modal';
import { FormFooter } from '../../components/Form';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { ClienteFormFields } from '../Clientes/ClienteFormFields';
import {
  clientFormFingerprint,
  clientFormToPayload,
  createEmptyClientForm,
  validateClientForm,
  type ClientFormErrors,
  type ClientFormState
} from '../Clientes/clientForm';

export interface CreatedProjectClient {
  id: string;
  nome: string;
}

interface QuickClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (client: CreatedProjectClient) => void;
}

const emptyClientFingerprint = clientFormFingerprint(createEmptyClientForm());

function QuickClientModalContent({ isOpen, onClose, onCreated }: QuickClientModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClientFormState>(() => createEmptyClientForm());
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const dirty = clientFormFingerprint(form) !== emptyClientFingerprint;

  const clearErrors = (...fields: Array<keyof ClientFormState>) => {
    setErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  };

  const createClientMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof clientFormToPayload>) => (
      apiClient.post<CreatedProjectClient>('/api/clientes', payload)
    ),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente cadastrado e selecionado no projeto.');
      onCreated(client);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao cadastrar cliente.');
    }
  });

  const close = () => {
    if (dirty && !createClientMutation.isPending && !window.confirm('Descartar os dados deste novo cliente?')) return;
    onClose();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateClientForm(form);
    setErrors(validation.errors);
    if (!validation.valid) {
      const firstField = Object.keys(validation.errors)[0] as keyof ClientFormState | undefined;
      const fieldId = firstField === 'tipoPessoa' ? 'client-tipo-pf' : firstField ? `client-${firstField}` : 'client-nome';
      window.setTimeout(() => document.getElementById(fieldId)?.focus(), 0);
      return;
    }
    createClientMutation.mutate(validation.payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={(
        <span className="flex flex-wrap items-center gap-2">
          <span>Novo cliente para o projeto</span>
          {dirty && (
            <span className="geo-badge-base geo-badge-unsaved px-2.5 py-1 text-[11px] font-bold leading-none">
              Alterações não salvas
            </span>
          )}
        </span>
      )}
      maxWidth="max-w-[960px]"
      panelClassName="h-[min(760px,88dvh)]"
      contentScrollable={false}
      initialFocusId="client-nome"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div id="client-form-scroll-region" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-5 pr-1">
          <ClienteFormFields
            form={form}
            setForm={setForm}
            errors={errors}
            activeSection="basico"
            editing={false}
            onClearErrors={clearErrors}
          />
        </div>

        <FormFooter className="relative z-0 mt-0 flex-shrink-0 flex-wrap py-4 sm:flex-nowrap">
          <p className="mr-auto w-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:w-auto" role="status" aria-live="polite">
            Após salvar, o cliente será selecionado automaticamente.
          </p>
          <button type="button" onClick={close} disabled={createClientMutation.isPending} className={secondarySmallActionButtonClass}>
            Voltar ao projeto
          </button>
          <button
            type="submit"
            disabled={createClientMutation.isPending}
            aria-busy={createClientMutation.isPending}
            className={cn(primarySubmitButtonClass, 'px-6 py-3 disabled:cursor-wait disabled:opacity-70')}
          >
            {createClientMutation.isPending ? 'Cadastrando…' : 'Cadastrar cliente'}
          </button>
        </FormFooter>
      </form>
    </Modal>
  );
}

export function QuickClientModal(props: QuickClientModalProps) {
  if (!props.isOpen) return null;
  return <QuickClientModalContent {...props} />;
}
