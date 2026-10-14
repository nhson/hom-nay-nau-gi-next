import { Drumstick, Flame, CookingPot, Soup, type LucideIcon } from "lucide-react";
import type { Dish } from "@/domain";
import { BOWL_LABEL, CATEGORY_LABEL } from "./labels";

export interface GroupStyle {
  label: string;
  icon: LucideIcon;
  /** Icon colour (non-text: 3:1 is enough). */
  iconClass: string;
  /** Soft tinted tile behind the icon. */
  tileClass: string;
  /** Thin accent used on the edge of a card. */
  edgeClass: string;
}

// Full class names (not built from strings) so Tailwind can see them.
const STYLES = {
  xao: { label: CATEGORY_LABEL.xao, icon: Flame, iconClass: "text-cat-xao", tileClass: "bg-cat-xao/15", edgeClass: "border-l-cat-xao" },
  canh: { label: CATEGORY_LABEL.canh, icon: CookingPot, iconClass: "text-cat-canh", tileClass: "bg-cat-canh/15", edgeClass: "border-l-cat-canh" },
  man: { label: CATEGORY_LABEL.man, icon: Drumstick, iconClass: "text-cat-man", tileClass: "bg-cat-man/15", edgeClass: "border-l-cat-man" },
  bowl: { label: BOWL_LABEL, icon: Soup, iconClass: "text-cat-bowl", tileClass: "bg-cat-bowl/15", edgeClass: "border-l-cat-bowl" },
} satisfies Record<string, GroupStyle>;

export type GroupKey = keyof typeof STYLES;

export function groupOf(dish: Pick<Dish, "category">): GroupKey {
  return dish.category ?? "bowl";
}

export function groupStyle(group: GroupKey): GroupStyle {
  return STYLES[group];
}
