import { unconfiguredReader, type ReaderResult, type RecipeReader } from "./recipe-reader";

/**
 * The free models, in fallback order (ADR-0007): OpenRouter tries the next one when a model fails or
 * is rate-limited. Free models come and go; change this list (or OPENROUTER_MODELS) when one disappears.
 */
export const DEFAULT_MODELS = ["google/gemma-4-31b-it:free", "nvidia/nemotron-3.5-super-vl:free", "openrouter/free"];

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
/** Well under the function's 300 s limit, so a slow model still gets a clear answer back to the page. */
const TIMEOUT_MS = 120_000;

export interface OpenRouterConfig {
  apiKey: string;
  models: string[];
}

/** Sent as HTTP-Referer and X-Title so OpenRouter can attribute the calls to this app. */
const APP_URL = "https://hom-nay-nau-gi-next.vercel.app";

export function readOpenRouterConfig(env: Record<string, string | undefined> = process.env): OpenRouterConfig | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const listed = (env.OPENROUTER_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return { apiKey, models: listed.length > 0 ? listed : DEFAULT_MODELS };
}

/**
 * The production RecipeReader: one chat completion with the photos as image inputs and a JSON answer.
 * Deliberately thin (no logic worth testing); the answer is judged by `readRecipeReply`. Only recipe
 * photos and fixed instructions are sent, never anything from users' devices (ADR-0005).
 */
export function createOpenRouterReader(config: OpenRouterConfig | null): RecipeReader {
  if (!config) return unconfiguredReader;
  return {
    configured: true,
    async read({ instructions, photos }): Promise<ReaderResult> {
      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "POST",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "X-Title": "Hom nay nau gi",
            "HTTP-Referer": APP_URL,
          },
          body: JSON.stringify({
            models: config.models,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: instructions },
              {
                role: "user",
                content: [
                  { type: "text", text: "Đọc công thức trong các ảnh này." },
                  ...photos.map((url) => ({ type: "image_url", image_url: { url } })),
                ],
              },
            ],
          }),
        });
      } catch {
        return { ok: false, failure: "unavailable" };
      }
      if (response.status === 429) return { ok: false, failure: "rate_limited" };
      if (!response.ok) return { ok: false, failure: "unavailable" };

      const body = (await response.json().catch(() => null)) as {
        model?: string;
        choices?: { message?: { content?: unknown } }[];
        error?: { code?: number };
      } | null;
      if (body?.error) return { ok: false, failure: body.error.code === 429 ? "rate_limited" : "unavailable" };
      const content = body?.choices?.[0]?.message?.content;
      if (content === undefined) return { ok: false, failure: "unavailable" };
      return { ok: true, reply: content, model: body?.model ?? config.models[0] };
    },
  };
}
