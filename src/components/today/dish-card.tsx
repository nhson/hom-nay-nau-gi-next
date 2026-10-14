import { ChevronDown, Clock, Leaf, ShoppingBasket, Shuffle } from "lucide-react";
import { viewRecipeEvent, type Dish } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackEvents } from "@/lib/analytics";
import { groupOf, groupStyle } from "@/lib/category-style";
import { REGION_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { GroupTile } from "../group-tile";
import { Recipe } from "../recipe";

interface DishCardProps {
  dish: Dish;
  /** Position in the menu, used to stagger the entrance. */
  index: number;
  onReroll: () => void;
}

export function DishCard({ dish, index, onReroll }: DishCardProps) {
  const group = groupOf(dish);
  const style = groupStyle(group);

  return (
    <li
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-300",
        "rounded-2xl border border-l-4 bg-card p-4 text-card-foreground shadow-sm",
        style.edgeClass,
      )}
    >
      <div className="flex items-start gap-3">
        <GroupTile group={group} />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <span>{style.label}</span>
          </p>
          <h3 className="mt-0.5 font-display text-xl leading-snug font-semibold text-balance">{dish.name}</h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            {dish.time !== null && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock aria-hidden className="size-3.5" /> {dish.time} phút
              </span>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <ShoppingBasket aria-hidden className="size-3.5" /> {dish.ingredients.length} nguyên liệu
            </span>
            {dish.chay && (
              <Badge variant="secondary" className="gap-1">
                <Leaf aria-hidden className="size-3" /> Chay
              </Badge>
            )}
            {dish.region && <Badge variant="outline">{REGION_LABEL[dish.region]}</Badge>}
          </div>
        </div>

        <Button variant="outline" size="icon" onClick={onReroll} aria-label={`Đổi món khác cho ${dish.name}`}>
          <Shuffle aria-hidden />
        </Button>
      </div>

      {dish.steps.length > 0 && (
        <details
          className="group mt-3 border-t pt-1"
          onToggle={(event) => event.currentTarget.open && trackEvents([viewRecipeEvent(dish)])}
        >
          <summary className="flex min-h-11 cursor-pointer items-center justify-between rounded-lg text-sm font-medium text-primary marker:content-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <span>Xem cách nấu ({dish.steps.length} bước)</span>
            <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="pt-2 pb-1">
            <Recipe dish={dish} />
          </div>
        </details>
      )}
    </li>
  );
}
