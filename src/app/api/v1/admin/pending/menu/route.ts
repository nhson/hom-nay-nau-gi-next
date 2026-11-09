import { adminHandlers } from "@/server/admin";

// Reading an Ảnh thực đơn waits for the AI model; the reader gives up after 120 s, well inside this.
export const maxDuration = 180;

export const POST = adminHandlers.readMenu;
