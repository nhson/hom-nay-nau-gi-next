import { adminHandlers } from "@/server/admin";

// Chạy ngay waits for the whole run; the runner starts no new page after 240 s.
export const maxDuration = 300;

export const GET = adminHandlers.listRuns;
export const POST = adminHandlers.startRun;
