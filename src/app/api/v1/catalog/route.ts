import { createCatalogHandlers } from "@/server/catalog/handlers";
import { getDb } from "@/server/db/client";

const handlers = createCatalogHandlers(getDb);

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
