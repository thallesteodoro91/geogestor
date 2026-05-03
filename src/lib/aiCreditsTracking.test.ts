import { describe, it, expect } from "vitest";
import { buildAiCreditsCtaPayload } from "./aiCreditsTracking";

describe("buildAiCreditsCtaPayload", () => {
  const fixedNow = new Date("2026-05-03T10:30:00.000Z");

  it("includes user, competencia and credit fields", () => {
    const payload = buildAiCreditsCtaPayload({
      source: "AIInsightsCard",
      user: { id: "user-1", email: "a@b.com" },
      creditsRemaining: 2,
      creditsRequired: 5,
      now: fixedNow,
    });

    expect(payload).toMatchObject({
      source: "AIInsightsCard",
      reason: "PAYMENT_REQUIRED",
      userId: "user-1",
      userEmail: "a@b.com",
      year: fixedNow.getFullYear(),
      month: fixedNow.getMonth() + 1,
      creditsRemaining: 2,
      creditsRequired: 5,
    });
    expect(payload.competencia).toMatch(/^\d{4}-\d{2}$/);
    expect(payload.competencia).toBe(
      `${fixedNow.getFullYear()}-${String(fixedNow.getMonth() + 1).padStart(2, "0")}`,
    );
    expect(payload.timestamp).toBe(fixedNow.getTime());
  });

  it("falls back to nulls when user/credits are missing", () => {
    const payload = buildAiCreditsCtaPayload({
      source: "GeoBot",
      now: fixedNow,
    });
    expect(payload.userId).toBeNull();
    expect(payload.userEmail).toBeNull();
    expect(payload.creditsRemaining).toBeNull();
    expect(payload.creditsRequired).toBeNull();
    expect(payload.source).toBe("GeoBot");
  });

  it("pads single-digit months to YYYY-MM", () => {
    const payload = buildAiCreditsCtaPayload({
      source: "x",
      now: new Date("2026-01-15T00:00:00.000Z"),
    });
    expect(payload.competencia).toBe(
      `${new Date("2026-01-15T00:00:00.000Z").getFullYear()}-${String(
        new Date("2026-01-15T00:00:00.000Z").getMonth() + 1,
      ).padStart(2, "0")}`,
    );
  });
});
