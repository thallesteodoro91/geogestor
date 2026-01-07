import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTarefasByCliente,
  createTarefa,
  updateTarefa,
  deleteTarefa,
  marcarTarefaConcluida,
  getTarefasPendentes,
  FiltrosTarefa,
  ClienteTarefa,
} from '@/modules/crm/services/cliente-tarefas.service';

export function useClienteTarefas(clienteId: string, filtros?: FiltrosTarefa) {
  return useQuery({
    queryKey: ['cliente-tarefas', clienteId, filtros],
    queryFn: () => fetchTarefasByCliente(clienteId, filtros),
    enabled: !!clienteId,
  });
}

export function useCreateTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<ClienteTarefa, 'id_tarefa' | 'created_at' | 'updated_at' | 'tenant_id'>) =>
      createTarefa(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cliente-tarefas', variables.id_cliente],
      });
    },
  });
}

export function useUpdateTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      clienteId,
      data,
    }: {
      id: string;
      clienteId: string;
      data: Partial<Omit<ClienteTarefa, 'id_tarefa' | 'created_at' | 'updated_at' | 'tenant_id'>>;
    }) => updateTarefa(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cliente-tarefas', variables.clienteId],
      });
    },
  });
}

export function useDeleteTarefa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, clienteId }: { id: string; clienteId: string }) =>
      deleteTarefa(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cliente-tarefas', variables.clienteId],
      });
    },
  });
}

export function useMarcarTarefaConcluida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      clienteId,
      concluida,
    }: {
      id: string;
      clienteId: string;
      concluida: boolean;
    }) => marcarTarefaConcluida(id, concluida),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cliente-tarefas', variables.clienteId],
      });
      queryClient.invalidateQueries({
        queryKey: ['cliente-eventos', variables.clienteId],
      });
    },
  });
}

export function useTarefasPendentes(clienteId: string) {
  return useQuery({
    queryKey: ['cliente-tarefas-pendentes', clienteId],
    queryFn: () => getTarefasPendentes(clienteId),
    enabled: !!clienteId,
  });
}
