import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCategorias,
  createCategoria,
  CategoriaEvento,
} from '@/modules/crm/services/categoria-evento.service';

export function useCategoriaEventos(tipo?: 'evento' | 'tarefa' | 'ambos') {
  return useQuery({
    queryKey: ['categorias-evento', tipo],
    queryFn: () => fetchCategorias(tipo),
  });
}

export function useCreateCategoria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<CategoriaEvento, 'id_categoria' | 'created_at' | 'tenant_id'>) =>
      createCategoria(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias-evento'] });
    },
  });
}
