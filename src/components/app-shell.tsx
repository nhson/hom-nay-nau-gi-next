"use client";

import { BookOpen, Heart, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Hôm nay", icon: UtensilsCrossed },
  { href: "/dishes", label: "Món ăn", icon: BookOpen },
  { href: "/favorites", label: "Yêu thích", icon: Heart },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="px-4 pt-6 pb-2 md:pt-10">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">
          Hôm nay <span className="text-turmeric-text">nấu gì?</span>
        </h1>
      </header>

      <nav
        aria-label="Chính"
        className={cn(
          "z-20 border-border bg-background/95 backdrop-blur",
          // Phone: thumb-reachable bar fixed to the bottom. Larger screens: tabs under the title.
          "fixed inset-x-0 bottom-0 border-t pb-[env(safe-area-inset-bottom)]",
          "md:static md:mx-4 md:mt-2 md:rounded-xl md:border md:pb-0",
        )}
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                    "md:min-h-11 md:flex-row md:gap-2 md:text-sm",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="flex-1 px-4 pt-4 pb-28 md:pb-12">{children}</main>
    </div>
  );
}
