import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { flushWrites, menuNames, readPersonal } from "./helpers";

// Chromium with an iPhone user agent: the hint keys off the user agent and `navigator.standalone`,
// not the rendering engine.
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const hint = (page: Page) => page.getByRole("region", { name: "Cài app lên màn hình chính" });

async function openToday(page: Page) {
  await page.goto("/");
  await expect(menuNames(page).first()).toBeVisible();
}

test.describe("on an iPhone browser tab", () => {
  test.use({ userAgent: IPHONE_UA });

  test("explains how to install, and stays gone once dismissed", async ({ page }) => {
    await openToday(page);
    await expect(hint(page)).toBeVisible();

    // Collapsed by default so the menu stays on the first screen.
    await expect(page.getByText("Thêm vào MH chính")).toBeHidden();
    await hint(page).getByRole("button", { name: "Xem cách" }).click();
    await expect(page.getByText("Thêm vào MH chính")).toBeVisible();
    await expect(page.getByText("Không thấy mục này? Cuộn xuống, hoặc mở trang bằng Safari.")).toBeVisible();

    await hint(page).getByRole("button", { name: "Đã hiểu" }).click();
    await expect(hint(page)).toBeHidden();

    await flushWrites(page);
    await page.reload();
    await expect(menuNames(page).first()).toBeVisible();
    await expect(hint(page)).toBeHidden();
    expect((await readPersonal(page)).installHintDismissed).toBe(true);
  });

  test("the close button dismisses it for good as well", async ({ page }) => {
    await openToday(page);
    await hint(page).getByRole("button", { name: "Ẩn gợi ý, không hiện lại" }).click();
    await expect(hint(page)).toBeHidden();
    await flushWrites(page);
    await page.reload();
    await expect(menuNames(page).first()).toBeVisible();
    await expect(hint(page)).toBeHidden();
    expect((await readPersonal(page)).installHintDismissed).toBe(true);
  });

  test("is not shown once the app runs from the Home Screen (iOS flag)", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
    await openToday(page);
    await expect(hint(page)).toBeHidden();
  });

  test("is not shown in standalone display mode (media query)", async ({ page }) => {
    // Playwright cannot emulate display-mode, so answer that one query the way an installed app would.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query === "(display-mode: standalone)"
          ? ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
          : real(query);
    });
    await openToday(page);
    await expect(hint(page)).toBeHidden();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`is accessible when expanded (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await openToday(page);
      await hint(page).getByRole("button", { name: "Xem cách" }).click();
      await expect(page.getByText("Thêm vào MH chính")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
    });
  }
});

// The phone project is a Pixel 7: an Android Chrome user agent.
test("Android browsers never see it", async ({ page }) => {
  await openToday(page);
  await expect(hint(page)).toBeHidden();
});
