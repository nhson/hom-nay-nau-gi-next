import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { GOOD_PASSWORD, installFakeAdmin } from "./admin-fake-api";

// The admin pages are real; the admin API is a stateful fake (CI has no database). The contract of the
// real API is covered by src/server/admin/admin.contract.test.ts.

const heading = (page: Page, name: string) => page.getByRole("heading", { name, level: 1 });
const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });

async function openList(page: Page) {
  await page.goto("/admin");
  await expect(heading(page, "Danh mục món")).toBeVisible();
  await expect(page.getByRole("table", { name: "Danh mục món" })).toBeVisible();
}

async function openEdit(page: Page, name: RegExp) {
  await openList(page);
  await page.getByRole("link", { name }).click();
  await expect(heading(page, "Sửa món")).toBeVisible();
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

test.describe("signing in", () => {
  test("an admin page sends a signed-out visitor to sign-in, and a wrong password says only that", async ({ page }) => {
    await installFakeAdmin(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("sai");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Mật khẩu không đúng.");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("shows when sign-in opens again after a lock", async ({ page }) => {
    await installFakeAdmin(page);
    await page.goto("/admin/login");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("khoa");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Tạm khoá 15 phút");
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Thử lại sau");
  });

  test("the right password lands on the list, and sign-out returns to sign-in", async ({ page }) => {
    await installFakeAdmin(page);
    await page.goto("/admin/login?next=/admin");
    await page.getByLabel("Mật khẩu", { exact: true }).fill(GOOD_PASSWORD);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(heading(page, "Danh mục món")).toBeVisible();
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("never sends the person anywhere outside the admin after signing in", async ({ page }) => {
    await installFakeAdmin(page);
    await page.goto("/admin/login?next=https://evil.example/");
    await page.getByLabel("Mật khẩu", { exact: true }).fill(GOOD_PASSWORD);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("is not available, and says so, when the admin is not configured", async ({ page }) => {
    await page.route("**/api/v1/admin/session", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "admin_unavailable", message: "x" } }) }),
    );
    await page.goto("/admin");
    await expect(page.getByText("Trang quản trị chưa được bật")).toBeVisible();
  });
});

test.describe("the dish list", () => {
  test("counts dishes, searches without accents and filters", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await openList(page);
    await expect(page.getByText("Tổng số món")).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(8); // header + 7 dishes

    await page.getByRole("searchbox", { name: "Tìm món" }).fill("ca kho");
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("row").filter({ hasText: "Cá kho tộ" })).toBeVisible();

    await page.getByRole("searchbox", { name: "Tìm món" }).fill("");
    await page.getByRole("button", { name: "Chay", exact: true }).click();
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.getByRole("button", { name: "Chay", exact: true }).click();
    await page.getByRole("button", { name: "Đã ẩn", exact: true }).click();
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("row").filter({ hasText: "Canh bí đỏ nấu tôm" })).toBeVisible();
  });

  test("says when nothing matches and clears the filters", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await openList(page);
    await page.getByRole("searchbox", { name: "Tìm món" }).fill("zzzz");
    await expect(page.getByText("Không có món nào khớp")).toBeVisible();
    await page.getByRole("button", { name: "Xoá bộ lọc" }).click();
    await expect(page.getByRole("row")).toHaveCount(8);
  });

  test("hiding asks first, keeps focus where it was, and showing again needs no question", async ({ page }) => {
    const fake = await installFakeAdmin(page, { signedIn: true });
    await openList(page);
    const hide = page.getByRole("button", { name: /^Ẩn Canh chua cá lóc/ });
    await hide.click();
    const dialog = page.getByRole("dialog", { name: /Ẩn “Canh chua cá lóc”\?/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Lịch sử và yêu thích trên máy mọi người vẫn hiện đúng tên món.");

    // Keep it: nothing changes and focus returns to the button that opened the dialog.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(hide).toBeFocused();
    expect(fake.dishes.find((d) => d.id === "c3")?.retired).toBe(false);

    await hide.click();
    await page.getByRole("button", { name: "Ẩn món" }).click();
    await expect(toast(page, "Đã ẩn “Canh chua cá lóc”. Danh mục lên v13.")).toBeVisible();
    expect(fake.dishes.find((d) => d.id === "c3")?.retired).toBe(true);
    // Focus stays on that row's button (now "Hiện lại"), never dropped to the page.
    const show = page.getByRole("button", { name: /^Hiện lại Canh chua cá lóc/ });
    await expect(show).toBeFocused();

    await show.click();
    await expect(toast(page, "Đã hiện lại “Canh chua cá lóc”. Danh mục lên v14.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Ẩn Canh chua cá lóc/ })).toBeFocused();
    expect(fake.dishes.find((d) => d.id === "c3")?.retired).toBe(false);
  });
});

test.describe("adding and editing", () => {
  test("edits a dish, publishes, and returns to the list with focus on its heading", async ({ page }) => {
    const fake = await installFakeAdmin(page, { signedIn: true });
    await openEdit(page, /^Sửa Cá kho tộ/);
    await expect(page.getByLabel("Tên món", { exact: true })).toHaveValue("Cá kho tộ");
    await page.getByLabel("Thời gian nấu (phút)", { exact: true }).fill("50");
    await page.getByRole("button", { name: "Lưu và đăng" }).click();

    await expect(heading(page, "Danh mục món")).toBeFocused();
    await expect(toast(page, "Đã lưu và đăng. Danh mục lên v13.")).toBeVisible();
    expect(fake.dishes.find((d) => d.id === "m5")?.time).toBe(50);
  });

  test("adds a dish with a Nhóm món, ingredients and steps", async ({ page }) => {
    const fake = await installFakeAdmin(page, { signedIn: true });
    await openList(page);
    await page.getByRole("link", { name: "Thêm món" }).click();
    await expect(heading(page, "Thêm món")).toBeVisible();

    await page.getByLabel("Tên món", { exact: true }).fill("Canh bắp cải thịt bằm");
    await page.getByLabel("Nhóm món", { exact: true }).selectOption("canh");
    await page.getByLabel("Nguyên liệu 1", { exact: true }).fill("Bắp cải 300g");
    await page.getByRole("button", { name: "Thêm nguyên liệu" }).click();
    await page.getByLabel("Nguyên liệu 2", { exact: true }).fill("Thịt bằm 100g");
    await page.getByLabel("Bước 1", { exact: true }).fill("Nấu nước sôi");
    await page.getByRole("button", { name: "Lưu và đăng" }).click();

    await expect(toast(page, "Đã lưu và đăng. Danh mục lên v13.")).toBeVisible();
    expect(fake.dishes.at(-1)).toMatchObject({ id: "c10", name: "Canh bắp cải thịt bằm", category: "canh", ingredients: ["Bắp cải 300g", "Thịt bằm 100g"] });
  });

  test("Bữa 1 món has no Nhóm món", async ({ page }) => {
    const fake = await installFakeAdmin(page, { signedIn: true });
    await page.goto("/admin/dishes/new");
    await page.getByLabel("Tên món", { exact: true }).fill("Bún bò Huế");
    await page.getByRole("button", { name: "Bữa 1 món", exact: true }).click();
    await expect(page.getByLabel("Nhóm món", { exact: true })).toBeDisabled();
    await page.getByLabel("Nguyên liệu 1", { exact: true }).fill("Bún");
    await page.getByRole("button", { name: "Lưu và đăng" }).click();
    await expect(toast(page, "Đã lưu và đăng.")).toBeVisible();
    expect(fake.dishes.at(-1)).toMatchObject({ id: "t3", mealType: "buatomonuoc", category: null });
  });

  test("moves and removes steps", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await openEdit(page, /^Sửa Cá kho tộ/);
    await expect(page.getByLabel("Bước 1", { exact: true })).toHaveValue("Ướp cá");
    await page.getByRole("button", { name: "Chuyển bước 1 xuống" }).click();
    await expect(page.getByLabel("Bước 1", { exact: true })).toHaveValue("Kho lửa nhỏ");
    await page.getByRole("button", { name: "Xoá bước 1" }).click();
    await expect(page.getByLabel("Bước 1", { exact: true })).toHaveValue("Ướp cá");
    await expect(page.getByLabel("Bước 2", { exact: true })).toHaveCount(0);
  });

  test("a Chay dish with tỏi is flagged as you type, explained on submit, and fixed through the summary link", async ({ page }) => {
    const fake = await installFakeAdmin(page, { signedIn: true });
    await openEdit(page, /^Sửa Đậu hũ sốt cà chua/);
    await page.getByLabel("Nguyên liệu 2", { exact: true }).fill("Tỏi băm 2 tép");
    // Inline while typing, no submit needed; Save stays clickable.
    await expect(page.locator("#ing-1-e")).toContainText("Nguyên liệu 2 có “tỏi”");
    await expect(page.getByRole("button", { name: "Lưu và đăng" })).toBeEnabled();

    await page.getByRole("button", { name: "Lưu và đăng" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "Chưa lưu được" });
    await expect(summary).toBeFocused();
    await summary.getByRole("link", { name: /Nguyên liệu 2 có “tỏi”/ }).click();
    await expect(page.getByLabel("Nguyên liệu 2", { exact: true })).toBeFocused();
    expect(fake.dishes.find((d) => d.id === "m8")?.ingredients).not.toContain("Tỏi băm 2 tép");

    await page.getByLabel("Nguyên liệu 2", { exact: true }).fill("Hành boa-rô");
    await expect(summary).toBeHidden();
    await page.getByRole("button", { name: "Lưu và đăng" }).click();
    await expect(toast(page, "Đã lưu và đăng.")).toBeVisible();
  });

  test("tối (evening) is not tỏi", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await openEdit(page, /^Sửa Đậu hũ sốt cà chua/);
    await page.getByLabel("Bước 1", { exact: true }).fill("Món cho bữa tối");
    await expect(page.locator("#step-0-e")).toHaveCount(0);
  });

  test("a missing name waits for a submit attempt, then the summary names it", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await page.goto("/admin/dishes/new");
    await expect(page.locator("#f-name-e")).toHaveCount(0);
    await page.getByRole("button", { name: "Lưu và đăng" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "Chưa lưu được" });
    await expect(summary).toContainText("Nhập tên món.");
    await expect(summary).toContainText("Cần ít nhất một nguyên liệu.");
    await summary.getByRole("link", { name: "Nhập tên món." }).click();
    await expect(page.getByLabel("Tên món", { exact: true })).toBeFocused();
  });

  test("refuses a name that already exists, ignoring case and accents", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await page.goto("/admin/dishes/new");
    await page.getByLabel("Tên món", { exact: true }).fill("CA KHO TO");
    await expect(page.locator("#f-name-e")).toContainText("Tên món bị trùng");
  });

  test("previews the dish as users will see it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await installFakeAdmin(page, { signedIn: true });
    await openEdit(page, /^Sửa Cá kho tộ/);
    const preview = page.getByRole("complementary", { name: "Xem trước" });
    await expect(preview).toContainText("Cá kho tộ");
    await page.getByLabel("Tên món", { exact: true }).fill("Cá kho tộ đậm đà");
    await expect(preview).toContainText("Cá kho tộ đậm đà");
    await page.getByLabel("Nguyên liệu 1", { exact: true }).fill("Cá basa 600g");
    await expect(preview).toContainText("Cá basa 600g");
  });
});

test.describe("saving can go wrong", () => {
  test("a network failure keeps what was typed and Thử lại saves it", async ({ page }) => {
    const fake = await installFakeAdmin(page, { signedIn: true, nextSave: "network" });
    await openEdit(page, /^Sửa Cá kho tộ/);
    await page.getByLabel("Tên món", { exact: true }).fill("Cá kho tộ ngon");
    await page.getByRole("button", { name: "Lưu và đăng" }).click();

    const failure = page.getByRole("alert").filter({ hasText: "Không lưu được" });
    await expect(failure).toBeFocused();
    await expect(page.getByLabel("Tên món", { exact: true })).toHaveValue("Cá kho tộ ngon");
    await expect(page.getByRole("button", { name: "Lưu và đăng" })).toBeEnabled();

    await failure.getByRole("button", { name: "Thử lại" }).click();
    await expect(toast(page, "Đã lưu và đăng. Danh mục lên v13.")).toBeVisible();
    expect(fake.dishes.find((d) => d.id === "m5")?.name).toBe("Cá kho tộ ngon");
  });

  test("a session that expires mid-edit goes to sign-in and comes back to the same form with the input", async ({ page }) => {
    const fake = await installFakeAdmin(page, { signedIn: true, nextSave: "expired" });
    await openEdit(page, /^Sửa Cá kho tộ/);
    await page.getByLabel("Tên món", { exact: true }).fill("Cá kho tộ đã gõ dở");
    await page.getByRole("button", { name: "Lưu và đăng" }).click();

    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fdishes%2Fm5/);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(GOOD_PASSWORD);
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(heading(page, "Sửa món")).toBeVisible();
    await expect(page.getByLabel("Tên món", { exact: true })).toHaveValue("Cá kho tộ đã gõ dở");
    await page.getByRole("button", { name: "Lưu và đăng" }).click();
    await expect(toast(page, "Đã lưu và đăng.")).toBeVisible();
    expect(fake.dishes.find((d) => d.id === "m5")?.name).toBe("Cá kho tộ đã gõ dở");
  });

  test("a rule the server enforces is shown in the summary too", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true, nextSave: "tỏi" });
    await openEdit(page, /^Sửa Cá kho tộ/);
    await page.getByLabel("Thời gian nấu (phút)", { exact: true }).fill("40");
    await page.getByRole("button", { name: "Lưu và đăng" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Chưa lưu được" })).toContainText("Tên món bị trùng");
  });
});

test.describe("leaving a form", () => {
  test("asks before dropping edits, and not when nothing changed", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await openEdit(page, /^Sửa Cá kho tộ/);
    await page.getByRole("button", { name: "Danh sách" }).click();
    await expect(heading(page, "Danh mục món")).toBeVisible(); // untouched: no prompt

    await page.getByRole("link", { name: /^Sửa Cá kho tộ/ }).click();
    await page.getByLabel("Tên món", { exact: true }).fill("Đã đổi");
    await page.getByRole("button", { name: "Huỷ" }).click();
    const dialog = page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Ở lại sửa" }).click();
    await expect(page.getByLabel("Tên món", { exact: true })).toHaveValue("Đã đổi");

    await page.getByRole("button", { name: "Huỷ" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bỏ thay đổi" }).click();
    await expect(heading(page, "Danh mục món")).toBeVisible();
  });
});

test.describe("on a phone", () => {
  // The default project is a Pixel 7: the list becomes cards but stays a table for assistive technology.
  test("keeps table semantics and 44px touch targets", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await openList(page);
    await expect(page.getByRole("columnheader")).toHaveCount(7);
    await expect(page.getByRole("row")).toHaveCount(8);

    const small = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href], input:not([type=checkbox]), select, textarea")]
        .filter((el) => (el as HTMLElement).offsetParent !== null && !el.closest(".sr-only") && getComputedStyle(el).position !== "fixed")
        .map((el) => ({ name: (el.getAttribute("aria-label") || el.textContent || el.id).trim().slice(0, 24), h: Math.round(el.getBoundingClientRect().height) }))
        .filter((x) => x.h < 44),
    );
    expect(small).toEqual([]);
  });

  test("the form fits and its controls are all at least 44px", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await openEdit(page, /^Sửa Cá kho tộ/);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href], input:not([type=checkbox]), select, textarea")]
        .filter((el) => (el as HTMLElement).offsetParent !== null && !el.closest(".sr-only"))
        .map((el) => ({ name: (el.getAttribute("aria-label") || el.textContent || el.id).trim().slice(0, 24), h: Math.round(el.getBoundingClientRect().height) }))
        .filter((x) => x.h < 44),
    );
    expect(small).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("privacy and isolation", () => {
  test("admin pages are not indexed, not cached, and carry none of the user app's chrome", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    const response = await page.goto("/admin");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    expect(response?.headers()["cache-control"]).toBe("no-store");
    await expect(heading(page, "Danh mục món")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("navigation", { name: "Chính" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Yêu thích" })).toHaveCount(0);
  });

  test("nothing links to the admin from the user app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Chính" })).toBeVisible();
    expect(await page.locator('a[href^="/admin"]').count()).toBe(0);
  });

  test("the service worker never caches an admin page", async ({ page }) => {
    await installFakeAdmin(page, { signedIn: true });
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await openList(page);
    await page.getByRole("link", { name: "Thêm món" }).click();
    await expect(heading(page, "Thêm món")).toBeVisible();
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
      return urls.filter((url) => url.includes("/admin"));
    });
    expect(cached).toEqual([]);
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      // Reduced motion: no entrance animation, so axe reads the final colours.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    });

    test("sign-in", async ({ page }) => {
      await installFakeAdmin(page);
      await page.goto("/admin/login");
      await expect(heading(page, "Đăng nhập")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("list, and the hide dialog", async ({ page }) => {
      await installFakeAdmin(page, { signedIn: true });
      await openList(page);
      expect(await axeViolations(page)).toEqual([]);
      await page.getByRole("button", { name: /^Ẩn Cá kho tộ/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("edit form, and after a failed submit", async ({ page }) => {
      await installFakeAdmin(page, { signedIn: true });
      await openEdit(page, /^Sửa Đậu hũ sốt cà chua/);
      expect(await axeViolations(page)).toEqual([]);
      await page.getByLabel("Nguyên liệu 2", { exact: true }).fill("Tỏi băm");
      await page.getByRole("button", { name: "Lưu và đăng" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Chưa lưu được" })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}

// The desktop layout is a different arrangement (table, preview column): check it too.
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility on a desktop (${colorScheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    });

    test("list and edit form", async ({ page }) => {
      await installFakeAdmin(page, { signedIn: true });
      await openList(page);
      expect(await axeViolations(page)).toEqual([]);
      await page.getByRole("link", { name: /^Sửa Đậu hũ sốt cà chua/ }).click();
      await expect(heading(page, "Sửa món")).toBeVisible();
      await expect(page.getByRole("complementary", { name: "Xem trước" })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}
