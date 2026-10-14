import * as React from "react";
import { cn } from "@/lib/utils";

/** A styled native <select>: the best picker on phones (OS sheet, accessible by default). */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none transition-colors md:text-sm",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-invalid:border-destructive dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
