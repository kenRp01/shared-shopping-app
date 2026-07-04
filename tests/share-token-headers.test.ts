import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("share token response headers", () => {
  it("prevents token pages from leaking through referrers, caches, or crawlers", async () => {
    const rules = await nextConfig.headers?.();
    const tokenPages = rules?.filter((rule) => rule.source === "/invite/:path*" || rule.source === "/public/:path*") ?? [];

    expect(tokenPages).toHaveLength(2);
    for (const page of tokenPages) {
      expect(page.headers).toEqual(expect.arrayContaining([
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      ]));
    }
  });
});
