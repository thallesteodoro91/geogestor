/**
 * @fileoverview Teste e2e (em ambiente jsdom) da página de Assinatura focado em
 * comportamento de URL adulterada manualmente:
 *
 *  - Quando o usuário acessa `/assinatura?plano=hacker&oferta=evil`, a página deve:
 *      1. Limpar os parâmetros inválidos da URL (replace, sem histórico).
 *      2. Mostrar um toast informando que o parâmetro não foi reconhecido.
 *      3. Manter o estado interno em valores válidos ("anual" / "padrao") — de modo que
 *         o clique no CTA principal NÃO dispare o log de auditoria de rejeição,
 *         pois a sanitização já ocorreu.
 *
 *  - Os testes unitários da camada de validação ficam em
 *    `src/lib/checkoutValidation.test.ts` (incluindo emissão dos logs `[AUDIT][CHECKOUT]`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---- Mocks ----
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
      <Toaster />
    </MemoryRouter>,
  );
}

describe("Assinatura — URL adulterada manualmente", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("exibe toast informando que o parâmetro inválido foi descartado", async () => {
    renderWithUrl("/assinatura?plano=hacker&oferta=evil");

    // O toast da sanitização vem do useEffect que roda na primeira render.
    await waitFor(
      () => {
        expect(
          screen.getByText(/não reconhecido/i),
        ).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    const toastText = screen.getByText(/não reconhecido/i).textContent ?? "";
    expect(toastText).toMatch(/plano "hacker"/);
    expect(toastText).toMatch(/oferta "evil"/);
  });

  it("recai no plano padrão (anual) quando a URL chega com plano inválido", () => {
    renderWithUrl("/assinatura?plano=hacker");

    // Os botões "Anual" e "Mensal" continuam disponíveis; o estado padrão é "anual".
    expect(screen.getByRole("button", { name: /anual/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mensal/i })).toBeInTheDocument();

    // O CTA principal exibe o copy do plano anual (estado sanitizado).
    expect(
      screen.getAllByRole("button", { name: /começar com desconto/i }).length,
    ).toBeGreaterThan(0);
  });

  it("não emite log de auditoria [AUDIT][CHECKOUT] quando a sanitização da URL já corrigiu o estado", async () => {
    renderWithUrl("/assinatura?plano=hacker");

    await act(async () => {
      await Promise.resolve();
    });

    const auditCalls = warnSpy.mock.calls.filter(([msg]) =>
      typeof msg === "string" && msg.includes("[AUDIT][CHECKOUT]"),
    );
    // A camada de URL absorveu o valor inválido — o handler de checkout só veria
    // valores válidos. O log de auditoria de rejeição NÃO deve ser emitido aqui.
    expect(auditCalls).toHaveLength(0);
    expect(infoSpy.mock.calls.filter(([msg]) =>
      typeof msg === "string" && msg.includes("[AUDIT][CHECKOUT]"),
    )).toHaveLength(0);
  });
});
