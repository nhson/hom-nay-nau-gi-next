import { createAdminHandlers, type AdminConfig } from "./handlers";
import type { Db } from "@/server/catalog/repository";

export const PASSPHRASE = "correct horse battery staple";
export const SESSION_SECRET = "s".repeat(48);
export const START = Date.UTC(2026, 9, 22, 3, 0, 0);

/** Test harness: admin handlers over a test database with a controllable clock. */
export function createAdminKit(getDb: () => Db, config: AdminConfig | null = { passphrase: PASSPHRASE, sessionSecret: SESSION_SECRET }) {
  let nowMs = START;
  const handlers = createAdminHandlers({ getDb, getConfig: () => config, now: () => new Date(nowMs) });

  function request(
    path: string,
    init: { method?: string; body?: unknown; cookie?: string; origin?: string | null; ip?: string; contentType?: string | null } = {},
  ): Request {
    const headers = new Headers();
    const origin = init.origin === undefined ? "http://localhost" : init.origin;
    if (origin) headers.set("origin", origin);
    if (init.cookie) headers.set("cookie", init.cookie);
    if (init.ip) headers.set("x-forwarded-for", init.ip);
    const hasBody = init.body !== undefined;
    const contentType = init.contentType === undefined ? (hasBody ? "application/json" : null) : init.contentType;
    if (contentType) headers.set("content-type", contentType);
    return new Request(`http://localhost/api/v1/admin${path}`, {
      method: init.method ?? "GET",
      headers,
      body: hasBody ? JSON.stringify(init.body) : undefined,
    });
  }

  /** Signs in and returns the cookie header a browser would send next. */
  async function signIn(ip = "10.0.0.1"): Promise<string> {
    const response = await handlers.login(request("/session", { method: "POST", body: { passphrase: PASSPHRASE }, ip }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    return setCookie.split(";")[0];
  }

  return {
    handlers,
    request,
    signIn,
    advance: (ms: number) => {
      nowMs += ms;
    },
    now: () => new Date(nowMs),
  };
}
