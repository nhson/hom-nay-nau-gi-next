import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installFakeAdmin, type FakeAdmin } from "./admin-fake-api";

// The Chờ duyệt tab (spec #30): real pages against the stateful fake admin API (CI has no database or
// AI key). The real API contract is covered by src/server/admin/review.contract.test.ts.

// A real, decodable 8x8 PNG, so the page's photo shrinking runs for real.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4kWKEFTEMLQkAVkZXgTy9n4kAAAAASUVORK5CYII=",
  "base64",
);
const photo = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

const heading = (page: Page, name: string) => page.getByRole("heading", { name, level: 1 });
const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });

async function signedIn(page: Page, initial: Partial<FakeAdmin> = {}) {
  return installFakeAdmin(page, { signedIn: true, ...initial });
}

async function openReview(page: Page) {
  await page.goto("/admin/review");
  await expect(heading(page, "Chờ duyệt")).toBeVisible();
}

async function pickPhotos(page: Page, ...names: string[]) {
  await page.locator("#recipe-photos").setInputFiles(names.map(photo));
}

async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.flatMap((v) =>
    v.nodes.map((n) => {
      const d = n.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string } | undefined;
      return `${v.id}: ${n.target.join(" ")}${d?.contrastRatio ? ` [${d.fgColor} on ${d.bgColor} = ${d.contrastRatio}]` : ""}`;
    }),
  );
}

test("a recipe photo becomes a Món chờ duyệt, is edited, and Duyệt puts it in the Danh mục món", async ({ page }) => {
  const fake = await signedIn(page);
  await openReview(page);
  await expect(page.getByText("Chưa có món nào chờ duyệt")).toBeVisible();

  await pickPhotos(page, "trang-1.png", "trang-2.png");
  await expect(page.getByRole("list", { name: "Ảnh đã chọn" }).getByRole("img")).toHaveCount(2);
  await page.getByRole("button", { name: "Bỏ ảnh 2" }).click();
  await expect(page.getByRole("list", { name: "Ảnh đã chọn" }).getByRole("img")).toHaveCount(1);

  await page.getByRole("button", { name: "Đọc công thức" }).click();
  await expect(heading(page, "Duyệt món")).toBeVisible();
  // The photo was shrunk to a JPEG on the device before it was sent.
  expect(fake.uploads).toHaveLength(1);
  expect(fake.uploads[0]).toHaveLength(1);
  expect(fake.uploads[0][0]).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.getByText(/Ảnh tải lên · .* · google\/gemma-4-31b-it:free/)).toBeVisible();
  await expect(page.getByLabel("Tên món")).toHaveValue("Gà kho gừng");

  // The badge counts what is waiting.
  await expect(page.getByRole("link", { name: /Chờ duyệt\s*:\s*1 món đang chờ/ })).toBeVisible();

  await page.getByLabel("Tên món").fill("Gà kho gừng sả");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(toast(page, "Đã lưu. Món vẫn ở Chờ duyệt.")).toBeVisible();
  expect(fake.pending[0].name).toBe("Gà kho gừng sả");

  await page.getByRole("button", { name: "Duyệt và đăng" }).click();
  await expect(toast(page, /Đã duyệt “Gà kho gừng sả” \(mã m9\)\. Danh mục lên v13\./)).toBeVisible();
  await expect(heading(page, "Chờ duyệt")).toBeVisible();
  await expect(page.getByText("Chưa có món nào chờ duyệt")).toBeVisible();
  expect(fake.dishes.find((d) => d.id === "m9")?.name).toBe("Gà kho gừng sả");
  await expect(page.getByRole("link", { name: /đang chờ/ })).toHaveCount(0);
});

test("shows a duplicate warning and blocks Duyệt on the same name, with the dish form's message", async ({ page }) => {
  await signedIn(page, {
    pending: [
      { id: "p9", source: { kind: "photo", url: null }, model: null, mealType: "buacom", category: "man", chay: false, region: null, name: "Cá kho tộ", time: 30, ingredients: ["Cá"], steps: ["Kho"], createdAt: "2026-11-08T01:00:00.000Z", updatedAt: "2026-11-08T01:00:00.000Z" },
    ],
  });
  await openReview(page);
  await expect(page.getByText("1 cảnh báo")).toBeVisible();
  await page.getByRole("link", { name: /Cá kho tộ/ }).click();
  await expect(heading(page, "Duyệt món")).toBeVisible();
  await expect(page.getByText("Có thể trùng với “Cá kho tộ” (m5) trong Danh mục món.")).toBeVisible();
  await page.getByRole("button", { name: "Duyệt và đăng" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Chưa lưu được" })).toContainText("Tên món bị trùng");
});

test("Bỏ asks first, then removes the Món chờ duyệt", async ({ page }) => {
  const fake = await signedIn(page);
  await openReview(page);
  await pickPhotos(page, "a.png");
  await page.getByRole("button", { name: "Đọc công thức" }).click();
  await expect(heading(page, "Duyệt món")).toBeVisible();
  await page.getByRole("button", { name: "Bỏ", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Bỏ “Gà kho gừng”?" })).toBeVisible();
  await page.getByRole("button", { name: "Bỏ món" }).click();
  await expect(toast(page, "Đã bỏ “Gà kho gừng”.")).toBeVisible();
  await expect(heading(page, "Chờ duyệt")).toBeVisible();
  expect(fake.pending).toHaveLength(0);
  expect(fake.dishes.some((d) => d.name === "Gà kho gừng")).toBe(false);
});

for (const [code, message] of [
  ["not_a_recipe", "Ảnh này không giống một công thức nấu ăn"],
  ["unreadable", "Không đọc được công thức trong ảnh"],
  ["reader_rate_limited", "đã hết lượt cho hôm nay"],
  ["reader_unavailable", "Dịch vụ AI đang bận"],
] as const) {
  test(`explains a failed read (${code}) and keeps the photos to try again`, async ({ page }) => {
    const fake = await signedIn(page, { nextRead: code });
    await openReview(page);
    await pickPhotos(page, "a.png");
    await page.getByRole("button", { name: "Đọc công thức" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(message);
    await expect(page.getByRole("list", { name: "Ảnh đã chọn" }).getByRole("img")).toHaveCount(1);
    expect(fake.pending).toHaveLength(0);
  });
}

test("refuses more than 4 photos and files that are not images, before sending anything", async ({ page }) => {
  const fake = await signedIn(page);
  await openReview(page);
  await pickPhotos(page, "1.png", "2.png", "3.png", "4.png", "5.png");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Chọn tối đa 4 ảnh cho một công thức.");
  await page.locator("#recipe-photos").setInputFiles({ name: "cong-thuc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Tệp “cong-thuc.pdf” không phải ảnh.");
  expect(fake.uploads).toHaveLength(0);
});

test("says photo reading is not set up when there is no OpenRouter key", async ({ page }) => {
  await signedIn(page, { readerConfigured: false });
  await openReview(page);
  await expect(page.getByText(/Chưa bật đọc ảnh công thức/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Chọn ảnh" })).toBeDisabled();
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`Chờ duyệt accessibility (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      // Reduced motion: no entrance animation, so axe reads the final colours.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    });

    test("the list with photos picked, and a failed read", async ({ page }) => {
      await signedIn(page, {
        nextRead: "unreadable",
        pending: [
          { id: "p9", source: { kind: "photo", url: null }, model: null, mealType: "buacom", category: "man", chay: true, region: null, name: "Cá kho tộ", time: 30, ingredients: ["Tỏi"], steps: ["Kho"], createdAt: "2026-11-08T01:00:00.000Z", updatedAt: "2026-11-08T01:00:00.000Z" },
        ],
      });
      await openReview(page);
      await pickPhotos(page, "a.png");
      await page.getByRole("button", { name: "Đọc công thức" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("the review form with warnings, and the Bỏ dialog", async ({ page }) => {
      await signedIn(page, {
        pending: [
          { id: "p9", source: { kind: "photo", url: null }, model: "google/gemma-4-31b-it:free", mealType: "buacom", category: "man", chay: true, region: null, name: "Cá kho tộ", time: 30, ingredients: ["Tỏi"], steps: ["Kho"], createdAt: "2026-11-08T01:00:00.000Z", updatedAt: "2026-11-08T01:00:00.000Z" },
        ],
      });
      await page.goto("/admin/review/p9");
      await expect(heading(page, "Duyệt món")).toBeVisible();
      await expect(page.getByText("Cần xem trước khi Duyệt")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Bỏ", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}
