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

/**
 * Tabela canônica de (variant, icon) por status de checkout.
 *
 * Esses asserts isolam o CONTRATO VISUAL de cada status — independente do copy
 * (mensagem/descrição). Se alguém trocar `toast.error(...)` por `toast(...)`,
 * ou remover o `icon: "⏳"`, o teste correspondente falha mesmo que o texto
 * permaneça idêntico.
 *
 * Regras travadas:
 *  - approved   → variant="success", SEM icon (sonner aplica check verde nativo)
 *  - failed     → variant="error",   SEM icon (sonner aplica X vermelho nativo)
 *  - processing → variant="default", icon="⏳"
 *  - canceled   → variant="default", icon="ℹ️"
 */
describe("Assinatura — contrato (variant + icon) por status de checkout", () => {
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

  /** Espera EXATAMENTE 1 toast com a variant esperada e captura suas options. */
  async function captureSingleToast(status: string, expectedVariant: ToastEvent["variant"]) {
    renderWithUrl(`/assinatura?checkout=${status}`);

    await waitFor(() => {
      const events = collectToastEvents();
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
    // Aguarda re-renders encadeados pela limpeza da searchParam.
    await act(async () => { await Promise.resolve(); });

    const events = collectToastEvents();
    expect(events).toHaveLength(1);
    expect(events[0].variant).toBe(expectedVariant);
    return events[0].args[1] as Record<string, unknown> | undefined;
  }

  it("approved → variant=success, options SEM `icon` (usa o ícone nativo do sonner)", async () => {
    const options = await captureSingleToast("approved", "success");
    expect(options).toBeDefined();
    expect(options).not.toHaveProperty("icon");
  });

  it("failed → variant=error, options SEM `icon` (usa o ícone nativo do sonner)", async () => {
    const options = await captureSingleToast("failed", "error");
    expect(options).toBeDefined();
    expect(options).not.toHaveProperty("icon");
  });

  it("processing → variant=default, icon=⏳ (ampulheta)", async () => {
    const options = await captureSingleToast("processing", "default");
    expect(options?.icon).toBe("⏳");
  });

  it("canceled → variant=default, icon=ℹ️ (info)", async () => {
    const options = await captureSingleToast("canceled", "default");
    expect(options?.icon).toBe("ℹ️");
  });

  it("matriz completa: cada status mapeia EXATAMENTE para 1 par (variant, icon)", async () => {
    const cases: Array<{
      status: string;
      variant: ToastEvent["variant"];
      icon: string | undefined;
    }> = [
      { status: "approved", variant: "success", icon: undefined },
      { status: "failed", variant: "error", icon: undefined },
      { status: "processing", variant: "default", icon: "⏳" },
      { status: "canceled", variant: "default", icon: "ℹ️" },
    ];

    for (const { status, variant, icon } of cases) {
      clearAllToastSpies();
      const options = await captureSingleToast(status, variant);
      expect(options?.icon).toBe(icon);
    }
  });
});

/**
 * Ordenação cronológica real dos toasts (cross-variant).
 *
 * `collectToastEvents` agrupa por variant — perde a ordem entre variants
 * diferentes. Aqui usamos `invocationCallOrder` do vitest, que numera
 * GLOBALMENTE cada chamada de qualquer spy, para reconstruir a sequência
 * exata em que os toasts foram disparados.
 */
type OrderedToastEvent = ToastEvent & { order: number };

function collectOrderedToastEvents(): OrderedToastEvent[] {
  const spies: Array<[ToastEvent["variant"], { mock: { calls: unknown[][]; invocationCallOrder: number[] } }]> = [
    ["default", toastMock as unknown as { mock: { calls: unknown[][]; invocationCallOrder: number[] } }],
    ["error", toastMock.error as unknown as { mock: { calls: unknown[][]; invocationCallOrder: number[] } }],
    ["success", toastMock.success as unknown as { mock: { calls: unknown[][]; invocationCallOrder: number[] } }],
    ["info", toastMock.info as unknown as { mock: { calls: unknown[][]; invocationCallOrder: number[] } }],
    ["warning", toastMock.warning as unknown as { mock: { calls: unknown[][]; invocationCallOrder: number[] } }],
    ["message", toastMock.message as unknown as { mock: { calls: unknown[][]; invocationCallOrder: number[] } }],
  ];
  const events: OrderedToastEvent[] = [];
  for (const [variant, spy] of spies) {
    spy.mock.calls.forEach((args, i) => {
      events.push({ variant, args, order: spy.mock.invocationCallOrder[i] });
    });
  }
  return events.sort((a, b) => a.order - b.order);
}

/**
 * Garante a ORDEM EXATA dos toasts quando dois efeitos disparam simultaneamente:
 * sanitização da URL + status de checkout. Como ambos os useEffect são
 * disparados na mesma fase de commit, a ordem é determinística e segue a
 * ordem em que os efeitos estão declarados em `Assinatura.tsx`:
 *   1º) sanitização (paramInvalido)
 *   2º) feedback do status de checkout
 *
 * Qualquer reordenação acidental de useEffects (ou um efeito extra colado no meio)
 * quebra esses testes.
 */
describe("Assinatura — ordem cronológica dos toasts em cenários combinados", () => {
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

  /** Renderiza, espera 2 toasts e devolve a sequência ordenada como
   *  pares `[variant, primeiroArg]` para asserts compactos. */
  async function renderAndCollectSequence(url: string): Promise<Array<[string, unknown]>> {
    renderWithUrl(url);
    await waitFor(() => {
      expect(collectOrderedToastEvents().length).toBeGreaterThanOrEqual(2);
    });
    await act(async () => { await Promise.resolve(); });
    return collectOrderedToastEvents().map((e) => [e.variant, e.args[0]]);
  }

  it("plano inválido + checkout=approved → 1º sanitização (default), 2º success", async () => {
    const seq = await renderAndCollectSequence(
      "/assinatura?plano=hacker&checkout=approved",
    );
    expect(seq).toEqual([
      ["default", 'Parâmetro plano "hacker" não reconhecido — usando opção padrão.'],
      ["success", "Pagamento aprovado — bem-vindo ao GeoGestor!"],
    ]);
  });

  it("plano inválido + checkout=failed → 1º sanitização (default), 2º error", async () => {
    const seq = await renderAndCollectSequence(
      "/assinatura?plano=hacker&checkout=failed",
    );
    expect(seq).toEqual([
      ["default", 'Parâmetro plano "hacker" não reconhecido — usando opção padrão.'],
      ["error", "Pagamento recusado"],
    ]);
  });

  it("plano inválido + checkout=processing → 1º sanitização (default), 2º processing (default)", async () => {
    const seq = await renderAndCollectSequence(
      "/assinatura?plano=hacker&checkout=processing",
    );
    expect(seq).toEqual([
      ["default", 'Parâmetro plano "hacker" não reconhecido — usando opção padrão.'],
      ["default", "Pagamento em processamento"],
    ]);
  });

  it("plano inválido + checkout=canceled → 1º sanitização (default), 2º canceled (default)", async () => {
    const seq = await renderAndCollectSequence(
      "/assinatura?plano=hacker&checkout=canceled",
    );
    expect(seq).toEqual([
      ["default", 'Parâmetro plano "hacker" não reconhecido — usando opção padrão.'],
      ["default", "Compra cancelada — seus dados estão salvos"],
    ]);
  });

  it("plano + oferta inválidos + checkout=failed → 1 toast de sanitização (combinado) e DEPOIS o error", async () => {
    const seq = await renderAndCollectSequence(
      "/assinatura?plano=hacker&oferta=evil&checkout=failed",
    );
    expect(seq).toEqual([
      [
        "default",
        'Parâmetro plano "hacker" e oferta "evil" não reconhecido — usando opção padrão.',
      ],
      ["error", "Pagamento recusado"],
    ]);
  });

  it("matriz: para todo status válido, sanitização SEMPRE precede o feedback de checkout", async () => {
    const matrix: Array<{ status: string; expectedVariant: string; expectedMsg: string }> = [
      { status: "approved", expectedVariant: "success", expectedMsg: "Pagamento aprovado — bem-vindo ao GeoGestor!" },
      { status: "failed", expectedVariant: "error", expectedMsg: "Pagamento recusado" },
      { status: "processing", expectedVariant: "default", expectedMsg: "Pagamento em processamento" },
      { status: "canceled", expectedVariant: "default", expectedMsg: "Compra cancelada — seus dados estão salvos" },
    ];

    for (const { status, expectedVariant, expectedMsg } of matrix) {
      clearAllToastSpies();
      const seq = await renderAndCollectSequence(
        `/assinatura?plano=hacker&checkout=${status}`,
      );
      expect(seq).toHaveLength(2);
      expect(seq[0][0]).toBe("default");
      expect(seq[0][1]).toMatch(/não reconhecido/);
      expect(seq[1][0]).toBe(expectedVariant);
      expect(seq[1][1]).toBe(expectedMsg);
    }
  });
});

