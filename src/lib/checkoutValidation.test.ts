/**
 * @fileoverview Testes unitários da validação e auditoria do checkout.
 *
 * Cobre os cenários em que `planId` (vindo da URL ou do estado interno)
 * é inválido — garantindo que:
 *  1. As funções `isValidPlano` / `isValidOferta` rejeitem valores fora da whitelist.
 *  2. A entrada de auditoria seja construída com o valor rejeitado e o contexto correto.
 *  3. Os logs `[AUDIT][CHECKOUT]` sejam emitidos via console.warn / console.info.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isValidPlano,
  isValidOferta,
  parsePlano,
  parseOferta,
  buildCheckoutAuditEntry,
  logCheckoutRejection,
  logCheckoutRecoveryClick,
  AUDIT_PREFIX,
  VALID_PLANOS,
} from "./checkoutValidation";

describe("checkoutValidation - whitelist", () => {
  it("aceita planos válidos", () => {
    expect(isValidPlano("anual")).toBe(true);
    expect(isValidPlano("mensal")).toBe(true);
  });

  it("rejeita planId inválidos vindos da URL", () => {
    expect(isValidPlano("hacker")).toBe(false);
    expect(isValidPlano("")).toBe(false);
    expect(isValidPlano(null)).toBe(false);
    expect(isValidPlano(undefined)).toBe(false);
    expect(isValidPlano("ANUAL")).toBe(false); // case-sensitive
    expect(isValidPlano("anual; DROP TABLE")).toBe(false);
  });

  it("aceita ofertas válidas e rejeita ofertas inválidas", () => {
    expect(isValidOferta("padrao")).toBe(true);
    expect(isValidOferta("premium")).toBe(true);
    expect(isValidOferta("vip")).toBe(false);
    expect(isValidOferta(null)).toBe(false);
  });

  it("parsePlano/parseOferta caem nos defaults seguros", () => {
    expect(parsePlano("hacker")).toBe("anual");
    expect(parsePlano(null)).toBe("anual");
    expect(parseOferta("vip")).toBe("padrao");
    expect(parseOferta(null)).toBe("padrao");
  });
});

describe("checkoutValidation - auditoria", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("buildCheckoutAuditEntry captura o valor rejeitado e o contexto", () => {
    const entry = buildCheckoutAuditEntry({
      rejectedPlanId: "hacker",
      currentSelectedPlan: "anual",
      currentSelectedOferta: "padrao",
      urlPlano: "hacker",
      urlOferta: "vip",
      url: "https://app.test/assinatura?plano=hacker&oferta=vip",
    });

    expect(entry.event).toBe("checkout_planId_rejeitado");
    expect(entry.rejectedPlanId).toBe("hacker");
    expect(entry.rejectedPlanIdType).toBe("string");
    expect(entry.validValues).toEqual([...VALID_PLANOS]);
    expect(entry.urlPlano).toBe("hacker");
    expect(entry.urlOferta).toBe("vip");
    expect(entry.url).toContain("plano=hacker");
    expect(entry.userAction).toBe("auto_reset_para_anual");
    expect(entry.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("buildCheckoutAuditEntry trata null sem quebrar", () => {
    const entry = buildCheckoutAuditEntry({ rejectedPlanId: null });
    expect(entry.rejectedPlanId).toBeNull();
    expect(entry.rejectedPlanIdType).toBe("object"); // typeof null === "object"
  });

  it("logCheckoutRejection emite console.warn com prefixo [AUDIT][CHECKOUT] e o valor rejeitado", () => {
    const entry = buildCheckoutAuditEntry({
      rejectedPlanId: "hacker",
      urlPlano: "hacker",
    });

    logCheckoutRejection(entry);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message, payload] = warnSpy.mock.calls[0];
    expect(message).toContain(AUDIT_PREFIX);
    expect(message).toContain("planId rejeitado");
    expect(payload).toMatchObject({
      event: "checkout_planId_rejeitado",
      rejectedPlanId: "hacker",
      userAction: "auto_reset_para_anual",
    });
  });

  it("logCheckoutRecoveryClick emite console.info com userAction de recuperação", () => {
    const entry = buildCheckoutAuditEntry({ rejectedPlanId: "hacker" });

    logCheckoutRecoveryClick(entry);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [message, payload] = infoSpy.mock.calls[0];
    expect(message).toContain(AUDIT_PREFIX);
    expect(message).toContain("Selecionar Anual");
    expect(payload).toMatchObject({
      rejectedPlanId: "hacker",
      userAction: "usuario_clicou_selecionar_anual",
    });
    expect(payload.clickedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
