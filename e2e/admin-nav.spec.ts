import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { installFakeAdmin, type FakeAdmin, type FakeRun } from "./admin-fake-api";

// The admin menu, Tổng quan, Thêm món with its Nhập từ file tab (spec #41, feat-021) and bulk Duyệt: real pages against the
// stateful fake admin API. The real API contract is covered by src/server/admin/import.contract.test.ts.

const heading = (page: Page, name: string) => page.getByRole("heading", { name, level: 1 });
const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const drawer = (page: Page) => page.getByRole("dialog", { name: "Menu quản trị" });
const DESKTOP = { width: 1280, height: 860 };

const signedIn = (page: Page, initial: Partial<FakeAdmin> = {}) => installFakeAdmin(page, { signedIn: true, ...initial });

const LAST_RUN: FakeRun = {
  id: "r0",
  trigger: "cron",
  status: "ok",
  skipped: null,
  stoppedBy: null,
  pagesRead: 5,
  added: 2,
  entries: [],
  startedAt: "2026-11-09T22:00:00.000Z",
  finishedAt: "2026-11-09T22:03:00.000Z",
};

async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
}

const file = (name: string, content: unknown) => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(typeof content === "string" ? content : JSON.stringify(content)),
});

const IMPORT = [
  { name: "Thịt kho tàu", mealType: "Bữa cơm 3 món", category: "Mặn", ingredients: "Thịt ba chỉ\nTrứng vịt", steps: ["Kho"] },
  { name: "Đậu hũ chiên", mealType: "buacom", category: "man", chay: "có", ingredients: ["Đậu hũ", "Tỏi"], steps: ["Chiên"] },
  { name: "Cá kho tộ", category: "man" },
  { name: "Bún chay", mealType: "Bữa 1 món" },
  { mealType: "buacom" },
];

test.describe("the admin menu", () => {
  test("is a sidebar on a desktop, in order, showing the current page and the waiting count", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signedIn(page, { pending: [] });
    await page.goto("/admin");
    await expect(heading(page, "Tổng quan")).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Trang quản trị" });
    await expect(nav.getByRole("link")).toHaveText(["Tổng quan", "Danh mục món", "Chờ duyệt", "Thêm món", "Tác nhân thu thập", "Xuất JSON"]);
    await expect(nav.getByRole("link", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Xuất JSON" })).toHaveAttribute("href", "/api/v1/admin/export");
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();

    await nav.getByRole("link", { name: "Danh mục món" }).click();
    await expect(heading(page, "Danh mục món")).toBeVisible();
    await expect(nav.getByRole("link", { name: "Danh mục món" })).toHaveAttribute("aria-current", "page");
  });

  test("is a drawer on a phone: Escape closes it and focus returns to Menu, and picking a page closes it", async ({ page }) => {
    await signedIn(page);
    await page.goto("/admin");
    await expect(heading(page, "Tổng quan")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Trang quản trị" })).toBeHidden();

    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page).getByRole("link", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
    await expect(menu).toBeFocused();

    await menu.click();
    await drawer(page).getByRole("link", { name: "Thêm món" }).click();
    await expect(heading(page, "Thêm món")).toBeVisible();
    await expect(drawer(page)).toBeHidden();
  });
});

test.describe("Tổng quan", () => {
  test("shows the catalog counts, what waits on Chờ duyệt and the agent's last run", async ({ page }) => {
    await signedIn(page, { runs: [LAST_RUN] });
    await page.goto("/admin");
    const catalog = page.getByRole("region", { name: "Danh mục món" });
    await expect(catalog.getByText("Phiên bản v12")).toBeVisible();
    // The fake catalog: 7 dishes, one hidden (c9); shown: 2 xào, 1 canh, 2 mặn, 1 Bữa 1 món.
    for (const [label, value] of [["Đang dùng", "6"], ["Đã ẩn", "1"], ["Xào / Luộc / Salad", "2"], ["Canh", "1"], ["Món mặn", "2"], ["Bữa 1 món", "1"]]) {
      await expect(catalog.locator("div").filter({ has: page.getByRole("term").getByText(label, { exact: true }) }).getByRole("definition")).toHaveText(value);
    }
    await expect(page.getByRole("region", { name: "Chờ duyệt" })).toContainText("Không có món nào đang chờ.");
    await expect(page.getByRole("region", { name: "Tác nhân thu thập" })).toContainText("Đọc 5 trang · thêm 2 món chờ duyệt");

    await page.getByRole("button", { name: "Chạy ngay" }).click();
    await expect(toast(page, "Tác nhân đã thêm 1 món chờ duyệt.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Chờ duyệt" })).toContainText("1 món đang chờ bạn duyệt.");
    await expect(page.getByRole("region", { name: "Tác nhân thu thập" })).toContainText("Đọc 4 trang · thêm 1 món chờ duyệt");
  });

  test("a block that fails says so without blanking the others", async ({ page }) => {
    await signedIn(page);
    await page.route("**/api/v1/admin/agent/runs", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal_error", message: "x" } }) }),
    );
    await page.goto("/admin");
    await expect(page.getByRole("region", { name: "Tác nhân thu thập" })).toContainText("Không tải được các lần chạy.");
    await expect(page.getByRole("region", { name: "Danh mục món" })).toContainText("Phiên bản v12");
    await expect(page.getByRole("region", { name: "Chờ duyệt" })).toContainText("Không có món nào đang chờ.");
  });
});

test("Thêm món has two tabs in the address, and Tự nhập công thức opens the form", async ({ page }) => {
  await signedIn(page);
  await page.goto("/admin/add");
  await expect(heading(page, "Thêm món")).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Cách thêm món" });
  await expect(tabs.getByRole("link")).toHaveText(["Ảnh thực đơn / Gõ tên", "Nhập từ file"]);
  await expect(tabs.getByRole("link", { name: "Ảnh thực đơn / Gõ tên" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Tải ảnh thực đơn" })).toBeVisible();
  await expect(page.getByLabel("Thêm tên món")).toBeVisible();

  await tabs.getByRole("link", { name: "Nhập từ file" }).click();
  await expect(page).toHaveURL(/\/admin\/add\?cach=file$/);
  await expect(page.getByText("Chọn file JSON", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải file mẫu" })).toBeVisible();
  await expect(page.getByText("Một danh sách món, hoặc")).toBeHidden(); // the field guide starts folded
  await page.getByText("Cách viết file").click();
  await expect(page.getByText("Một danh sách món, hoặc")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Tải ảnh thực đơn" })).toBeVisible();

  await page.getByRole("link", { name: /Tự nhập công thức/ }).click();
  await expect(page).toHaveURL(/\/admin\/dishes\/new$/);
  await expect(page.getByLabel("Tên món", { exact: true })).toBeVisible();
});

test.describe("Nhập từ file", () => {
  test("a file is previewed, added to Chờ duyệt, and bulk Duyệt approves the ready ones and keeps the rest selected", async ({ page }) => {
    const fake = await signedIn(page);
    // The old address still works: it opens the Nhập từ file tab of Thêm món.
    await page.goto("/admin/import");
    await expect(page).toHaveURL(/\/admin\/add\?cach=file$/);
    await page.locator("#dish-file").setInputFiles(file("mon-moi.json", { version: 3, dishes: IMPORT }));

    const preview = page.getByRole("region", { name: "Xem trước: mon-moi.json" });
    await expect(preview).toBeVisible();
    for (const [label, value] of [["Sẽ thêm", "3"], ["Bỏ qua", "2"], ["Có cảnh báo", "2"]]) {
      await expect(preview.locator("div").filter({ has: page.getByRole("term").getByText(label, { exact: true }) }).getByRole("definition")).toHaveText(value);
    }
    await expect(preview).toContainText("#3 Cá kho tộ · Bỏ qua vì trùng tên");
    await expect(preview).toContainText("#5 Không có tên món");
    await expect(preview).toContainText("Thiếu Nguyên liệu.");
    await expect(preview).toContainText("Món chay có nhắc “tỏi”");
    expect(fake.pending).toHaveLength(0);

    await page.getByRole("button", { name: "Thêm 3 món vào Chờ duyệt" }).click();
    await expect(toast(page, "Đã thêm 3 món vào Chờ duyệt, bỏ qua 2.")).toBeVisible();
    await expect(heading(page, "Chờ duyệt")).toBeVisible();
    await expect(page.getByRole("link", { name: /Thịt kho tàu/ })).toContainText("Nhập từ file · mon-moi.json");

    await page.getByText("Chọn tất cả").click();
    await page.getByRole("button", { name: "Duyệt các món đã chọn (3)" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "Đã duyệt" });
    await expect(summary).toContainText("Đã duyệt 1 món. 2 món chưa duyệt được:");
    await expect(summary).toContainText("Đậu hũ chiên: Nguyên liệu 2 có “tỏi”");
    await expect(summary).toContainText("Bún chay: Cần ít nhất một nguyên liệu.");
    expect(fake.dishes.find((dish) => dish.name === "Thịt kho tàu")?.id).toBe("m9");

    await expect(page.getByRole("heading", { name: "Món đang chờ (2)" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Chọn Đậu hũ chiên" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Chọn Bún chay" })).toBeChecked();
    await expect(page.getByRole("link", { name: /Bún chay/ })).toContainText("Chưa duyệt được: Cần ít nhất một nguyên liệu.");
  });

  test("refuses a file that is not JSON, and Tải file mẫu gives a file it accepts", async ({ page }) => {
    const fake = await signedIn(page);
    await page.goto("/admin/add?cach=file");
    await page.locator("#dish-file").setInputFiles(file("hong.json", "{ dishes: ["));
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("File này không phải JSON hợp lệ.");
    await expect(page.getByRole("button", { name: /vào Chờ duyệt/ })).toHaveCount(0);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Tải file mẫu" }).click();
    const template = await download;
    expect(template.suggestedFilename()).toBe("mau-nhap-mon.json");
    const text = await readFile(await template.path(), "utf8");
    await page.locator("#dish-file").setInputFiles(file("mau-nhap-mon.json", text));
    await expect(page.getByRole("region", { name: "Xem trước: mau-nhap-mon.json" })).toContainText("Phở bò · Bỏ qua vì trùng tên");
    expect(fake.pending).toHaveLength(0);
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`admin pages accessibility (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    });

    test("Tổng quan and the open drawer", async ({ page }) => {
      await signedIn(page, { runs: [LAST_RUN] });
      await page.goto("/admin");
      await expect(page.getByRole("region", { name: "Tác nhân thu thập" })).toContainText("Đọc 5 trang");
      expect(await axeViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Menu" }).click();
      await expect(drawer(page)).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("Thêm món and the agent page", async ({ page }) => {
      await signedIn(page);
      await page.goto("/admin/add");
      await expect(heading(page, "Thêm món")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
      await page.goto("/admin/agent");
      await expect(page.getByText(/Chưa chạy lần nào/)).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("Nhập từ file with a preview, and Chờ duyệt after a bulk Duyệt", async ({ page }) => {
      await signedIn(page);
      await page.goto("/admin/add?cach=file");
      await page.locator("#dish-file").setInputFiles(file("mon-moi.json", IMPORT));
      await expect(page.getByRole("region", { name: "Xem trước: mon-moi.json" })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
      await page.getByRole("button", { name: "Thêm 3 món vào Chờ duyệt" }).click();
      await expect(heading(page, "Chờ duyệt")).toBeVisible();
      await page.getByText("Chọn tất cả").click();
      await page.getByRole("button", { name: "Duyệt các món đã chọn (3)" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Đã duyệt" })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("the desktop sidebar", async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await signedIn(page);
      await page.goto("/admin/review");
      await expect(heading(page, "Chờ duyệt")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}
