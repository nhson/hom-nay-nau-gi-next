/** Where the app is running, reduced to what the install hint cares about. */
export type InstallPlatform = "ios" | "other";

export interface InstallHintFacts {
  /** iPhone or iPad. Every iOS browser installs through the Share sheet and has no install prompt. */
  platform: InstallPlatform;
  /** Already running from the Home Screen. */
  standalone: boolean;
  /** The person tapped "Đã hiểu" (or closed the hint) on this device. */
  dismissed: boolean;
}

/** Whether to explain "Thêm vào MH chính": only where the browser itself never will. */
export function installHintVisible({ platform, standalone, dismissed }: InstallHintFacts): boolean {
  return platform === "ios" && !standalone && !dismissed;
}

export interface BrowserFacts {
  userAgent: string;
  /** `navigator.maxTouchPoints`. */
  maxTouchPoints: number;
}

/**
 * iPhone and iPod say so in the user agent. iPadOS 13+ reports itself as a Mac, so a "Mac" that has a
 * touch screen is an iPad (a real Mac has none).
 */
export function detectInstallPlatform({ userAgent, maxTouchPoints }: BrowserFacts): InstallPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios";
  return "other";
}
