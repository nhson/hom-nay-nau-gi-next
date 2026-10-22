import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/app-provider";
import { AppShell } from "@/components/app-shell";
import { PwaProvider } from "@/components/pwa-provider";
import { UpdatePrompt } from "@/components/update-prompt";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { BAR_COLOUR } from "@/lib/theme";
import { beVietnam, fraunces } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Hôm nay nấu gì?",
  applicationName: "Hôm nay nấu gì?",
  appleWebApp: { capable: true, title: "Nấu gì?", statusBarStyle: "default" },
  // Next emits only the unprefixed tag; iOS before 16.4 needs Apple's to open the installed app standalone.
  other: { "apple-mobile-web-app-capable": "yes" },
  description:
    "Gợi ý bữa cơm gia đình mỗi ngày: 3 món hoặc 1 món, kèm cách nấu và danh sách đi chợ.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BAR_COLOUR.light },
    { media: "(prefers-color-scheme: dark)", color: BAR_COLOUR.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>
          <PwaProvider>
            <AppProvider>
              <AppShell>{children}</AppShell>
              <Toaster position="top-center" />
              <UpdatePrompt />
              <Analytics />
            </AppProvider>
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
