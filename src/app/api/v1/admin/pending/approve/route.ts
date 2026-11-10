import { adminHandlers } from "@/server/admin";

// Bulk Duyệt (spec #41): several Món chờ duyệt, each approved on its own.
export const POST = adminHandlers.approvePendingMany;
