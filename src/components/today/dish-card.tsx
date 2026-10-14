import { Clock, Shuffle } from "lucide-react";
import { viewRecipeEvent, type Dish } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackEvents } from "@/lib/analytics";
import { BOWL_LABEL, CATEGORY_LABEL, REGION_LABEL } from "@/lib/labels";

interface DishCardProps {
  dish: Dish;
  onReroll: () => void;
}

export function DishCard({ dish, onReroll }: DishCardProps) {
  const group = dish.category ? CATEGORY_LABEL[dish.category] : BOWL_LABEL;

  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</span>
          {dish.chay && <Badge variant="secondary">Chay</Badge>}
          {dish.region && <Badge variant="outline">{REGION_LABEL[dish.region]}</Badge>}
        </div>

        <h3 className="mt-1 font-display text-xl leading-snug font-semibold">{dish.name}</h3>

        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          {dish.time !== null && (
            <>
              <Clock aria-hidden className="size-3.5" />
              {dish.time} phút ·{" "}
            </>
          )}
          {dish.ingredients.length} nguyên liệu
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{dish.ingredients.join(", ")}</p>

        {dish.steps.length > 0 && (
          <details
            className="group mt-3"
            onToggle={(event) => event.currentTarget.open && trackEvents([viewRecipeEvent(dish)])}
          >
            <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-medium text-primary marker:content-none">
              Xem cách nấu ({dish.steps.length} bước)
            </summary>
            <ol className="mt-1 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              {dish.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </details>
        )}
      </div>

      <Button variant="outline" size="icon" onClick={onReroll} aria-label={`Đổi món khác cho ${dish.name}`}>
        <Shuffle aria-hidden />
      </Button>
    </li>
  );
}
