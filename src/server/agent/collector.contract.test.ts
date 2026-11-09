import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bowl, dish } from "@/domain/testing";
import { createAdminKit, PASSPHRASE, SESSION_SECRET } from "@/server/admin/admin-test-kit";
import { insertPending } from "@/server/admin/pending-repository";
import type { ReaderResult, RecipeReader } from "@/server/admin/recipe-reader";
import { applySeed } from "@/server/catalog/repository";
import { createTestDb } from "@/server/testing/db";
import {
  adminCatalogResponseSchema,
  agentRunResponseSchema,
  agentRunsResponseSchema,
  agentSettingsResponseSchema,
  apiErrorSchema,
  pendingListResponseSchema,
  type AgentRun,
} from "@/shared/schemas";
import { createCollector } from "./collector";
import { createCronHandlers } from "./cron";
import type { FetchResult, PageFetcher } from "./page-fetcher";
import { listSeen } from "./repository";

// The Tác nhân thu thập contract (spec #31, ADR-0006/0007): real handlers and runner -> Drizzle -> real
// migrations on in-memory Postgres. The web is a fake fetcher serving pages from memory, and the model a
// fake RecipeReader, so a run is deterministic, offline and free.

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

// The catalog leans on món mặn and has no canh: a canh fills the biggest gap.
const FIXTURE = [
  dish({ id: "x1", name: "Rau muống xào", category: "xao", region: "nam" }),
  dish({ id: "m1", name: "Cá kho tộ", category: "man", region: "nam" }),
  dish({ id: "m2", name: "Thịt kho trứng", category: "man", region: "nam" }),
  dish({ id: "m3", name: "Sườn ram mặn", category: "man", region: "nam" }),
  bowl({ id: "t1", name: "Phở bò", region: "nam" }),
];

const MON = "https://monngonmoingay.com";
const VNE = "https://vnexpress.net";
const LISTING = `${VNE}/doi-song/cooking`;

const recipe = (name: string, category: string | null, mealType = "buacom") => ({
  isRecipe: true,
  readable: true,
  name,
  mealType,
  category,
  chay: false,
  region: "nam",
  time: 30,
  ingredients: ["Nguyên liệu 1", "Nguyên liệu 2"],
  steps: ["Bước một", "Bước hai"],
});

/** The recipe pages on the fake web: URL -> the page title (which the fake model recognises) and its answer. */
const PAGES: Record<string, { title: string; reply: unknown }> = {
  [`${MON}/canh-bi-do-nau-tom/`]: { title: "Canh bí đỏ nấu tôm", reply: recipe("Canh bí đỏ nấu tôm", "canh") },
  [`${MON}/ga-kho-gung/`]: { title: "Gà kho gừng", reply: recipe("Gà kho gừng", "man") },
  [`${MON}/dau-hu-xao-nam/`]: { title: "Đậu hũ xào nấm", reply: recipe("Đậu hũ xào nấm", "xao") },
  [`${VNE}/cach-lam-bun-rieu-cua-4800001.html`]: { title: "Bún riêu cua", reply: recipe("Bún riêu cua", null, "buatomonuoc") },
  [`${VNE}/meo-chon-dao-bep-4800002.html`]: { title: "Mẹo chọn dao bếp", reply: { isRecipe: false, readable: true } },
};

const sitemap = (urls: string[]) =>
  `<?xml version="1.0"?><urlset>${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;

function fakeWeb() {
  const served = new Map<string, FetchResult>();
  const ok = (text: string): FetchResult => ({ ok: true, text });
  served.set(`${MON}/robots.txt`, ok("User-agent: *\nDisallow: /wp-admin/\n"));
  served.set(
    `${MON}/sitemap_index.xml`,
    ok(`<sitemapindex><sitemap><loc>${MON}/monan-sitemap.xml</loc></sitemap><sitemap><loc>${MON}/post-sitemap.xml</loc></sitemap></sitemapindex>`),
  );
  served.set(`${MON}/monan-sitemap.xml`, ok(sitemap(Object.keys(PAGES).filter((url) => url.startsWith(MON)))));
  served.set(`${MON}/post-sitemap.xml`, ok(sitemap([`${MON}/khuyen-mai-thang-10/`])));
  served.set(`${VNE}/robots.txt`, { ok: false, status: 404 });
  served.set(
    LISTING,
    ok(
      `<html><body>${Object.keys(PAGES)
        .filter((url) => url.startsWith(VNE))
        .map((url) => `<a href="${url.replace(VNE, "")}">x</a>`)
        .join("")}<a href="/the-thao">Thể thao</a></body></html>`,
    ),
  );
  for (const [url, page] of Object.entries(PAGES)) {
    served.set(url, ok(`<html><head><title>${page.title}</title></head><body><nav>menu</nav><p>${page.title} ngon.</p></body></html>`));
  }
  const fetched: string[] = [];
  const fetcher: PageFetcher = {
    get: async (url) => {
      fetched.push(url);
      await Promise.resolve();
      return served.get(url) ?? { ok: false, status: 404 };
    },
  };
  return { fetcher, fetched, served };
}

/** A fake model that recognises each page by its title. `before` can change an answer or move the clock. */
function fakeModel(before?: (title: string, call: number) => ReaderResult | void) {
  const read: string[] = [];
  const reader: RecipeReader = {
    configured: true,
    read: async ({ prompt = "" }) => {
      const title = prompt.split("\n")[0];
      read.push(title);
      const override = before?.(title, read.length);
      if (override) return override;
      const page = Object.values(PAGES).find((item) => item.title === title);
      return { ok: true, reply: page?.reply ?? { isRecipe: false, readable: true }, model: "google/gemma-4-31b-it:free" };
    },
  };
  return { reader, read };
}

const CRON_SECRET = "c".repeat(40);

async function setup(options: { model?: ReturnType<typeof fakeModel>; deadlineMs?: number; reader?: RecipeReader } = {}) {
  await applySeed(ctx.db, FIXTURE);
  const web = fakeWeb();
  const model = options.model ?? fakeModel();
  const reader = options.reader ?? model.reader;
  const k = createAdminKit(() => ctx.db, { passphrase: PASSPHRASE, sessionSecret: SESSION_SECRET }, reader, (now) =>
    createCollector({
      getDb: () => ctx.db,
      getReader: () => reader,
      fetcher: web.fetcher,
      now,
      sleep: async () => {},
      rng: () => 0.5,
      deadlineMs: options.deadlineMs,
    }),
  );
  const cron = createCronHandlers({ getSecret: () => CRON_SECRET, getCollector: () => k.collector! });
  return { k, web, model, cron, cookie: await k.signIn() };
}

type Kit = Awaited<ReturnType<typeof setup>>;

async function runNow({ k, cookie }: Kit): Promise<AgentRun> {
  const response = await k.handlers.startRun(k.request("/agent/runs", { method: "POST", body: {}, cookie }));
  expect(response.status).toBe(201);
  return agentRunResponseSchema.parse(await response.json()).run;
}

const pending = async ({ k, cookie }: Kit) =>
  pendingListResponseSchema.parse(await (await k.handlers.listPending(k.request("/pending", { cookie }))).json()).items;

const runs = async ({ k, cookie }: Kit) =>
  agentRunsResponseSchema.parse(await (await k.handlers.listRuns(k.request("/agent/runs", { cookie }))).json());

const saveSettings = ({ k, cookie }: Kit, body: unknown) =>
  k.handlers.saveAgentSettings(k.request("/agent/settings", { method: "PUT", body, cookie }));

const cronRequest = (authorization?: string) =>
  new Request("http://localhost/api/v1/cron/collect", { headers: authorization ? { authorization } : {} });

describe("the daily cron route", () => {
  it("refuses a call without the cron secret, and starts nothing", async () => {
    const kit = await setup();
    for (const header of [undefined, "Bearer wrong", `Basic ${CRON_SECRET}`]) {
      const response = await kit.cron.collect(cronRequest(header));
      expect(response.status).toBe(401);
    }
    expect(kit.web.fetched).toEqual([]);
    expect((await runs(kit)).runs).toEqual([]);
  });

  it("refuses everyone when no secret is set", async () => {
    const kit = await setup();
    const cron = createCronHandlers({ getSecret: () => null, getCollector: () => kit.k.collector! });
    expect((await cron.collect(cronRequest("Bearer "))).status).toBe(401);
  });

  it("runs with the secret, answers the run summary, and is never cached", async () => {
    const kit = await setup();
    const response = await kit.cron.collect(cronRequest(`Bearer ${CRON_SECRET}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    const { run } = agentRunResponseSchema.parse(await response.json());
    expect(run).toMatchObject({ trigger: "cron", status: "ok", added: 3 });
  });
});

describe("a run", () => {
  it("adds the dishes that fill the biggest gaps as Món chờ duyệt from the agent, with their page", async () => {
    const kit = await setup();
    const run = await runNow(kit);

    expect(run).toMatchObject({ trigger: "manual", status: "ok", skipped: null, stoppedBy: null, pagesRead: 5, added: 3 });
    const items = await pending(kit);
    expect(items.map((item) => item.name).sort()).toEqual(["Bún riêu cua", "Canh bí đỏ nấu tôm", "Đậu hũ xào nấm"]);
    expect(items.find((item) => item.name === "Canh bí đỏ nấu tôm")).toMatchObject({
      source: { kind: "agent", url: `${MON}/canh-bi-do-nau-tom/` },
      model: "google/gemma-4-31b-it:free",
      category: "canh",
    });
    // The món mặn lost to better gap-fillers; the page that is not a recipe is remembered as such.
    expect(run.entries).toContainEqual({ kind: "skip", reason: "not_kept", sourceId: "monngonmoingay", url: `${MON}/ga-kho-gung/` });
    expect(run.entries).toContainEqual({ kind: "skip", reason: "not_a_recipe", sourceId: "vnexpress", url: `${VNE}/meo-chon-dao-bep-4800002.html` });
  });

  it("reads only recipe pages: other sitemaps and links outside the source's article pattern are ignored", async () => {
    const kit = await setup();
    await runNow(kit);
    expect(kit.web.fetched).not.toContain(`${MON}/khuyen-mai-thang-10/`);
    expect(kit.web.fetched).not.toContain(`${VNE}/the-thao`);
  });

  it("never reads a page twice; a dish that was not kept is picked up by a later run", async () => {
    const kit = await setup();
    await runNow(kit);
    kit.model.read.length = 0;
    const second = await runNow(kit);
    expect(kit.model.read).toEqual(["Gà kho gừng"]);
    expect(second).toMatchObject({ pagesRead: 1, added: 1, status: "ok" });
    const third = await runNow(kit);
    expect(third).toMatchObject({ pagesRead: 0, added: 0, status: "ok" });
  });

  it("skips a page whose address already names a dish in the catalog, without reading it", async () => {
    const kit = await setup();
    kit.web.served.set(`${MON}/monan-sitemap.xml`, { ok: true, text: sitemap([`${MON}/canh-bi-do-nau-tom/`, `${MON}/ca-kho-to/`]) });
    const run = await runNow(kit);
    expect(kit.web.fetched).not.toContain(`${MON}/ca-kho-to/`);
    expect(run.entries).toContainEqual({ kind: "skip", reason: "duplicate", sourceId: "monngonmoingay", url: `${MON}/ca-kho-to/` });
  });

  it("does not add a dish the model names like one already in the catalog or waiting", async () => {
    const model = fakeModel((title) =>
      title === "Gà kho gừng" ? { ok: true, reply: recipe("Thịt kho trứng", "man"), model: "m" } : undefined,
    );
    const kit = await setup({ model });
    await saveSettings(kit, { dishesPerDay: 10, pauseAt: 15, pagesPerRun: 10 });
    const run = await runNow(kit);
    expect((await pending(kit)).map((item) => item.name)).not.toContain("Thịt kho trứng");
    expect(run.entries).toContainEqual({ kind: "skip", reason: "duplicate", sourceId: "monngonmoingay", url: `${MON}/ga-kho-gung/` });
  });

  it("puts nothing in the public catalog until the Quản trị viên approves it", async () => {
    const kit = await setup();
    await runNow(kit);
    const catalog = adminCatalogResponseSchema.parse(
      await (await kit.k.handlers.listDishes(kit.k.request("/dishes", { cookie: kit.cookie }))).json(),
    );
    expect(catalog.dishes.map((item) => item.id).sort()).toEqual(["m1", "m2", "m3", "t1", "x1"]);
  });
});

describe("close matches and changed sites", () => {
  it("still proposes a dish whose name only resembles one we have, with the possible-duplicate warning", async () => {
    const model = fakeModel((title) =>
      title === "Gà kho gừng" ? { ok: true, reply: recipe("Thịt kho trứng cút", "man"), model: "m" } : undefined,
    );
    const kit = await setup({ model });
    await saveSettings(kit, { dishesPerDay: 10, pauseAt: 15, pagesPerRun: 10 });
    await runNow(kit);
    const item = (await pending(kit)).find((dish) => dish.name === "Thịt kho trứng cút");
    expect(item?.warnings).toContainEqual({ code: "possible-duplicate", of: "dish", id: "m2", name: "Thịt kho trứng", hidden: false });
  });

  it("reports a source whose pages no longer list any recipe as a layout error", async () => {
    const kit = await setup();
    kit.web.served.set(LISTING, { ok: true, text: "<html><body><a href='/the-thao'>Thể thao</a></body></html>" });
    const run = await runNow(kit);
    expect(run.entries).toContainEqual({ kind: "error", reason: "layout", sourceId: "vnexpress" });
    expect(run.status).toBe("partial");
  });
});

describe("Duyệt and Bỏ on a dish the agent found", () => {
  it("remember the page as approved or discarded, so it is never proposed again", async () => {
    const kit = await setup();
    await runNow(kit);
    const items = await pending(kit);
    const canh = items.find((item) => item.name === "Canh bí đỏ nấu tôm")!;
    const bun = items.find((item) => item.name === "Bún riêu cua")!;
    const { k, cookie } = kit;
    const draft = { mealType: canh.mealType, category: canh.category, chay: canh.chay, region: canh.region, name: canh.name, time: canh.time, ingredients: canh.ingredients, steps: canh.steps };
    expect((await k.handlers.approvePending(k.request(`/pending/${canh.id}/approve`, { method: "POST", body: draft, cookie }), canh.id)).status).toBe(201);
    expect((await k.handlers.discardPending(k.request(`/pending/${bun.id}`, { method: "DELETE", cookie }), bun.id)).status).toBe(200);
    const seen = await listSeen(ctx.db);
    expect(seen.find((page) => page.url === canh.source.url)?.outcome).toBe("approved");
    expect(seen.find((page) => page.url === bun.source.url)?.outcome).toBe("discarded");
    kit.model.read.length = 0;
    await runNow(kit);
    expect(kit.model.read).not.toContain("Canh bí đỏ nấu tôm");
    expect(kit.model.read).not.toContain("Bún riêu cua");
  });
});

describe("when something goes wrong", () => {
  it("tries a page that failed again on later runs, up to three times", async () => {
    const kit = await setup();
    const flaky = `${MON}/ga-kho-gung/`;
    kit.web.served.set(flaky, { ok: false, status: 503 });
    const reads = async () => {
      const before = kit.web.fetched.filter((url) => url === flaky).length;
      const run = await runNow(kit);
      return { run, fetched: kit.web.fetched.filter((url) => url === flaky).length - before };
    };
    const first = await reads();
    expect(first.fetched).toBe(1);
    expect(first.run.status).toBe("partial");
    expect(first.run.entries).toContainEqual({ kind: "error", reason: "page", sourceId: "monngonmoingay", url: flaky });
    expect((await reads()).fetched).toBe(1);
    expect((await reads()).fetched).toBe(1);
    expect((await reads()).fetched).toBe(0);
  });

  it("leaves a source alone when its robots.txt disallows the agent, and says so", async () => {
    const kit = await setup();
    kit.web.served.set(`${VNE}/robots.txt`, { ok: true, text: "User-agent: HomNayNauGiBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n" });
    const run = await runNow(kit);
    expect(kit.web.fetched.filter((url) => url.startsWith(VNE))).toEqual([`${VNE}/robots.txt`]);
    expect(run.entries).toContainEqual({ kind: "skip", reason: "robots", sourceId: "vnexpress" });
    expect(run.added).toBe(3);
    expect(run.status).toBe("ok");
  });

  it("still collects from one source when the other is down", async () => {
    const kit = await setup();
    kit.web.served.set(`${MON}/sitemap_index.xml`, { ok: false, status: 503 });
    const run = await runNow(kit);
    expect(run.entries).toContainEqual({ kind: "error", reason: "source", sourceId: "monngonmoingay" });
    expect((await pending(kit)).map((item) => item.name)).toEqual(["Bún riêu cua"]);
    expect(run.status).toBe("partial");
  });

  it("stops when the free models hit their limit, keeping what it already found", async () => {
    const model = fakeModel((_title, call) => (call > 1 ? { ok: false, failure: "rate_limited" } : undefined));
    const kit = await setup({ model });
    const run = await runNow(kit);
    expect(run).toMatchObject({ status: "partial", stoppedBy: "rate_limited" });
    expect(model.read.length).toBeLessThan(5);
    const found = (await pending(kit)).length;
    expect(run.added).toBe(found);
    // The pages the limit cut off were not used up: the next run reads them.
    model.read.length = 0;
    const next = await runNow(kit);
    expect(next.pagesRead).toBeGreaterThan(0);
  });

  it("starts no new page after the deadline, and keeps everything finished before it", async () => {
    // Each page takes the model 100 s.
    const clock: { advance?: (ms: number) => void } = {};
    const model = fakeModel(() => {
      clock.advance?.(100_000);
    });
    const kit = await setup({ model, deadlineMs: 240_000 });
    clock.advance = kit.k.advance;
    const run = await runNow(kit);
    expect(run.stoppedBy).toBe("deadline");
    expect(run.status).toBe("partial");
    expect(run.pagesRead).toBe(3);
    expect(run.added).toBe((await pending(kit)).length);
    expect(run.added).toBeGreaterThan(0);
  });

  it("reads nothing when the AI model is not set up", async () => {
    const kit = await setup({ reader: { configured: false, read: async () => ({ ok: false, failure: "not_configured" }) } });
    const run = await runNow(kit);
    expect(run).toMatchObject({ status: "failed", stoppedBy: "not_configured", pagesRead: 0 });
    expect(kit.web.fetched).toEqual([]);
  });
});

describe("when a run does not go ahead", () => {
  it("skips when dishes per day is 0", async () => {
    const kit = await setup();
    expect((await saveSettings(kit, { dishesPerDay: 0, pauseAt: 15, pagesPerRun: 10 })).status).toBe(200);
    const run = await runNow(kit);
    expect(run).toMatchObject({ status: "skipped", skipped: "paused", pagesRead: 0, added: 0 });
    expect(kit.web.fetched).toEqual([]);
  });

  it("skips when as many Món chờ duyệt are waiting as the pause threshold, and runs below it", async () => {
    const kit = await setup();
    await saveSettings(kit, { dishesPerDay: 3, pauseAt: 2, pagesPerRun: 10 });
    const draft = { mealType: "buacom" as const, category: "xao" as const, chay: false, region: null, name: "Món chờ", time: null, ingredients: ["a"], steps: ["b"] };
    await insertPending(ctx.db, { id: "p1", source: { kind: "menu", url: null }, model: null, draft: { ...draft, name: "Món một" }, at: kit.k.now() });
    expect((await runNow(kit)).status).not.toBe("skipped");
    const waiting = (await pending(kit)).length;
    expect(waiting).toBeGreaterThanOrEqual(2);
    const run = await runNow(kit);
    expect(run).toMatchObject({ status: "skipped", skipped: "too_many_waiting" });
  });

  it("answers 409 to a run started while another is going", async () => {
    const kit = await setup();
    const { k, cookie } = kit;
    const [a, b] = await Promise.all([
      k.handlers.startRun(k.request("/agent/runs", { method: "POST", body: {}, cookie })),
      kit.cron.collect(cronRequest(`Bearer ${CRON_SECRET}`)),
    ]);
    // Exactly one of them runs (Chạy ngay answers 201, the cron 200); the other is refused.
    expect([a.status, b.status].filter((status) => status === 409)).toHaveLength(1);
    expect([a.status, b.status].filter((status) => status === 201 || status === 200)).toHaveLength(1);
    const refused = a.status === 409 ? a : b;
    expect(apiErrorSchema.parse(await refused.json()).error.code).toBe("agent_running");
    // The lock is released afterwards: the next run goes ahead.
    expect((await runNow(kit)).status).toBe("ok");
  });

  it("does not stay locked by a run that crashed", async () => {
    const kit = await setup();
    await ctx.db.execute(
      // A lock left behind that ran out a minute ago.
      sql`INSERT INTO agent_settings (id, running_until) VALUES (1, ${new Date(kit.k.now().getTime() - 60_000).toISOString()}::timestamptz)`,
    );
    expect((await runNow(kit)).status).toBe("ok");
  });
});

describe("Lần chạy gần nhất", () => {
  it("lists the runs newest first, says whether one is going, and keeps only the last 30", async () => {
    const kit = await setup();
    await saveSettings(kit, { dishesPerDay: 0, pauseAt: 15, pagesPerRun: 10 });
    for (let i = 0; i < 32; i++) {
      await runNow(kit);
      kit.k.advance(60_000);
    }
    const list = await runs(kit);
    expect(list.running).toBe(false);
    expect(list.runs).toHaveLength(30);
    const started = list.runs.map((run) => run.startedAt);
    expect([...started].sort().reverse()).toEqual(started);
  });

  it("is for the Quản trị viên only", async () => {
    const kit = await setup();
    const { k } = kit;
    expect((await k.handlers.listRuns(k.request("/agent/runs"))).status).toBe(401);
    expect((await k.handlers.startRun(k.request("/agent/runs", { method: "POST", body: {} }))).status).toBe(401);
    expect((await k.handlers.startRun(k.request("/agent/runs", { method: "POST", body: {}, cookie: kit.cookie, origin: "https://evil.example" }))).status).toBe(403);
    expect(kit.web.fetched).toEqual([]);
  });
});

describe("Cài đặt tác nhân", () => {
  it("starts at 3 dishes a day, a pause at 15 waiting and 10 pages a run, and saves new values", async () => {
    const kit = await setup();
    const { k, cookie } = kit;
    const read = async () =>
      agentSettingsResponseSchema.parse(await (await k.handlers.getAgentSettings(k.request("/agent/settings", { cookie }))).json()).settings;
    expect(await read()).toEqual({ dishesPerDay: 3, pauseAt: 15, pagesPerRun: 10 });
    expect((await saveSettings(kit, { dishesPerDay: 5, pauseAt: 20, pagesPerRun: 12 })).status).toBe(200);
    expect(await read()).toEqual({ dishesPerDay: 5, pauseAt: 20, pagesPerRun: 12 });
  });

  it("refuses values out of range and names each one", async () => {
    const kit = await setup();
    const response = await saveSettings(kit, { dishesPerDay: 11, pauseAt: 0, pagesPerRun: 10 });
    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error).toMatchObject({ code: "bad_request", fields: ["dishesPerDay", "pauseAt"] });
    expect((await saveSettings(kit, { dishesPerDay: "3" })).status).toBe(400);
    expect((await saveSettings(kit, { dishesPerDay: 2.5, pauseAt: 15, pagesPerRun: 10 })).status).toBe(400);
  });
});
