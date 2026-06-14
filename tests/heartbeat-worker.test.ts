import { describe, expect, it, vi } from "vitest";
import { buildHeartbeatHeaders, buildHeartbeatUrl, sendHeartbeat } from "@/workers/heartbeat";

describe("Cloudflare heartbeat worker", () => {
  it("builds the heartbeat URL from APP_ORIGIN", () => {
    expect(
      buildHeartbeatUrl({
        APP_ORIGIN: "https://shareshopi.vercel.app/",
      }),
    ).toBe("https://shareshopi.vercel.app/api/heartbeat");
  });

  it("allows overriding the heartbeat path", () => {
    expect(
      buildHeartbeatUrl({
        APP_ORIGIN: "https://example.com",
        HEARTBEAT_PATH: "internal/heartbeat",
      }),
    ).toBe("https://example.com/internal/heartbeat");
  });

  it("adds bearer auth when CRON_SECRET is available", () => {
    const headers = buildHeartbeatHeaders({ CRON_SECRET: "secret-value" });
    expect(headers.get("Authorization")).toBe("Bearer secret-value");
  });

  it("calls heartbeat endpoint without exposing response data", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

    await expect(
      sendHeartbeat(
        {
          APP_ORIGIN: "https://shareshopi.vercel.app",
          CRON_SECRET: "secret-value",
        },
        fetcher,
      ),
    ).resolves.toMatchObject({
      ok: true,
      url: "https://shareshopi.vercel.app/api/heartbeat",
      status: 200,
    });

    expect(fetcher).toHaveBeenCalledWith("https://shareshopi.vercel.app/api/heartbeat", {
      method: "GET",
      headers: expect.any(Headers),
    });
    const [, init] = fetcher.mock.calls[0];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer secret-value");
  });

  it("returns a safe error when APP_ORIGIN is missing", async () => {
    await expect(sendHeartbeat({}, vi.fn())).resolves.toMatchObject({
      ok: false,
      error: "APP_ORIGIN is required.",
    });
  });
});
