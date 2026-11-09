import { AGENT_USER_AGENT } from "@/domain";

/** What fetching one URL gave: the body text, or the HTTP status (null when there was no answer). */
export type FetchResult = { ok: true; text: string } | { ok: false; status: number | null };

/** How the Tác nhân thu thập reads the web. Injected, so the contract tests serve pages from memory. */
export interface PageFetcher {
  get(url: string): Promise<FetchResult>;
}

const TIMEOUT_MS = 15_000;
/** Recipe pages are well under this; anything bigger is not worth reading. */
const MAX_BYTES = 2 * 1024 * 1024;

/** The real fetcher: honest User-Agent, a timeout, and a size cap. Politeness delays are the runner's job. */
export const httpFetcher: PageFetcher = {
  async get(url) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": AGENT_USER_AGENT, Accept: "text/html,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.5" },
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        return { ok: false, status: response.status };
      }
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > MAX_BYTES) {
        await response.body.cancel();
        return { ok: false, status: null };
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          return { ok: false, status: null };
        }
        chunks.push(value);
      }
      return { ok: true, text: new TextDecoder("utf-8").decode(Buffer.concat(chunks)) };
    } catch {
      return { ok: false, status: null };
    }
  },
};
