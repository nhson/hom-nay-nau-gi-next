import { createCollector } from "@/server/agent/collector";
import { createCronHandlers, readCronSecret } from "@/server/agent/cron";
import { httpFetcher } from "@/server/agent/page-fetcher";
import { getDb } from "@/server/db/client";
import { readAdminConfig } from "./config";
import { createAdminHandlers } from "./handlers";
import { createOpenRouterReader, readOpenRouterConfig } from "./openrouter-reader";

const getReader = () => createOpenRouterReader(readOpenRouterConfig());

/** The Tác nhân thu thập (spec B): the real web, the real database, OpenRouter. */
const collector = createCollector({ getDb, getReader, fetcher: httpFetcher });

/** The production wiring: real database, the settings from the environment, and OpenRouter (ADR-0007). */
export const adminHandlers = createAdminHandlers({
  getDb,
  getConfig: () => readAdminConfig(),
  getReader,
  getCollector: () => collector,
});

/** The daily cron route (Vercel sends Authorization: Bearer CRON_SECRET). */
export const cronHandlers = createCronHandlers({ getSecret: () => readCronSecret(), getCollector: () => collector });
