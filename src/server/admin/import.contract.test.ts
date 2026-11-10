import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bowl, dish } from "@/domain/testing";
import { listSeen, recordSeen } from "@/server/agent/repository";
import { applySeed } from "@/server/catalog/repository";
import { createTestDb } from "@/server/testing/db";
import {
  apiErrorSchema,
  bulkApproveResponseSchema,
  catalogResponseSchema,
  dishFileImportResponseSchema,
  pendingListResponseSchema,
} from "@/shared/schemas";
import { createAdminKit } from "./admin-test-kit";
import { insertPending } from "./pending-repository";

// Nhập từ file and bulk Duyệt (spec #41): real handlers -> Zod -> Drizzle -> real migrations on in-memory Postgres.

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

const FIXTURE = [
  dish({ id: "x1", name: "Rau muống xào", category: "xao" }),
  dish({ id: "c1", name: "Canh chua cá lóc", category: "canh" }),
  dish({ id: "m1", name: "Cá kho tộ", category: "man", retired: true }),
  bowl({ id: "t1", name: "Phở bò" }),
];

async function setup() {
  await applySeed(ctx.db, FIXTURE);
  const k = createAdminKit(() => ctx.db);
  return { k, cookie: await k.signIn() };
}
type Kit = Awaited<ReturnType<typeof setup>>;

const ga = {
  name: "Gà kho gừng",
  mealType: "Bữa cơm 3 món",
  category: "Mặn",
  chay: "không",
  region: "Miền Bắc",
  time: 40,
  ingredients: "Gà 500g\nGừng 1 củ",
  steps: ["Chặt gà", "Kho với gừng"],
};

const importFile = ({ k, cookie }: Kit, body: unknown, origin?: string | null) =>
  k.handlers.importPending(k.request("/pending/import", { method: "POST", body, cookie, origin }));

const fileOf = (dishes: unknown, fileName = "mon-moi.json") => ({ fileName, text: JSON.stringify(dishes) });

const list = async ({ k, cookie }: Kit) =>
  pendingListResponseSchema.parse(await (await k.handlers.listPending(k.request("/pending", { cookie }))).json()).items;

const errorOf = async (response: Response) => apiErrorSchema.parse(await response.json()).error;

const publicCatalog = async () => {
  const { createCatalogHandlers } = await import("@/server/catalog/handlers");
  const response = await createCatalogHandlers(() => ctx.db).GET(new Request("http://localhost/api/v1/catalog"));
  return catalogResponseSchema.parse(await response.json());
};

describe("Nhập từ file: a JSON file of dishes becomes Món chờ duyệt", () => {
  it("stores each dish to add with source file and the file name, and answers with what was added and skipped", async () => {
    const kit = await setup();
    const response = await importFile(
      kit,
      fileOf({ version: 3, dishes: [ga, { name: "Canh chua cá lóc" }, { mealType: "buacom" }, { name: "Bún riêu cua", mealType: "bua 1 mon" }] }, "thuc-don-tet.json"),
    );
    expect(response.status).toBe(201);
    expect(dishFileImportResponseSchema.parse(await response.json())).toEqual({
      added: [
        { row: 1, id: expect.any(String), name: "Gà kho gừng", warnings: [] },
        {
          row: 4,
          id: expect.any(String),
          name: "Bún riêu cua",
          warnings: [
            { code: "missing", field: "ingredients" },
            { code: "missing", field: "steps" },
          ],
        },
      ],
      skipped: [
        { row: 2, name: "Canh chua cá lóc", reason: "duplicate" },
        { row: 3, reason: "no_name" },
      ],
    });

    const items = await list(kit);
    expect(items.map((item) => item.name).sort()).toEqual(["Bún riêu cua", "Gà kho gừng"]);
    const gaItem = items.find((item) => item.name === "Gà kho gừng");
    expect(gaItem).toMatchObject({
      source: { kind: "file", url: "thuc-don-tet.json" },
      model: null,
      mealType: "buacom",
      category: "man",
      chay: false,
      region: "bac",
      time: 40,
      ingredients: ["Gà 500g", "Gừng 1 củ"],
      steps: ["Chặt gà", "Kho với gừng"],
      warnings: [],
    });
  });

  it("skips names already in the Danh mục món (hidden ones too) and on Chờ duyệt, checked when saving", async () => {
    const kit = await setup();
    // On Chờ duyệt already, e.g. added from another tab after the preview was made.
    await insertPending(ctx.db, {
      id: "p-old",
      source: { kind: "menu", url: null },
      model: "m",
      draft: { name: "Bún chả", mealType: "buatomonuoc", category: null, chay: false, region: null, time: null, ingredients: ["Bún"], steps: [] },
      at: new Date(),
    });
    const response = await importFile(kit, fileOf([{ name: "cá kho tộ" }, { name: "Bún chả" }, ga, { ...ga, name: "gà kho gừng" }]));
    expect(dishFileImportResponseSchema.parse(await response.json()).skipped).toEqual([
      { row: 1, name: "cá kho tộ", reason: "duplicate" },
      { row: 2, name: "Bún chả", reason: "duplicate" },
      { row: 4, name: "gà kho gừng", reason: "repeated_in_file" },
    ]);
    expect((await list(kit)).map((item) => item.name).sort()).toEqual(["Bún chả", "Gà kho gừng"]);
  });

  it("keeps what a dish lacks for Duyệt as a warning in review", async () => {
    const kit = await setup();
    await importFile(kit, fileOf([{ name: "Bún riêu cua", mealType: "Bữa cơm 3 món", category: "lẩu" }]));
    const [item] = await list(kit);
    expect(item.warnings).toEqual([
      { code: "missing", field: "category" },
      { code: "missing", field: "ingredients" },
      { code: "missing", field: "steps" },
    ]);
  });

  it("gives imported dishes the usual review warnings", async () => {
    const kit = await setup();
    await importFile(kit, fileOf([{ ...ga, name: "Canh chua cá lóc miền Tây", category: "canh", chay: true, ingredients: ["Cá", "Tỏi"] }]));
    const [item] = await list(kit);
    expect(item.warnings).toEqual([
      { code: "chay-toi" },
      { code: "possible-duplicate", of: "dish", id: "c1", name: "Canh chua cá lóc", hidden: false },
    ]);
  });

  it.each([
    ["text that is not JSON", { fileName: "a.json", text: "{ dishes: [" }, "not_json"],
    ["JSON without a list of dishes", fileOf({ version: 1 }), "no_dishes"],
    ["more than 200 dishes", fileOf(Array.from({ length: 201 }, (_, i) => ({ name: `Món ${i}` }))), "too_many"],
  ])("refuses %s with one reason, adding nothing", async (_name, body, refusal) => {
    const kit = await setup();
    const response = await importFile(kit, body);
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toMatchObject({ code: "bad_request", refusal });
    expect(await list(kit)).toEqual([]);
  });

  it("refuses a request that is not { fileName, text }", async () => {
    const kit = await setup();
    expect((await importFile(kit, { text: "[]" })).status).toBe(400);
    expect((await importFile(kit, { fileName: "a.json", text: [ga] })).status).toBe(400);
  });

  it("refuses a file over 1 MB with 413, adding nothing", async () => {
    const kit = await setup();
    const big = [{ ...ga, steps: ["x".repeat(1_000_001)] }];
    const response = await importFile(kit, fileOf(big));
    expect(response.status).toBe(413);
    expect(await list(kit)).toEqual([]);
  });

  it("never changes an existing dish, even when a row carries its id, and nothing reaches the public catalog", async () => {
    const kit = await setup();
    const before = await publicCatalog();
    await importFile(kit, fileOf([{ ...ga, id: "x1", retired: true }]));
    expect(await publicCatalog()).toEqual(before);
  });
});

const approveMany = ({ k, cookie }: Kit, body: unknown, origin?: string | null) =>
  k.handlers.approvePendingMany(k.request("/pending/approve", { method: "POST", body, cookie, origin }));

const ready = (name: string, extra: Partial<Parameters<typeof insertPending>[1]["draft"]> = {}) => ({
  name,
  mealType: "buacom" as const,
  category: "man" as const,
  chay: false,
  region: null,
  time: 30,
  ingredients: ["Thịt"],
  steps: ["Kho"],
  ...extra,
});

async function addPending(id: string, draft: ReturnType<typeof ready>, source: { kind: "agent" | "file" | "menu"; url: string | null } = { kind: "file", url: "a.json" }) {
  await insertPending(ctx.db, { id, source, model: null, draft, at: new Date() });
}

describe("bulk Duyệt: approving several Món chờ duyệt in one go", () => {
  it("approves each ready dish on its own and reports the ones that cannot be approved, with why", async () => {
    const kit = await setup();
    const before = await publicCatalog();
    await addPending("p1", ready("Thịt kho tàu"));
    await addPending("p2", ready("Rau muống xào", { category: "xao" })); // exact duplicate of x1
    await addPending("p3", ready("Đậu hũ sốt cà", { chay: true, ingredients: ["Đậu hũ", "Tỏi băm"] }));
    await addPending("p4", ready("Canh bí", { category: "canh", ingredients: [] }));
    await addPending("p5", ready("Bún bò Huế", { mealType: "buatomonuoc", category: null }));

    const response = await approveMany(kit, { ids: ["p1", "p2", "p3", "p4", "p5", "gone"] });
    expect(response.status).toBe(200);
    const body = bulkApproveResponseSchema.parse(await response.json());
    expect(body.approved).toEqual([
      { id: "p1", dishId: "m2" },
      { id: "p5", dishId: "t2" },
    ]);
    expect(body.failed).toEqual([
      { id: "p2", reason: "validation_failed", issues: [{ code: "name-duplicate", field: "name" }] },
      { id: "p3", reason: "validation_failed", issues: [{ code: "chay-toi", field: "ingredients", index: 1 }] },
      { id: "p4", reason: "validation_failed", issues: [{ code: "ingredients-required", field: "ingredients" }] },
      { id: "gone", reason: "not_found", issues: [] },
    ]);

    // One version per approved dish, as single Duyệt does.
    expect(body.version).toBe(before.version + 2);
    const after = await publicCatalog();
    expect(after.version).toBe(before.version + 2);
    expect(after.dishes.filter((d) => ["m2", "t2"].includes(d.id)).map((d) => d.name).sort()).toEqual(["Bún bò Huế", "Thịt kho tàu"]);
    expect((await list(kit)).map((item) => item.id).sort()).toEqual(["p2", "p3", "p4"]);
  });

  it("checks names against the dishes approved earlier in the same go", async () => {
    const kit = await setup();
    await addPending("p1", ready("Thịt kho tàu"));
    await addPending("p2", ready("thịt kho tàu"));
    const body = bulkApproveResponseSchema.parse(await (await approveMany(kit, { ids: ["p1", "p2"] })).json());
    expect(body.approved).toEqual([{ id: "p1", dishId: "m2" }]);
    expect(body.failed).toEqual([{ id: "p2", reason: "validation_failed", issues: [{ code: "name-duplicate", field: "name" }] }]);
  });

  it("marks the agent's page approved for each dish the agent found", async () => {
    const kit = await setup();
    const url = "https://monngonmoingay.com/thit-kho-tau/";
    await recordSeen(ctx.db, [{ url, sourceId: "monngonmoingay", outcome: "proposed" }], new Date());
    await addPending("p1", ready("Thịt kho tàu"), { kind: "agent", url });
    await approveMany(kit, { ids: ["p1"] });
    expect((await listSeen(ctx.db)).find((page) => page.url === url)?.outcome).toBe("approved");
  });

  it("refuses a request without 1 to 200 ids", async () => {
    const kit = await setup();
    for (const body of [{ ids: [] }, { ids: Array.from({ length: 201 }, (_, i) => `p${i}`) }, { ids: "p1" }, {}]) {
      expect((await approveMany(kit, body)).status).toBe(400);
    }
  });
});

describe("Nhập từ file and bulk Duyệt need a session, and must come from the admin page", () => {
  it("answer 401 without a session and 403 from another site", async () => {
    const kit = await setup();
    const anonymous = { ...kit, cookie: "" };
    expect((await importFile(anonymous, fileOf([ga]))).status).toBe(401);
    expect((await approveMany(anonymous, { ids: ["p1"] })).status).toBe(401);
    expect((await importFile(kit, fileOf([ga]), "https://evil.example")).status).toBe(403);
    expect((await approveMany(kit, { ids: ["p1"] }, "https://evil.example")).status).toBe(403);
    expect(await list(kit)).toEqual([]);
  });
});
