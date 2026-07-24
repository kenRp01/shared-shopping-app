import { existsSync, readFileSync, statSync } from "node:fs";
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
    const seoDoc = readFileSync(new URL("../docs/seo-monetization.md", import.meta.url), "utf8");

    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_API_KEY=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_PROJECT_ID=");
    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_APP_ID=");
    expect(envExample).toContain("NEXT_PUBLIC_SITE_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=");
    expect(envExample).toContain("NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_HOME=");
    expect(envExample).toContain("NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LOGIN=");
    expect(envExample).toContain("NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_LEGAL=");
    expect(envExample).toContain("GOOGLE_ADSENSE_PUBLISHER_ID=");
    expect(envExample).toContain("RESEND_API_KEY=");
    expect(envExample).toContain("REMINDER_FROM_EMAIL=");
    expect(envExample).toContain("CRON_SECRET=");
    expect(envExample).not.toMatch(/SUPABASE|NEXT_PUBLIC_SUPABASE|SERVICE_ROLE/);

    expect(migrationDoc).not.toMatch(/Supabase/);
    expect(freeOpsDoc).not.toMatch(/Supabase|Vercel Hobby|Vercel Cron/);
    expect(seoDoc).toContain("NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT");
    expect(seoDoc).toContain("/sitemap.xml");
    expect(seoDoc).toContain("/ads.txt");
    expect(seoDoc).toContain("/llms.txt");
  });

  it("ships SEO and monetization entrypoints", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    const robots = readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
    const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
    const adsTxtRoute = readFileSync(new URL("../app/ads.txt/route.ts", import.meta.url), "utf8");
    const llmsTxt = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");
    const about = readFileSync(new URL("../app/about/page.tsx", import.meta.url), "utf8");
    const login = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
    const privacy = readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
    const adConfigRoute = readFileSync(new URL("../app/api/ads/config/route.ts", import.meta.url), "utf8");
    const adsenseScript = readFileSync(new URL("../components/adsense-script.tsx", import.meta.url), "utf8");
    const adSlot = readFileSync(new URL("../components/ad-slot.tsx", import.meta.url), "utf8");
    const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

    expect(layout).toContain("metadataBase");
    expect(layout).toContain("openGraph");
    expect(layout).not.toContain("AdsenseScript");
    expect(robots).toContain("disallow");
    expect(robots).toContain("/app");
    expect(robots).toContain("/lists/");
    expect(robots).toContain("/llms.txt");
    expect(sitemap).toContain("/about");
    expect(sitemap).toContain("/privacy");
    expect(adsTxtRoute).toContain("buildAdsTxt");
    expect(adsTxtRoute).toContain("text/plain");
    expect(llmsTxt).toContain("ShareShopi");
    expect(llmsTxt).toContain("AI");
    expect(llmsTxt).toContain("Cloudflare D1");
    expect(home).toContain('"@type": "WebSite"');
    expect(home).toContain('"@type": "Organization"');
    expect(home).toContain("seo-faq-strip");
    expect(about).toContain("AI検索向け要約");
    expect(about).toContain("FAQPage");
    expect(login).toContain("export const metadata");
    expect(privacy).toContain("プライバシーポリシー");
    expect(privacy).toContain("広告とCookie");
    expect(adConfigRoute).toContain("getRuntimeMonetizationEnv");
    expect(adConfigRoute).toContain("getAdSenseConfig");
    expect(adsenseScript).toContain("pagead2.googlesyndication.com");
    expect(adSlot).toContain("/api/ads/config");
  });

  it("keeps operational documents aligned with Cloudflare D1 and Firebase", () => {
    const architecture = readFileSync(new URL("../ARCHITECTURE.md", import.meta.url), "utf8");
    const betaChecklist = readFileSync(new URL("../BETA_RELEASE_CHECKLIST.md", import.meta.url), "utf8");
    const requestBrief = readFileSync(new URL("../REQUEST_BRIEF.md", import.meta.url), "utf8");
    const operations = readFileSync(new URL("../OPERATIONS.md", import.meta.url), "utf8");
    const migration = readFileSync(new URL("../CLOUDFLARE_MIGRATION.md", import.meta.url), "utf8");
    const docs = [architecture, betaChecklist, requestBrief, operations, migration].join("\n");

    expect(docs).toContain("Cloudflare Workers + OpenNext");
    expect(docs).toContain("Cloudflare D1");
    expect(docs).toContain("Firebase Auth");
    expect(docs).toContain("npm run cf:typegen");
    expect(docs).not.toMatch(/Supabase|Vercel|shareshopi\.vercel|shareshopi\.shareshopi|Workers & Pages > shareshopi/);
    expect(operations).toContain("Workers & Pages > app > Settings > Triggers > Cron Events");
  });

  it("ships the ShareShopi app icons and manifest", () => {
    const iconPaths = [
      "../public/favicon-32x32.png",
      "../public/apple-touch-icon.png",
      "../public/icon-192.png",
      "../public/icon-512.png",
      "../public/shareshopi-icon.png",
    ];
    const manifest = readFileSync(new URL("../public/site.webmanifest", import.meta.url), "utf8");

    for (const iconPath of iconPaths) {
      const iconUrl = new URL(iconPath, import.meta.url);
      expect(existsSync(iconUrl)).toBe(true);
      expect(statSync(iconUrl).size).toBeGreaterThan(100);
    }

    expect(manifest).toContain('"name": "ShareShopi"');
    expect(manifest).toContain("/icon-192.png");
    expect(manifest).toContain("/icon-512.png");
  });

  it("defines CI and Cloudflare deployment workflows", () => {
    const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    const deploy = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
    const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const operations = readFileSync(new URL("../OPERATIONS.md", import.meta.url), "utf8");
    const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");

    expect(ci).toContain("npm test");
    expect(ci).toContain("npx tsc --noEmit");
    expect(ci).toContain("npm run build");
    expect(ci).toContain("npm run test:e2e:smoke");
    expect(ci).toContain("npm run cf:build");
    expect(deploy).toContain("npm run cf:deploy");
    expect(deploy).toContain("CLOUDFLARE_API_TOKEN");
    expect(deploy).toContain("CLOUDFLARE_ACCOUNT_ID");
    expect(packageJson).toContain('"test:e2e:smoke"');
    expect(packageJson).toContain('"test:e2e:prod"');
    expect(readme).toContain("CLOUDFLARE_API_TOKEN");
    expect(readme).toContain("CLOUDFLARE_ACCOUNT_ID");
    expect(operations).toContain("npm run test:e2e:prod");
    expect(operations).toContain("npx wrangler d1 export shareshopi-prod --remote");
    expect(operations).toContain("Workers & Pages > app > Logs");
    expect(gitignore).toContain("backups/");
  });
});
