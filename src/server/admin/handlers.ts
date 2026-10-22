import { z } from "zod";
import { dishIdPrefix, nextDishId, normalizeDraft, validateDish, type DishDraft } from "@/domain";
import { errorResponse } from "@/server/api/responses";
import { readAdminCatalog, readCatalog, type AdminDish, type Db } from "@/server/catalog/repository";
import { adminCatalogResponseSchema, catalogResponseSchema, dishDraftSchema } from "@/shared/schemas";
import type { AdminConfig } from "./config";
import { createDish, isUniqueViolation, setRetired, updateDish, type Saved } from "./repository";
import {
  clearedSessionCookie,
  createSessionToken,
  readCookie,
  secretsMatch,
  SESSION_COOKIE,
  sessionCookie,
  verifySessionToken,
} from "./session";
import { clearFailures, lockedUntil, recordFailure } from "./throttle";

export type { AdminConfig } from "./config";

export interface AdminDeps {
  getDb: () => Db;
  /** Null when the admin is not configured: every admin route then answers 503. */
  getConfig: () => AdminConfig | null;
  /** Injected so tests control time. */
  now?: () => Date;
}

const loginBody = z.object({ passphrase: z.string() });
const hiddenBody = z.object({ retired: z.boolean() });

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}) =>
  Response.json(body, { ...init, headers: { ...noStore, ...init.headers } });

/**
 * The client the failed-attempt counter belongs to: the first address the platform saw. On Vercel the
 * platform sets this header itself, so a client cannot pick its own key to dodge the lock.
 */
function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

const isSecure = (request: Request) => new URL(request.url).protocol === "https:";

/**
 * Route Handlers for the admin API. Takes plain Requests and returns Responses so the contract tests
 * and the thin files under src/app/api call exactly this code.
 */
export function createAdminHandlers(deps: AdminDeps) {
  const now = deps.now ?? (() => new Date());

  const unavailable = () =>
    errorResponse(503, "admin_unavailable", "The admin area is not available.");

  /** Writes must come from this site, as JSON: another site cannot make the owner's browser change anything. */
  function checkWrite(request: Request): Response | null {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return errorResponse(403, "forbidden_origin", "This request did not come from the admin page.");
    }
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
        return errorResponse(415, "unsupported_media_type", "Send JSON.");
      }
    }
    return null;
  }

  /** Null when the caller is signed in; otherwise the response to return. */
  function requireAdmin(request: Request, config: AdminConfig): Response | null {
    const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
    return verifySessionToken(config.sessionSecret, token, now())
      ? null
      : errorResponse(401, "unauthorized", "Sign in to continue.");
  }

  async function signIn(request: Request, config: AdminConfig): Promise<Response> {
    let body: z.infer<typeof loginBody>;
    try {
      body = loginBody.parse(await request.json());
    } catch {
      return errorResponse(400, "bad_request", "Send { passphrase }.");
    }

    const db = deps.getDb();
    const key = clientKey(request);
    const current = now();

    const locked = await lockedUntil(db, key, current);
    if (locked) return lockedResponse(locked, current);

    if (!secretsMatch(body.passphrase, config.passphrase)) {
      const nowLocked = await recordFailure(db, key, current);
      return nowLocked
        ? lockedResponse(nowLocked, current)
        : errorResponse(401, "invalid_credentials", "Wrong password.");
    }

    await clearFailures(db, key);
    return json(
      { ok: true },
      { headers: { "Set-Cookie": sessionCookie(createSessionToken(config.sessionSecret, current), isSecure(request)) } },
    );
  }

  async function login(request: Request): Promise<Response> {
    const config = deps.getConfig();
    if (!config) return unavailable();
    const blocked = checkWrite(request);
    if (blocked) return blocked;
    try {
      return await signIn(request, config);
    } catch (error) {
      console.error("admin sign-in failed", error);
      return errorResponse(500, "internal_error", "Something went wrong. Please try again.");
    }
  }

  function lockedResponse(until: Date, current: Date): Response {
    const seconds = Math.max(1, Math.ceil((until.getTime() - current.getTime()) / 1000));
    return errorResponse(
      429,
      "locked",
      "Too many wrong passwords. Try again later.",
      { "Retry-After": String(seconds) },
      { lockedUntil: until.toISOString() },
    );
  }

  async function logout(request: Request): Promise<Response> {
    const config = deps.getConfig();
    if (!config) return unavailable();
    const blocked = checkWrite(request);
    if (blocked) return blocked;
    return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie(isSecure(request)) } });
  }

  async function session(request: Request): Promise<Response> {
    const config = deps.getConfig();
    if (!config) return unavailable();
    return requireAdmin(request, config) ?? json({ ok: true });
  }

  /** Runs `handle` for a signed-in admin; writes also pass the same-site checks. */
  function guarded(write: boolean, handle: (request: Request, db: Db) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      const config = deps.getConfig();
      if (!config) return unavailable();
      // Who you are first (401), then whether the request came from our own page (403).
      const denied = requireAdmin(request, config) ?? (write ? checkWrite(request) : null);
      if (denied) return denied;
      try {
        return await handle(request, deps.getDb());
      } catch (error) {
        console.error("admin request failed", error);
        return errorResponse(500, "internal_error", "Something went wrong. Please try again.");
      }
    };
  }

  const catalogUnavailable = () => errorResponse(503, "catalog_unavailable", "The catalog has not been published yet.");

  async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T | null> {
    try {
      return schema.parse(await request.json());
    } catch {
      return null;
    }
  }

  const listDishes = guarded(false, async (_request, db) => {
    const catalog = await readAdminCatalog(db);
    return catalog ? json(adminCatalogResponseSchema.parse(catalog)) : catalogUnavailable();
  });

  const exportCatalog = guarded(false, async (_request, db) => {
    const catalog = await readCatalog(db);
    if (!catalog) return catalogUnavailable();
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now());
    return json(catalogResponseSchema.parse(catalog), {
      headers: { "Content-Disposition": `attachment; filename="danh-muc-mon-${day}.json"` },
    });
  });

  const badDish = () =>
    errorResponse(400, "bad_request", "Send a dish: mealType, category, chay, region, name, time, ingredients, steps.");

  /** The dish as stored: what was submitted, plus the facts only the database knows. */
  const stored = (id: string, draft: DishDraft, saved: Saved): AdminDish => ({
    id,
    ...draft,
    retired: saved.retired,
    updatedAt: saved.updatedAt,
  });

  const createDishHandler = guarded(true, async (request, db) => {
    const input = await readJson(request, dishDraftSchema);
    if (!input) return badDish();
    const draft = normalizeDraft(input);

    // Two people adding at the same moment can pick the same next id: the loser reads again and takes the next one.
    for (let attempt = 0; attempt < 3; attempt++) {
      const catalog = await readCatalog(db);
      if (!catalog) return catalogUnavailable();
      const issues = validateDish(draft, catalog.dishes);
      if (issues.length > 0) return validationFailed(issues);

      const id = nextDishId(dishIdPrefix(draft), catalog.dishes.map((dish) => dish.id));
      try {
        const saved = await createDish(db, id, draft);
        return saved ? json({ version: saved.version, dish: stored(id, draft, saved) }, { status: 201 }) : catalogUnavailable();
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    return errorResponse(500, "internal_error", "Something went wrong. Please try again.");
  });

  const updateDishHandler = (request: Request, id: string) =>
    guarded(true, async (req, db) => {
      const input = await readJson(req, dishDraftSchema);
      if (!input) return badDish();
      const catalog = await readCatalog(db);
      if (!catalog) return catalogUnavailable();
      if (!catalog.dishes.some((dish) => dish.id === id)) return notFound();

      const draft = normalizeDraft(input);
      const issues = validateDish(draft, catalog.dishes, id);
      if (issues.length > 0) return validationFailed(issues);

      const saved = await updateDish(db, id, draft);
      return saved ? json({ version: saved.version, dish: stored(id, draft, saved) }) : notFound();
    })(request);

  const setHiddenHandler = (request: Request, id: string) =>
    guarded(true, async (req, db) => {
      const input = await readJson(req, hiddenBody);
      if (!input) return errorResponse(400, "bad_request", "Send { retired: true | false }.");
      const catalog = await readAdminCatalog(db);
      if (!catalog) return catalogUnavailable();
      const current = catalog.dishes.find((dish) => dish.id === id);
      if (!current) return notFound();
      // Already in that state: nothing to publish, so no new catalog version.
      if (current.retired === input.retired) return json({ version: catalog.version, dish: current });

      const saved = await setRetired(db, id, input.retired);
      if (saved) return json({ version: saved.version, dish: { ...current, retired: saved.retired, updatedAt: saved.updatedAt } });
      // Someone else changed it in between: report what is there now.
      const fresh = await readAdminCatalog(db);
      const dish = fresh?.dishes.find((item) => item.id === id);
      return fresh && dish ? json({ version: fresh.version, dish }) : notFound();
    })(request);

  const notFound = () => errorResponse(404, "not_found", "No dish with that id.");

  function validationFailed(issues: ReturnType<typeof validateDish>): Response {
    return errorResponse(422, "validation_failed", "The dish cannot be saved as it is.", {}, { issues });
  }

  return {
    login,
    logout,
    session,
    listDishes,
    createDish: createDishHandler,
    updateDish: updateDishHandler,
    setHidden: setHiddenHandler,
    exportCatalog,
  };
}
