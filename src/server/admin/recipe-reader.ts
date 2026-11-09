/** Why the AI model could not be asked. */
export type ReaderFailure = "not_configured" | "unavailable" | "rate_limited";

export type ReaderResult = { ok: true; reply: unknown; model: string } | { ok: false; failure: ReaderFailure };

/**
 * The port to the AI model (ADR-0007): it reads the dish names off an Ảnh thực đơn and writes a recipe for one name. Production talks to OpenRouter;
 * tests inject a fake. Returns the model's raw answer: turning it into a dish is a domain rule.
 */
export interface RecipeReader {
  /** Whether the reader has what it needs (an API key), so the page can say so before an upload. */
  configured: boolean;
  /** `photos` are data URLs (JPEG, PNG or WebP) of one menu; absent for a text-only call (writing a recipe). */
  read(input: { instructions: string; photos?: string[] }): Promise<ReaderResult>;
}

/** A reader that is switched off: every read reports `not_configured`. */
export const unconfiguredReader: RecipeReader = {
  configured: false,
  read: async () => ({ ok: false, failure: "not_configured" }),
};
