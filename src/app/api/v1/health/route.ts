import { getDb } from "@/server/db/client";
import { createHealthHandlers } from "@/server/health/handlers";

const handlers = createHealthHandlers(getDb);

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
