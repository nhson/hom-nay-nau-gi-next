import { cronHandlers } from "@/server/admin";

// The daily Tác nhân thu thập run; the runner starts no new page after 240 s.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export const GET = cronHandlers.collect;
