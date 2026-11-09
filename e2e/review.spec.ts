import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installFakeAdmin, type FakeAdmin } from "./admin-fake-api";

// The Chờ duyệt tab (spec #30, Ảnh thực đơn #36): real pages against the stateful fake admin API (CI has no database or
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
  await page.locator("#menu-photos").setInputFiles(names.map(photo));
}

const names = (page: Page) => page.getByRole("list", { name: /Món muốn tạo/ });
const nameRow = (page: Page, index: number) => names(page).getByRole("listitem").nth(index);
const progress = (page: Page) => page.getByRole("list", { name: "Tiến độ" });

async function addName(page: Page, name: string) {
  await page.getByLabel("Thêm tên món").fill(name);
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(names(page).getByRole("textbox").last()).toHaveValue(name);
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

test("a menu photo becomes a checklist, the ticked names are written one by one, and Duyệt puts one in the Danh mục món", async ({ page }) => {
  const fake = await signedIn(page);
  await openReview(page);
  await expect(page.getByText("Chưa có món nào chờ duyệt")).toBeVisible();

  await pickPhotos(page, "trang-1.png", "trang-2.png");
  await expect(page.getByRole("list", { name: "Ảnh đã chọn" }).getByRole("img")).toHaveCount(2);
  await page.getByRole("button", { name: "Bỏ ảnh 2" }).click();
  await expect(page.getByRole("list", { name: "Ảnh đã chọn" }).getByRole("img")).toHaveCount(1);

  await page.getByRole("button", { name: "Đọc thực đơn" }).click();
  await expect(page.getByText("Đã đọc 3 tên món.")).toBeVisible();
  // The photo was shrunk to a JPEG on the device before it was sent; reading stores nothing.
  expect(fake.uploads).toHaveLength(1);
  expect(fake.uploads[0]).toHaveLength(1);
  expect(fake.uploads[0][0]).toMatch(/^data:image\/jpeg;base64,/);
  expect(fake.pending).toHaveLength(0);

  // A name the catalog has starts unticked and says which dish.
  await expect(page.getByRole("checkbox", { name: "Chọn “Canh chua cá lóc”" })).not.toBeChecked();
  await expect(nameRow(page, 0)).toContainText("đã có (c3)");
  await expect(page.getByRole("checkbox", { name: "Chọn “Bò lúc lắc”" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Chọn “Gà kho gừng”" })).toBeChecked();

  // Editing a name re-checks it: "Cá kho tộ" is in the catalog, so it unticks.
  await page.getByLabel("Tên món 3").fill("Cá kho tộ");
  await page.getByLabel("Tên món 3").blur();
  await expect(page.getByRole("checkbox", { name: "Chọn “Cá kho tộ”" })).not.toBeChecked();
  await expect(nameRow(page, 2)).toContainText("đã có (m5)");

  // A typed name joins the list; a hidden dish's name says so.
  await addName(page, "Canh bí đỏ nấu tôm");
  await expect(nameRow(page, 3)).toContainText("đã có (c9, đã ẩn)");
  await addName(page, "Bún riêu cua");
  await expect(page.getByRole("checkbox", { name: "Chọn “Bún riêu cua”" })).toBeChecked();
  await page.getByRole("button", { name: "Bỏ “Canh bí đỏ nấu tôm” khỏi danh sách" }).click();

  await page.getByRole("button", { name: "Tạo món (2)" }).click();
  await expect(progress(page).getByRole("link", { name: "Xong" })).toHaveCount(2);
  await expect(toast(page, "Đã tạo 2 món chờ duyệt.")).toBeVisible();
  expect(fake.written).toEqual(["Bò lúc lắc", "Bún riêu cua"]);
  await expect(page.getByRole("link", { name: /Chờ duyệt\s*:\s*2 món đang chờ/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Món đang chờ (2)" })).toBeVisible();

  await page.getByRole("link", { name: /Bò lúc lắc.*Ảnh thực đơn/ }).click();
  await expect(heading(page, "Duyệt món")).toBeVisible();
  await expect(page.getByText(/Ảnh thực đơn · .* · google\/gemma-4-31b-it:free/)).toBeVisible();
  await expect(page.getByText("AI tự viết công thức, hãy kiểm tra")).toBeVisible();
  await expect(page.getByLabel("Tên món")).toHaveValue("Bò lúc lắc");

  await page.getByRole("button", { name: "Duyệt và đăng" }).click();
  await expect(toast(page, /Đã duyệt “Bò lúc lắc” \(mã m9\)\. Danh mục lên v13\./)).toBeVisible();
  await expect(heading(page, "Chờ duyệt")).toBeVisible();
  expect(fake.dishes.find((d) => d.id === "m9")?.name).toBe("Bò lúc lắc");
  await expect(page.getByRole("heading", { name: "Món đang chờ (1)" })).toBeVisible();
});

test("names can be typed without any photo", async ({ page }) => {
  const fake = await signedIn(page);
  await openReview(page);
  await addName(page, "Thịt kho trứng");
  await page.getByRole("button", { name: "Tạo món (1)" }).click();
  await expect(progress(page).getByRole("link", { name: "Xong" })).toHaveCount(1);
  expect(fake.uploads).toHaveLength(0);
  expect(fake.pending.map((item) => item.name)).toEqual(["Thịt kho trứng"]);
});

test("at most 8 names are ticked at once", async ({ page }) => {
  await signedIn(page);
  await openReview(page);
  for (let i = 1; i <= 9; i++) await addName(page, `Món thử ${i}`);
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(8);
  await expect(page.getByRole("checkbox", { name: "Chọn “Món thử 9”" })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Chọn “Món thử 9”" }).click();
  await expect(page.getByText("Mỗi lần chỉ tạo tối đa 8 món.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Chọn “Món thử 9”" })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Tạo món (8)" })).toBeEnabled();
});

test("when the free limit runs out mid-batch, written dishes stay and the rest can be retried", async ({ page }) => {
  const fake = await signedIn(page, { writeAnswers: [null, "unusable_answer", "reader_rate_limited"] });
  await openReview(page);
  for (const name of ["Món A", "Món B", "Món C", "Món D"]) await addName(page, name);
  await page.getByRole("button", { name: "Tạo món (4)" }).click();

  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("đã hết lượt cho hôm nay");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Đã tạo 1 món");
  await expect(progress(page).getByRole("listitem")).toHaveText([/Món A\s*Xong/, /Món B\s*Lỗi/, /Món C\s*Chưa tạo/, /Món D\s*Chưa tạo/]);
  // D was never sent: the batch stopped at the limit.
  expect(fake.written).toEqual(["Món A", "Món B", "Món C"]);
  expect(fake.pending.map((item) => item.name)).toEqual(["Món A"]);

  await page.getByRole("button", { name: "Thử lại các món chưa tạo (3)" }).click();
  const boxes = names(page).getByRole("textbox");
  await expect(boxes).toHaveCount(3);
  for (const [index, name] of ["Món B", "Món C", "Món D"].entries()) await expect(boxes.nth(index)).toHaveValue(name);
  await expect(page.getByRole("button", { name: "Tạo món (3)" })).toBeEnabled();
});

test("shows a duplicate warning and blocks Duyệt on the same name, with the dish form's message", async ({ page }) => {
  await signedIn(page, {
    pending: [
      { id: "p9", source: { kind: "photo", url: null }, model: null, mealType: "buacom", category: "man", chay: false, region: null, name: "Cá kho tộ", time: 30, ingredients: ["Cá"], steps: ["Kho"], createdAt: "2026-11-08T01:00:00.000Z", updatedAt: "2026-11-08T01:00:00.000Z" },
    ],
  });
  await openReview(page);
  await expect(page.getByText("1 cảnh báo")).toBeVisible();
  await expect(page.getByText(/Ảnh công thức ·/)).toBeVisible();
  await page.getByRole("link", { name: /Cá kho tộ/ }).click();
  await expect(heading(page, "Duyệt món")).toBeVisible();
  await expect(page.getByText("Có thể trùng với “Cá kho tộ” (m5) trong Danh mục món.")).toBeVisible();
  await page.getByRole("button", { name: "Duyệt và đăng" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Chưa lưu được" })).toContainText("Tên món bị trùng");
});

test("Bỏ asks first, then removes the Món chờ duyệt", async ({ page }) => {
  const fake = await signedIn(page);
  await openReview(page);
  await addName(page, "Gà kho gừng");
  await page.getByRole("button", { name: "Tạo món (1)" }).click();
  await progress(page).getByRole("link", { name: "Xong" }).click();
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
  ["unreadable", "Không đọc được thực đơn trong ảnh"],
  ["no_dishes", "Không tìm thấy tên món nào trong ảnh"],
  ["reader_rate_limited", "đã hết lượt cho hôm nay"],
  ["reader_unavailable", "Dịch vụ AI đang bận"],
] as const) {
  test(`explains a failed menu read (${code}) and keeps the photos to try again`, async ({ page }) => {
    const fake = await signedIn(page, { nextRead: code });
    await openReview(page);
    await pickPhotos(page, "a.png");
    await page.getByRole("button", { name: "Đọc thực đơn" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText(message);
    await expect(page.getByRole("list", { name: "Ảnh đã chọn" }).getByRole("img")).toHaveCount(1);
    expect(fake.pending).toHaveLength(0);
  });
}

test("refuses more than 4 photos and files that are not images, before sending anything", async ({ page }) => {
  const fake = await signedIn(page);
  await openReview(page);
  await pickPhotos(page, "1.png", "2.png", "3.png", "4.png", "5.png");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Chọn tối đa 4 ảnh cho một thực đơn.");
  await page.locator("#menu-photos").setInputFiles({ name: "thuc-don.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Tệp “thuc-don.pdf” không phải ảnh.");
  expect(fake.uploads).toHaveLength(0);
});

test("says the AI is not set up when there is no OpenRouter key", async ({ page }) => {
  await signedIn(page, { readerConfigured: false });
  await openReview(page);
  await expect(page.getByText(/Chưa bật AI/)).toBeVisible();
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
      await page.getByRole("button", { name: "Đọc thực đơn" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("the checklist with hints, the limit message and the progress list", async ({ page }) => {
      await signedIn(page, { writeAnswers: [null, "reader_rate_limited"] });
      await openReview(page);
      await pickPhotos(page, "a.png");
      await page.getByRole("button", { name: "Đọc thực đơn" }).click();
      await expect(nameRow(page, 0)).toContainText("đã có (c3)");
      expect(await axeViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Tạo món (2)" }).click();
      await expect(progress(page).getByRole("listitem").last()).toContainText("Chưa tạo");
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
