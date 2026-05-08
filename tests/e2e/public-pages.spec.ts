import { expect, test } from "@playwright/test";

test.describe("Public beta pages", () => {
  test("shows legal and contact pages", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "利用規約" })).toBeVisible();
    await expect(page.getByText("ShareShopi は限定ベータ版として提供されます。")).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "プライバシーポリシー" })).toBeVisible();
    await expect(page.getByText("Supabase")).toBeVisible();

    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "問い合わせ" })).toBeVisible();
    await expect(page.getByText("限定ベータ招待時に案内した連絡先")).toBeVisible();
  });

  test("exposes footer links from the login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "プライバシー" })).toHaveAttribute("href", "/privacy");
    await expect(page.getByRole("link", { name: "問い合わせ" })).toHaveAttribute("href", "/contact");
  });
});
