import { adminHandlers } from "@/server/admin";

// Writing one dish waits for the AI model; the page sends one name per request, so each stays well inside this.
export const maxDuration = 180;

export const POST = adminHandlers.writeDish;
