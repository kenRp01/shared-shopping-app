import { describe, expect, it } from "vitest";
import { createShareToken, hashShareToken, isShareTokenExpired } from "@/lib/share-token";

describe("share tokens", () => {
  it("creates purpose-scoped tokens with 256 bits of randomness", () => {
    const first = createShareToken("invite");
    const second = createShareToken("invite");
    const publicToken = createShareToken("public");

    expect(first).toMatch(/^invite_[a-f0-9]{64}$/);
    expect(publicToken).toMatch(/^public_[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });

  it("stores a deterministic SHA-256 hash instead of the raw token", async () => {
    const token = "invite_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const hash = await hashShareToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    await expect(hashShareToken(token)).resolves.toBe(hash);
  });

  it("treats invite expiry as an exclusive boundary", () => {
    const now = new Date("2026-07-04T00:00:00.000Z");

    expect(isShareTokenExpired("2026-07-04T00:00:00.001Z", now)).toBe(false);
    expect(isShareTokenExpired("2026-07-04T00:00:00.000Z", now)).toBe(true);
    expect(isShareTokenExpired("2026-07-03T23:59:59.999Z", now)).toBe(true);
  });
});
