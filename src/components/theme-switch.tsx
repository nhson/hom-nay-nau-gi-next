"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Theo thiết bị", icon: Monitor },
] as const;

// The stored choice is unknown on the server, so the icon only reflects it after the page has loaded.
const subscribe = () => () => {};
const useLoaded = () => useSyncExternalStore(subscribe, () => true, () => false);

/** Giao diện: an icon button (the current choice) that opens Sáng / Tối / Theo thiết bị. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const loaded = useLoaded();
  const current = OPTIONS.find((option) => option.value === (loaded ? theme : "system")) ?? OPTIONS[2];
  const Icon = current.icon;

  return (
    // Not modal: three options need no page lock, and nothing behind the menu is hidden from assistive technology.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Giao diện" className={cn("text-muted-foreground", className)}>
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={loaded ? (theme ?? "system") : "system"} onValueChange={setTheme}>
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <OptionIcon aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
