import { getDb } from "@/server/db/client";
import { readAdminConfig } from "./config";
import { createAdminHandlers } from "./handlers";
import { createOpenRouterReader, readOpenRouterConfig } from "./openrouter-reader";

/** The production wiring: real database, the settings from the environment, and OpenRouter (ADR-0007). */
export const adminHandlers = createAdminHandlers({
  getDb,
  getConfig: () => readAdminConfig(),
  getReader: () => createOpenRouterReader(readOpenRouterConfig()),
});
