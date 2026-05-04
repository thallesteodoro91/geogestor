import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractCreditsFromBody,
  extractCreditsInfo,
  readNumHeader,
  HEADER_KEYS_REMAINING,
  HEADER_KEYS_REQUIRED,
} from "./credits.ts";

Deno.test("readNumHeader returns null when no key matches", () => {
  const h = new Headers({ "content-type": "application/json" });
  assertEquals(readNumHeader(h, HEADER_KEYS_REMAINING), null);
  assertEquals(readNumHeader(h, HEADER_KEYS_REQUIRED), null);
});

Deno.test("readNumHeader picks first matching key", () => {
  const h = new Headers({ "x-credits-remaining": "42" });
  assertEquals(readNumHeader(h, HEADER_KEYS_REMAINING), 42);
});

Deno.test("readNumHeader falls back to alternate header names", () => {
  const h = new Headers({ "x-ratelimit-remaining-credits": "7" });
  assertEquals(readNumHeader(h, HEADER_KEYS_REMAINING), 7);
});

Deno.test("readNumHeader skips empty / non-numeric values", () => {
  const h = new Headers({
    "x-credits-remaining": "",
    "x-ratelimit-remaining-credits": "not-a-number",
    "x-ratelimit-remaining": "12",
  });
  assertEquals(readNumHeader(h, HEADER_KEYS_REMAINING), 12);
});

Deno.test("extractCreditsFromBody handles flat JSON keys", () => {
  const body = JSON.stringify({
    credits_remaining: 3,
    credits_required: 10,
  });
  assertEquals(extractCreditsFromBody(body), { remaining: 3, required: 10 });
});

Deno.test("extractCreditsFromBody handles nested error.metadata", () => {
  const body = JSON.stringify({
    error: { metadata: { credits_remaining: 1, credits_required: 5 } },
  });
  assertEquals(extractCreditsFromBody(body), { remaining: 1, required: 5 });
});

Deno.test("extractCreditsFromBody returns nulls for invalid JSON", () => {
  assertEquals(extractCreditsFromBody("not json at all"), {
    remaining: null,
    required: null,
  });
});

Deno.test("extractCreditsFromBody returns nulls when keys absent", () => {
  assertEquals(extractCreditsFromBody(JSON.stringify({ foo: "bar" })), {
    remaining: null,
    required: null,
  });
});

Deno.test("extractCreditsInfo: full fallback when headers + body empty", () => {
  const h = new Headers();
  const info = extractCreditsInfo(h, "");
  assertEquals(info, {
    creditsRemaining: null,
    creditsRequired: null,
    creditsInfoAvailable: false,
  });
});

Deno.test("extractCreditsInfo: fallback when only invalid (non-JSON) body", () => {
  const h = new Headers();
  const info = extractCreditsInfo(h, "<html>upstream error</html>");
  assertEquals(info.creditsRemaining, null);
  assertEquals(info.creditsRequired, null);
  assertEquals(info.creditsInfoAvailable, false);
});

Deno.test("extractCreditsInfo: prefers headers over body", () => {
  const h = new Headers({
    "x-credits-remaining": "100",
    "x-credits-required": "5",
  });
  const body = JSON.stringify({ credits_remaining: 1, credits_required: 1 });
  const info = extractCreditsInfo(h, body);
  assertEquals(info.creditsRemaining, 100);
  assertEquals(info.creditsRequired, 5);
  assertEquals(info.creditsInfoAvailable, true);
});

Deno.test("extractCreditsInfo: mixes headers and body when partial", () => {
  const h = new Headers({ "x-credits-remaining": "8" });
  const body = JSON.stringify({
    error: { metadata: { credits_required: 20 } },
  });
  const info = extractCreditsInfo(h, body);
  assertEquals(info, {
    creditsRemaining: 8,
    creditsRequired: 20,
    creditsInfoAvailable: true,
  });
});

Deno.test("extractCreditsInfo: creditsInfoAvailable true when only one value found", () => {
  const h = new Headers();
  const body = JSON.stringify({ credits_remaining: 0 });
  const info = extractCreditsInfo(h, body);
  assertEquals(info.creditsRemaining, 0);
  assertEquals(info.creditsRequired, null);
  assertEquals(info.creditsInfoAvailable, true);
});

Deno.test(
  "extractCreditsInfo: only x-credits-required header + body provides remaining (nested mixed)",
  () => {
    const h = new Headers({ "x-credits-required": "15" });
    const body = JSON.stringify({
      error: {
        code: "insufficient_credits",
        message: "Out of credits",
        metadata: { credits_remaining: 2 },
      },
    });
    const info = extractCreditsInfo(h, body);
    assertEquals(info, {
      creditsRemaining: 2,
      creditsRequired: 15,
      creditsInfoAvailable: true,
    });
  },
);

Deno.test(
  "extractCreditsInfo: only alt 'x-credits-cost' header + body remaining at root",
  () => {
    const h = new Headers({ "x-credits-cost": "9" });
    const body = JSON.stringify({
      creditsRemaining: 4,
      error: { metadata: { credits_required: 999 } }, // header should win
    });
    const info = extractCreditsInfo(h, body);
    assertEquals(info.creditsRequired, 9);
    assertEquals(info.creditsRemaining, 4);
    assertEquals(info.creditsInfoAvailable, true);
  },
);

Deno.test(
  "extractCreditsInfo: required header set but body has neither key — remaining stays null",
  () => {
    const h = new Headers({ "x-credits-required": "30" });
    const body = JSON.stringify({
      error: { code: "payment_required", metadata: { plan: "free" } },
    });
    const info = extractCreditsInfo(h, body);
    assertEquals(info, {
      creditsRemaining: null,
      creditsRequired: 30,
      creditsInfoAvailable: true,
    });
  },
);

Deno.test(
  "extractCreditsInfo: mixed body — required at root, remaining nested under error",
  () => {
    const h = new Headers();
    const body = JSON.stringify({
      credits_required: 25,
      error: { metadata: { credits_remaining: 5 } },
    });
    const info = extractCreditsInfo(h, body);
    assertEquals(info, {
      creditsRemaining: 5,
      creditsRequired: 25,
      creditsInfoAvailable: true,
    });
  },
);

Deno.test(
  "extractCreditsInfo: required header is zero (boundary) + body remaining nested",
  () => {
    const h = new Headers({ "x-credits-required": "0" });
    const body = JSON.stringify({
      error: { creditsRemaining: 0 },
    });
    const info = extractCreditsInfo(h, body);
    assertEquals(info.creditsRequired, 0);
    assertEquals(info.creditsRemaining, 0);
    assertEquals(info.creditsInfoAvailable, true);
  },
);

