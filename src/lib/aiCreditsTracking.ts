import { supabase } from "@/integrations/supabase/client";

export interface AiCreditsCtaPayload {
  source: string;
  reason: string;
  timestamp: number;
  userId: string | null;
  userEmail: string | null;
  competencia: string; // YYYY-MM
  year: number;
  month: number;
  creditsRemaining: number | null;
  creditsRequired: number | null;
}

export interface BuildPayloadInput {
  source: string;
  reason?: string;
  user?: { id?: string | null; email?: string | null } | null;
  creditsRemaining?: number | null;
  creditsRequired?: number | null;
  now?: Date;
}

export const AI_CREDITS_USAGE_URL =
  "https://lovable.dev/settings/workspace/usage";

export const AI_CREDITS_EVENT_NAME = "ai_credits_cta_clicked";

/**
 * Build the analytics payload for the AI credits CTA.
 * Pure function — no side effects — so it can be tested deterministically.
 */
export function buildAiCreditsCtaPayload(
  input: BuildPayloadInput,
): AiCreditsCtaPayload {
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const competencia = `${year}-${String(month).padStart(2, "0")}`;
  return {
    source: input.source,
    reason: input.reason ?? "PAYMENT_REQUIRED",
    timestamp: now.getTime(),
    userId: input.user?.id ?? null,
    userEmail: input.user?.email ?? null,
    competencia,
    year,
    month,
    creditsRemaining: input.creditsRemaining ?? null,
    creditsRequired: input.creditsRequired ?? null,
  };
}

/**
 * Track a click on the AI-credits CTA: builds payload, dispatches DOM
 * event + gtag, persists in the backend, and opens the Usage page.
 */
export async function trackAiCreditsCtaClick(opts: {
  source: string;
  creditsRemaining?: number | null;
  creditsRequired?: number | null;
}): Promise<AiCreditsCtaPayload> {
  let user: { id?: string | null; email?: string | null } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = { id: data.user?.id ?? null, email: data.user?.email ?? null };
  } catch {
    // ignore — tracking should never block the CTA
  }

  const payload = buildAiCreditsCtaPayload({
    source: opts.source,
    user,
    creditsRemaining: opts.creditsRemaining,
    creditsRequired: opts.creditsRequired,
  });

  // 1. DOM event for in-app listeners
  try {
    window.dispatchEvent(
      new CustomEvent(AI_CREDITS_EVENT_NAME, { detail: payload }),
    );
  } catch {
    /* noop */
  }

  // 2. gtag (best-effort)
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    w.gtag?.("event", AI_CREDITS_EVENT_NAME, payload);
  } catch {
    /* noop */
  }

  // 3. Persist to backend (fire-and-forget)
  try {
    void supabase.functions.invoke("track-event", {
      body: {
        event_name: AI_CREDITS_EVENT_NAME,
        source: payload.source,
        competencia: payload.competencia,
        metadata: {
          reason: payload.reason,
          creditsRemaining: payload.creditsRemaining,
          creditsRequired: payload.creditsRequired,
          userEmail: payload.userEmail,
          timestamp: payload.timestamp,
        },
      },
    });
  } catch {
    /* noop */
  }

  // 4. Open Usage page in a new tab
  try {
    window.open(AI_CREDITS_USAGE_URL, "_blank", "noopener,noreferrer");
  } catch {
    /* noop */
  }

  return payload;
}
