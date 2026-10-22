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

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Theo thiết bị (the default) follows the device", () => {
  test("light device, dark device, and a device that changes while the app is open", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await openApp(page);
    expect(await background(page)).toBe(LIGHT);

    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await expect.poll(() => background(page)).toBe(DARK);
  });
});

test.describe("choosing a theme", () => {
  test("Tối on a light device survives a reload and is the same in the admin", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
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
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await openApp(page);
    await choose(page, "Sáng");
    await expect.poll(() => background(page)).toBe(LIGHT);
    await page.reload();
    await expect(menuNames(page).first()).toBeVisible();
    expect(await background(page)).toBe(LIGHT);
  });

  test("going back to Theo thiết bị follows the device again", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await openApp(page);
    await choose(page, "Tối");
    await expect.poll(() => background(page)).toBe(DARK);
    await choose(page, "Theo thiết bị");
    await expect.poll(() => background(page)).toBe(LIGHT);
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await expect.poll(() => background(page)).toBe(DARK);
  });

  test("the chosen theme is already there at the first paint, so there is no flash", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.addInitScript(() => {
      localStorage.setItem("giao-dien", "dark");
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { __first: string | null }).__first = document.documentElement.getAttribute("data-theme");
      });
    });
    await page.goto("/");
    await expect(menuNames(page).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __first: string | null }).__first)).toBe("dark");
  });

  test("the phone's status and address bar follow the choice, then the device again", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
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

  test("the native form controls follow the choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
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

    await switchButton(page).click();
    const options = page.getByRole("menuitemradio");
    await expect(options).toHaveText(["Sáng", "Tối", "Theo thiết bị"]);
    await expect(page.getByRole("menuitemradio", { name: "Theo thiết bị" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await choose(page, "Tối");
    await switchButton(page).click();
    await expect(page.getByRole("menuitemradio", { name: "Tối" })).toHaveAttribute("aria-checked", "true");
  });

  test("works with the keyboard: open, arrows, Enter, Esc, and focus comes back", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await openApp(page);
    await switchButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter"); // the second option: Tối
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
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await openApp(page);
    await flushWrites(page);
    const before = await readPersonal(page);
    const seen = requests.length;

    await choose(page, "Tối");
    await choose(page, "Sáng");
    await choose(page, "Theo thiết bị");
    await flushWrites(page);

    expect(await readPersonal(page)).toEqual(before);
    expect(requests.slice(seen).filter((url) => url.includes("/api/") || /theme|giao/i.test(url))).toEqual([]);
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility with the menu open (${colorScheme})`, () => {
    const violations = async (page: Page) =>
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`),
      );

    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
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
