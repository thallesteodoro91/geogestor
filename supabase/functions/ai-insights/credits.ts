// Pure helpers for extracting AI credit metadata from a 402 response.
// Extracted so the fallback logic can be unit tested without spinning up
// the full edge function.

export const HEADER_KEYS_REMAINING = [
  "x-credits-remaining",
  "x-ratelimit-remaining-credits",
  "x-ratelimit-remaining",
  "x-credit-balance",
];

export const HEADER_KEYS_REQUIRED = [
  "x-credits-required",
  "x-ratelimit-required-credits",
  "x-credits-cost",
];

export interface CreditsInfo {
  creditsRemaining: number | null;
  creditsRequired: number | null;
  creditsInfoAvailable: boolean;
}

export function readNumHeader(
  headers: Headers,
  keys: string[],
): number | null {
  for (const k of keys) {
    const raw = headers.get(k);
    if (raw !== null && raw !== "" && !Number.isNaN(Number(raw))) {
      return Number(raw);
    }
  }
  return null;
}

export function extractCreditsFromBody(
  body: string,
): { remaining: number | null; required: number | null } {
  let remaining: number | null = null;
  let required: number | null = null;
  try {
    const parsed = JSON.parse(body);
    const candidatesRemaining = [
      parsed?.credits_remaining,
      parsed?.creditsRemaining,
      parsed?.error?.credits_remaining,
      parsed?.error?.creditsRemaining,
      parsed?.error?.metadata?.credits_remaining,
    ];
    const candidatesRequired = [
      parsed?.credits_required,
      parsed?.creditsRequired,
      parsed?.error?.credits_required,
      parsed?.error?.creditsRequired,
      parsed?.error?.metadata?.credits_required,
    ];
    for (const v of candidatesRemaining) {
      if (typeof v === "number" && !Number.isNaN(v)) { remaining = v; break; }
    }
    for (const v of candidatesRequired) {
      if (typeof v === "number" && !Number.isNaN(v)) { required = v; break; }
    }
  } catch {
    // body wasn't JSON — return nulls
  }
  return { remaining, required };
}

/**
 * Extract credit info from a 402 response, scanning headers first then the body.
 * `creditsInfoAvailable` is true iff at least one of the values was found.
 */
export function extractCreditsInfo(
  headers: Headers,
  body: string,
): CreditsInfo {
  let creditsRemaining = readNumHeader(headers, HEADER_KEYS_REMAINING);
  let creditsRequired = readNumHeader(headers, HEADER_KEYS_REQUIRED);

  if (creditsRemaining === null || creditsRequired === null) {
    const fromBody = extractCreditsFromBody(body);
    if (creditsRemaining === null) creditsRemaining = fromBody.remaining;
    if (creditsRequired === null) creditsRequired = fromBody.required;
  }

  return {
    creditsRemaining,
    creditsRequired,
    creditsInfoAvailable:
      creditsRemaining !== null || creditsRequired !== null,
  };
}
