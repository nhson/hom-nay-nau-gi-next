import {
  AGENT_NAME,
  chooseCandidates,
  pageText,
  rankByGaps,
  READ_PAGE_INSTRUCTIONS,
  readRecipeReply,
  RECIPE_SOURCES,
  robotsAllow,
  runGate,
  runStatus,
  similarNames,
  sitemapLocations,
  listingLinks,
  type Candidate,
  type DishDraft,
  type RecipeSource,
  type Rng,
  type RunEntry,
  type RunStop,
  type SeenOutcome,
} from "@/domain";
import { readAdminCatalog, type Db } from "@/server/catalog/repository";
import { insertPending, listPending } from "@/server/admin/pending-repository";
import type { RecipeReader } from "@/server/admin/recipe-reader";
import type { AgentRun } from "@/shared/schemas";
import type { PageFetcher } from "./page-fetcher";
import { listSeen, recordRun, recordSeen, releaseRunLock, takeRunLock } from "./repository";

export interface CollectorDeps {
  getDb: () => Db;
  getReader: () => RecipeReader;
  fetcher: PageFetcher;
  now?: () => Date;
  /** Waits between two requests to the same site. Tests pass one that returns at once. */
  sleep?: (ms: number) => Promise<void>;
  rng?: Rng;
  newId?: () => string;
  /** Default RECIPE_SOURCES; tests may narrow it. */
  sources?: readonly RecipeSource[];
  /** No new page is started after this long (default 240 s, under the 300 s function limit). */
  deadlineMs?: number;
}

export type RunOutcome = { ok: true; run: AgentRun } | { ok: false; reason: "running" };

export interface Collector {
  run(trigger: AgentRun["trigger"]): Promise<RunOutcome>;
}

const DEADLINE_MS = 240_000;
/** A crashed run's lock frees itself after this; longer than any run can last. */
const LOCK_MS = 330_000;
/** Pages read with the model at the same time. */
const CONCURRENCY = 3;

interface Found extends DishDraft {
  url: string;
  sourceId: string;
  model: string;
}

/** The Tác nhân thu thập (spec B, #31): one run, used by the daily cron and by Chạy ngay. */
export function createCollector(deps: CollectorDeps): Collector {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const rng = deps.rng ?? Math.random;
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const sources = deps.sources ?? RECIPE_SOURCES;
  const deadlineMs = deps.deadlineMs ?? DEADLINE_MS;

  /** Spaces out requests to one site by its source's delay, whichever worker makes them. */
  const nextSlot = new Map<string, number>();
  async function politely<T>(source: RecipeSource, request: () => Promise<T>): Promise<T> {
    const at = now().getTime();
    const slot = Math.max(at, nextSlot.get(source.id) ?? 0);
    nextSlot.set(source.id, slot + source.delayMs);
    if (slot > at) await sleep(slot - at);
    return request();
  }

  const path = (url: string) => {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  };

  /** The recipe pages a source lists, or null when they could not be read. */
  async function candidatesOf(source: RecipeSource, robots: string | null): Promise<string[] | null> {
    const get = (url: string) => politely(source, () => deps.fetcher.get(url));
    const allowed = (url: string) => source.articlePattern.test(url) && robotsAllow(robots, AGENT_NAME, path(url));
    if (source.find.kind === "listing") {
      const page = await get(source.find.url);
      return page.ok ? listingLinks(page.text, source.find.url, source.articlePattern).filter(allowed) : null;
    }
    const index = await get(source.find.index);
    if (!index.ok) return null;
    const pattern = source.find.sitemapPattern;
    const sitemaps = sitemapLocations(index.text).filter((url) => pattern.test(url));
    const urls: string[] = [];
    let read = 0;
    for (const sitemap of sitemaps) {
      const xml = await get(sitemap);
      if (!xml.ok) continue;
      read++;
      urls.push(...sitemapLocations(xml.text).filter(allowed));
    }
    return read > 0 || sitemaps.length === 0 ? [...new Set(urls)] : null;
  }

  async function run(trigger: AgentRun["trigger"]): Promise<RunOutcome> {
    const db = deps.getDb();
    const startedAt = now();
    const settings = await takeRunLock(db, startedAt, new Date(startedAt.getTime() + LOCK_MS));
    if (!settings) return { ok: false, reason: "running" };

    const entries: RunEntry[] = [];
    const seenNow: { url: string; sourceId: string; outcome: SeenOutcome }[] = [];
    let skipped: AgentRun["skipped"] = null;
    let stoppedBy: RunStop | null = null;
    let pagesRead = 0;
    let added = 0;

    try {
      const catalog = (await readAdminCatalog(db))?.dishes ?? [];
      const pending = await listPending(db);
      const gate = runGate(settings, pending.length);
      const reader = deps.getReader();
      if (!gate.run) {
        skipped = gate.reason;
      } else if (!reader.configured) {
        stoppedBy = "not_configured";
      } else {
        const seen = await listSeen(db);
        const knownNames = [...catalog.map((dish) => dish.name), ...pending.map((item) => item.name)];

        const listed: { sourceId: string; urls: string[] }[] = [];
        for (const source of sources) {
          const robotsFile = await politely(source, () => deps.fetcher.get(`${source.origin}/robots.txt`));
          // No robots.txt (a 4xx) means everything is allowed; a site that cannot answer is left alone.
          if (!robotsFile.ok && !(robotsFile.status && robotsFile.status >= 400 && robotsFile.status < 500)) {
            entries.push({ kind: "error", reason: "source", sourceId: source.id });
            continue;
          }
          const robots = robotsFile.ok ? robotsFile.text : null;
          const start = source.find.kind === "listing" ? source.find.url : source.find.index;
          if (!robotsAllow(robots, AGENT_NAME, path(start))) {
            entries.push({ kind: "skip", reason: "robots", sourceId: source.id });
            continue;
          }
          const urls = await candidatesOf(source, robots);
          if (urls === null) entries.push({ kind: "error", reason: "source", sourceId: source.id });
          else listed.push({ sourceId: source.id, urls });
        }

        const choice = chooseCandidates({ sources: listed, seen, knownNames, pagesPerRun: settings.pagesPerRun, rng });
        for (const duplicate of choice.duplicates) {
          entries.push({ kind: "skip", reason: "duplicate", sourceId: duplicate.sourceId, url: duplicate.url });
          seenNow.push({ ...duplicate, outcome: "duplicate" });
        }

        const found: Found[] = [];
        const queue = [...choice.pick];
        const bySource = new Map(sources.map((source) => [source.id, source]));

        async function readPage(candidate: Candidate): Promise<void> {
          const source = bySource.get(candidate.sourceId)!;
          const page = await politely(source, () => deps.fetcher.get(candidate.url));
          if (!page.ok) {
            entries.push({ kind: "error", reason: "page", sourceId: candidate.sourceId, url: candidate.url });
            seenNow.push({ ...candidate, outcome: "failed" });
            return;
          }
          const { title, text } = pageText(page.text);
          pagesRead++;
          const answer = await reader.read({ instructions: READ_PAGE_INSTRUCTIONS, prompt: `${title}\n\n${text}` });
          if (!answer.ok) {
            if (answer.failure === "unavailable") {
              entries.push({ kind: "error", reason: "reader", sourceId: candidate.sourceId, url: candidate.url });
              seenNow.push({ ...candidate, outcome: "failed" });
            } else {
              // Not this page's fault: it stays unseen and the run stops.
              stoppedBy = answer.failure;
            }
            return;
          }
          const reading = readRecipeReply(answer.reply);
          if (!reading.ok) {
            if (reading.reason === "not_a_recipe") {
              entries.push({ kind: "skip", reason: "not_a_recipe", sourceId: candidate.sourceId, url: candidate.url });
              seenNow.push({ ...candidate, outcome: "not_a_recipe" });
            } else {
              const reason = reading.reason === "unreadable" ? "unreadable" : "reader";
              entries.push(
                reason === "unreadable"
                  ? { kind: "skip", reason, sourceId: candidate.sourceId, url: candidate.url }
                  : { kind: "error", reason, sourceId: candidate.sourceId, url: candidate.url },
              );
              seenNow.push({ ...candidate, outcome: "failed" });
            }
            return;
          }
          const { draft } = reading;
          const names = [...knownNames, ...found.map((dish) => dish.name)];
          if (!draft.name || names.some((name) => similarNames(draft.name, name))) {
            entries.push({ kind: "skip", reason: "duplicate", sourceId: candidate.sourceId, url: candidate.url });
            seenNow.push({ ...candidate, outcome: "duplicate" });
            return;
          }
          found.push({ ...draft, ...candidate, model: answer.model });
        }

        async function worker(): Promise<void> {
          for (;;) {
            if (stoppedBy) return;
            if (now().getTime() - startedAt.getTime() >= deadlineMs) {
              stoppedBy = "deadline";
              return;
            }
            const candidate = queue.shift();
            if (!candidate) return;
            await readPage(candidate);
          }
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        // A deadline that fell after the last page was started stopped nothing.
        if (stoppedBy === "deadline" && queue.length === 0) stoppedBy = null;

        const kept = rankByGaps(found, catalog, settings.dishesPerDay);
        for (const dish of found) {
          if (!kept.includes(dish)) {
            // Left unseen, so a later run can pick it up again.
            entries.push({ kind: "skip", reason: "not_kept", sourceId: dish.sourceId, url: dish.url });
            continue;
          }
          const { url, sourceId, model, ...draft } = dish;
          await insertPending(db, { id: newId(), source: { kind: "agent", url }, model, draft, at: now() });
          seenNow.push({ url, sourceId, outcome: "proposed" });
          added++;
        }
      }
    } catch (error) {
      console.error("collector run failed", error);
      entries.push({ kind: "error", reason: "source", sourceId: "agent" });
    } finally {
      try {
        await recordSeen(db, seenNow, now());
      } finally {
        await releaseRunLock(db);
      }
    }

    const errors = entries.filter((entry) => entry.kind === "error").length;
    const result: AgentRun = {
      id: newId(),
      trigger,
      status: runStatus({ skipped, pagesRead, added, errors, stoppedBy }),
      skipped,
      stoppedBy,
      pagesRead,
      added,
      entries,
      startedAt: startedAt.toISOString(),
      finishedAt: now().toISOString(),
    };
    await recordRun(db, result);
    return { ok: true, run: result };
  }

  return { run };
}
