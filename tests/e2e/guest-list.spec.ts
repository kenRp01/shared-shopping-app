import { expect, type Page, test } from "@playwright/test";

async function openGuestList(page: Page) {
  await page.goto("/");
  await expect(page.getByText("マイリストを開いています")).toBeVisible();
  await expect(page).toHaveURL(/\/lists\/list_/, { timeout: 20_000 });
  await expect(page.getByLabel("商品名")).toBeVisible();
}

test.describe("Guest shopping list", () => {
  test("opens a guest list, adds an item, and removes it by checkbox", async ({ page }) => {
    const itemName = `E2E牛乳${Date.now()}`;

    await openGuestList(page);

    await page.getByLabel("商品名").fill(itemName);
    await page.getByRole("button", { name: "追加" }).click();

    const itemButton = page.getByRole("button", { name: new RegExp(`${itemName} を編集`) });
    await expect(itemButton).toBeVisible();

    await page.getByLabel(`${itemName} を購入済みにして一覧から外す`).click();
    await expect(itemButton).toHaveCount(0, { timeout: 10_000 });
  });

  test("requires Google login for sharing from a guest list", async ({ page }) => {
    await openGuestList(page);

    const listPath = new URL(page.url()).pathname;
    await page.goto(`${listPath}/settings`);

    await expect(page.getByText("Googleでログインしてください")).toBeVisible();
    await expect(page.getByRole("link", { name: "Googleでログイン" })).toHaveAttribute("href", "/login");
  });
});
