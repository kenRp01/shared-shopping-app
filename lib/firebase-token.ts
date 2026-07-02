import { createRemoteJWKSet, decodeJwt, jwtVerify, type CryptoKey, type JWTVerifyOptions } from "jose";

const FIREBASE_JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
);
const firebaseJwks = createRemoteJWKSet(FIREBASE_JWKS_URL);

export type FirebaseTokenViewer = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

type VerifyFirebaseIdTokenOptions = {
  projectId?: string;
  key?: CryptoKey;
  currentDate?: Date;
};

function requirePastTimestamp(value: unknown, claim: "iat" | "auth_time", nowSeconds: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value > nowSeconds) {
    throw new Error(`Firebase ID Token の ${claim} が不正です。`);
  }
}

export function isFirebaseIdToken(token: string, projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  if (!projectId) {
    return false;
  }

  try {
    const payload = decodeJwt(token);
    return payload.iss === `https://securetoken.google.com/${projectId}` || payload.aud === projectId;
  } catch {
    return false;
  }
}

export async function verifyFirebaseIdToken(token: string, options: VerifyFirebaseIdTokenOptions = {}) {
  const projectId = options.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID が設定されていません。");
  }

  const currentDate = options.currentDate ?? new Date();
  const verifyOptions: JWTVerifyOptions = {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
    currentDate,
  };
  const { payload } = options.key
    ? await jwtVerify(token, options.key, verifyOptions)
    : await jwtVerify(token, firebaseJwks, verifyOptions);

  const nowSeconds = Math.floor(currentDate.getTime() / 1000);
  requirePastTimestamp(payload.iat, "iat", nowSeconds);
  requirePastTimestamp(payload.auth_time, "auth_time", nowSeconds);

  if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) {
    throw new Error("Firebase ID Token の sub が不正です。");
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  } satisfies FirebaseTokenViewer;
}
