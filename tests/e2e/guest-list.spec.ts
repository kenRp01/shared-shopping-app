import { expect, type Page, test } from "@playwright/test";

async function openGuestList(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("shareshopi:theme", "dark");
    document.documentElement.dataset.theme = "dark";
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/lists\/list_/, { timeout: 20_000 });
  await expect(page.getByLabel("商品名")).toBeVisible();
  await expect(page.getByRole("heading", { name: "マイリスト", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "共有", exact: true })).toBeVisible();
  await expect(page.getByText("マイリストを開いています")).toHaveCount(0);
}

test.describe("Guest shopping list", () => {
  test("opens a guest list, adds an item, and removes it by checkbox", async ({ page }) => {
    const itemName = `E2E牛乳${Date.now()}`;

    await openGuestList(page);

    await page.getByLabel("商品名").fill(itemName);
    await page.getByLabel("商品名").press("Enter");

    const itemButton = page.getByRole("button", { name: new RegExp(`${itemName} を編集`) });
    await expect(itemButton).toBeVisible();

    await page.getByLabel(`${itemName} を購入済みにして一覧から外す`).click();
    await expect(itemButton).toHaveCount(0, { timeout: 10_000 });
  });

  test("switches between default guest lists", async ({ page }) => {
    await openGuestList(page);

    await page.getByRole("link", { name: "共有", exact: true }).click();

    await expect(page).toHaveURL(/\/lists\/list_/);
    await expect(page.getByRole("heading", { name: "共有", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "マイリスト", exact: true })).toBeVisible();
  });

  test("switches lists by horizontal scrolling", async ({ page }) => {
    await openGuestList(page);
    await expect(page.getByText("Swipe lists")).toHaveCount(0);
    await expect(page.getByText("Add your shopping")).toHaveCount(0);

    const cardBackgrounds = await page.locator(".category-card").evaluateAll((cards) =>
      cards.map((card) => getComputedStyle(card).backgroundImage),
    );
    expect(new Set(cardBackgrounds).size).toBeGreaterThan(1);
    await expect(page.locator(".category-card-preview-body")).toHaveCount(0);
    const cardLayoutCounts = await page.locator(".category-card").evaluateAll((cards) =>
      cards.map((card) => card.querySelectorAll(".item-list-stack").length),
    );
    expect(cardLayoutCounts.every((count) => count === 1)).toBe(true);
    await expect(page.locator(".active-list-card-actions").getByText(/^\d+$/)).toHaveCount(0);
    await expect(page.locator(".category-card-count")).toHaveCount(0);
    const addItemMetrics = await page.locator(".list-carousel-stage").evaluate((stage) => {
      const activeAddForm = stage.querySelector(".category-card-active .list-task-add-form");
      const activeCard = stage.querySelector(".category-card-active");
      const previewCard = stage.querySelector(".category-card:not(.category-card-active)");
      const activeAddInput = activeAddForm?.querySelector("input");
      const previewAddPlaceholder = previewCard?.querySelector(".category-card-add-placeholder");
      const activeInputStyle = activeAddInput ? getComputedStyle(activeAddInput) : null;
      const activePlaceholderStyle = activeAddInput ? getComputedStyle(activeAddInput, "::placeholder") : null;
      const previewStyle = previewAddPlaceholder ? getComputedStyle(previewAddPlaceholder) : null;
      const activeInputRect = activeAddInput?.getBoundingClientRect();
      const activeCardRect = activeCard?.getBoundingClientRect();
      const previewCardRect = previewCard?.getBoundingClientRect();
      const previewRect = previewAddPlaceholder?.getBoundingClientRect();
      const activeContentLeft = activeInputRect && activeInputStyle
        ? activeInputRect.left + parseFloat(activeInputStyle.paddingLeft) - (activeCardRect?.left ?? 0)
        : null;
      const previewContentLeft = previewRect && previewStyle
        ? previewRect.left + parseFloat(previewStyle.paddingLeft) - (previewCardRect?.left ?? 0)
        : null;
      return {
        activeFontSize: activeAddInput ? getComputedStyle(activeAddInput).fontSize : null,
        previewFontSize: previewAddPlaceholder ? getComputedStyle(previewAddPlaceholder).fontSize : null,
        activeColor: activePlaceholderStyle?.color ?? null,
        previewColor: previewStyle?.color ?? null,
        activeHeight: activeAddForm?.getBoundingClientRect().height ?? null,
        previewHeight: previewAddPlaceholder?.getBoundingClientRect().height ?? null,
        activeContentLeft,
        previewContentLeft,
      };
    });
    expect(addItemMetrics.activeFontSize).toBe(addItemMetrics.previewFontSize);
    expect(addItemMetrics.activeColor).toBe(addItemMetrics.previewColor);
    expect(parseFloat(addItemMetrics.activeFontSize ?? "99")).toBeLessThanOrEqual(17);
    expect(addItemMetrics.activeHeight).toBe(addItemMetrics.previewHeight);
    expect(addItemMetrics.activeHeight ?? 999).toBeLessThanOrEqual(62);
    expect(Math.abs((addItemMetrics.activeContentLeft ?? 0) - (addItemMetrics.previewContentLeft ?? 99))).toBeLessThanOrEqual(1);

    await page.getByLabel("カテゴリー切り替え").evaluate((element) => {
      element.scrollTo({ left: element.scrollWidth, behavior: "instant" });
    });

    await expect(page.getByRole("heading", { name: "共有", exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/lists\/list_/);
  });

  test("switches lists from carousel indicators after creating another list", async ({ page }) => {
    const listName = `E2Eリスト${Date.now()}`;

    await openGuestList(page);
    await page.getByRole("button", { name: "新しいリストを作成" }).click();
    await page.getByPlaceholder("新しいリスト").fill(listName);
    await expect(page.getByRole("button", { name: "作成" })).toHaveCount(0);
    await page.getByPlaceholder("新しいリスト").press("Enter");

    await expect(page.getByRole("heading", { name: listName, exact: true })).toBeVisible({ timeout: 10_000 });

    const visibleListNames = await page.locator(".category-card .active-list-card-head h2").evaluateAll((nodes) =>
      nodes.map((node) => node.textContent?.trim()),
    );
    expect(visibleListNames.at(-1)).toBe(listName);

    await page.getByRole("button", { name: "マイリストへ移動" }).click();
    await expect(page.getByRole("heading", { name: "マイリスト", exact: true })).toBeVisible();

    await page.getByRole("button", { name: `${listName}へ移動` }).click();
    await expect(page.getByRole("heading", { name: listName, exact: true })).toBeVisible();
  });

  test("toggles list theme between dark and light", async ({ page }) => {
    await openGuestList(page);

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "ライトモードに切り替え" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "ダークモードに切り替え" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("requires Google login for sharing from a guest list", async ({ page }) => {
    await openGuestList(page);

    const listPath = new URL(page.url()).pathname;
    await page.goto(`${listPath}/settings`);

    await expect(page.locator(".settings-shell")).toBeVisible();
    await expect(page.locator(".settings-appbar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.locator(".settings-avatar")).toHaveCount(0);
    await expect(page.getByText("LIST SETTINGS", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sharing/ })).toBeVisible();
    await expect(page.locator(".settings-nav-card")).toHaveCount(1);
    await expect(page.locator(".settings-card").first()).toBeVisible();
    await expect(page.getByText("REMINDER", { exact: true })).toBeVisible();
    await expect(page.getByText("PUBLICITY", { exact: true })).toBeVisible();
    await expect(page.locator(".settings-public-card")).toBeVisible();
    await expect(page.getByText("Googleでログインしてください")).toBeVisible();
    await expect(page.getByRole("link", { name: "Googleでログイン" })).toHaveAttribute("href", "/login");
  });
});
