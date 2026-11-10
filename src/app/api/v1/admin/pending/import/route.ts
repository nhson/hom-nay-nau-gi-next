import { adminHandlers } from "@/server/admin";

// Nhập từ file (spec #41): a JSON file of dishes becomes Món chờ duyệt. No AI.
export const POST = adminHandlers.importPending;
