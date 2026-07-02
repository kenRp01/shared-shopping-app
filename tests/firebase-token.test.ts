import { generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { verifyFirebaseIdToken } from "@/lib/firebase-token";

const projectId = "shareshopi-test";
const issuer = `https://securetoken.google.com/${projectId}`;
const now = new Date("2026-07-01T00:00:00.000Z");

async function createToken(overrides: Record<string, unknown> = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const payload = {
    aud: projectId,
    iss: issuer,
    sub: "firebase-user-1",
    email: "user@example.com",
    email_verified: true,
    iat: nowSeconds - 60,
    auth_time: nowSeconds - 120,
    exp: nowSeconds + 3600,
    ...overrides,
  };
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(privateKey);

  return { token, publicKey };
}

describe("verifyFirebaseIdToken", () => {
  it("validates a correctly signed Firebase ID token", async () => {
    const { token, publicKey } = await createToken();

    const viewer = await verifyFirebaseIdToken(token, { projectId, key: publicKey, currentDate: now });

    expect(viewer).toMatchObject({
      uid: "firebase-user-1",
      email: "user@example.com",
      emailVerified: true,
    });
  });

  it("rejects a token issued for another Firebase project", async () => {
    const { token, publicKey } = await createToken({ aud: "another-project" });

    await expect(verifyFirebaseIdToken(token, { projectId, key: publicKey, currentDate: now })).rejects.toThrow();
  });

  it("rejects a token with a future authentication time", async () => {
    const future = Math.floor(now.getTime() / 1000) + 60;
    const { token, publicKey } = await createToken({ auth_time: future });

    await expect(verifyFirebaseIdToken(token, { projectId, key: publicKey, currentDate: now })).rejects.toThrow(
      "auth_time",
    );
  });

  it("rejects an empty Firebase uid", async () => {
    const { token, publicKey } = await createToken({ sub: "" });

    await expect(verifyFirebaseIdToken(token, { projectId, key: publicKey, currentDate: now })).rejects.toThrow(
      "sub",
    );
  });
});
