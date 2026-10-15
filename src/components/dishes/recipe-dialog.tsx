"use client";

import { Clock, Leaf, ShoppingBasket } from "lucide-react";
import { useEffect } from "react";
import { viewRecipeEvent, type Dish } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trackEvents } from "@/lib/analytics";
import { groupOf, groupStyle } from "@/lib/category-style";
import { REGION_LABEL } from "@/lib/labels";
import { GroupTile } from "../group-tile";
import { Recipe } from "../recipe";

/** Read a dish's recipe from the dish bank without adding it to today's menu. */
export function RecipeDialog({
  dish,
  onClose,
  returnFocusTo,
}: {
  dish: Dish | null;
  onClose: () => void;
  /** The element that opened the dialog; it gets focus back when the dialog closes. */
  returnFocusTo: HTMLElement | null;
}) {
  return (
    <Dialog open={dish !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo) return;
          event.preventDefault();
          returnFocusTo.focus();
        }}
      >
        {dish && <RecipeBody dish={dish} />}
      </DialogContent>
    </Dialog>
  );
}

function RecipeBody({ dish }: { dish: Dish }) {
  const group = groupOf(dish);
  const style = groupStyle(group);

  // Opening a recipe counts the same as opening it on the menu.
  useEffect(() => {
    trackEvents([viewRecipeEvent(dish)]);
  }, [dish]);

  return (
    <div className="grid gap-4">
      <DialogHeader className="pr-10">
        <div className="flex items-start gap-3">
          <GroupTile group={group} />
          <div className="min-w-0 text-left">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{style.label}</p>
            <DialogTitle className="mt-0.5 font-display text-xl leading-snug font-semibold text-balance">{dish.name}</DialogTitle>
          </div>
        </div>
        <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-sm">
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
        </DialogDescription>
      </DialogHeader>
      <Recipe dish={dish} />
    </div>
  );
}
