import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { menuNames } from "./helpers";

/** One readable line per violation, with the colours when it is a contrast problem. */
type Violations = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"];

function describe(violations: Violations): string[] {
  return violations.flatMap((violation) =>
    violation.nodes.map((node) => {
      const data = node.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string } | undefined;
      const colors = data?.contrastRatio ? ` [${data.fgColor} on ${data.bgColor} = ${data.contrastRatio}]` : "";
      return `${violation.id}: ${node.target.join(" ")}${colors}`;
    }),
  );
}

const PAGES = [
  { path: "/", ready: (page: import("@playwright/test").Page) => menuNames(page).first() },
  { path: "/dishes", ready: (page: import("@playwright/test").Page) => page.getByText(/^73 món$/) },
  { path: "/favorites", ready: (page: import("@playwright/test").Page) => page.getByText("Chưa có thực đơn yêu thích") },
];

for (const colorScheme of ["light", "dark"] as const) {
  for (const { path, ready } of PAGES) {
    test(`no accessibility violations on ${path} (${colorScheme})`, async ({ page }) => {
      // Reduced motion: no entrance animation, so axe reads the final colours, not a mid-fade blend.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(path);
      await expect(ready(page)).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(describe(results.violations)).toEqual([]);
    });
  }
}

test("the recipe view is accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dishes");
  await page.getByRole("button", { name: "Xem công thức Cá kho tộ" }).click();
  await expect(page.getByRole("dialog", { name: "Cá kho tộ" })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(describe(results.violations)).toEqual([]);
});

test("dialogs are accessible and keyboard operable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dishes");
  await expect(page.getByText(/^73 món$/)).toBeVisible();
  await page.getByRole("button", { name: "Thêm món mới" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm món mới" });
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(describe(results.violations)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
