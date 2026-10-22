import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installFakeAdmin } from "./admin-fake-api";
import { flushWrites, menuNames, readPersonal } from "./helpers";

// Giao diện: Sáng / Tối / Theo thiết bị. Verified through what a person sees (the page colours), not how it is wired.

const LIGHT = "rgb(251, 247, 238)";
const DARK = "rgb(24, 29, 23)";
const LIGHT_BAR = "#fbf7ee";
const DARK_BAR = "#181d17";

const switchButton = (page: Page) => page.getByRole("button", { name: "Giao diện" });
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function openApp(page: Page) {
  await page.goto("/");
  await expect(menuNames(page).first()).toBeVisible();
}

async function choose(page: Page, option: "Sáng" | "Tối" | "Theo thiết bị") {
  await switchButton(page).click();
  await page.getByRole("menuitemradio", { name: option }).click();
}

const barColours = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => ({
      media: meta.getAttribute("media") ?? "",
      content: meta.getAttribute("content") ?? "",
    })),
  );

/** The device setting, with reduced motion so colours are read after any fade. */
const device = (page: Page, colorScheme: "light" | "dark") => page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Theo thiết bị (the default) follows the device", () => {
  test("light device, dark device, and a device that changes while the app is open", async ({ page }) => {
    await device(page, "light");
    await openApp(page);
    expect(await background(page)).toBe(LIGHT);

    await device(page, "dark");
    await expect.poll(() => background(page)).toBe(DARK);
  });
});

test.describe("choosing a theme", () => {
  test("Tối on a light device survives a reload and is the same in the admin", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await device(page, "light");
    await openApp(page);
    await choose(page, "Tối");
    await expect.poll(() => background(page)).toBe(DARK);

    await page.reload();
    await expect(menuNames(page).first()).toBeVisible();
    expect(await background(page)).toBe(DARK);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Danh mục món", level: 1 })).toBeVisible();
    expect(await background(page)).toBe(DARK);
  });

  test("Sáng on a dark device survives a reload", async ({ page }) => {
    await device(page, "dark");
    await openApp(page);
    await choose(page, "Sáng");
    await expect.poll(() => background(page)).toBe(LIGHT);
    await page.reload();
    await expect(menuNames(page).first()).toBeVisible();
    expect(await background(page)).toBe(LIGHT);
  });

  test("going back to Theo thiết bị follows the device again", async ({ page }) => {
    await device(page, "light");
    await openApp(page);
    await choose(page, "Tối");
    await expect.poll(() => background(page)).toBe(DARK);
    await choose(page, "Theo thiết bị");
    await expect.poll(() => background(page)).toBe(LIGHT);
    await device(page, "dark");
    await expect.poll(() => background(page)).toBe(DARK);
  });

  for (const [where, path] of [
    ["the app", "/"],
    ["the admin", "/admin/login"],
  ] as const) {
    test(`the chosen theme is painted by the page itself, before any script bundle runs (${where})`, async ({ page }) => {
      await device(page, "light");
      await page.addInitScript(() => localStorage.setItem("giao-dien", "dark"));
      // Block every script bundle: only the tiny inline script in the HTML can apply the theme, so if the
      // page is already dark, it was dark at first paint, not after the app started.
      await page.route(/\/_next\/static\/.*\.js/, (route) => route.abort());
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("dark");
      expect(await background(page)).toBe(DARK);
    });
  }

  test("the choice is kept on the device under one key, and 'Theo thiết bị' stores the device-following value", async ({ page }) => {
    await openApp(page);
    const stored = () => page.evaluate(() => localStorage.getItem("giao-dien"));
    await choose(page, "Tối");
    expect(await stored()).toBe("dark");
    await choose(page, "Sáng");
    expect(await stored()).toBe("light");
    await choose(page, "Theo thiết bị");
    expect(await stored()).toBe("system");
  });

  test("the phone's status and address bar follow the choice, then the device again", async ({ page }) => {
    await device(page, "light");
    await openApp(page);
    await choose(page, "Tối");
    await expect.poll(async () => (await barColours(page)).every((m) => m.content === DARK_BAR)).toBe(true);
    await choose(page, "Sáng");
    await expect.poll(async () => (await barColours(page)).every((m) => m.content === LIGHT_BAR)).toBe(true);
    await choose(page, "Theo thiết bị");
    await expect
      .poll(async () => (await barColours(page)).map((m) => `${m.media.includes("dark") ? "dark" : "light"}:${m.content}`).sort())
      .toEqual([`dark:${DARK_BAR}`, `light:${LIGHT_BAR}`]);
  });

  test("the bar colour keeps following the choice after moving to another screen", async ({ page }) => {
    await device(page, "light");
    await openApp(page);
    await choose(page, "Tối");
    await page.getByRole("link", { name: "Món ăn" }).click();
    await expect(page.getByRole("searchbox", { name: "Tìm món" })).toBeVisible();
    expect((await barColours(page)).every((m) => m.content === DARK_BAR)).toBe(true);
  });

  test("the native form controls follow the choice", async ({ page }) => {
    await device(page, "light");
    await openApp(page);
    await choose(page, "Tối");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("dark");
  });
});

test.describe("the control", () => {
  test("shows the current choice and is at least 44px on a phone", async ({ page }) => {
    await openApp(page);
    const box = await switchButton(page).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await expect(switchButton(page).locator("svg.lucide-monitor")).toBeVisible();
    await switchButton(page).click();
    const options = page.getByRole("menuitemradio");
    await expect(options).toHaveText(["Sáng", "Tối", "Theo thiết bị"]);
    await expect(page.getByRole("menuitemradio", { name: "Theo thiết bị" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await choose(page, "Tối");
    await expect(switchButton(page).locator("svg.lucide-moon")).toBeVisible();
    await switchButton(page).click();
    await expect(page.getByRole("menuitemradio", { name: "Tối" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await choose(page, "Sáng");
    await expect(switchButton(page).locator("svg.lucide-sun")).toBeVisible();
  });

  test("works with the keyboard: open, arrows, Enter, Esc, and focus comes back", async ({ page }) => {
    await device(page, "light");
    await openApp(page);
    await switchButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    // Wait until focus is inside the menu (it moves there just after opening), then go to the first option.
    await expect(page.getByRole("menuitemradio").and(page.locator(":focus"))).toHaveCount(1);
    await page.keyboard.press("Home");
    await expect(page.getByRole("menuitemradio", { name: "Sáng" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "Tối" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => background(page)).toBe(DARK);
    await expect(switchButton(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(switchButton(page)).toBeFocused();
  });

  test("is in the app header, the admin top bar and the admin sign-in page", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await openApp(page);
    await expect(switchButton(page)).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Danh mục món", level: 1 })).toBeVisible();
    await expect(switchButton(page)).toBeVisible();

    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: "Đăng nhập", level: 1 })).toBeVisible();
    await expect(switchButton(page)).toBeVisible();
  });

  test("keeps the choice on the device: no request, no change to the saved history and favorites", async ({ page }) => {
    const sent: { method: string; url: string; body: string | null }[] = [];
    page.on("request", (request) => sent.push({ method: request.method(), url: request.url(), body: request.postData() }));
    await openApp(page);
    await flushWrites(page);
    const before = await readPersonal(page);
    const seen = sent.length;

    await choose(page, "Tối");
    await choose(page, "Sáng");
    await choose(page, "Theo thiết bị");
    await flushWrites(page);

    expect(await readPersonal(page)).toEqual(before);
    // Nothing is sent anywhere: no API call, no write, no request that carries the choice
    // (background page prefetches and the menu's own code arriving are not "sending").
    const leaks = sent.slice(seen).filter(
      ({ method, url, body }) => method !== "GET" || body !== null || url.includes("/api/") || /giao-dien|theme/i.test(`${url}${body ?? ""}`),
    );
    expect(leaks).toEqual([]);
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility with the menu open (${colorScheme})`, () => {
    const violations = async (page: Page) =>
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`),
      );

    test.beforeEach(async ({ page }) => {
      await device(page, colorScheme);
    });

    test("the app", async ({ page }) => {
      await openApp(page);
      await switchButton(page).click();
      await expect(page.getByRole("menu")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the admin sign-in page", async ({ page }) => {
      await installFakeAdmin(page);
      await page.goto("/admin/login");
      await expect(page.getByRole("heading", { name: "Đăng nhập", level: 1 })).toBeVisible();
      await switchButton(page).click();
      await expect(page.getByRole("menu")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the admin list", async ({ page }) => {
      await installFakeAdmin(page, { signedIn: true });
      await page.goto("/admin");
      await expect(page.getByRole("table", { name: "Danh mục món" })).toBeVisible();
      await switchButton(page).click();
      await expect(page.getByRole("menu")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}
