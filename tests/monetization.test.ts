import { describe, expect, it } from "vitest";
import { buildAdsTxt, getAdSenseConfig, resolveAdSensePublisherId } from "@/lib/monetization";

describe("monetization configuration", () => {
  it("accepts only valid AdSense publisher identifiers", () => {
    expect(resolveAdSensePublisherId({ GOOGLE_ADSENSE_PUBLISHER_ID: "pub-1234567890123456" })).toBe(
      "pub-1234567890123456",
    );
    expect(resolveAdSensePublisherId({ NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: "ca-pub-1234567890123456" })).toBe(
      "pub-1234567890123456",
    );
    expect(resolveAdSensePublisherId({ GOOGLE_ADSENSE_PUBLISHER_ID: "pub-invalid" })).toBeNull();
  });

  it("enables a placement only when both client and slot are valid", () => {
    const env = {
      NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT: "ca-pub-1234567890123456",
      NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME: "1234567890",
    };

    expect(getAdSenseConfig(env, "home")).toEqual({
      client: "ca-pub-1234567890123456",
      slot: "1234567890",
    });
    expect(getAdSenseConfig(env, "login")).toBeNull();
    expect(getAdSenseConfig({ ...env, NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME: "invalid" }, "home")).toBeNull();
  });

  it("builds a crawlable ads.txt record from runtime configuration", () => {
    expect(buildAdsTxt({ GOOGLE_ADSENSE_PUBLISHER_ID: "pub-1234567890123456" })).toBe(
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
    );
    expect(buildAdsTxt({})).toBe("# Google AdSense publisher ID is not configured yet.\n");
  });
});
