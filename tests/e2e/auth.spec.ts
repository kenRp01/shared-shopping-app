import { expect, test } from "@playwright/test";

test.describe("Google authentication entry", () => {
  test("shows Google login with email fallback", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Googleアカウントで共有リストを使う" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
    await expect(page.getByRole("button", { name: "メールログイン" })).toBeVisible();
    await expect(page.getByPlaceholder("メールアドレス")).toBeVisible();
    await expect(page.getByPlaceholder("パスワード")).toBeVisible();
    await expect(page.getByText("デモ用ログイン")).toHaveCount(0);
  });

  test("redirects signup to login", async ({ page }) => {
    await page.goto("/signup");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新規登録" })).toBeVisible();
  });

  test("starts Google OAuth with the app callback URL", async ({ page }) => {
    await page.goto("/login");
    const appOrigin = new URL(page.url()).origin;

    await page.getByRole("button", { name: "Googleでログイン" }).click();

    await expect(page).toHaveURL(/accounts\.google\.com|oguntadofgerjwfeqxok\.supabase\.co/, {
      timeout: 20_000,
    });

    const loginUrl = new URL(page.url());
    const oauthUrl = page.url();

    expect(loginUrl.hostname).toMatch(/accounts\.google\.com|oguntadofgerjwfeqxok\.supabase\.co/);
    expect(oauthUrl).toContain(encodeURIComponent("https://oguntadofgerjwfeqxok.supabase.co/auth/v1/callback"));
    expect(oauthUrl).toContain(
      encodeURIComponent(encodeURIComponent(`?redirect_to=${encodeURIComponent(`${appOrigin}/auth/callback`)}`)),
    );
  });
});
