const MAX_API_BODY_BYTES = 32 * 1024;
const RETRY_AFTER_SECONDS = 60;

type RateLimitResult = {
  success: boolean;
};

type RateLimitBinding = {
  limit(input: { key: string }): Promise<RateLimitResult>;
};

export type ApiGuardEnv = {
  API_RATE_LIMITER?: RateLimitBinding;
  SENSITIVE_API_RATE_LIMITER?: RateLimitBinding;
};

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const sensitiveRoutes = [
  /^\/api\/contact$/,
  /^\/api\/invites\/[^/]+\/accept$/,
  /^\/api\/lists\/[^/]+\/(invite|members|public-token)$/,
];

function jsonError(status: number, error: string, headers?: HeadersInit) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    },
  );
}

function isSensitiveRequest(pathname: string, method: string) {
  return mutationMethods.has(method) && sensitiveRoutes.some((route) => route.test(pathname));
}

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function actorKey(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    return `auth:${await hash(authorization)}`;
  }

  return `anonymous:${request.headers.get("cf-connecting-ip") ?? "unknown"}`;
}

async function exceedsBodyLimit(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_API_BODY_BYTES) {
    return true;
  }

  if (!request.body) {
    return false;
  }

  const reader = request.clone().body?.getReader();
  if (!reader) {
    return false;
  }

  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return false;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_API_BODY_BYTES) {
      void reader.cancel();
      return true;
    }
  }
}

async function isRateLimited(binding: RateLimitBinding | undefined, key: string) {
  if (!binding) {
    return false;
  }

  const result = await binding.limit({ key });
  return !result.success;
}

export async function guardApiRequest(request: Request, env: ApiGuardEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (!url.pathname.startsWith("/api/") || method === "OPTIONS") {
    return null;
  }

  if (mutationMethods.has(method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return jsonError(403, "許可されていない送信元です。");
    }

    if (await exceedsBodyLimit(request)) {
      return jsonError(413, "リクエストのサイズが上限を超えています。");
    }
  }

  const actor = await actorKey(request);
  if (await isRateLimited(env.API_RATE_LIMITER, `${actor}:api`)) {
    return jsonError(429, "リクエストが多すぎます。時間をおいて再試行してください。", {
      "Retry-After": String(RETRY_AFTER_SECONDS),
    });
  }

  if (
    isSensitiveRequest(url.pathname, method)
    && await isRateLimited(env.SENSITIVE_API_RATE_LIMITER, `${actor}:sensitive`)
  ) {
    return jsonError(429, "操作回数が多すぎます。時間をおいて再試行してください。", {
      "Retry-After": String(RETRY_AFTER_SECONDS),
    });
  }

  return null;
}
