import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-token", () => {
  class UnverifiedFirebaseEmailError extends Error {}
  return {
    UnverifiedFirebaseEmailError,
    isFirebaseIdToken: vi.fn(() => true),
    verifyFirebaseIdToken: vi.fn(async () => {
      throw new UnverifiedFirebaseEmailError("メール認証が完了していません。");
    }),
  };
});

vi.mock("@/lib/d1", () => ({
  getD1Database: vi.fn(),
  resolveD1FirebaseProfile: vi.fn(),
}));

import { getBearerViewer } from "@/lib/api-auth";

describe("getBearerViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 before database access for an unverified email", async () => {
    const result = await getBearerViewer(new Request("https://example.com/api/lists", {
      headers: { Authorization: "Bearer firebase-token" },
    }));

    expect(result.error?.status).toBe(403);
    await expect(result.error?.json()).resolves.toEqual({
      error: "メール認証を完了してからログインしてください。",
    });
  });
});
