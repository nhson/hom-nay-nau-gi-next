"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BAR_COLOUR, THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Giao diện. The theme is an attribute on the root element, set before the page paints (so no flash)
 * from the person's choice or, for "Theo thiết bị", from the device. Both root layouts use this one
 * provider and storage key, so the app and the admin share the choice.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="data-theme" defaultTheme="system" enableSystem storageKey={THEME_STORAGE_KEY} disableTransitionOnChange>
      <BarColourSync />
      {children}
    </NextThemes>
  );
}

/**
 * The page declares a light and a dark bar colour for the device setting. When the person picks a
 * theme, both follow the pick; "Theo thiết bị" restores the per-device pair. Re-applied after each
 * navigation because the framework may rewrite its head tags.
 */
function BarColourSync() {
  const { theme, resolvedTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    const chosen = theme === "light" || theme === "dark" ? theme : null;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      const forDark = (meta.media ?? "").includes("dark");
      meta.content = BAR_COLOUR[chosen ?? (forDark ? "dark" : "light")];
    }
  }, [theme, resolvedTheme, pathname]);

  return null;
}
