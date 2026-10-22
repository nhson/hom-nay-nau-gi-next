import type { Page, Route } from "@playwright/test";

/** The right password for the fake; "khoa" makes the fake answer as if 5 wrong tries had locked sign-in. */
export const GOOD_PASSWORD = "mat-khau-dung";

interface FakeDish {
  id: string;
  mealType: "buacom" | "buatomonuoc";
  category: "xao" | "canh" | "man" | null;
  chay: boolean;
  region: "bac" | "trung" | "nam" | null;
  name: string;
  time: number | null;
  ingredients: string[];
  steps: string[];
  retired: boolean;
  updatedAt: string;
}

const stamp = (day: number) => `2026-10-${String(day).padStart(2, "0")}T03:00:00.000Z`;

export function seedDishes(): FakeDish[] {
  return [
    { id: "x1", mealType: "buacom", category: "xao", chay: false, region: "nam", name: "Rau muống xào tỏi", time: 15, ingredients: ["Rau muống 300g", "Tỏi 4 tép"], steps: ["Nhặt rau", "Phi tỏi", "Xào lửa lớn"], retired: false, updatedAt: stamp(12) },
    { id: "x12", mealType: "buacom", category: "xao", chay: true, region: null, name: "Nấm đùi gà xào bơ hành boa-rô", time: 12, ingredients: ["Nấm đùi gà 300g", "Hành boa-rô 2 cây", "Bơ thực vật"], steps: ["Thái nấm", "Phi hành boa-rô", "Xào nấm"], retired: false, updatedAt: stamp(18) },
    { id: "c3", mealType: "buacom", category: "canh", chay: false, region: "nam", name: "Canh chua cá lóc", time: 30, ingredients: ["Cá lóc 400g", "Cà chua 2 quả"], steps: ["Sơ chế cá", "Nấu nước me"], retired: false, updatedAt: stamp(2) },
    { id: "c9", mealType: "buacom", category: "canh", chay: false, region: null, name: "Canh bí đỏ nấu tôm", time: 20, ingredients: ["Bí đỏ 300g", "Tôm 150g"], steps: ["Nấu nước sôi"], retired: true, updatedAt: stamp(1) },
    { id: "m5", mealType: "buacom", category: "man", chay: false, region: "nam", name: "Cá kho tộ", time: 45, ingredients: ["Cá basa 500g", "Nước màu"], steps: ["Ướp cá", "Kho lửa nhỏ"], retired: false, updatedAt: stamp(9) },
    { id: "m8", mealType: "buacom", category: "man", chay: true, region: "bac", name: "Đậu hũ sốt cà chua", time: 20, ingredients: ["Đậu hũ 3 miếng", "Cà chua 3 quả"], steps: ["Chiên đậu hũ", "Rim cà chua"], retired: false, updatedAt: stamp(15) },
    { id: "t2", mealType: "buatomonuoc", category: null, chay: false, region: "bac", name: "Phở bò", time: 60, ingredients: ["Bánh phở", "Thịt bò"], steps: ["Ninh xương"], retired: false, updatedAt: stamp(1) },
  ];
}

/** What the real server stores: a trimmed name and no blank ingredient or step lines. */
function clean<T extends { name: string; ingredients: string[]; steps: string[] }>(draft: T): T {
  const keep = (lines: string[]) => lines.map((line) => line.trim()).filter(Boolean);
  return { ...draft, name: draft.name.trim(), ingredients: keep(draft.ingredients), steps: keep(draft.steps) };
}

export interface FakeAdmin {
  signedIn: boolean;
  version: number;
  dishes: FakeDish[];
  /** What the next save (PUT or POST) does instead of succeeding. One shot. */
  nextSave: "network" | "expired" | "tỏi" | null;
  requests: string[];
}

/**
 * A stateful stand-in for the admin API (CI has no database): the real pages talk to it through
 * request interception, so the page, its validation and its states are exercised for real.
 */
export async function installFakeAdmin(page: Page, initial: Partial<FakeAdmin> = {}): Promise<FakeAdmin> {
  const fake: FakeAdmin = { signedIn: false, version: 12, dishes: seedDishes(), nextSave: null, requests: [], ...initial };
  const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const error = (route: Route, status: number, code: string, message = code, extra: object = {}) =>
    json(route, status, { error: { code, message, ...extra } });

  // On the context, not the page: requests that pass through the service worker are only seen there.
  await page.context().route("**/api/v1/admin/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1/admin", "");
    const method = request.method();
    fake.requests.push(`${method} ${path}`);

    if (path === "/session") {
      if (method === "GET") return fake.signedIn ? json(route, 200, { ok: true }) : error(route, 401, "unauthorized");
      if (method === "DELETE") {
        fake.signedIn = false;
        return json(route, 200, { ok: true });
      }
      const { passphrase } = request.postDataJSON() as { passphrase: string };
      if (passphrase === "khoa") return error(route, 429, "locked", "locked", { lockedUntil: "2026-10-22T08:15:00.000Z" });
      if (passphrase !== GOOD_PASSWORD) return error(route, 401, "invalid_credentials");
      fake.signedIn = true;
      return json(route, 200, { ok: true });
    }

    if (!fake.signedIn) return error(route, 401, "unauthorized");
    if (path === "/dishes" && method === "GET") return json(route, 200, { version: fake.version, dishes: fake.dishes });

    const saving = method === "POST" || method === "PUT";
    if (path.startsWith("/dishes") && saving && fake.nextSave) {
      const mode = fake.nextSave;
      fake.nextSave = null;
      if (mode === "network") return route.abort("failed");
      if (mode === "expired") {
        fake.signedIn = false;
        return error(route, 401, "unauthorized");
      }
      return error(route, 422, "validation_failed", "invalid", { issues: [{ code: "name-duplicate", field: "name" }] });
    }

    const id = decodeURIComponent(path.split("/")[2] ?? "");
    if (path === "/dishes" && method === "POST") {
      const draft = clean(request.postDataJSON() as Omit<FakeDish, "id" | "retired" | "updatedAt">);
      const prefix = draft.mealType === "buatomonuoc" ? "t" : draft.category === "canh" ? "c" : draft.category === "man" ? "m" : "x";
      const next = Math.max(0, ...fake.dishes.filter((d) => d.id.startsWith(prefix)).map((d) => Number(d.id.slice(1)))) + 1;
      const dish = { ...draft, id: `${prefix}${next}`, retired: false, updatedAt: new Date().toISOString() };
      fake.dishes.push(dish);
      fake.version += 1;
      return json(route, 201, { version: fake.version, dish });
    }
    const index = fake.dishes.findIndex((d) => d.id === id);
    if (index < 0) return error(route, 404, "not_found");
    if (method === "PUT") {
      fake.dishes[index] = { ...fake.dishes[index], ...clean(request.postDataJSON() as Omit<FakeDish, "id" | "retired" | "updatedAt">), updatedAt: new Date().toISOString() };
      fake.version += 1;
      return json(route, 200, { version: fake.version, dish: fake.dishes[index] });
    }
    if (method === "PATCH") {
      fake.dishes[index] = { ...fake.dishes[index], retired: (request.postDataJSON() as { retired: boolean }).retired, updatedAt: new Date().toISOString() };
      fake.version += 1;
      return json(route, 200, { version: fake.version, dish: fake.dishes[index] });
    }
    return error(route, 405, "method_not_allowed");
  });

  return fake;
}
