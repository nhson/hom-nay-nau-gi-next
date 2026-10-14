import { expect, test } from "@playwright/test";
import { SEED_DISHES } from "../src/seed/dishes";
import { dishCount, flushWrites, menuList, menuNames, openToday } from "./helpers";

test("first open generates a Bữa cơm 3 món in the fixed order", async ({ page }) => {
  await openToday(page);
  await expect(menuNames(page)).toHaveCount(3);
  const groups = await menuList(page).locator("p.uppercase").allTextContents();
  expect(groups).toEqual(["Xào / Luộc / Salad", "Canh", "Món mặn"]);
  await expect(page.getByRole("heading", { name: "Danh sách đi chợ" })).toBeVisible();
  await expect(page.getByRole("checkbox").first()).toBeVisible();
});

test("random, reroll and mark cooked shows up in history", async ({ page }) => {
  await openToday(page);
  await page.getByRole("button", { name: "Random thực đơn" }).click();
  await expect(menuNames(page)).toHaveCount(3);

  const first = (await menuNames(page).allTextContents())[0];
  await page.getByRole("button", { name: /^Đổi món khác cho/ }).first().click();
  await expect(menuNames(page)).toHaveCount(3);
  await expect(menuNames(page).first()).not.toHaveText(first);

  const names = await menuNames(page).allTextContents();
  await page.getByRole("button", { name: "Đã nấu hôm nay" }).click();
  await expect(page.getByText("Đã nấu thực đơn này hôm nay")).toBeVisible();
  const history = page.locator("main time").first().locator("..");
  for (const name of names) await expect(history).toContainText(name);

  // Rerolling after cooking means the menu on screen is no longer the recorded one.
  await page.getByRole("button", { name: /^Đổi món khác cho/ }).first().click();
  await expect(page.getByText("Đã nấu thực đơn này hôm nay")).toBeHidden();
});

test("Món chay regenerates a vegetarian menu and survives a reload", async ({ page }) => {
  await openToday(page);
  const chay = page.getByRole("button", { name: "Món chay", exact: true });
  await chay.click();
  await expect(chay).toHaveAttribute("aria-pressed", "true");

  // Every dish that could be found is Chay (some groups may be missing and are reported).
  const count = await menuNames(page).count();
  expect(count).toBeGreaterThan(0);
  await expect(menuList(page).getByRole("listitem").filter({ hasText: "Chay" })).toHaveCount(count);

  const before = await menuNames(page).allTextContents();
  await flushWrites(page);
  await page.reload();
  await expect(menuNames(page).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Món chay", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await menuNames(page).allTextContents()).toEqual(before);
});

test("Nấu 1 món switches to a single dish and Random returns to 3 dishes", async ({ page }) => {
  await openToday(page);
  const one = page.getByRole("button", { name: "Nấu 1 món" });
  await one.click();
  await expect(menuNames(page)).toHaveCount(1);
  await expect(one).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Random thực đơn" }).click();
  await expect(menuNames(page)).toHaveCount(3);
});

test("add, edit, delete, reset and restore dishes", async ({ page }) => {
  await page.goto("/dishes");
  await expect(page.getByText(/^73 món$/)).toBeVisible();

  // Add a custom dish.
  await page.getByRole("button", { name: "Thêm món mới" }).click();
  await page.getByRole("button", { name: "Lưu món" }).click();
  await expect(page.locator("#dish-name-error")).toHaveText("Nhập tên món");
  await expect(page.locator("#dish-category-error")).toHaveText("Chọn nhóm món");
  await page.getByLabel("Tên món").fill("Canh chua nhà làm");
  await page.getByLabel("Nhóm món").selectOption("canh");
  await page.getByLabel("Thời gian (phút)").fill("25");
  await page.getByLabel("Nguyên liệu (cách nhau bằng dấu phẩy)").fill("cá, cà chua, me");
  await page.getByLabel("Hướng dẫn nấu (mỗi bước 1 dòng)").fill("Sơ chế\nNấu chín");
  await page.getByRole("button", { name: "Lưu món" }).click();
  await expect(page.getByText("Đã lưu món ăn!")).toBeVisible();
  expect(await dishCount(page)).toBe(74);

  // Edit a catalog dish: it becomes an on-device override.
  await page.getByRole("button", { name: "Sửa Bắp cải luộc" }).click();
  await page.getByLabel("Tên món").fill("Bắp cải luộc chấm mắm");
  await page.getByRole("button", { name: "Lưu món" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Bắp cải luộc chấm mắm" });
  await expect(row).toContainText("Đã sửa");

  // Reset to the catalog version.
  await page.getByRole("button", { name: "Sửa Bắp cải luộc chấm mắm" }).click();
  await page.getByRole("button", { name: "Khôi phục bản gốc" }).click();
  await expect(page.getByRole("button", { name: "Sửa Bắp cải luộc", exact: true })).toBeVisible();

  // Delete (confirmed), then restore the hidden catalog dish.
  await page.getByRole("button", { name: "Xoá Bắp cải luộc" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Huỷ" }).click();
  expect(await dishCount(page)).toBe(74);
  await page.getByRole("button", { name: "Xoá Bắp cải luộc" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá" }).click();
  expect(await dishCount(page)).toBe(73);
  await page.getByRole("button", { name: "Khôi phục" }).click();
  expect(await dishCount(page)).toBe(74);

  // Delete the custom dish for good.
  await page.getByRole("button", { name: "Xoá Canh chua nhà làm" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá" }).click();
  expect(await dishCount(page)).toBe(73);

  // Edits persist across reloads.
  await flushWrites(page);
  await page.reload();
  await expect(page.getByText(/^73 món$/)).toBeVisible();
});

test("the dish bank filters by group and Chay", async ({ page }) => {
  const count = (filter: (dish: (typeof SEED_DISHES)[number]) => boolean) => SEED_DISHES.filter(filter).length;
  await page.goto("/dishes");
  expect(await dishCount(page)).toBe(SEED_DISHES.length);

  await page.getByRole("button", { name: "Canh", exact: true }).click();
  expect(await dishCount(page)).toBe(count((d) => d.category === "canh"));

  await page.getByRole("button", { name: "Chay", exact: true }).click();
  expect(await dishCount(page)).toBe(count((d) => d.category === "canh" && d.chay));

  await page.getByRole("button", { name: "Bữa 1 món", exact: true }).click();
  expect(await dishCount(page)).toBe(count((d) => d.mealType === "buatomonuoc" && d.chay));

  await page.getByRole("button", { name: "Chay", exact: true }).click();
  expect(await dishCount(page)).toBe(count((d) => d.mealType === "buatomonuoc"));
});

test("search the dish bank and read a recipe without adding it to the menu", async ({ page }) => {
  await page.goto("/dishes");
  const search = page.getByRole("searchbox", { name: "Tìm món" });
  // Accent- and case-insensitive: "ca kho" finds "Cá kho tộ".
  await search.fill("CA KHO");
  await expect(page.getByRole("button", { name: "Xem công thức Cá kho tộ" })).toBeVisible();
  expect(await dishCount(page)).toBeLessThan(10);

  await page.getByRole("button", { name: "Xem công thức Cá kho tộ" }).click();
  const dialog = page.getByRole("dialog", { name: "Cá kho tộ" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /^Nguyên liệu/ })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /^Cách nấu/ })).toBeVisible();
  await expect(dialog.getByRole("listitem").filter({ hasText: /\S/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await search.fill("khong co mon nay");
  await expect(page.getByText("Không có món nào phù hợp.")).toBeVisible();
  await search.fill("");
  expect(await dishCount(page)).toBe(SEED_DISHES.length);
});

test("save a favorite and use it again", async ({ page }) => {
  await openToday(page);
  const names = await menuNames(page).allTextContents();
  await page.getByRole("button", { name: "Lưu thực đơn yêu thích" }).click();
  await expect(page.getByLabel("Tên thực đơn")).toHaveValue(/^Thực đơn \d{2}\/\d{2}$/);
  await page.getByLabel("Tên thực đơn").fill("Cuối tuần");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();

  await page.getByRole("button", { name: "Random thực đơn" }).click();
  await page.getByRole("link", { name: "Yêu thích" }).click();
  await expect(page.getByRole("heading", { name: "Cuối tuần" })).toBeVisible();
  await page.getByRole("button", { name: "Dùng lại" }).click();
  await expect(page).toHaveURL("/");
  expect(await menuNames(page).allTextContents()).toEqual(names);

  await page.getByRole("link", { name: "Yêu thích" }).click();
  await page.getByRole("button", { name: "Xoá" }).click();
  await expect(page.getByText("Chưa có thực đơn yêu thích")).toBeVisible();
});

// Playwright cannot intercept requests the service worker makes, so mock the API with the worker off.
test.describe("catalog refresh", () => {
  test.use({ serviceWorkers: "block" });

  test("a catalog correction from the server reaches the app, and the user's own edits win", async ({ page }) => {
    // Serve a newer catalog in which one dish was renamed (as if corrected centrally).
    await page.route("**/api/v1/catalog", async (route) => {
      const dishes = SEED_DISHES.map((dish) =>
        dish.name === "Bắp cải luộc" ? { ...dish, name: "Bắp cải luộc (đã sửa trung tâm)" } : dish,
      ).map((dish) => ({ retired: false, ...dish }));
      await route.fulfill({ json: { version: 2, dishes }, headers: { ETag: '"catalog-v2"' } });
    });

    // First view shows the bundled seed; the refreshed catalog is cached for the next view.
    const refreshed = page.waitForResponse("**/api/v1/catalog");
    await page.goto("/dishes");
    await refreshed;
    await flushWrites(page);
    await page.reload();
    await expect(page.getByText("Bắp cải luộc (đã sửa trung tâm)")).toBeVisible();

    // The user's own edit wins over the catalog's version of the same dish.
    await page.getByRole("button", { name: "Sửa Bắp cải luộc (đã sửa trung tâm)" }).click();
    await page.getByLabel("Tên món").fill("Bắp cải của tôi");
    await page.getByRole("button", { name: "Lưu món" }).click();
    await flushWrites(page);
    await page.reload();
    await expect(page.getByText("Bắp cải của tôi")).toBeVisible();
    await expect(page.getByText("Bắp cải luộc (đã sửa trung tâm)")).toHaveCount(0);
  });
});

test("works offline once opened: menu, recipe, shopping ticks and navigation", async ({ page, context }) => {
  await openToday(page);
  // Wait for the service worker to take control, then go offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(menuNames(page).first()).toBeVisible();
  const names = await menuNames(page).allTextContents();

  await context.setOffline(true);
  await page.reload();
  await expect(menuNames(page).first()).toBeVisible();
  expect(await menuNames(page).allTextContents()).toEqual(names);

  await page.getByText(/^Xem cách nấu/).first().click();
  await expect(page.locator("details[open] ol li").first()).toBeVisible();

  const tick = page.getByRole("checkbox").first();
  await tick.click();
  await expect(tick).toHaveAttribute("aria-checked", "true");
  await flushWrites(page);
  await page.reload();
  await expect(page.getByRole("checkbox").first()).toHaveAttribute("aria-checked", "true");

  await page.getByRole("link", { name: "Món ăn" }).click();
  await expect(page.getByText(/^73 món$/)).toBeVisible();
  await page.goto("/favorites");
  await expect(page.getByText("Chưa có thực đơn yêu thích")).toBeVisible();
});
