import { expect, test } from "@playwright/test";
import { SEED_DISHES } from "../src/seed/dishes";
import { dishCount, flushWrites, localToday, menuList, menuNames, openToday, readPersonal, seedDevice } from "./helpers";

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

test("the dish library is read-only: no add, edit, delete, restore or reset anywhere", async ({ page }) => {
  await page.goto("/dishes");
  await expect(page.getByText(/^73 món$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Thêm món/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Sửa / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Xoá / })).toHaveCount(0);
  await expect(page.getByText("Món đã xoá")).toHaveCount(0);
  await expect(page.getByText("Đã sửa")).toHaveCount(0);

  // What is left: tap a dish to read it.
  await page.getByRole("button", { name: "Xem công thức Bắp cải luộc" }).click();
  const dialog = page.getByRole("dialog", { name: "Bắp cải luộc" });
  await expect(dialog.getByRole("button", { name: /Khôi phục|Lưu|Sửa/ })).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: /^Cách nấu/ })).toBeVisible();
});

test.describe("a device that still holds dishes from the version that allowed editing", () => {
  const caiLuoc = SEED_DISHES.find((dish) => dish.name === "Bắp cải luộc")!;
  const caiThia = SEED_DISHES.find((dish) => dish.name === "Cải thìa xào nấm")!;
  const custom = {
    id: "custom:1",
    mealType: "buacom",
    category: "canh",
    chay: false,
    region: null,
    name: "Món nhà làm",
    time: 20,
    ingredients: ["cá"],
    steps: ["nấu"],
  };
  const legacyUser = {
    customDishes: [custom],
    overrides: { [caiLuoc.id]: { ...caiLuoc, name: "Bản sửa cũ" } },
    hiddenIds: [caiThia.id],
  };
  const xao = SEED_DISHES.find((dish) => dish.category === "xao" && dish.id !== caiLuoc.id)!;
  const man = SEED_DISHES.find((dish) => dish.category === "man")!;
  const oldDevice = () => ({
    schemaVersion: 1,
    user: legacyUser,
    history: [{ date: localToday(-1), dishIds: [custom.id, xao.id], mealType: "buacom" }],
    favorites: [{ id: "f1", name: "Món cũ của nhà", dishIds: [custom.id], mealType: "buacom", savedAt: 1 }],
    todayMenu: { date: localToday(), dishIds: [custom.id, xao.id, man.id], mealType: "buacom" },
    ticks: {},
    chayFilter: false,
  });

  test("shows exactly the catalog, with removed dishes marked in history and favorites", async ({ page }) => {
    await seedDevice(page, oldDevice());

    // Today's menu named a dish that no longer exists: it is replaced by a complete fresh one.
    await expect(menuNames(page)).toHaveCount(3);
    await expect(menuNames(page).filter({ hasText: "Món nhà làm" })).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: "(đã xoá)" })).toBeVisible();

    await page.getByRole("link", { name: "Món ăn" }).click();
    await expect(page.getByRole("searchbox", { name: "Tìm món" })).toBeVisible();
    expect(await dishCount(page)).toBe(SEED_DISHES.length);
    await expect(page.getByText("Món nhà làm")).toHaveCount(0);
    await expect(page.getByText("Bản sửa cũ")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Xem công thức Bắp cải luộc" })).toBeVisible();
    await expect(page.getByRole("button", { name: `Xem công thức ${caiThia.name}` })).toBeVisible();

    await page.getByRole("link", { name: "Yêu thích" }).click();
    await expect(page.getByRole("heading", { name: "Món cũ của nhà" })).toBeVisible();
    await expect(page.getByText("(đã xoá)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dùng lại" })).toBeDisabled();
  });

  test("leaves the old data untouched in storage", async ({ page }) => {
    await seedDevice(page, oldDevice());
    await expect(menuNames(page).first()).toBeVisible();
    // Do things that make the app save: tick an item, cook, then reload.
    await page.getByRole("checkbox").first().click();
    await page.getByRole("button", { name: "Đã nấu hôm nay" }).click();
    await flushWrites(page);
    await page.reload();
    await expect(menuNames(page).first()).toBeVisible();
    await flushWrites(page);
    expect((await readPersonal(page)).user).toEqual(legacyUser);
  });
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

  test("a catalog correction reaches every device, even one that once edited that dish", async ({ page }) => {
    // Serve a newer catalog in which one dish was renamed (as if corrected centrally).
    await page.route("**/api/v1/catalog", async (route) => {
      const dishes = SEED_DISHES.map((dish) =>
        dish.name === "Bắp cải luộc" ? { ...dish, name: "Bắp cải luộc (đã sửa trung tâm)" } : dish,
      ).map((dish) => ({ retired: false, ...dish }));
      await route.fulfill({ json: { version: 2, dishes }, headers: { ETag: '"catalog-v2"' } });
    });

    // This device holds an old local edit of that very dish.
    const original = SEED_DISHES.find((dish) => dish.name === "Bắp cải luộc")!;
    await seedDevice(page, {
      schemaVersion: 1,
      user: { customDishes: [], overrides: { [original.id]: { ...original, name: "Bản sửa của tôi" } }, hiddenIds: [] },
      history: [],
      favorites: [],
      todayMenu: null,
      ticks: {},
      chayFilter: false,
    });

    // First view shows the bundled seed; the refreshed catalog is cached for the next view.
    const refreshed = page.waitForResponse("**/api/v1/catalog");
    await page.goto("/dishes");
    await refreshed;
    await flushWrites(page);
    await page.reload();
    await expect(page.getByText("Bắp cải luộc (đã sửa trung tâm)")).toBeVisible();
    await expect(page.getByText("Bản sửa của tôi")).toHaveCount(0);
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
