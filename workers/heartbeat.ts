export type HeartbeatEnv = {
  APP_ORIGIN?: string;
  CRON_SECRET?: string;
  HEARTBEAT_PATH?: string;
};

type WorkerExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

type HeartbeatResult = {
  ok: boolean;
  url?: string;
  status?: number;
  error?: string;
};

const DEFAULT_HEARTBEAT_PATH = "/api/heartbeat";

export function buildHeartbeatUrl(env: HeartbeatEnv) {
  const origin = env.APP_ORIGIN?.trim().replace(/\/+$/, "");
  if (!origin) {
    throw new Error("APP_ORIGIN is required.");
  }

  const path = env.HEARTBEAT_PATH?.trim() || DEFAULT_HEARTBEAT_PATH;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildHeartbeatHeaders(env: HeartbeatEnv) {
  const headers = new Headers();
  if (env.CRON_SECRET) {
    headers.set("Authorization", `Bearer ${env.CRON_SECRET}`);
  }
  return headers;
}

export async function sendHeartbeat(
  env: HeartbeatEnv,
  fetcher: typeof fetch = fetch,
): Promise<HeartbeatResult> {
  let url: string;
  try {
    url = buildHeartbeatUrl(env);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to build heartbeat URL.",
    };
  }

  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: buildHeartbeatHeaders(env),
    });

    return {
      ok: response.ok,
      url,
      status: response.status,
      error: response.ok ? undefined : `Heartbeat failed with ${response.status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : "Heartbeat request failed.",
    };
  }
}

export default {
  async scheduled(_event: unknown, env: HeartbeatEnv, ctx: WorkerExecutionContext) {
    ctx.waitUntil(sendHeartbeat(env));
  },

  async fetch(_request: Request, env: HeartbeatEnv) {
    const result = await sendHeartbeat(env);
    return Response.json(result, { status: result.ok ? 200 : 500 });
  },
};
