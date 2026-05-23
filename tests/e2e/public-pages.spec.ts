import { expect, test } from "@playwright/test";

test.describe("Public beta pages", () => {
  test("shows legal and contact pages", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();
    await expect(page.getByText("ShareShopi の機能や提供条件は、サービス改善のため変更される場合があります。")).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "プライバシーポリシー" })).toBeVisible();
    await expect(page.getByText("ShareShopi は、ログイン、共有、リマインドに必要な最小限の情報だけを扱います。")).toBeVisible();

    await page.goto("/contact");
    await expect(page.getByText("不具合、共有の相談、データ削除依頼はこちらから送信してください。")).toBeVisible();
    await expect(page.getByLabel("名前")).toBeVisible();
    await expect(page.getByLabel("返信先メール")).toBeVisible();
    await expect(page.getByLabel("内容")).toBeVisible();
  });

  test("submits the contact form", async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/contact");
    await page.getByLabel("名前").fill("テストユーザー");
    await page.getByLabel("返信先メール").fill("test@example.com");
    await page.getByLabel("内容").fill("問い合わせフォームの送信確認です。");
    await page.getByRole("button", { name: "送信する" }).click();

    await expect(page.getByText("送信しました。内容を確認して返信します。")).toBeVisible();
  });

  test("does not show the old global footer on the login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("footer.site-footer")).toHaveCount(0);
  });
});
