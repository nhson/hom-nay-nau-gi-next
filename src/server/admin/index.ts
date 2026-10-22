import { getDb } from "@/server/db/client";
import { readAdminConfig } from "./config";
import { createAdminHandlers } from "./handlers";

/** The production wiring: real database and the settings from the environment. */
export const adminHandlers = createAdminHandlers({ getDb, getConfig: () => readAdminConfig() });
