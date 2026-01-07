import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEventosByCliente,
  createEvento,
  deleteEvento,
  updateEvento,
  registrarNotaManual,
  FiltrosEvento,
  ClienteEvento,
} from '@/modules/crm/services/cliente-eventos.service';

export function useClienteEventos(clienteId: string, filtros?: FiltrosEvento) {
  return useQuery({
    queryKey: ['cliente-eventos', clienteId, filtros],
    queryFn: () => fetchEventosByCliente(clienteId, filtros),
    enabled: !!clienteId,
  });
}

export function useCreateEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<ClienteEvento, 'id_evento' | 'created_at' | 'tenant_id'>) =>
      createEvento(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cliente-eventos', variables.id_cliente],
      });
    },
  });
}

export function useDeleteEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventoId, clienteId }: { eventoId: string; clienteId: string }) =>
      deleteEvento(eventoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cliente-eventos', variables.clienteId],
      });
    },
  });
}

export function useUpdateEvento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventoId,
      clienteId,
      data,
    }: {
      eventoId: string;
      clienteId: string;
      data: Partial<Pick<ClienteEvento, 'titulo' | 'descricao' | 'categoria' | 'data_evento' | 'id_servico'>>;
    }) => updateEvento(eventoId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cliente-eventos', variables.clienteId],
      });
    },
  });
}

export function useRegistrarNota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clienteId,
      titulo,
      descricao,
      servicoId,
      categoria,
      dataEvento,
    }: {
      clienteId: string;
      titulo: string;
      descricao?: string;
      servicoId?: string;
      categoria?: string;
      dataEvento?: string;
    }) => registrarNotaManual(clienteId, titulo, descricao, servicoId, categoria, dataEvento),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cliente-eventos', variables.clienteId],
      });
    },
  });
}
