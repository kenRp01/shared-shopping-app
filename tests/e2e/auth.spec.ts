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
});
