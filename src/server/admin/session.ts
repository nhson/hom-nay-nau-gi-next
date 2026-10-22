import { createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_DAYS } from "@/shared/admin-policy";

export const SESSION_COOKIE = "admin_session";
export const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

const sign = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

/** `v1.<expiry in epoch seconds>.<signature>`: stateless, so there is nothing to store or revoke server-side. */
export function createSessionToken(secret: string, now: Date): string {
  const payload = `v1.${Math.floor(now.getTime() / 1000) + SESSION_SECONDS}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifySessionToken(secret: string, token: string | undefined, now: Date): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [version, expires, signature] = parts;
  const expected = Buffer.from(sign(secret, `${version}.${expires}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const expiresAt = Number(expires);
  return Number.isFinite(expiresAt) && expiresAt * 1000 > now.getTime();
}

/** Compares two secrets without revealing, through timing, how much of the guess was right. */
export function secretsMatch(a: string, b: string): boolean {
  const left = createHmac("sha256", "compare").update(a).digest();
  const right = createHmac("sha256", "compare").update(b).digest();
  return timingSafeEqual(left, right);
}

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}
