/**
 * @fileoverview Hook para verificação de limites do plano antes de operações
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { checkPlanLimit, ResourceType, withLimitCheck } from '@/services/plan-limits.service';

/**
 * Hook para verificar limite antes de uma operação
 */
export function usePlanLimitCheck() {
  const queryClient = useQueryClient();

  /**
   * Verifica se pode adicionar um recurso e mostra toast se não puder
   */
  const canAdd = async (resourceType: ResourceType): Promise<boolean> => {
    const result = await checkPlanLimit(resourceType);
    
    if (!result.allowed) {
      toast.error(result.message, {
        description: 'Acesse Configurações > Plano para fazer upgrade.',
        action: {
          label: 'Ver Planos',
          onClick: () => window.location.href = '/configuracoes',
        },
        duration: 6000,
      });
    }
    
    return result.allowed;
  };

  /**
   * Executa uma operação com verificação de limite
   */
  const executeWithCheck = async <T>(
    resourceType: ResourceType,
    operation: () => Promise<T>,
    options?: {
      onSuccess?: (data: T) => void;
      onError?: (error: string) => void;
      invalidateQueries?: string[];
    }
  ): Promise<T | null> => {
    const result = await withLimitCheck(resourceType, operation);
    
    if (!result.success) {
      toast.error(result.error || 'Operação não permitida', {
        description: 'Acesse Configurações > Plano para fazer upgrade.',
        action: {
          label: 'Ver Planos',
          onClick: () => window.location.href = '/configuracoes',
        },
        duration: 6000,
      });
      options?.onError?.(result.error || 'Erro desconhecido');
      return null;
    }
    
    // Invalidar queries relacionadas
    if (options?.invalidateQueries) {
      for (const key of options.invalidateQueries) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
    
    // Sempre invalidar resource-counts para atualizar contagens
    queryClient.invalidateQueries({ queryKey: ['resource-counts'] });
    
    options?.onSuccess?.(result.data as T);
    return result.data as T;
  };

  return {
    canAdd,
    executeWithCheck,
    checkPlanLimit,
  };
}

/**
 * Hook para criar mutação com verificação de limite automática
 */
export function useProtectedMutation<TData, TVariables>(
  resourceType: ResourceType,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: string) => void;
    successMessage?: string;
    errorMessage?: string;
    invalidateQueries?: string[];
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const result = await withLimitCheck(resourceType, () => mutationFn(variables));
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result.data as TData;
    },
    onSuccess: (data) => {
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
      
      // Invalidar queries
      if (options?.invalidateQueries) {
        for (const key of options.invalidateQueries) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['resource-counts'] });
      
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const isLimitError = error.message.includes('Limite') || error.message.includes('limite');
      
      toast.error(options?.errorMessage || error.message, {
        description: isLimitError ? 'Acesse Configurações > Plano para fazer upgrade.' : undefined,
        action: isLimitError ? {
          label: 'Ver Planos',
          onClick: () => window.location.href = '/configuracoes',
        } : undefined,
        duration: isLimitError ? 6000 : 4000,
      });
      
      options?.onError?.(error.message);
    },
  });
}
