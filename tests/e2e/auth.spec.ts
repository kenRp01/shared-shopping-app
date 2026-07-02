import { expect, test } from "@playwright/test";

test.describe("Google authentication entry", () => {
  test("shows Google login with email fallback", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Googleアカウントで共有リストを使う" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("メールアドレス")).toBeVisible();
    await expect(page.getByPlaceholder("パスワード")).toBeVisible();
    await expect(page.getByText("デモ用ログイン")).toHaveCount(0);

    const loginTheme = await page.locator(".page-shell").evaluate((shell) => {
      const card = document.querySelector(".auth-layout .auth-card");
      const input = document.querySelector(".auth-layout input");
      return {
        shellBackground: getComputedStyle(shell).backgroundColor,
        cardBackground: card ? getComputedStyle(card).backgroundImage : "",
        inputBackground: input ? getComputedStyle(input).backgroundColor : "",
        inputColor: input ? getComputedStyle(input).color : "",
      };
    });
    expect(loginTheme.shellBackground).toBe("rgb(5, 6, 7)");
    expect(loginTheme.cardBackground).toContain("linear-gradient");
    expect(loginTheme.inputBackground).not.toBe("rgb(255, 255, 255)");
    expect(loginTheme.inputColor).toBe("rgb(255, 255, 255)");
  });

  test("redirects signup to login", async ({ page }) => {
    await page.goto("/signup");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新規登録" })).toBeVisible();
  });

  test("shows password confirmation on signup", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "新規登録" }).click();

    await expect(page.getByPlaceholder("表示名")).toBeVisible();
    await expect(page.getByPlaceholder("パスワード確認")).toBeVisible();
    await expect(page.getByRole("button", { name: "登録", exact: true })).toBeVisible();
  });

  test("starts Google OAuth in a Firebase popup", async ({ page }) => {
    await page.goto("/login");
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Googleでログイン" }).click();
    const popup = await popupPromise;

    await popup.waitForLoadState("domcontentloaded");
    expect(new URL(popup.url()).hostname).toMatch(/accounts\.google\.com|firebaseapp\.com/);
    await expect(page).toHaveURL(/\/login$/);
  });
});
