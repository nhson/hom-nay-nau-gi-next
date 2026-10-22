"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const CHOICES = ["light", "dark", "system"] as const;
type Choice = (typeof CHOICES)[number];

const LABEL: Record<Choice, string> = { light: "Sáng", dark: "Tối", system: "Theo thiết bị" };
const ICON = { light: Sun, dark: Moon, system: Monitor } satisfies Record<Choice, unknown>;

const isChoice = (value: string | undefined): value is Choice => CHOICES.some((choice) => choice === value);

// The stored choice is unknown on the server, so it is only shown once the page has loaded.
const subscribe = () => () => {};
const useLoaded = () => useSyncExternalStore(subscribe, () => true, () => false);

/** Giao diện: an icon button (the current choice) that opens Sáng / Tối / Theo thiết bị. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const loaded = useLoaded();
  const choice: Choice = loaded && isChoice(theme) ? theme : "system";
  const Icon = ICON[choice];

  return (
    // Not modal: three options need no page lock, and nothing behind the menu is hidden from assistive technology.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Giao diện" className={cn("text-muted-foreground", className)}>
          <Icon aria-hidden className={loaded ? undefined : "invisible"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={choice} onValueChange={setTheme}>
          {CHOICES.map((value) => {
            const OptionIcon = ICON[value];
            return (
              <DropdownMenuRadioItem key={value} value={value}>
                <OptionIcon aria-hidden />
                {LABEL[value]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
