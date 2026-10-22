import { describe, expect, it } from "vitest";
import { detectInstallPlatform, installHintVisible } from "./install-hint";

describe("installHintVisible", () => {
  it("shows on an iPhone or iPad browser tab that has not dismissed it", () => {
    expect(installHintVisible({ platform: "ios", standalone: false, dismissed: false })).toBe(true);
  });

  it("hides once the app runs from the Home Screen", () => {
    expect(installHintVisible({ platform: "ios", standalone: true, dismissed: false })).toBe(false);
  });

  it("hides after the person dismissed it", () => {
    expect(installHintVisible({ platform: "ios", standalone: false, dismissed: true })).toBe(false);
  });

  it("never shows off iOS: Android and desktop browsers offer their own install", () => {
    expect(installHintVisible({ platform: "other", standalone: false, dismissed: false })).toBe(false);
  });
});

describe("detectInstallPlatform", () => {
  const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const IPHONE_CHROME =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1";
  const IPAD_AS_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  const MAC_SAFARI = IPAD_AS_MAC;

  it.each([
    ["Safari on iPhone", IPHONE_SAFARI, 5],
    ["Chrome on iPhone", IPHONE_CHROME, 5],
    ["iPad, which reports itself as a Mac but has a touch screen", IPAD_AS_MAC, 5],
  ])("recognises %s as iOS", (_name, userAgent, maxTouchPoints) => {
    expect(detectInstallPlatform({ userAgent, maxTouchPoints })).toBe("ios");
  });

  it.each([
    ["Chrome on Android", ANDROID_CHROME, 5],
    ["Safari on a Mac (no touch screen)", MAC_SAFARI, 0],
  ])("recognises %s as another platform", (_name, userAgent, maxTouchPoints) => {
    expect(detectInstallPlatform({ userAgent, maxTouchPoints })).toBe("other");
  });
});
