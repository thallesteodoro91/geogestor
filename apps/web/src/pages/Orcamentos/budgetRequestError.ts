import { ApiError } from '../../services/apiClient';

/** Communication loss does not establish whether a financial action was committed. */
export function budgetRequestError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Não foi possível concluir a solicitação.';
  if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) {
    return `${message} Seus campos foram preservados. Confira a lista e o histórico para verificar se a operação foi concluída antes de tentar novamente.`;
  }
  return `${message} Revise as informações e tente novamente. Seus campos foram preservados.`;
}
