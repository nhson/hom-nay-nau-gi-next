export interface AdminConfig {
  passphrase: string;
  /** Signs the session cookie; at least 32 characters. */
  sessionSecret: string;
}

/**
 * The admin is switched on only when both settings exist (and the secret is long enough): a missing
 * setting must leave it unavailable, never open.
 */
export function readAdminConfig(env: Record<string, string | undefined> = process.env): AdminConfig | null {
  const passphrase = env.ADMIN_PASSPHRASE;
  const sessionSecret = env.ADMIN_SESSION_SECRET;
  if (!passphrase || !sessionSecret || sessionSecret.length < 32) return null;
  return { passphrase, sessionSecret };
}
