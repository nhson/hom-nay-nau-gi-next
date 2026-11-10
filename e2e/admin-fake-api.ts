import type { Page, Route } from "@playwright/test";
import { dishIdPrefix, nextDishId, normalizeDraft, validateDish } from "../src/domain/dish-rules";
import { checkAgentSettings, type AgentSettings, type RunEntry } from "../src/domain/collector";
import { startingTick } from "../src/domain/menu-photo";
import { readDishFile } from "../src/domain/dish-file";
import { pendingWarnings } from "../src/domain/pending-dish";

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

export interface FakePending {
  id: string;
  source: { kind: "menu" | "agent" | "file" | "photo"; url: string | null };
  model: string | null;
  mealType: "buacom" | "buatomonuoc";
  category: "xao" | "canh" | "man" | null;
  chay: boolean;
  region: "bac" | "trung" | "nam" | null;
  name: string;
  time: number | null;
  ingredients: string[];
  steps: string[];
  createdAt: string;
  updatedAt: string;
}

/** What the fake "model" reads off any menu photo. */
export const MENU_NAMES = ["Canh chua cá lóc", "Bò lúc lắc", "Gà kho gừng"];

/** What the fake "model" writes for a name (the name itself is the one sent). */
export const WRITTEN_RECIPE: Omit<FakePending, "id" | "source" | "model" | "name" | "createdAt" | "updatedAt"> = {
  mealType: "buacom",
  category: "man",
  chay: false,
  region: "bac",
  time: 40,
  ingredients: ["Gà 500g", "Gừng 1 củ"],
  steps: ["Chặt gà", "Kho với gừng"],
};

export interface FakeRun {
  id: string;
  trigger: "cron" | "manual";
  status: "ok" | "skipped" | "partial" | "failed";
  skipped: "paused" | "too_many_waiting" | null;
  stoppedBy: "rate_limited" | "not_configured" | "deadline" | null;
  pagesRead: number;
  added: number;
  entries: RunEntry[];
  startedAt: string;
  finishedAt: string;
}

/** What the fake agent finds on a Chạy ngay. */
export const AGENT_FIND: Omit<FakePending, "id" | "createdAt" | "updatedAt"> = {
  source: { kind: "agent", url: "https://monngonmoingay.com/bun-rieu-cua/" },
  model: "google/gemma-4-31b-it:free",
  mealType: "buatomonuoc",
  category: null,
  chay: false,
  region: "bac",
  name: "Bún riêu cua",
  time: 60,
  ingredients: ["Cua đồng 500g", "Bún tươi"],
  steps: ["Giã cua lọc nước", "Nấu riêu"],
};

export interface FakeAdmin {
  signedIn: boolean;
  version: number;
  dishes: FakeDish[];
  /** What the next save (PUT or POST) does instead of succeeding. One shot. */
  nextSave: "network" | "expired" | "tỏi" | null;
  requests: string[];
  pending: FakePending[];
  /** Whether an OpenRouter key is "configured". */
  readerConfigured: boolean;
  /** What the next menu read answers instead of names. One shot. */
  nextRead: "unreadable" | "no_dishes" | "reader_rate_limited" | "reader_unavailable" | null;
  /** What the next dish writes answer, in order: null succeeds, a code fails. Empty: all succeed. */
  writeAnswers: (null | "unusable_answer" | "reader_rate_limited" | "reader_unavailable")[];
  /** Menu photo uploads received (data URLs per upload). */
  uploads: string[][];
  /** Names sent to be written, in order. */
  written: string[];
  /** Lần chạy gần nhất first. */
  runs: FakeRun[];
  agentSettings: AgentSettings;
}

/**
 * A stateful stand-in for the admin API (CI has no database): the real pages talk to it through
 * request interception, so the page, its validation and its states are exercised for real.
 */
export async function installFakeAdmin(page: Page, initial: Partial<FakeAdmin> = {}): Promise<FakeAdmin> {
  const fake: FakeAdmin = {
    signedIn: false,
    version: 12,
    dishes: seedDishes(),
    nextSave: null,
    requests: [],
    pending: [],
    readerConfigured: true,
    nextRead: null,
    writeAnswers: [],
    uploads: [],
    written: [],
    runs: [],
    agentSettings: { dishesPerDay: 3, pauseAt: 15, pagesPerRun: 10 },
    ...initial,
  };
  const view = (item: FakePending) => ({
    ...item,
    warnings: pendingWarnings({ ...item, sourceKind: item.source.kind }, fake.dishes, fake.pending, item.id),
  });
  let pendingSeq = 0;
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

    if (path === "/agent/runs" && method === "GET") return json(route, 200, { runs: fake.runs, running: false });
    if (path === "/agent/runs" && method === "POST") {
      const at = new Date().toISOString();
      fake.pending.push({ ...AGENT_FIND, id: `a${++pendingSeq}`, createdAt: at, updatedAt: at });
      const run: FakeRun = {
        id: `r${fake.runs.length + 1}`,
        trigger: "manual",
        status: "ok",
        skipped: null,
        stoppedBy: null,
        pagesRead: 4,
        added: 1,
        entries: [
          { kind: "skip", reason: "not_a_recipe", sourceId: "vnexpress", url: "https://vnexpress.net/meo-bep-4800002.html" },
          { kind: "skip", reason: "duplicate", sourceId: "monngonmoingay", url: "https://monngonmoingay.com/canh-chua-ca-loc/" },
        ],
        startedAt: at,
        finishedAt: at,
      };
      fake.runs.unshift(run);
      return json(route, 201, { run });
    }
    if (path === "/agent/settings" && method === "GET") return json(route, 200, { settings: fake.agentSettings });
    if (path === "/agent/settings" && method === "PUT") {
      const checked = checkAgentSettings(request.postDataJSON() as AgentSettings);
      if (!checked.ok) return error(route, 400, "bad_request", "out of range", { fields: checked.fields });
      fake.agentSettings = checked.settings;
      return json(route, 200, { settings: fake.agentSettings });
    }

    if (path.startsWith("/pending")) {
      if (path === "/pending" && method === "GET") {
        const items = [...fake.pending].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view);
        return json(route, 200, { items, readerConfigured: fake.readerConfigured });
      }
      if (path === "/pending/menu" && method === "POST") {
        const { photos } = request.postDataJSON() as { photos: string[] };
        fake.uploads.push(photos);
        if (!fake.readerConfigured) return error(route, 503, "reader_not_configured");
        if (fake.nextRead) {
          const code = fake.nextRead;
          fake.nextRead = null;
          return error(route, code.startsWith("reader") ? 503 : 422, code);
        }
        const names = MENU_NAMES.map((name) => ({ name, ...startingTick(name, fake.dishes, fake.pending) }));
        return json(route, 200, { model: "google/gemma-4-31b-it:free", names });
      }
      if (path === "/pending/dishes" && method === "POST") {
        const { name } = request.postDataJSON() as { name: string };
        fake.written.push(name);
        if (!fake.readerConfigured) return error(route, 503, "reader_not_configured");
        const failure = fake.writeAnswers.shift();
        if (failure) return error(route, failure.startsWith("reader") ? 503 : 422, failure);
        const at = new Date(Date.UTC(2026, 10, 8, 2, 0, pendingSeq)).toISOString();
        const item: FakePending = { id: `p${++pendingSeq}`, source: { kind: "menu", url: null }, model: "google/gemma-4-31b-it:free", name, ...WRITTEN_RECIPE, createdAt: at, updatedAt: at };
        fake.pending.push(item);
        return json(route, 201, { pending: view(item) });
      }
      if (path === "/pending/import" && method === "POST") {
        const { fileName, text } = request.postDataJSON() as { fileName: string; text: string };
        const reading = readDishFile(text, [...fake.dishes, ...fake.pending].map((item) => item.name));
        if (!reading.ok) return error(route, 400, "bad_request", "bad file", { refusal: reading.refusal });
        const added = reading.add.map((item) => {
          const at = new Date(Date.UTC(2026, 10, 8, 3, 0, ++pendingSeq)).toISOString();
          const pending: FakePending = { id: `f${pendingSeq}`, source: { kind: "file", url: fileName }, model: null, ...item.draft, createdAt: at, updatedAt: at };
          fake.pending.push(pending);
          return { row: item.row, id: pending.id, name: item.draft.name, warnings: item.warnings };
        });
        return json(route, 201, { added, skipped: reading.skipped });
      }
      if (path === "/pending/approve" && method === "POST") {
        const { ids } = request.postDataJSON() as { ids: string[] };
        const approved: { id: string; dishId: string }[] = [];
        const failed: { id: string; reason: string; issues: unknown[] }[] = [];
        for (const pendingId of ids) {
          const at = fake.pending.findIndex((item) => item.id === pendingId);
          if (at < 0) {
            failed.push({ id: pendingId, reason: "not_found", issues: [] });
            continue;
          }
          const item = fake.pending[at];
          const draft = normalizeDraft({ mealType: item.mealType, category: item.category, chay: item.chay, region: item.region, name: item.name, time: item.time, ingredients: item.ingredients, steps: item.steps });
          const issues = validateDish(draft, fake.dishes);
          if (issues.length > 0) {
            failed.push({ id: pendingId, reason: "validation_failed", issues });
            continue;
          }
          const dishId = nextDishId(dishIdPrefix(draft), fake.dishes.map((d) => d.id));
          fake.dishes.push({ ...draft, id: dishId, retired: false, updatedAt: new Date().toISOString() });
          fake.pending.splice(at, 1);
          fake.version += 1;
          approved.push({ id: pendingId, dishId });
        }
        return json(route, 200, { version: fake.version, approved, failed });
      }
      const [, , pid, action] = path.split("/");
      const index = fake.pending.findIndex((item) => item.id === decodeURIComponent(pid ?? ""));
      if (index < 0) return error(route, 404, "not_found");
      if (method === "GET") return json(route, 200, { pending: view(fake.pending[index]) });
      if (method === "PUT") {
        fake.pending[index] = { ...fake.pending[index], ...normalizeDraft(request.postDataJSON()), updatedAt: new Date().toISOString() };
        return json(route, 200, { pending: view(fake.pending[index]) });
      }
      if (method === "DELETE") {
        fake.pending.splice(index, 1);
        return json(route, 200, { ok: true });
      }
      if (method === "POST" && action === "approve") {
        const draft = normalizeDraft(request.postDataJSON());
        const issues = validateDish(draft, fake.dishes);
        if (issues.length > 0) return error(route, 422, "validation_failed", "invalid", { issues });
        const id = nextDishId(dishIdPrefix(draft), fake.dishes.map((d) => d.id));
        const dish = { ...draft, id, retired: false, updatedAt: new Date().toISOString() };
        fake.dishes.push(dish);
        fake.pending.splice(index, 1);
        fake.version += 1;
        return json(route, 201, { version: fake.version, dish });
      }
      return error(route, 405, "method_not_allowed");
    }

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
      const draft = normalizeDraft(request.postDataJSON());
      const id = nextDishId(dishIdPrefix(draft), fake.dishes.map((d) => d.id));
      const dish = { ...draft, id, retired: false, updatedAt: new Date().toISOString() };
      fake.dishes.push(dish);
      fake.version += 1;
      return json(route, 201, { version: fake.version, dish });
    }
    const index = fake.dishes.findIndex((d) => d.id === id);
    if (index < 0) return error(route, 404, "not_found");
    if (method === "PUT") {
      fake.dishes[index] = { ...fake.dishes[index], ...normalizeDraft(request.postDataJSON()), updatedAt: new Date().toISOString() };
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
