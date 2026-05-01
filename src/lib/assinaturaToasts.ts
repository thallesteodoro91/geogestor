/**
 * @fileoverview Cópias (copy) dos toasts da página de Assinatura.
 *
 * Centralizar aqui garante que o texto exibido ao usuário não mude
 * acidentalmente entre versões — qualquer alteração de wording quebra
 * o teste correspondente em `assinaturaToasts.test.ts`.
 */

import type { PlanId } from "./checkoutValidation";

export const ASSINATURA_TOASTS = {
  /** Toast informativo quando a URL chega com parâmetros fora da whitelist. */
  paramInvalido: (partes: string) =>
    `Parâmetro ${partes} não reconhecido — usando opção padrão.`,

  /** Toast informativo após retorno do checkout cancelado pelo usuário. */
  checkoutCancelado: {
    message: "Compra cancelada — seus dados estão salvos",
    description: "Quando quiser, você pode escolher um plano novamente.",
  } as const,

  /** Toast de sucesso quando o checkout retorna com pagamento aprovado. */
  checkoutApproved: {
    message: "Pagamento aprovado — bem-vindo ao GeoGestor!",
    description: "Seu acesso completo foi liberado. Bom trabalho!",
  } as const,

  /** Toast de erro quando o checkout retorna com pagamento recusado. */
  checkoutFailed: {
    message: "Pagamento recusado",
    description: "Tente outro método de pagamento ou fale com seu banco.",
  } as const,

  /** Toast informativo quando o pagamento ainda está em processamento (boleto/pix). */
  checkoutProcessing: {
    message: "Pagamento em processamento",
    description: "Avisaremos por e-mail assim que a confirmação chegar.",
  } as const,

  /** Toast de erro quando o portal de gerenciamento falha. */
  erroPortal: {
    message: "Erro ao abrir portal de gerenciamento",
  } as const,

  /** Toast de erro quando o `planId` enviado ao checkout é inválido. */
  planoInvalido: (planoExibido: string, validValues: readonly PlanId[]) => ({
    message: `Plano ${planoExibido} não é válido`,
    description: `Aceitamos apenas: ${validValues.join(" ou ")}. Toque em "Anual" ou "Mensal" acima para escolher novamente antes de continuar.`,
    actionLabel: "Selecionar Anual",
    duration: 6000,
  }),

  /** Toast de erro quando o usuário tenta assinar sem sessão. */
  semSessao: "Faça login para assinar um plano.",

  /** Toast de sucesso após abrir o checkout em nova aba (desktop). */
  checkoutAberto: {
    message: "Abrimos o pagamento em uma nova aba",
    description: "Conclua a compra para liberar o acesso completo.",
  } as const,

  /** Toast de erro genérico ao iniciar o pagamento. */
  erroCheckout: {
    message: "Erro ao iniciar pagamento",
  } as const,
} as const;

/**
 * Formata o `planId` para exibição no toast — vazio vira a string `vazio`
 * (sem aspas), qualquer outra coisa vai entre aspas duplas.
 */
export function formatPlanoExibido(planId: string | null | undefined): string {
  return planId?.trim() ? `"${planId}"` : "vazio";
}

/**
 * Monta o trecho "plano \"x\" e oferta \"y\"" usado no toast de URL inválida.
 * Aceita qualquer combinação dos dois parâmetros.
 */
export function formatParamsInvalidos(opts: {
  planoInvalido: string | null;
  ofertaInvalida: string | null;
}): string {
  return [
    opts.planoInvalido !== null ? `plano "${opts.planoInvalido}"` : null,
    opts.ofertaInvalida !== null ? `oferta "${opts.ofertaInvalida}"` : null,
  ]
    .filter(Boolean)
    .join(" e ");
}
