"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { BarColourSync } from "./bar-colour-sync";

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
