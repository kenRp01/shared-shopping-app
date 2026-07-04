import { describe, expect, it, vi } from "vitest";
import { guardApiRequest } from "@/lib/api-guard";

function limiter(success = true) {
  return { limit: vi.fn(async () => ({ success })) };
}

function env(options: { general?: boolean; sensitive?: boolean } = {}) {
  return {
    API_RATE_LIMITER: limiter(options.general ?? true),
    SENSITIVE_API_RATE_LIMITER: limiter(options.sensitive ?? true),
  };
}

describe("guardApiRequest", () => {
  it("returns 429 with retry metadata when the general limit is exceeded", async () => {
    const response = await guardApiRequest(new Request("https://shareshopi.app/api/lists"), env({ general: false }));

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("60");
  });

  it("applies the stricter limiter to invite creation", async () => {
    const bindings = env({ sensitive: false });
    const request = new Request("https://shareshopi.app/api/lists/list-1/invite", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    });

    const response = await guardApiRequest(request, bindings);

    expect(response?.status).toBe(429);
    expect(bindings.SENSITIVE_API_RATE_LIMITER.limit).toHaveBeenCalledOnce();
  });

  it("rejects oversized mutation bodies before Next.js handles them", async () => {
    const response = await guardApiRequest(new Request("https://shareshopi.app/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "40000" },
      body: "{}",
    }), env());

    expect(response?.status).toBe(413);
  });

  it("measures the body when content length is understated", async () => {
    const response = await guardApiRequest(new Request("https://shareshopi.app/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "2" },
      body: "x".repeat(33 * 1024),
    }), env());

    expect(response?.status).toBe(413);
  });

  it("rejects browser mutations from a different origin", async () => {
    const response = await guardApiRequest(new Request("https://shareshopi.app/api/lists", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    }), env());

    expect(response?.status).toBe(403);
  });

  it("allows a valid same-origin API request", async () => {
    const response = await guardApiRequest(new Request("https://shareshopi.app/api/lists", {
      headers: { Authorization: "Bearer token" },
    }), env());

    expect(response).toBeNull();
  });
});
