import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dish } from "@/domain";
import { dish as fixture } from "@/domain/testing";
import { SEED_DISHES } from "@/seed/dishes";
import { dishes as dishesTable } from "@/server/db/schema";
import { createTestDb, errorText } from "@/server/testing/db";
import { createHealthHandlers } from "@/server/health/handlers";
import { apiErrorSchema, catalogResponseSchema, healthResponseSchema } from "@/shared/schemas";
import { createCatalogHandlers } from "./handlers";
import { applySeed, readCatalog, seedEmptyCatalog } from "./repository";

// The catalog API contract: real handlers -> Zod -> Drizzle -> real migrations on in-memory
// Postgres (PGlite). No network, no shared state.

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

const catalog = () => createCatalogHandlers(() => ctx.db);
const request = (headers?: HeadersInit, method = "GET") =>
  new Request("http://localhost/api/v1/catalog", { method, headers });

describe("GET /api/v1/catalog", () => {
  it("is a typed 503 before the catalog has ever been seeded", async () => {
    const response = await catalog().GET(request());
    expect(response.status).toBe(503);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe("catalog_unavailable");
  });

  it("returns the whole seeded catalog in seed order, valid against the shared schema", async () => {
    await applySeed(ctx.db, SEED_DISHES);
    const response = await catalog().GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = catalogResponseSchema.parse(await response.json());
    expect(body.version).toBe(1);
    expect(body.dishes.map((d) => d.id)).toEqual(SEED_DISHES.map((d) => d.id));
    expect(body.dishes.every((d) => d.retired === false)).toBe(true);
    expect(body.dishes.find((d) => d.id === "x1")).toMatchObject({
      name: "Rau muống xào hành boa-rô",
      chay: true,
      time: 10,
    });
  });

  it("sends an ETag and CDN-friendly cache headers", async () => {
    await applySeed(ctx.db, SEED_DISHES);
    const response = await catalog().GET(request());
    expect(response.headers.get("etag")).toBe('"catalog-v1"');
    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("s-maxage=");
    expect(cacheControl).toContain("stale-while-revalidate=");
  });

  it.each([
    ['"catalog-v1"'],
    ['W/"catalog-v1"'],
    ['"other", "catalog-v1"'],
    ["*"],
  ])("answers 304 with no body when If-None-Match is %s", async (header) => {
    await applySeed(ctx.db, SEED_DISHES);
    const response = await catalog().GET(request({ "If-None-Match": header }));
    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("etag")).toBe('"catalog-v1"');
  });

  it("answers 200 when the client's ETag is out of date", async () => {
    await applySeed(ctx.db, SEED_DISHES);
    const response = await catalog().GET(request({ "If-None-Match": '"catalog-v0"' }));
    expect(response.status).toBe(200);
  });

  it("includes retired dishes, flagged, so history and favorites keep resolving", async () => {
    await applySeed(ctx.db, SEED_DISHES);
    await applySeed(ctx.db, SEED_DISHES.filter((d) => d.id !== "x1"));
    const body = catalogResponseSchema.parse(await (await catalog().GET(request())).json());
    expect(body.dishes).toHaveLength(SEED_DISHES.length);
    expect(body.dishes.find((d) => d.id === "x1")?.retired).toBe(true);
    expect(body.dishes.find((d) => d.id === "x2")?.retired).toBe(false);
  });
});

describe("catalog versioning (applySeed)", () => {
  it("a repeated seed is a no-op: same version, same ETag", async () => {
    const first = await applySeed(ctx.db, SEED_DISHES);
    const again = await applySeed(ctx.db, SEED_DISHES);
    expect(first).toMatchObject({ changed: true, version: 1, added: 73, updated: 0, retired: 0 });
    expect(again).toEqual({ changed: false, version: 1, added: 0, updated: 0, retired: 0 });
    const response = await catalog().GET(request());
    expect(response.headers.get("etag")).toBe('"catalog-v1"');
  });

  it("a content fix bumps the version once and invalidates the old ETag", async () => {
    await applySeed(ctx.db, SEED_DISHES);
    const fixed = SEED_DISHES.map((d) => (d.id === "x2" ? { ...d, name: "Rau lang xào (đã sửa)" } : d));
    const result = await applySeed(ctx.db, fixed);
    expect(result).toMatchObject({ changed: true, version: 2, added: 0, updated: 1, retired: 0 });

    const stale = await catalog().GET(request({ "If-None-Match": '"catalog-v1"' }));
    expect(stale.status).toBe(200);
    const body = catalogResponseSchema.parse(await stale.json());
    expect(body.version).toBe(2);
    expect(body.dishes.find((d) => d.id === "x2")?.name).toBe("Rau lang xào (đã sửa)");
  });

  it("re-adding a retired dish brings it back", async () => {
    // Drop the LAST dish: removing an earlier one would also shift every later `position`.
    const last = SEED_DISHES[SEED_DISHES.length - 1];
    await applySeed(ctx.db, SEED_DISHES);
    const dropped = await applySeed(ctx.db, SEED_DISHES.slice(0, -1));
    expect(dropped).toMatchObject({ changed: true, version: 2, updated: 0, retired: 1 });
    const back = await applySeed(ctx.db, SEED_DISHES);
    expect(back).toMatchObject({ changed: true, version: 3, updated: 1, retired: 0 });
    const snapshot = await readCatalog(ctx.db);
    expect(snapshot?.dishes.find((d) => d.id === last.id)?.retired).toBe(false);
  });

  it("is atomic: a bad dish aborts the whole seed and leaves the catalog untouched", async () => {
    await applySeed(ctx.db, SEED_DISHES);
    const broken: Dish[] = [
      ...SEED_DISHES.map((d) => (d.id === "x2" ? { ...d, name: "Should not persist" } : d)),
      fixture({ id: "bad", mealType: "buacom", category: null }),
    ];
    await expect(applySeed(ctx.db, broken)).rejects.toBeDefined();
    const snapshot = await readCatalog(ctx.db);
    expect(snapshot?.version).toBe(1);
    expect(snapshot?.dishes.find((d) => d.id === "x2")?.name).toBe("Rau lang xào hành boa-rô");
    expect(snapshot?.dishes.some((d) => d.id === "bad")).toBe(false);
  });

  it("rejects duplicate ids before touching the database", async () => {
    await expect(applySeed(ctx.db, [fixture({ id: "a" }), fixture({ id: "a" })])).rejects.toThrow(/Duplicate/);
    expect(await readCatalog(ctx.db)).toBeNull();
  });
});

describe("seeding is only for an empty catalog (ADR-0004: the database is the source of truth)", () => {
  it("fills a catalog that has never been seeded", async () => {
    const result = await seedEmptyCatalog(ctx.db, SEED_DISHES);
    expect(result).toMatchObject({ status: "seeded", version: 1, added: SEED_DISHES.length });
    expect((await readCatalog(ctx.db))?.dishes).toHaveLength(SEED_DISHES.length);
  });

  it("refuses to touch a catalog that already has dishes, leaving admin edits alone", async () => {
    await applySeed(ctx.db, SEED_DISHES);
    await ctx.db.update(dishesTable).set({ name: "Tên do quản trị viên sửa" }).where(eq(dishesTable.id, "x1"));

    const result = await seedEmptyCatalog(ctx.db, SEED_DISHES);

    expect(result).toEqual({ status: "refused", dishes: SEED_DISHES.length });
    const catalog = await readCatalog(ctx.db);
    expect(catalog?.version).toBe(1);
    expect(catalog?.dishes.find((d) => d.id === "x1")?.name).toBe("Tên do quản trị viên sửa");
  });

  it("also refuses when only hidden dishes remain", async () => {
    await applySeed(ctx.db, SEED_DISHES);
    await ctx.db.update(dishesTable).set({ retired: true });
    expect((await seedEmptyCatalog(ctx.db, SEED_DISHES)).status).toBe("refused");
  });
});

describe("database constraints (real migrations)", () => {
  const row = (overrides: Partial<typeof dishesTable.$inferInsert> = {}): typeof dishesTable.$inferInsert => ({
    id: "t",
    position: 0,
    mealType: "buacom",
    category: "xao",
    chay: false,
    region: null,
    name: "Món",
    timeMinutes: 10,
    ingredients: ["a"],
    steps: ["b"],
    ...overrides,
  });
  const insert = (overrides?: Partial<typeof dishesTable.$inferInsert>) =>
    ctx.db.insert(dishesTable).values(row(overrides));

  it("accepts a valid Bữa cơm 3 món row and a valid Bữa 1 món row", async () => {
    await expect(insert()).resolves.toBeDefined();
    await expect(insert({ id: "t2", mealType: "buatomonuoc", category: null })).resolves.toBeDefined();
  });

  it.each<[string, Partial<typeof dishesTable.$inferInsert>, string]>([
    ["Bữa cơm 3 món without a Nhóm món", { category: null }, "dishes_category_rule"],
    ["Bữa 1 món with a Nhóm món", { mealType: "buatomonuoc", category: "xao" }, "dishes_category_rule"],
    ["an unknown Nhóm món", { category: "dessert" }, "dishes_category_rule"],
    ["an unknown meal type", { mealType: "snack", category: null }, "dishes_category_rule"], // Postgres reports the first violated check by name
    ["an unknown region", { region: "mars" }, "dishes_region_valid"],
    ["no ingredients", { ingredients: [] }, "dishes_ingredients_nonempty"],
    ["a zero cooking time", { timeMinutes: 0 }, "dishes_time_positive"],
  ])("rejects %s", async (_label, overrides, constraint) => {
    const error = await insert(overrides).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).not.toBeNull();
    expect(errorText(error)).toContain(constraint);
  });
});

describe("unsupported methods", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)("%s is a typed 405 that lists the allowed methods", async (method) => {
    const response = await catalog()[method]();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe("method_not_allowed");
  });
});

describe("failures", () => {
  it("is a typed 500 that does not leak internals when the database throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handlers = createCatalogHandlers(() => {
      throw new Error("password=hunter2 host=db.internal");
    });
    const response = await handlers.GET(request());
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(apiErrorSchema.safeParse(JSON.parse(text)).success).toBe(true);
    expect(text).not.toContain("hunter2");
    spy.mockRestore();
  });
});

describe("GET /api/v1/health", () => {
  it("reports ok when the database answers", async () => {
    const response = await createHealthHandlers(() => ctx.db).GET();
    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({ status: "ok", database: "up" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports degraded with 503 when the database is unreachable", async () => {
    const response = await createHealthHandlers(() => {
      throw new Error("connection refused");
    }).GET();
    expect(response.status).toBe(503);
    expect(healthResponseSchema.parse(await response.json())).toEqual({ status: "degraded", database: "down" });
  });

  it("rejects unsupported methods with a typed 405", async () => {
    const response = createHealthHandlers(() => ctx.db).POST();
    expect(response.status).toBe(405);
  });
});
