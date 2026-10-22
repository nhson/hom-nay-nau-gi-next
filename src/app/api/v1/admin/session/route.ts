import { adminHandlers } from "@/server/admin";

export const GET = adminHandlers.session;
export const POST = adminHandlers.login;
export const DELETE = adminHandlers.logout;
