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
  test("uses the neutral redirect loader before opening the first list", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("shareshopi:theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".landing-hero")).toHaveCount(0);
    await expect(page.locator(".redirect-loader")).toBeVisible();
    await expect(page).toHaveURL(/\/lists\/list_/, { timeout: 20_000 });
  });

  test("keeps the carousel layout during the first resolving paint", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("shareshopi:theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });

    await page.goto("/lists/list_first_paint_check", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".list-carousel-stage")).toBeVisible();
    await expect(page.locator(".page-grid.detail-shell > .panel.list-section-panel:not(.list-carousel-stage)")).toHaveCount(0);
  });

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

  test("keeps the item edit form readable inside the list card", async ({ page }) => {
    const itemName = `E2E編集${Date.now()}`;

    await openGuestList(page);
    await page.getByLabel("商品名").fill(itemName);
    await page.getByLabel("商品名").press("Enter");
    await page.getByRole("button", { name: new RegExp(`${itemName} を編集`) }).click();

    const metrics = await page.locator(".category-card-active .item-row-modern:has(.item-edit-form)").evaluate((row) => {
      const card = row.closest(".category-card");
      const form = row.querySelector(".item-edit-form");
      const top = row.querySelector(".item-row-top");
      const firstInput = form?.querySelector("input");
      const style = form ? getComputedStyle(form) : null;
      const cardRect = card?.getBoundingClientRect();
      const formRect = form?.getBoundingClientRect();
      const topRect = top?.getBoundingClientRect();
      const inputRect = firstInput?.getBoundingClientRect();

      return {
        cardLeft: cardRect?.left ?? 0,
        cardRight: cardRect?.right ?? 0,
        formLeft: formRect?.left ?? 0,
        formRight: formRect?.right ?? 0,
        formTop: formRect?.top ?? 0,
        rowTopBottom: topRect?.bottom ?? 0,
        inputWidth: inputRect?.width ?? 0,
        columns: style?.gridTemplateColumns ?? "",
      };
    });

    expect(metrics.formLeft).toBeGreaterThanOrEqual(metrics.cardLeft);
    expect(metrics.formRight).toBeLessThanOrEqual(metrics.cardRight);
    expect(metrics.formTop).toBeGreaterThanOrEqual(metrics.rowTopBottom);
    expect(metrics.inputWidth).toBeGreaterThan(180);
    expect(metrics.columns.split(" ").length).toBe(1);
  });

  test("switches between default guest lists", async ({ page }) => {
    await openGuestList(page);

    await page.getByRole("link", { name: "共有", exact: true }).click();

    await expect(page).toHaveURL(/\/lists\/list_/);
    await expect(page.getByRole("heading", { name: "共有", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "マイリスト", exact: true })).toBeVisible();
  });

  test("switches lists by horizontal scrolling", async ({ page }) => {
    const itemName = `E2Eパン${Date.now()}`;
    await openGuestList(page);
    await expect(page.getByText("Swipe lists")).toHaveCount(0);
    await expect(page.getByText("Add your shopping")).toHaveCount(0);
    await page.getByLabel("商品名").fill(itemName);
    await page.getByLabel("商品名").press("Enter");
    await expect(page.getByRole("button", { name: new RegExp(`${itemName} を編集`) })).toBeVisible();

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
    const settingsButton = page.getByRole("link", { name: "現在のリスト設定" });
    await expect(settingsButton).toBeVisible();
    await expect(settingsButton).toHaveCount(1);
    const settingsButtonIsInsideActiveCard = await page.locator(".list-card-settings-button").evaluate((button) => {
      const activeCard = button.closest(".category-card-active");
      const activeHead = button.closest(".active-list-card-head");
      return Boolean(activeCard && activeHead) && getComputedStyle(button).position !== "absolute";
    });
    expect(settingsButtonIsInsideActiveCard).toBe(true);
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

    await expect(settingsButton).toBeVisible();
    await expect(page.locator(".category-card-active .active-list-card-head h2")).toHaveText("共有", { timeout: 10_000 });
    await expect(settingsButton).toBeVisible();
    await expect(page.locator(".category-card-active")).not.toContainText(itemName);
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
    await expect(page.getByRole("heading", { name: "表示できません" })).toHaveCount(0);
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
    await expect(page.locator(".settings-role-tag").first()).toContainText("Role");
    await expect(page.locator(".settings-role-tag").first()).toContainText("所有者");

    const settingsTheme = await page.locator(".page-shell").evaluate((shell) => {
      const navCard = document.querySelector(".settings-nav-card");
      const field = document.querySelector(".settings-field input");
      const saveButton = document.querySelector(".settings-save-button");
      const timeInput = document.querySelector(".settings-time-input input");
      return {
        shellBackground: getComputedStyle(shell).backgroundColor,
        navCardBackground: navCard ? getComputedStyle(navCard).backgroundImage : "",
        fieldBackground: field ? getComputedStyle(field).backgroundColor : "",
        fieldColor: field ? getComputedStyle(field).color : "",
        saveButtonBackground: saveButton ? getComputedStyle(saveButton).backgroundColor : "",
        timeInputText: timeInput instanceof HTMLInputElement ? timeInput.value : "",
        timeInputWidth: timeInput ? timeInput.getBoundingClientRect().width : 0,
      };
    });
    expect(settingsTheme.shellBackground).toBe("rgb(5, 6, 7)");
    expect(settingsTheme.navCardBackground).toContain("linear-gradient");
    expect(settingsTheme.fieldBackground).not.toBe("rgb(255, 255, 255)");
    expect(settingsTheme.fieldColor).toBe("rgb(255, 255, 255)");
    expect(settingsTheme.saveButtonBackground).not.toBe("rgba(5, 6, 7, 0.82)");
    expect(settingsTheme.timeInputText).toBe("08:00");
    expect(settingsTheme.timeInputWidth).toBeGreaterThanOrEqual(120);

    await page.getByRole("button", { name: "ライトモードに切り替え" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const lightSettingsTheme = await page.locator(".page-shell").evaluate((shell) => {
      const navCard = document.querySelector(".settings-nav-card");
      const field = document.querySelector(".settings-field input");
      const saveButton = document.querySelector(".settings-save-button");
      return {
        shellBackground: getComputedStyle(shell).backgroundImage,
        navCardBackground: navCard ? getComputedStyle(navCard).backgroundColor : "",
        fieldBackground: field ? getComputedStyle(field).backgroundColor : "",
        fieldColor: field ? getComputedStyle(field).color : "",
        saveButtonBackground: saveButton ? getComputedStyle(saveButton).backgroundImage : "",
      };
    });
    expect(lightSettingsTheme.shellBackground).toContain("linear-gradient");
    expect(lightSettingsTheme.navCardBackground).toBe("rgba(255, 255, 255, 0.94)");
    expect(lightSettingsTheme.fieldBackground).toBe("rgba(255, 255, 255, 0.92)");
    expect(lightSettingsTheme.fieldColor).toBe("rgb(18, 51, 39)");
    expect(lightSettingsTheme.saveButtonBackground).toContain("linear-gradient");
  });

  test("shows a styled settings fallback instead of the generic error panel", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("shareshopi:theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });

    await page.goto("/lists/missing-list/settings");

    await expect(page.locator(".settings-shell")).toBeVisible();
    await expect(page.locator(".settings-appbar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "表示できません" })).toHaveCount(0);
    await expect(page.getByText("このリストの設定を開けません")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "ログインする" })).toHaveAttribute("href", "/login");
  });
});
