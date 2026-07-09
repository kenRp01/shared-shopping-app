import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cloudflare Worker configuration", () => {
  it("publishes the app Worker on app.shareshopi.workers.dev", () => {
    const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    const config = JSON.parse(source.replace(/^\s*\/\/.*$/gm, "")) as {
      name: string;
      services: Array<{ binding: string; service: string }>;
    };

    expect(config.name).toBe("app");
    expect(config.services).toContainEqual({
      binding: "WORKER_SELF_REFERENCE",
      service: "app",
    });
  });

  it("does not block the first deploy with required secrets", () => {
    const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    const config = JSON.parse(source.replace(/^\s*\/\/.*$/gm, "")) as {
      secrets?: { required?: string[] };
    };

    expect(config.secrets?.required ?? []).toEqual([]);
  });

  it("documents only the active local environment variables", () => {
    const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    const migrationDoc = readFileSync(new URL("../CLOUDFLARE_MIGRATION.md", import.meta.url), "utf8");
    const freeOpsDoc = readFileSync(new URL("../docs/free-operation-constraints.md", import.meta.url), "utf8");

    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_API_KEY=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_PROJECT_ID=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_APP_ID=");
    expect(envExample).toContain("RESEND_API_KEY=");
    expect(envExample).toContain("REMINDER_FROM_EMAIL=");
    expect(envExample).toContain("CRON_SECRET=");
    expect(envExample).not.toMatch(/SUPABASE|NEXT_PUBLIC_SUPABASE|SERVICE_ROLE/);

    expect(migrationDoc).not.toMatch(/Supabase/);
    expect(freeOpsDoc).not.toMatch(/Supabase|Vercel Hobby|Vercel Cron/);
  });
});
