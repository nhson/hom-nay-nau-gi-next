import { track } from "@vercel/analytics";
import type { AnalyticsEvent } from "@/domain";

/** Fire-and-forget: tracking can never throw into, block or slow the UI (it is also a no-op offline). */
export function trackEvents(events: readonly AnalyticsEvent[]): void {
  for (const event of events) {
    try {
      track(event.name, event.props);
    } catch {
      // Analytics is best effort.
    }
  }
}
