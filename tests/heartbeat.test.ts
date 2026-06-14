import { describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runSupabaseHeartbeat, type HeartbeatSupabaseClient } from "@/lib/heartbeat";

describe("isAuthorizedCronRequest", () => {
  it("allows bearer token matching CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", "secret-value");
    const request = new Request("https://example.com/api/heartbeat", {
      headers: { authorization: "Bearer secret-value" },
    });

    expect(isAuthorizedCronRequest(request)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects an invalid cron secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "secret-value");
    const request = new Request("https://example.com/api/heartbeat?secret=wrong");

    expect(isAuthorizedCronRequest(request)).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("runSupabaseHeartbeat", () => {
  it("reads profiles without returning row data", async () => {
    const select = vi.fn().mockResolvedValue({ count: 2, error: null });
    const admin: HeartbeatSupabaseClient = {
      from: vi.fn().mockReturnValue({ select }),
    };

    const result = await runSupabaseHeartbeat(admin);

    expect(admin.from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(result).toMatchObject({ ok: true, checkedTable: "profiles", profileCount: 2 });
  });

  it("returns a safe error when Supabase rejects the query", async () => {
    const admin: HeartbeatSupabaseClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ count: null, error: { message: "connection failed" } }),
      }),
    };

    await expect(runSupabaseHeartbeat(admin)).resolves.toMatchObject({
      ok: false,
      checkedTable: "profiles",
      error: "connection failed",
    });
  });
});
