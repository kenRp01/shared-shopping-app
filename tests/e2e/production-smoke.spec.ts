import { expect, test } from "@playwright/test";

test.describe("Production smoke", () => {
  test("loads public pages and app icons", async ({ page, request, baseURL }) => {
    const origin = baseURL ?? "";

    await page.goto("/");

    await expect(page).toHaveTitle(/ShareShopi/);
    await expect(page.locator(".app-loader, .topbar, .app-shell-title").first()).toBeVisible();

    const manifest = await request.get(`${origin}/site.webmanifest`);
    expect(manifest.ok()).toBe(true);
    expect(await manifest.text()).toContain("ShareShopi");

    const favicon = await request.get(`${origin}/favicon-32x32.png`);
    expect(favicon.ok()).toBe(true);
    expect(favicon.headers()["content-type"]).toContain("image/png");
  });

  test("keeps legal and contact routes available", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "プライバシーポリシー" })).toBeVisible();

    await page.goto("/contact");
    await expect(page.getByLabel("名前")).toBeVisible();
    await expect(page.getByLabel("返信先メール")).toBeVisible();
    await expect(page.getByLabel("内容")).toBeVisible();
  });
});
