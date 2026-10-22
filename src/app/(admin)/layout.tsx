import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { BAR_COLOUR } from "@/lib/theme";
import { beVietnam, fraunces } from "../fonts";
import "../globals.css";

// The admin has its own root layout: no on-device data provider, no bottom navigation, no analytics
// and no service-worker registration, so nothing about it leaks into the user app.
export const metadata: Metadata = {
  title: "Quản trị · Hôm nay nấu gì?",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BAR_COLOUR.light },
    { media: "(prefers-color-scheme: dark)", color: BAR_COLOUR.dark },
  ],
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-center" duration={6000} closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
