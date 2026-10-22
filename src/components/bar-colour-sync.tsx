"use client";

import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BAR_COLOUR } from "@/lib/theme";

/**
 * The page declares a light and a dark bar colour for the device setting. When the person picks a
 * theme, both follow the pick; "Theo thiết bị" restores the per-device pair. Applied again after each
 * navigation: Next rewrites its head tags when the screen changes (an e2e test covers it).
 */
export function BarColourSync() {
  const { theme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    const chosen = theme === "light" || theme === "dark" ? theme : null;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = BAR_COLOUR[chosen ?? (meta.media.includes("dark") ? "dark" : "light")];
    }
  }, [theme, pathname]);

  return null;
}
