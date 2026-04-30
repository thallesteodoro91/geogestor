/**
 * @fileoverview Snapshot textual dos toasts da página de Assinatura.
 *
 * Este arquivo trava o conteúdo EXATO (mensagem + descrição + label da ação +
 * duração) de cada toast. Qualquer mudança de wording precisa atualizar
 * conscientemente este teste — protegendo contra regressões silenciosas.
 *
 * Se você está alterando uma mensagem de propósito: ajuste a constante em
 * `src/lib/assinaturaToasts.ts` E o teste correspondente aqui.
 */

import { describe, it, expect } from "vitest";
import {
  ASSINATURA_TOASTS,
  formatPlanoExibido,
  formatParamsInvalidos,
} from "./assinaturaToasts";
import { VALID_PLANOS } from "./checkoutValidation";

describe("ASSINATURA_TOASTS — texto exato (anti-regressão)", () => {
  it("paramInvalido: cita os parâmetros e indica fallback para padrão", () => {
    expect(ASSINATURA_TOASTS.paramInvalido('plano "hacker"')).toBe(
      'Parâmetro plano "hacker" não reconhecido — usando opção padrão.',
    );

    expect(
      ASSINATURA_TOASTS.paramInvalido('plano "x" e oferta "y"'),
    ).toBe(
      'Parâmetro plano "x" e oferta "y" não reconhecido — usando opção padrão.',
    );
  });

  it("checkoutCancelado: mensagem e descrição exatas", () => {
    expect(ASSINATURA_TOASTS.checkoutCancelado).toEqual({
      message: "Compra cancelada — seus dados estão salvos",
      description: "Quando quiser, você pode escolher um plano novamente.",
    });
  });

  it("erroPortal: mensagem exata", () => {
    expect(ASSINATURA_TOASTS.erroPortal).toEqual({
      message: "Erro ao abrir portal de gerenciamento",
    });
  });

  it("planoInvalido: mensagem, descrição, ação e duração exatas", () => {
    const copy = ASSINATURA_TOASTS.planoInvalido('"hacker"', VALID_PLANOS);

    expect(copy.message).toBe('Plano "hacker" não é válido');
    expect(copy.description).toBe(
      'Aceitamos apenas: anual ou mensal. Toque em "Anual" ou "Mensal" acima para escolher novamente antes de continuar.',
    );
    expect(copy.actionLabel).toBe("Selecionar Anual");
    expect(copy.duration).toBe(6000);
  });

  it("planoInvalido: trata planId vazio com a string 'vazio' (sem aspas)", () => {
    const copy = ASSINATURA_TOASTS.planoInvalido(
      formatPlanoExibido(""),
      VALID_PLANOS,
    );
    expect(copy.message).toBe("Plano vazio não é válido");
  });

  it("planoInvalido: descrição lista exatamente os valores aceitos na ordem da whitelist", () => {
    const copy = ASSINATURA_TOASTS.planoInvalido('"x"', VALID_PLANOS);
    // Reforça que a frase "anual ou mensal" reflete VALID_PLANOS na ordem original.
    expect(copy.description).toContain(VALID_PLANOS.join(" ou "));
  });

  it("semSessao: string exata (toast.error de uma linha)", () => {
    expect(ASSINATURA_TOASTS.semSessao).toBe(
      "Faça login para assinar um plano.",
    );
  });

  it("checkoutAberto: mensagem e descrição exatas", () => {
    expect(ASSINATURA_TOASTS.checkoutAberto).toEqual({
      message: "Abrimos o pagamento em uma nova aba",
      description: "Conclua a compra para liberar o acesso completo.",
    });
  });

  it("erroCheckout: mensagem exata", () => {
    expect(ASSINATURA_TOASTS.erroCheckout).toEqual({
      message: "Erro ao iniciar pagamento",
    });
  });
});

describe("formatPlanoExibido", () => {
  it("envolve valores não-vazios em aspas duplas", () => {
    expect(formatPlanoExibido("hacker")).toBe('"hacker"');
    expect(formatPlanoExibido("anual")).toBe('"anual"');
  });

  it("retorna 'vazio' para nulo, undefined ou string em branco", () => {
    expect(formatPlanoExibido(null)).toBe("vazio");
    expect(formatPlanoExibido(undefined)).toBe("vazio");
    expect(formatPlanoExibido("")).toBe("vazio");
    expect(formatPlanoExibido("   ")).toBe("vazio");
  });
});

describe("formatParamsInvalidos", () => {
  it("formata apenas plano quando só plano é inválido", () => {
    expect(
      formatParamsInvalidos({ planoInvalido: "hacker", ofertaInvalida: null }),
    ).toBe('plano "hacker"');
  });

  it("formata apenas oferta quando só oferta é inválida", () => {
    expect(
      formatParamsInvalidos({ planoInvalido: null, ofertaInvalida: "vip" }),
    ).toBe('oferta "vip"');
  });

  it("une os dois com ' e ' quando ambos são inválidos", () => {
    expect(
      formatParamsInvalidos({
        planoInvalido: "hacker",
        ofertaInvalida: "evil",
      }),
    ).toBe('plano "hacker" e oferta "evil"');
  });

  it("retorna string vazia quando nenhum é inválido", () => {
    expect(
      formatParamsInvalidos({ planoInvalido: null, ofertaInvalida: null }),
    ).toBe("");
  });
});
