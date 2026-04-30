/**
 * @fileoverview Teste e2e (em ambiente jsdom) da página de Assinatura focado em
 * comportamento de URL adulterada manualmente.
 *
 * Estratégia: mockamos `sonner` para capturar diretamente as chamadas de `toast()` /
 * `toast.error()`. Isso evita depender da renderização assíncrona do portal do toaster
 * e cobre exatamente o contrato observado pelo usuário (mensagem + descrição).
 *
 * Cenários cobertos:
 *  1. URL com `?plano=hacker&oferta=evil` dispara um toast informativo citando
 *     ambos os parâmetros rejeitados.
 *  2. O estado interno cai no padrão seguro ("anual") — o CTA principal mostra o
 *     copy do plano anual.
 *  3. A camada de sanitização da URL absorve o valor inválido, então NENHUM log
 *     `[AUDIT][CHECKOUT]` (rejeição do `handleSubscribe`) é emitido nesse fluxo.
 *
 * Os testes do log de auditoria (warn/info com `[AUDIT][CHECKOUT]` e o valor rejeitado)
 * ficam no unitário `src/lib/checkoutValidation.test.ts`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---- Mocks ----
const { toastMock } = vi.hoisted(() => {
  const fn = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
  });
  return { toastMock: fn };
});

vi.mock("sonner", () => ({
  toast: toastMock,
  Toaster: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ subscription: null }),
  TenantProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useStripeSubscription", () => ({
  useStripeSubscription: () => ({
    subscribed: false,
    price_id: null,
    subscription_tier: null,
    subscription_end: null,
    loading: false,
  }),
}));

import Assinatura from "@/pages/Assinatura";

function renderWithUrl(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Assinatura />
    </MemoryRouter>,
  );
}

describe("Assinatura — URL adulterada manualmente", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    toastMock.mockClear();
    toastMock.error.mockClear();
    toastMock.success.mockClear();
    toastMock.info.mockClear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("dispara toast informativo citando os parâmetros inválidos da URL", async () => {
    renderWithUrl("/assinatura?plano=hacker&oferta=evil");

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled();
    });

    const sanitizationCall = toastMock.mock.calls.find(([msg]) =>
      typeof msg === "string" && msg.includes("não reconhecido"),
    );
    expect(sanitizationCall).toBeTruthy();

    const [message] = sanitizationCall!;
    expect(message).toMatch(/plano "hacker"/);
    expect(message).toMatch(/oferta "evil"/);
  });

  it("trava o TEXTO EXATO do toast de URL inválida (mensagem + opções)", async () => {
    renderWithUrl("/assinatura?plano=hacker&oferta=evil");

    await waitFor(() => {
      const found = toastMock.mock.calls.find(([msg]) =>
        typeof msg === "string" && msg.includes("não reconhecido"),
      );
      expect(found).toBeTruthy();
    });

    const sanitizationCall = toastMock.mock.calls.find(([msg]) =>
      typeof msg === "string" && msg.includes("não reconhecido"),
    )!;

    expect(sanitizationCall[0]).toBe(
      'Parâmetro plano "hacker" e oferta "evil" não reconhecido — usando opção padrão.',
    );
    expect(sanitizationCall[1]).toEqual({ icon: "ℹ️" });
  });

  it("trava o TEXTO EXATO do toast de checkout cancelado (mensagem + descrição)", async () => {
    renderWithUrl("/assinatura?checkout=canceled");

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled();
    });

    const canceladoCall = toastMock.mock.calls.find(([msg]) =>
      typeof msg === "string" && msg.includes("Compra cancelada"),
    );
    expect(canceladoCall).toBeTruthy();
    expect(canceladoCall![0]).toBe("Compra cancelada — seus dados estão salvos");
    expect(canceladoCall![1]).toEqual({
      description: "Quando quiser, você pode escolher um plano novamente.",
      icon: "ℹ️",
    });
  });

  it("não emite o toast informativo quando a URL é válida", async () => {
    renderWithUrl("/assinatura?plano=anual&oferta=premium");

    await act(async () => {
      await Promise.resolve();
    });

    const sanitizationCall = toastMock.mock.calls.find(([msg]) =>
      typeof msg === "string" && msg.includes("não reconhecido"),
    );
    expect(sanitizationCall).toBeUndefined();
  });

  it("recai no plano padrão (anual) quando a URL chega com plano inválido", () => {
    renderWithUrl("/assinatura?plano=hacker");

    expect(screen.getByRole("button", { name: /anual/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mensal/i })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /começar com desconto/i }).length,
    ).toBeGreaterThan(0);
  });

  it("não emite log [AUDIT][CHECKOUT] no carregamento — a URL já é sanitizada antes do submit", async () => {
    renderWithUrl("/assinatura?plano=hacker");

    await act(async () => {
      await Promise.resolve();
    });

    const auditWarnings = warnSpy.mock.calls.filter(([msg]) =>
      typeof msg === "string" && msg.includes("[AUDIT][CHECKOUT]"),
    );
    const auditInfos = infoSpy.mock.calls.filter(([msg]) =>
      typeof msg === "string" && msg.includes("[AUDIT][CHECKOUT]"),
    );

    expect(auditWarnings).toHaveLength(0);
    expect(auditInfos).toHaveLength(0);
  });
});
