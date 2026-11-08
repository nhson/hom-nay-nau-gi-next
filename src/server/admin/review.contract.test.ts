import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bowl, dish } from "@/domain/testing";
import { applySeed } from "@/server/catalog/repository";
import { createTestDb } from "@/server/testing/db";
import {
  adminDishResponseSchema,
  apiErrorSchema,
  catalogResponseSchema,
  pendingDishResponseSchema,
  pendingListResponseSchema,
} from "@/shared/schemas";
import { createAdminKit, PASSPHRASE, SESSION_SECRET } from "./admin-test-kit";
import type { ReaderResult, RecipeReader } from "./recipe-reader";

// The Món chờ duyệt contract (spec #30, ADR-0006): real handlers -> Zod -> Drizzle -> real migrations
// on in-memory Postgres. The AI model is a fake RecipeReader, so answers are deterministic and free.

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
  dish({ id: "m1", name: "Cá kho tộ", category: "man" }),
  bowl({ id: "t1", name: "Phở bò" }),
];

const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA==";

const recipe = (overrides: Record<string, unknown> = {}) => ({
  isRecipe: true,
  readable: true,
  name: "Gà kho gừng",
  mealType: "buacom",
  category: "man",
  chay: false,
  region: "bac",
  time: "40 phút",
  ingredients: ["Gà 500g", "Gừng 1 củ"],
  steps: ["1. Chặt gà", "2. Kho với gừng"],
  ...overrides,
});

/** A fake model: answers with the queued results in order, and records what it was asked. */
function fakeReader(...answers: ReaderResult[]) {
  const calls: { instructions: string; photos: string[] }[] = [];
  const reader: RecipeReader = {
    configured: true,
    read: async (input) => {
      calls.push(input);
      return answers.shift() ?? { ok: true, reply: recipe(), model: "google/gemma-4-31b-it:free" };
    },
  };
  return { reader, calls };
}

const answer = (reply: unknown, model = "google/gemma-4-31b-it:free"): ReaderResult => ({ ok: true, reply, model });

async function setup(...answers: ReaderResult[]) {
  await applySeed(ctx.db, FIXTURE);
  const { reader, calls } = fakeReader(...answers);
  const k = createAdminKit(() => ctx.db, { passphrase: PASSPHRASE, sessionSecret: SESSION_SECRET }, reader);
  return { k, calls, cookie: await k.signIn() };
}

type Kit = Awaited<ReturnType<typeof setup>>;

const upload = ({ k, cookie }: Kit, photos: unknown = [PHOTO]) =>
  k.handlers.readPhotos(k.request("/pending/photos", { method: "POST", body: { photos }, cookie }));

const list = async ({ k, cookie }: Kit) =>
  pendingListResponseSchema.parse(await (await k.handlers.listPending(k.request("/pending", { cookie }))).json());

async function errorOf(response: Response) {
  return apiErrorSchema.parse(await response.json()).error;
}

describe("reading a recipe photo into a Món chờ duyệt", () => {
  it("asks the model with the photos and stores what it read, cleaned up, with its source and model", async () => {
    const kit = await setup();
    const response = await upload(kit, [PHOTO, PHOTO]);
    expect(response.status).toBe(201);
    const { pending } = pendingDishResponseSchema.parse(await response.json());
    expect(pending).toMatchObject({
      source: { kind: "photo", url: null },
      model: "google/gemma-4-31b-it:free",
      name: "Gà kho gừng",
      mealType: "buacom",
      category: "man",
      region: "bac",
      time: 40,
      ingredients: ["Gà 500g", "Gừng 1 củ"],
      steps: ["Chặt gà", "Kho với gừng"],
      warnings: [],
    });
    expect(kit.calls).toHaveLength(1);
    expect(kit.calls[0].photos).toEqual([PHOTO, PHOTO]);
    expect(kit.calls[0].instructions).toContain("JSON");

    const { items } = await list(kit);
    expect(items.map((item) => item.id)).toEqual([pending.id]);
  });
});

describe("when a photo does not become a Món chờ duyệt, nothing is stored", () => {
  it.each([
    ["not a recipe", answer({ isRecipe: false, readable: true }), 422, "not_a_recipe"],
    ["unreadable", answer({ isRecipe: true, readable: false }), 422, "unreadable"],
    ["a garbled answer", answer("xin lỗi, tôi không đọc được"), 422, "unreadable"],
    ["the model is down", { ok: false, failure: "unavailable" } as ReaderResult, 503, "reader_unavailable"],
    ["the free limit is used up", { ok: false, failure: "rate_limited" } as ReaderResult, 503, "reader_rate_limited"],
  ])("%s answers %i %s", async (_name, result, status, code) => {
    const kit = await setup(result);
    const response = await upload(kit);
    expect(response.status).toBe(status);
    expect((await errorOf(response)).code).toBe(code);
    expect((await list(kit)).items).toEqual([]);
  });

  it("says photo reading is not set up when there is no OpenRouter key", async () => {
    await applySeed(ctx.db, FIXTURE);
    const k = createAdminKit(() => ctx.db);
    const kit = { k, calls: [], cookie: await k.signIn() };
    expect((await list(kit)).readerConfigured).toBe(false);
    const response = await upload(kit);
    expect(response.status).toBe(503);
    expect((await errorOf(response)).code).toBe("reader_not_configured");
  });

  it("reports that photo reading is set up when it is", async () => {
    expect((await list(await setup())).readerConfigured).toBe(true);
  });

  it.each([
    ["no photos", []],
    ["more than 4 photos", [PHOTO, PHOTO, PHOTO, PHOTO, PHOTO]],
    ["a file that is not an image", ["data:application/pdf;base64,JVBERi0xLjQ="]],
    ["not a data URL", ["https://example.com/a.jpg"]],
    ["not a list", PHOTO],
  ])("refuses %s without asking the model", async (_name, photos) => {
    const kit = await setup();
    const response = await upload(kit, photos);
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("bad_request");
    expect(kit.calls).toHaveLength(0);
  });

  it("refuses photos that are too large, without asking the model", async () => {
    const kit = await setup();
    const huge = `data:image/jpeg;base64,${"A".repeat(4_500_000)}`;
    const response = await upload(kit, [huge]);
    expect(response.status).toBe(413);
    expect((await errorOf(response)).code).toBe("payload_too_large");
    expect(kit.calls).toHaveLength(0);
  });
});

const created = async (response: Response) => pendingDishResponseSchema.parse(await response.json()).pending;

const draftOf = (overrides: Record<string, unknown> = {}) => ({
  mealType: "buacom",
  category: "man",
  chay: false,
  region: "bac",
  name: "Gà kho gừng",
  time: 40,
  ingredients: ["Gà 500g", "Gừng 1 củ"],
  steps: ["Chặt gà", "Kho với gừng"],
  ...overrides,
});

const publicCatalog = async () => {
  const { createCatalogHandlers } = await import("@/server/catalog/handlers");
  const response = await createCatalogHandlers(() => ctx.db).GET(new Request("http://localhost/api/v1/catalog"));
  return { etag: response.headers.get("etag"), body: catalogResponseSchema.parse(await response.json()) };
};

describe("the Chờ duyệt list", () => {
  it("lists the newest first", async () => {
    const kit = await setup(answer(recipe({ name: "Gà kho gừng" })), answer(recipe({ name: "Bò xào hành tây" })));
    await upload(kit);
    kit.k.advance(60_000);
    await upload(kit);
    expect((await list(kit)).items.map((item) => item.name)).toEqual(["Bò xào hành tây", "Gà kho gừng"]);
  });

  it("warns about a likely duplicate of a dish in the Danh mục món", async () => {
    const kit = await setup(answer(recipe({ name: "Canh chua cá lóc miền Tây", category: "canh" })));
    const pending = await created(await upload(kit));
    expect(pending.warnings).toEqual([{ code: "possible-duplicate", of: "dish", id: "c1", name: "Canh chua cá lóc", hidden: false }]);
  });

  it("warns when two Món chờ duyệt look like the same dish", async () => {
    const kit = await setup();
    const first = await created(await upload(kit));
    const second = await created(await upload(kit));
    expect(second.warnings).toEqual([{ code: "possible-duplicate", of: "pending", id: first.id, name: "Gà kho gừng", hidden: false }]);
    const { items } = await list(kit);
    expect(items.find((item) => item.id === first.id)?.warnings).toEqual([
      { code: "possible-duplicate", of: "pending", id: second.id, name: "Gà kho gừng", hidden: false },
    ]);
  });

  it("warns when a chay proposal mentions tỏi", async () => {
    const kit = await setup(answer(recipe({ name: "Đậu hũ sốt nấm", chay: true, steps: ["Phi tỏi thơm"] })));
    expect((await created(await upload(kit))).warnings).toEqual([{ code: "chay-toi" }]);
  });

  it("derives warnings from the catalog as it is now, not as it was at upload", async () => {
    const kit = await setup(answer(recipe({ name: "Bò xào hành tây", category: "xao" })), answer(recipe({ name: "Bò xào hành tây", category: "xao" })));
    const first = await created(await upload(kit));
    const second = await created(await upload(kit));
    // Approving the first puts it in the catalog; the second now duplicates a dish, not a Món chờ duyệt.
    const { k, cookie } = kit;
    const approved = await k.handlers.approvePending(
      k.request(`/pending/${first.id}/approve`, { method: "POST", body: draftOf({ name: "Bò xào hành tây", category: "xao" }), cookie }),
      first.id,
    );
    expect(approved.status).toBe(201);
    const { items } = await list(kit);
    expect(items.find((item) => item.id === second.id)?.warnings).toEqual([
      { code: "possible-duplicate", of: "dish", id: "x2", name: "Bò xào hành tây", hidden: false },
    ]);
  });

  it("opens one Món chờ duyệt, and says when it is not there", async () => {
    const kit = await setup();
    const pending = await created(await upload(kit));
    const { k, cookie } = kit;
    const one = await k.handlers.getPending(k.request(`/pending/${pending.id}`, { cookie }), pending.id);
    expect(pendingDishResponseSchema.parse(await one.json()).pending).toEqual(pending);
    const missing = await k.handlers.getPending(k.request("/pending/nope", { cookie }), "nope");
    expect(missing.status).toBe(404);
  });
});

describe("saving edits to a Món chờ duyệt (Lưu)", () => {
  it("stores the edits without publishing anything", async () => {
    const kit = await setup();
    const pending = await created(await upload(kit));
    const before = await publicCatalog();
    const { k, cookie } = kit;
    k.advance(60_000);
    const response = await k.handlers.updatePending(
      k.request(`/pending/${pending.id}`, { method: "PUT", body: draftOf({ name: "  Gà kho sả gừng ", ingredients: ["Gà 500g", "", "Sả 2 cây"] }), cookie }),
      pending.id,
    );
    expect(response.status).toBe(200);
    const saved = (await created(response)) as typeof pending;
    expect(saved).toMatchObject({ name: "Gà kho sả gừng", ingredients: ["Gà 500g", "Sả 2 cây"], createdAt: pending.createdAt });
    expect(saved.updatedAt).not.toBe(pending.updatedAt);
    expect((await publicCatalog()).etag).toBe(before.etag);
  });

  it("allows an incomplete proposal (no name yet), but not an impossible time", async () => {
    const kit = await setup();
    const pending = await created(await upload(kit));
    const { k, cookie } = kit;
    const blank = await k.handlers.updatePending(k.request(`/pending/${pending.id}`, { method: "PUT", body: draftOf({ name: "", ingredients: [] }), cookie }), pending.id);
    expect(blank.status).toBe(200);
    const badTime = await k.handlers.updatePending(k.request(`/pending/${pending.id}`, { method: "PUT", body: draftOf({ time: -3 }), cookie }), pending.id);
    expect(badTime.status).toBe(422);
    expect((await errorOf(badTime)).issues).toEqual([{ code: "time-invalid", field: "time" }]);
  });

  it("says when the Món chờ duyệt is not there", async () => {
    const kit = await setup();
    const { k, cookie } = kit;
    const response = await k.handlers.updatePending(k.request("/pending/nope", { method: "PUT", body: draftOf(), cookie }), "nope");
    expect(response.status).toBe(404);
  });
});

describe("Duyệt: a Món chờ duyệt becomes a dish", () => {
  const approve = ({ k, cookie }: Kit, id: string, body: unknown = draftOf()) =>
    k.handlers.approvePending(k.request(`/pending/${id}/approve`, { method: "POST", body, cookie }), id);

  it("adds the dish with the next id for its Nhóm món, bumps the catalog version and removes it from the list", async () => {
    const kit = await setup();
    const pending = await created(await upload(kit));
    const before = await publicCatalog();

    const response = await approve(kit, pending.id, draftOf({ name: "Gà kho gừng" }));
    expect(response.status).toBe(201);
    const body = adminDishResponseSchema.parse(await response.json());
    expect(body.dish).toMatchObject({ id: "m2", name: "Gà kho gừng", category: "man", retired: false });
    expect(body.version).toBe(before.body.version + 1);

    const after = await publicCatalog();
    expect(after.etag).not.toBe(before.etag);
    expect(after.body.dishes.find((d) => d.id === "m2")).toMatchObject({ name: "Gà kho gừng", ingredients: ["Gà 500g", "Gừng 1 củ"] });
    expect((await list(kit)).items).toEqual([]);
  });

  it("uses the edited draft that was sent, and gives a Bữa 1 món a t id", async () => {
    const kit = await setup();
    const pending = await created(await upload(kit));
    const response = await approve(kit, pending.id, draftOf({ name: "Bún riêu cua", mealType: "buatomonuoc", category: null }));
    expect(adminDishResponseSchema.parse(await response.json()).dish).toMatchObject({ id: "t2", name: "Bún riêu cua", category: null });
  });

  it.each([
    ["a chay dish with tỏi", draftOf({ chay: true, steps: ["Phi tỏi"] }), { code: "chay-toi", field: "steps", index: 0 }],
    ["a name already in the catalog", draftOf({ name: "Cá kho tộ" }), { code: "name-duplicate", field: "name" }],
    ["no ingredients", draftOf({ ingredients: [" "] }), { code: "ingredients-required", field: "ingredients" }],
    ["a Bữa cơm 3 món without a Nhóm món", draftOf({ category: null }), { code: "category-required", field: "category" }],
  ])("refuses %s with the dish form's problem codes and changes nothing", async (_name, body, issue) => {
    const kit = await setup();
    const pending = await created(await upload(kit));
    const before = await publicCatalog();
    const response = await approve(kit, pending.id, body);
    expect(response.status).toBe(422);
    expect((await errorOf(response)).issues).toContainEqual(issue);
    expect((await publicCatalog()).etag).toBe(before.etag);
    expect((await list(kit)).items.map((item) => item.id)).toEqual([pending.id]);
  });

  it("approves despite a duplicate warning when the name itself is different", async () => {
    const kit = await setup(answer(recipe({ name: "Canh chua cá lóc miền Tây", category: "canh" })));
    const pending = await created(await upload(kit));
    expect(pending.warnings).toHaveLength(1);
    const response = await approve(kit, pending.id, draftOf({ name: "Canh chua cá lóc miền Tây", category: "canh" }));
    expect(response.status).toBe(201);
  });

  it("cannot approve the same Món chờ duyệt twice", async () => {
    const kit = await setup();
    const pending = await created(await upload(kit));
    expect((await approve(kit, pending.id)).status).toBe(201);
    const again = await approve(kit, pending.id, draftOf({ name: "Gà kho gừng lần hai" }));
    expect(again.status).toBe(404);
    expect((await publicCatalog()).body.dishes.filter((d) => d.name.startsWith("Gà kho gừng"))).toHaveLength(1);
  });
});

describe("Bỏ: discarding a Món chờ duyệt", () => {
  it("removes it without touching the catalog", async () => {
    const kit = await setup();
    const pending = await created(await upload(kit));
    const before = await publicCatalog();
    const { k, cookie } = kit;
    const response = await k.handlers.discardPending(k.request(`/pending/${pending.id}`, { method: "DELETE", cookie }), pending.id);
    expect(response.status).toBe(200);
    expect((await list(kit)).items).toEqual([]);
    expect((await publicCatalog()).etag).toBe(before.etag);
    const again = await k.handlers.discardPending(k.request(`/pending/${pending.id}`, { method: "DELETE", cookie }), pending.id);
    expect(again.status).toBe(404);
  });
});

describe("Món chờ duyệt never leave the admin", () => {
  it("are not in the public catalog or the JSON export", async () => {
    const kit = await setup();
    await created(await upload(kit));
    expect((await publicCatalog()).body.dishes.map((d) => d.name)).not.toContain("Gà kho gừng");
    const { k, cookie } = kit;
    const exported = catalogResponseSchema.parse(await (await k.handlers.exportCatalog(k.request("/export", { cookie }))).json());
    expect(exported.dishes.map((d) => d.name)).not.toContain("Gà kho gừng");
  });
});

describe("every Chờ duyệt route needs a session, and writes must come from the admin page", () => {
  type Call = (k: Kit["k"], cookie?: string, origin?: string | null) => Promise<Response>;
  const routes: [string, boolean, Call][] = [
    ["list", false, (k, cookie) => k.handlers.listPending(k.request("/pending", { cookie }))],
    ["read photos", true, (k, cookie, origin) => k.handlers.readPhotos(k.request("/pending/photos", { method: "POST", body: { photos: [PHOTO] }, cookie, origin }))],
    ["open", false, (k, cookie) => k.handlers.getPending(k.request("/pending/p", { cookie }), "p")],
    ["save", true, (k, cookie, origin) => k.handlers.updatePending(k.request("/pending/p", { method: "PUT", body: draftOf(), cookie, origin }), "p")],
    ["approve", true, (k, cookie, origin) => k.handlers.approvePending(k.request("/pending/p/approve", { method: "POST", body: draftOf(), cookie, origin }), "p")],
    ["discard", true, (k, cookie, origin) => k.handlers.discardPending(k.request("/pending/p", { method: "DELETE", cookie, origin }), "p")],
  ];

  it.each(routes)("%s answers 401 without a session", async (_name, _write, call) => {
    const kit = await setup();
    expect((await call(kit.k)).status).toBe(401);
    expect(kit.calls).toHaveLength(0);
  });

  it.each(routes.filter(([, write]) => write))("%s answers 403 from another site", async (_name, _write, call) => {
    const kit = await setup();
    expect((await call(kit.k, kit.cookie, "https://evil.example")).status).toBe(403);
    expect(kit.calls).toHaveLength(0);
  });
});
