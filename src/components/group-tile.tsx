import { groupStyle, type GroupKey } from "@/lib/category-style";
import { cn } from "@/lib/utils";

/** The tinted icon tile that identifies a kind of dish (decorative: the label sits next to it). */
export function GroupTile({ group, className }: { group: GroupKey; className?: string }) {
  const { icon: Icon, tileClass, iconClass } = groupStyle(group);
  return (
    <span aria-hidden className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", tileClass, className)}>
      <Icon className={cn("size-6", iconClass)} strokeWidth={1.75} />
    </span>
  );
}
