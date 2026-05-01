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
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
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

/**
 * Garante que CADA cenário dispara exatamente N toasts esperados — nem mais,
 * nem menos. Protege contra regressões em que um efeito acidental passe a
 * disparar toasts duplicados ou em momentos errados.
 *
 * `totalToasts()` soma todas as variantes (toast(), toast.error, toast.success,
 * toast.info, toast.warning, toast.message) — qualquer toast extra inflaciona
 * a contagem e quebra o teste.
 */
function totalToasts(): number {
  return (
    toastMock.mock.calls.length +
    toastMock.error.mock.calls.length +
    toastMock.success.mock.calls.length +
    toastMock.info.mock.calls.length +
    toastMock.warning.mock.calls.length +
    toastMock.message.mock.calls.length
  );
}

function clearAllToastSpies() {
  toastMock.mockClear();
  toastMock.error.mockClear();
  toastMock.success.mockClear();
  toastMock.info.mockClear();
  toastMock.warning.mockClear();
  toastMock.message.mockClear();
}

describe("Assinatura — contagem de toasts por cenário (anti-regressão de fluxo)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    clearAllToastSpies();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("URL limpa: NENHUM toast é disparado no carregamento", async () => {
    renderWithUrl("/assinatura");

    await act(async () => {
      await Promise.resolve();
    });

    expect(totalToasts()).toBe(0);
  });

  it("URL válida (?plano=anual&oferta=premium): NENHUM toast é disparado", async () => {
    renderWithUrl("/assinatura?plano=anual&oferta=premium");

    await act(async () => {
      await Promise.resolve();
    });

    expect(totalToasts()).toBe(0);
  });

  it("URL com plano inválido: dispara EXATAMENTE 1 toast (informativo) e nenhum erro/sucesso", async () => {
    renderWithUrl("/assinatura?plano=hacker");

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1);
    });

    // O único toast deve ser o informativo de sanitização.
    expect(toastMock.mock.calls[0][0]).toContain("não reconhecido");
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.info).not.toHaveBeenCalled();
    expect(totalToasts()).toBe(1);
  });

  it("URL com ?checkout=canceled: dispara EXATAMENTE 1 toast informativo e nenhum erro", async () => {
    renderWithUrl("/assinatura?checkout=canceled");

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1);
    });

    expect(toastMock.mock.calls[0][0]).toBe(
      "Compra cancelada — seus dados estão salvos",
    );
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(totalToasts()).toBe(1);
  });

  it("URL inválida + checkout cancelado: dispara EXATAMENTE 2 toasts (um de cada) sem duplicação", async () => {
    renderWithUrl("/assinatura?plano=hacker&checkout=canceled");

    await waitFor(() => {
      expect(toastMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    // Aguarda eventuais re-renderizações encadeadas (sanitização da URL muda
    // searchParams, o que poderia disparar o effect de "checkout=canceled" outra vez).
    await act(async () => {
      await Promise.resolve();
    });

    const messages = toastMock.mock.calls.map((c) => c[0]);
    const sanitizacao = messages.filter(
      (m) => typeof m === "string" && m.includes("não reconhecido"),
    );
    const cancelamento = messages.filter(
      (m) => typeof m === "string" && m.includes("Compra cancelada"),
    );

    expect(sanitizacao).toHaveLength(1);
    expect(cancelamento).toHaveLength(1);
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(totalToasts()).toBe(2);
  });

  it("clique no CTA sem sessão: dispara EXATAMENTE 1 toast.error('Faça login...') e nenhum outro", async () => {
    renderWithUrl("/assinatura");

    await act(async () => {
      await Promise.resolve();
    });

    // Sanity: nenhum toast no carregamento.
    expect(totalToasts()).toBe(0);

    // Clica no CTA principal (estado padrão = "anual" → "Começar com desconto").
    const ctas = screen.getAllByRole("button", {
      name: /começar com desconto/i,
    });
    await act(async () => {
      fireEvent.click(ctas[0]);
      // Aguarda o supabase.auth.getSession() (mockado) resolver.
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledTimes(1);
    });

    expect(toastMock.error.mock.calls[0][0]).toBe(
      "Faça login para assinar um plano.",
    );
    expect(toastMock).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(totalToasts()).toBe(1);
  });
});

/**
 * Snapshots por cenário: capturam variante (`default` / `error` / `success` / ...)
 * + argumentos completos (mensagem + options) de CADA toast disparado, na ordem.
 *
 * Diferente da suite de contagem, aqui qualquer alteração de copy — mesmo mantendo
 * o número de toasts — quebra o snapshot e força revisão consciente do texto.
 *
 * Para atualizar intencionalmente: rode `vitest -u` e revise o diff.
 */
type ToastEvent = { variant: string; args: unknown[] };

function collectToastEvents(): ToastEvent[] {
  const variants: Array<["default" | "error" | "success" | "info" | "warning" | "message", { mock: { calls: unknown[][] } }]> = [
    ["default", toastMock as unknown as { mock: { calls: unknown[][] } }],
    ["error", toastMock.error],
    ["success", toastMock.success],
    ["info", toastMock.info],
    ["warning", toastMock.warning],
    ["message", toastMock.message],
  ];
  const events: ToastEvent[] = [];
  for (const [variant, spy] of variants) {
    for (const args of spy.mock.calls) {
      events.push({ variant, args });
    }
  }
  return events;
}

describe("Assinatura — snapshots de copy por cenário (anti-regressão de texto)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    clearAllToastSpies();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("URL limpa: snapshot vazio (nenhum toast)", async () => {
    renderWithUrl("/assinatura");
    await act(async () => { await Promise.resolve(); });

    expect(collectToastEvents()).toMatchInlineSnapshot(`[]`);
  });

  it("URL válida (?plano=anual&oferta=premium): snapshot vazio", async () => {
    renderWithUrl("/assinatura?plano=anual&oferta=premium");
    await act(async () => { await Promise.resolve(); });

    expect(collectToastEvents()).toMatchInlineSnapshot(`[]`);
  });

  it("URL com plano inválido: snapshot do toast informativo de sanitização", async () => {
    renderWithUrl("/assinatura?plano=hacker");
    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Parâmetro plano "hacker" não reconhecido — usando opção padrão.",
            {
              "icon": "ℹ️",
            },
          ],
          "variant": "default",
        },
      ]
    `);
  });

  it("URL com plano + oferta inválidos: snapshot cita ambos no mesmo toast", async () => {
    renderWithUrl("/assinatura?plano=hacker&oferta=evil");
    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Parâmetro plano "hacker" e oferta "evil" não reconhecido — usando opção padrão.",
            {
              "icon": "ℹ️",
            },
          ],
          "variant": "default",
        },
      ]
    `);
  });

  it("URL com ?checkout=canceled: snapshot do toast informativo de cancelamento", async () => {
    renderWithUrl("/assinatura?checkout=canceled");
    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Compra cancelada — seus dados estão salvos",
            {
              "description": "Quando quiser, você pode escolher um plano novamente.",
              "icon": "ℹ️",
            },
          ],
          "variant": "default",
        },
      ]
    `);
  });

  it("URL inválida + checkout cancelado: snapshot dos 2 toasts (sanitização + cancelamento)", async () => {
    renderWithUrl("/assinatura?plano=hacker&checkout=canceled");

    await waitFor(() => {
      expect(toastMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    await act(async () => { await Promise.resolve(); });

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Parâmetro plano "hacker" não reconhecido — usando opção padrão.",
            {
              "icon": "ℹ️",
            },
          ],
          "variant": "default",
        },
        {
          "args": [
            "Compra cancelada — seus dados estão salvos",
            {
              "description": "Quando quiser, você pode escolher um plano novamente.",
              "icon": "ℹ️",
            },
          ],
          "variant": "default",
        },
      ]
    `);
  });

  it("clique no CTA sem sessão: snapshot do toast.error 'Faça login...'", async () => {
    renderWithUrl("/assinatura");
    await act(async () => { await Promise.resolve(); });

    const ctas = screen.getAllByRole("button", { name: /começar com desconto/i });
    await act(async () => {
      fireEvent.click(ctas[0]);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Faça login para assinar um plano.",
          ],
          "variant": "error",
        },
      ]
    `);
  });
});

/**
 * Snapshots por status do retorno do checkout (?checkout=approved|failed|processing|canceled).
 * Cada cenário deve emitir EXATAMENTE 1 toast, com variante e copy específicos.
 * Mudou o copy ou a variante? O snapshot quebra e força revisão consciente.
 */
describe("Assinatura — snapshots por status de checkout (approved/failed/processing/canceled)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    clearAllToastSpies();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("?checkout=approved → toast.success com mensagem de boas-vindas", async () => {
    renderWithUrl("/assinatura?checkout=approved");
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Pagamento aprovado — bem-vindo ao GeoGestor!",
            {
              "description": "Seu acesso completo foi liberado. Bom trabalho!",
            },
          ],
          "variant": "success",
        },
      ]
    `);
  });

  it("?checkout=failed → toast.error com instrução de tentar outro método", async () => {
    renderWithUrl("/assinatura?checkout=failed");
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Pagamento recusado",
            {
              "description": "Tente outro método de pagamento ou fale com seu banco.",
            },
          ],
          "variant": "error",
        },
      ]
    `);
  });

  it("?checkout=processing → toast informativo (default) com ícone de relógio", async () => {
    renderWithUrl("/assinatura?checkout=processing");
    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Pagamento em processamento",
            {
              "description": "Avisaremos por e-mail assim que a confirmação chegar.",
              "icon": "⏳",
            },
          ],
          "variant": "default",
        },
      ]
    `);
  });

  it("?checkout=canceled → toast informativo (default) com ícone de info (regressão)", async () => {
    renderWithUrl("/assinatura?checkout=canceled");
    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    expect(collectToastEvents()).toMatchInlineSnapshot(`
      [
        {
          "args": [
            "Compra cancelada — seus dados estão salvos",
            {
              "description": "Quando quiser, você pode escolher um plano novamente.",
              "icon": "ℹ️",
            },
          ],
          "variant": "default",
        },
      ]
    `);
  });

  it("?checkout=foobar (status desconhecido) → NENHUM toast é disparado", async () => {
    renderWithUrl("/assinatura?checkout=foobar");
    await act(async () => { await Promise.resolve(); });

    expect(collectToastEvents()).toMatchInlineSnapshot(`[]`);
  });
});

