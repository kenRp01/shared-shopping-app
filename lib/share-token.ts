export type ShareTokenPurpose = "invite" | "public";

const TOKEN_BYTES = 32;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createShareToken(purpose: ShareTokenPurpose) {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return `${purpose}_${bytesToHex(bytes)}`;
}

export async function hashShareToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export function inviteExpiry(base = new Date(), validDays = 7) {
  return new Date(base.getTime() + validDays * 24 * 60 * 60 * 1000).toISOString();
}

export function isShareTokenExpired(expiresAt: string, now = new Date()) {
  return new Date(expiresAt).getTime() <= now.getTime();
}
