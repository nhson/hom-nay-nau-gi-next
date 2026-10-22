import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/server/testing/db";
import { apiErrorSchema } from "@/shared/schemas";
import { createAdminKit, PASSPHRASE } from "./admin-test-kit";

// The admin API contract: real handlers -> Zod -> Drizzle -> real migrations on in-memory Postgres.

let ctx: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  ctx = await createTestDb();
});
beforeEach(async () => {
  await ctx.reset();
});
afterAll(async () => {
  await ctx.close();
});

const kit = () => createAdminKit(() => ctx.db);
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

async function errorOf(response: Response) {
  return apiErrorSchema.parse(await response.json()).error;
}

describe("signing in", () => {
  it("accepts the password and sets a 7-day, httpOnly, same-site session cookie", async () => {
    const { handlers, request } = kit();
    const response = await handlers.login(request("/session", { method: "POST", body: { passphrase: PASSPHRASE } }));
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^admin_session=/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses a wrong password with a message that reveals nothing else", async () => {
    const { handlers, request } = kit();
    const response = await handlers.login(request("/session", { method: "POST", body: { passphrase: "nope" } }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await errorOf(response)).toMatchObject({ code: "invalid_credentials" });
  });

  it("is unavailable, not open, when the admin has not been configured", async () => {
    const { handlers, request } = createAdminKit(() => ctx.db, null);
    const response = await handlers.login(request("/session", { method: "POST", body: { passphrase: PASSPHRASE } }));
    expect(response.status).toBe(503);
    expect(await errorOf(response)).toMatchObject({ code: "admin_unavailable" });
    expect((await handlers.session(request("/session"))).status).toBe(503);
  });

  it("rejects a malformed body", async () => {
    const { handlers, request } = kit();
    const response = await handlers.login(request("/session", { method: "POST", body: { passphrase: 42 } }));
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toMatchObject({ code: "bad_request" });
  });
});

describe("locking after repeated failures", () => {
  const wrong = (k: ReturnType<typeof kit>, ip = "10.0.0.1") =>
    k.handlers.login(k.request("/session", { method: "POST", body: { passphrase: "nope" }, ip }));

  it("locks for 15 minutes after 5 wrong passwords in a row, and says until when", async () => {
    const k = kit();
    for (let i = 0; i < 4; i++) expect((await wrong(k)).status).toBe(401);
    const fifth = await wrong(k);
    expect(fifth.status).toBe(429);
    const sixth = await wrong(k);
    expect(sixth.status).toBe(429);
    const body = apiErrorSchema.parse(await sixth.json());
    expect(body.error.code).toBe("locked");
    expect(body.error.lockedUntil).toBe(new Date(k.now().getTime() + 15 * MINUTE).toISOString());
    expect(sixth.headers.get("retry-after")).toBe("900");
  });

  it("refuses even the right password while locked", async () => {
    const k = kit();
    for (let i = 0; i < 5; i++) await wrong(k);
    k.advance(14 * MINUTE);
    const response = await k.handlers.login(k.request("/session", { method: "POST", body: { passphrase: PASSPHRASE }, ip: "10.0.0.1" }));
    expect(response.status).toBe(429);
  });

  it("lets the right password in once the 15 minutes have passed", async () => {
    const k = kit();
    for (let i = 0; i < 5; i++) await wrong(k);
    k.advance(15 * MINUTE + 1000);
    const response = await k.handlers.login(k.request("/session", { method: "POST", body: { passphrase: PASSPHRASE }, ip: "10.0.0.1" }));
    expect(response.status).toBe(200);
  });

  it("forgets earlier failures after a successful sign-in", async () => {
    const k = kit();
    for (let i = 0; i < 4; i++) await wrong(k);
    await k.signIn();
    for (let i = 0; i < 4; i++) expect((await wrong(k)).status).toBe(401);
  });

  it("counts each client separately, so a stranger cannot lock the owner out", async () => {
    const k = kit();
    for (let i = 0; i < 5; i++) await wrong(k, "203.0.113.9");
    expect((await wrong(k, "203.0.113.9")).status).toBe(429);
    const owner = await k.handlers.login(k.request("/session", { method: "POST", body: { passphrase: PASSPHRASE }, ip: "198.51.100.7" }));
    expect(owner.status).toBe(200);
  });
});

describe("the session", () => {
  it("reports signed in with a valid cookie", async () => {
    const k = kit();
    const cookie = await k.signIn();
    expect((await k.handlers.session(k.request("/session", { cookie }))).status).toBe(200);
  });

  it.each([
    ["no cookie", () => undefined],
    ["a garbage cookie", () => "admin_session=abc"],
    ["a tampered cookie", () => "admin_session=v1.9999999999.AAAA"],
  ])("answers 401 with %s", async (_name, cookieOf) => {
    const k = kit();
    const response = await k.handlers.session(k.request("/session", { cookie: cookieOf() }));
    expect(response.status).toBe(401);
    expect(await errorOf(response)).toMatchObject({ code: "unauthorized" });
  });

  it("answers 401 once 7 days have passed", async () => {
    const k = kit();
    const cookie = await k.signIn();
    k.advance(7 * DAY - MINUTE);
    expect((await k.handlers.session(k.request("/session", { cookie }))).status).toBe(200);
    k.advance(2 * MINUTE);
    expect((await k.handlers.session(k.request("/session", { cookie }))).status).toBe(401);
  });

  it("rejects a cookie signed with a different secret", async () => {
    const other = createAdminKit(() => ctx.db, { passphrase: PASSPHRASE, sessionSecret: "z".repeat(48) });
    const foreign = await other.signIn();
    const k = kit();
    expect((await k.handlers.session(k.request("/session", { cookie: foreign }))).status).toBe(401);
  });

  it("signing out clears the cookie", async () => {
    const k = kit();
    const cookie = await k.signIn();
    const response = await k.handlers.logout(k.request("/session", { method: "DELETE", cookie }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/admin_session=;.*Max-Age=0/);
  });

  it.each([
    ["no Origin header", { origin: null }],
    ["another site's Origin", { origin: "https://evil.example" }],
  ])("refuses a write with %s", async (_name, init) => {
    const k = kit();
    const response = await k.handlers.login(k.request("/session", { method: "POST", body: { passphrase: PASSPHRASE }, ...init }));
    expect(response.status).toBe(403);
    expect(await errorOf(response)).toMatchObject({ code: "forbidden_origin" });
  });

  it("refuses a write that is not JSON", async () => {
    const k = kit();
    const response = await k.handlers.login(k.request("/session", { method: "POST", body: { passphrase: PASSPHRASE }, contentType: "text/plain" }));
    expect(response.status).toBe(415);
  });
});

// ---------------------------------------------------------------------------------------------
// Managing the Danh mục món
// ---------------------------------------------------------------------------------------------

import { bowl, dish } from "@/domain/testing";
import { applySeed } from "@/server/catalog/repository";
import { createCatalogHandlers } from "@/server/catalog/handlers";
import { adminCatalogResponseSchema, catalogResponseSchema } from "@/shared/schemas";

const FIXTURE = [
  dish({ id: "x1", name: "Rau muống xào", category: "xao" }),
  dish({ id: "x2", name: "Cải ngọt xào", category: "xao" }),
  dish({ id: "c1", name: "Canh chua cá lóc", category: "canh" }),
  dish({ id: "m1", name: "Cá kho tộ", category: "man" }),
  bowl({ id: "t1", name: "Phở bò" }),
];

const draft = (overrides: Record<string, unknown> = {}) => ({
  mealType: "buacom",
  category: "xao",
  chay: false,
  region: null,
  name: "Bắp cải xào",
  time: 12,
  ingredients: ["Bắp cải"],
  steps: ["Xào lửa lớn"],
  ...overrides,
});

async function seeded() {
  await applySeed(ctx.db, FIXTURE);
  const k = kit();
  return { k, cookie: await k.signIn() };
}

const publicCatalog = async (ifNoneMatch?: string) => {
  const response = await createCatalogHandlers(() => ctx.db).GET(
    new Request("http://localhost/api/v1/catalog", { headers: ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {} }),
  );
  return response;
};
const publicBody = async () => catalogResponseSchema.parse(await (await publicCatalog()).json());

describe("every admin route needs a session", () => {
  it.each([
    ["list", (k: ReturnType<typeof kit>) => k.handlers.listDishes(k.request("/dishes"))],
    ["create", (k: ReturnType<typeof kit>) => k.handlers.createDish(k.request("/dishes", { method: "POST", body: draft() }))],
    ["update", (k: ReturnType<typeof kit>) => k.handlers.updateDish(k.request("/dishes/x1", { method: "PUT", body: draft() }), "x1")],
    ["hide", (k: ReturnType<typeof kit>) => k.handlers.setHidden(k.request("/dishes/x1", { method: "PATCH", body: { retired: true } }), "x1")],
    ["export", (k: ReturnType<typeof kit>) => k.handlers.exportCatalog(k.request("/export"))],
  ])("%s answers 401 without one and changes nothing", async (_name, call) => {
    await applySeed(ctx.db, FIXTURE);
    const response = await call(kit());
    expect(response.status).toBe(401);
    expect((await publicBody()).version).toBe(1);
    expect((await publicBody()).dishes).toHaveLength(FIXTURE.length);
  });

  it("refuses a write from another site even with a valid session", async () => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.createDish(k.request("/dishes", { method: "POST", body: draft(), cookie, origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect((await publicBody()).dishes).toHaveLength(FIXTURE.length);
  });
});

describe("listing", () => {
  it("returns every dish, hidden ones included and flagged, with the catalog version", async () => {
    const { k, cookie } = await seeded();
    await k.handlers.setHidden(k.request("/dishes/m1", { method: "PATCH", body: { retired: true }, cookie }), "m1");
    const response = await k.handlers.listDishes(k.request("/dishes", { cookie }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = catalogResponseSchema.parse(await response.json());
    expect(body.version).toBe(2);
    expect(body.dishes.map((d) => d.id)).toEqual(["x1", "x2", "c1", "m1", "t1"]);
    expect(body.dishes.find((d) => d.id === "m1")?.retired).toBe(true);
  });

  it("says when each dish was last changed, and only the dish that changed moves", async () => {
    const { k, cookie } = await seeded();
    const list = async () => adminCatalogResponseSchema.parse(await (await k.handlers.listDishes(k.request("/dishes", { cookie }))).json());
    const before = await list();
    for (const dish of before.dishes) expect(Number.isNaN(Date.parse(dish.updatedAt))).toBe(false);

    await k.handlers.updateDish(k.request("/dishes/x1", { method: "PUT", cookie, body: draft({ name: "Rau muống xào", time: 99 }) }), "x1");
    const after = await list();
    const stamp = (body: typeof before, id: string) => body.dishes.find((d) => d.id === id)?.updatedAt;
    expect(stamp(after, "x1")).not.toBe(stamp(before, "x1"));
    expect(stamp(after, "x2")).toBe(stamp(before, "x2"));
  });

  it("keeps the public catalog free of that admin-only field", async () => {
    const { k, cookie } = await seeded();
    await k.handlers.listDishes(k.request("/dishes", { cookie }));
    const dishes = (await (await publicCatalog()).json()).dishes as Record<string, unknown>[];
    expect(dishes.every((d) => !("updatedAt" in d))).toBe(true);
  });

  it("is a typed 503 while the catalog has never been published", async () => {
    const k = kit();
    const cookie = await k.signIn();
    expect((await k.handlers.listDishes(k.request("/dishes", { cookie }))).status).toBe(503);
  });
});

describe("adding a dish", () => {
  it("creates it with the next free id, at the end, and publishes a new catalog version", async () => {
    const { k, cookie } = await seeded();
    const before = (await publicCatalog()).headers.get("etag");

    const response = await k.handlers.createDish(k.request("/dishes", { method: "POST", body: draft(), cookie }));
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.version).toBe(2);
    expect(created.dish).toMatchObject({ id: "x3", name: "Bắp cải xào", retired: false, ingredients: ["Bắp cải"] });

    const catalog = await publicCatalog();
    expect(catalog.headers.get("etag")).not.toBe(before);
    const body = catalogResponseSchema.parse(await catalog.json());
    expect(body.version).toBe(2);
    expect(body.dishes.at(-1)?.id).toBe("x3");
    expect(body.dishes).toHaveLength(FIXTURE.length + 1);
  });

  it("gives a device that holds the old version a fresh 200, not a 304", async () => {
    const { k, cookie } = await seeded();
    const oldTag = (await publicCatalog()).headers.get("etag") ?? "";
    expect((await publicCatalog(oldTag)).status).toBe(304);
    await k.handlers.createDish(k.request("/dishes", { method: "POST", body: draft(), cookie }));
    expect((await publicCatalog(oldTag)).status).toBe(200);
  });

  it.each([
    [{ mealType: "buacom", category: "canh" }, "c2"],
    [{ mealType: "buacom", category: "man" }, "m2"],
    [{ mealType: "buatomonuoc", category: null }, "t2"],
  ])("numbers a %j dish %s", async (overrides, id) => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.createDish(k.request("/dishes", { method: "POST", body: draft({ name: "Món mới", ...overrides }), cookie }));
    expect((await response.json()).dish.id).toBe(id);
  });

  it("stores the name trimmed and drops blank ingredient and step lines", async () => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.createDish(
      k.request("/dishes", { method: "POST", body: draft({ name: "  Su su luộc ", ingredients: [" Su su ", "", "  "], steps: ["Luộc", " "] }), cookie }),
    );
    expect((await response.json()).dish).toMatchObject({ name: "Su su luộc", ingredients: ["Su su"], steps: ["Luộc"] });
  });

  it("refuses a name that exists, ignoring case and accents, hidden dishes included", async () => {
    const { k, cookie } = await seeded();
    await k.handlers.setHidden(k.request("/dishes/m1", { method: "PATCH", body: { retired: true }, cookie }), "m1");
    const response = await k.handlers.createDish(k.request("/dishes", { method: "POST", body: draft({ name: "CA KHO TO", category: "man" }), cookie }));
    expect(response.status).toBe(422);
    const error = await errorOf(response);
    expect(error.code).toBe("validation_failed");
    expect(error.issues).toEqual([{ code: "name-duplicate", field: "name" }]);
    expect((await publicBody()).version).toBe(2); // only the hide changed the catalog
  });

  it("refuses a Chay dish that mentions tỏi and says exactly where", async () => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.createDish(
      k.request("/dishes", { method: "POST", cookie, body: draft({ chay: true, ingredients: ["Nấm", "Tỏi băm"], steps: ["Thái nấm", "Phi tỏi"] }) }),
    );
    expect(response.status).toBe(422);
    expect((await errorOf(response)).issues).toEqual([
      { code: "chay-toi", field: "ingredients", index: 1 },
      { code: "chay-toi", field: "steps", index: 1 },
    ]);
    expect((await publicBody()).dishes).toHaveLength(FIXTURE.length);
    expect((await publicBody()).version).toBe(1);
  });

  it("accepts tối (evening) and non-Chay tỏi", async () => {
    const { k, cookie } = await seeded();
    const a = await k.handlers.createDish(k.request("/dishes", { method: "POST", cookie, body: draft({ name: "Món bữa tối", chay: true, steps: ["Cho bữa tối"] }) }));
    const b = await k.handlers.createDish(k.request("/dishes", { method: "POST", cookie, body: draft({ name: "Rau xào tỏi", chay: false, ingredients: ["Tỏi"] }) }));
    expect([a.status, b.status]).toEqual([201, 201]);
  });

  it("refuses a Bữa 1 món that has a Nhóm món and a Bữa cơm 3 món that has none", async () => {
    const { k, cookie } = await seeded();
    const a = await k.handlers.createDish(k.request("/dishes", { method: "POST", cookie, body: draft({ mealType: "buatomonuoc", category: "canh" }) }));
    const b = await k.handlers.createDish(k.request("/dishes", { method: "POST", cookie, body: draft({ category: null }) }));
    expect((await errorOf(a)).issues).toEqual([{ code: "category-not-allowed", field: "category" }]);
    expect((await errorOf(b)).issues).toEqual([{ code: "category-required", field: "category" }]);
  });

  it.each([
    ["a missing field", { name: undefined }],
    ["a wrong type", { time: "ten" }],
    ["an unknown Kiểu bữa ăn", { mealType: "buatrua" }],
  ])("answers 400 for %s", async (_name, overrides) => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.createDish(k.request("/dishes", { method: "POST", cookie, body: draft(overrides) }));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("bad_request");
  });

  it("publishes nothing when the catalog was never seeded", async () => {
    const k = kit();
    const cookie = await k.signIn();
    const response = await k.handlers.createDish(k.request("/dishes", { method: "POST", body: draft(), cookie }));
    expect(response.status).toBe(503);
    const rows = await ctx.db.execute(sql`select count(*)::int as n from dishes`);
    const n = (Array.isArray(rows) ? rows : rows.rows)[0] as { n: number };
    expect(n.n).toBe(0);
  });
});

describe("editing a dish", () => {
  it("replaces its content, keeps its id and place, and publishes a new version", async () => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.updateDish(
      k.request("/dishes/c1", { method: "PUT", cookie, body: draft({ mealType: "buacom", category: "canh", name: "Canh chua cá bông lau", chay: false, region: "nam", time: 35, ingredients: ["Cá bông lau", "Dứa"], steps: ["Nấu nước me"] }) }),
      "c1",
    );
    expect(response.status).toBe(200);
    expect((await response.json()).version).toBe(2);
    const body = await publicBody();
    expect(body.dishes.map((d) => d.id)).toEqual(["x1", "x2", "c1", "m1", "t1"]);
    expect(body.dishes.find((d) => d.id === "c1")).toMatchObject({
      name: "Canh chua cá bông lau", region: "nam", time: 35, ingredients: ["Cá bông lau", "Dứa"], steps: ["Nấu nước me"], retired: false,
    });
  });

  it("lets a dish keep its own name", async () => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.updateDish(k.request("/dishes/x1", { method: "PUT", cookie, body: draft({ name: "Rau muống xào", time: 20 }) }), "x1");
    expect(response.status).toBe(200);
  });

  it("refuses another dish's name and a Chay dish with tỏi, changing nothing", async () => {
    const { k, cookie } = await seeded();
    const a = await k.handlers.updateDish(k.request("/dishes/x1", { method: "PUT", cookie, body: draft({ name: "cải ngọt xào" }) }), "x1");
    const b = await k.handlers.updateDish(k.request("/dishes/x1", { method: "PUT", cookie, body: draft({ name: "Rau muống xào", chay: true, ingredients: ["Tỏi"] }) }), "x1");
    expect([a.status, b.status]).toEqual([422, 422]);
    expect((await publicBody()).version).toBe(1);
  });

  it("does not change whether the dish is hidden", async () => {
    const { k, cookie } = await seeded();
    await k.handlers.setHidden(k.request("/dishes/m1", { method: "PATCH", body: { retired: true }, cookie }), "m1");
    await k.handlers.updateDish(k.request("/dishes/m1", { method: "PUT", cookie, body: draft({ category: "man", name: "Cá kho tộ ngon" }) }), "m1");
    expect((await publicBody()).dishes.find((d) => d.id === "m1")?.retired).toBe(true);
  });

  it("answers 404 for an unknown dish and publishes nothing", async () => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.updateDish(k.request("/dishes/zz9", { method: "PUT", cookie, body: draft() }), "zz9");
    expect(response.status).toBe(404);
    expect((await publicBody()).version).toBe(1);
  });
});

describe("hiding and showing a dish", () => {
  const hide = (k: ReturnType<typeof kit>, cookie: string, id: string, retired: boolean) =>
    k.handlers.setHidden(k.request(`/dishes/${id}`, { method: "PATCH", body: { retired }, cookie }), id);

  it("hides a dish (it stays in the catalog, flagged) and shows it again, each a new version", async () => {
    const { k, cookie } = await seeded();
    const hidden = await hide(k, cookie, "x2", true);
    expect(hidden.status).toBe(200);
    expect((await hidden.json()).dish).toMatchObject({ id: "x2", retired: true });
    let body = await publicBody();
    expect(body.version).toBe(2);
    expect(body.dishes.find((d) => d.id === "x2")).toMatchObject({ retired: true, name: "Cải ngọt xào" });

    const shown = await hide(k, cookie, "x2", false);
    expect((await shown.json()).dish.retired).toBe(false);
    body = await publicBody();
    expect(body.version).toBe(3);
    expect(body.dishes.find((d) => d.id === "x2")?.retired).toBe(false);
  });

  it("is a no-op, with no new version, when the dish is already in that state", async () => {
    const { k, cookie } = await seeded();
    const response = await hide(k, cookie, "x2", false);
    expect(response.status).toBe(200);
    expect((await response.json()).version).toBe(1);
    expect((await publicBody()).version).toBe(1);
  });

  it("answers 404 for an unknown dish", async () => {
    const { k, cookie } = await seeded();
    expect((await hide(k, cookie, "zz9", true)).status).toBe(404);
  });

  it("rejects a body without a boolean", async () => {
    const { k, cookie } = await seeded();
    const response = await k.handlers.setHidden(k.request("/dishes/x1", { method: "PATCH", body: { retired: "yes" }, cookie }), "x1");
    expect(response.status).toBe(400);
  });
});

describe("exporting the catalog", () => {
  it("downloads every dish, hidden included, as a dated JSON file", async () => {
    const { k, cookie } = await seeded();
    await k.handlers.setHidden(k.request("/dishes/t1", { method: "PATCH", body: { retired: true }, cookie }), "t1");
    const response = await k.handlers.exportCatalog(k.request("/export", { cookie }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="danh-muc-mon-2026-10-22.json"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = catalogResponseSchema.parse(await response.json());
    expect(body.dishes).toHaveLength(FIXTURE.length);
    expect(body.dishes.find((d) => d.id === "t1")?.retired).toBe(true);
  });
});
