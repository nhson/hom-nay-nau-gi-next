import { ShoppingBasket } from "lucide-react";
import type { Dish, ShoppingItem } from "@/domain";
import { Checkbox } from "@/components/ui/checkbox";
import { groupOf, groupStyle } from "@/lib/category-style";
import { cn } from "@/lib/utils";

interface ShoppingListProps {
  items: ShoppingItem[];
  /** Today's dishes, to show which kind of dish needs each ingredient. */
  dishes: Dish[];
  onToggle: (key: string, checked: boolean) => void;
}

export function ShoppingList({ items, dishes, onToggle }: ShoppingListProps) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        <ShoppingBasket aria-hidden className="size-5" /> Chưa có món nào, nên chưa có gì cần mua.
      </p>
    );
  }

  const done = items.filter((item) => item.checked).length;
  const byName = new Map(dishes.map((dish) => [dish.name, dish]));

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">{done === items.length ? "Đã mua đủ!" : "Đã mua"}</span>
          <span className="text-muted-foreground tabular-nums">
            {done}/{items.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Tiến độ đi chợ"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      </div>

      <ul className="divide-y border-t">
        {items.map((item) => (
          <li key={item.key}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 active:bg-muted/60">
              <Checkbox aria-label={item.label} checked={item.checked} onCheckedChange={(value) => onToggle(item.key, value === true)} />
              <span className={cn("flex-1 text-[0.95rem]", item.checked && "text-muted-foreground line-through")}>{item.label}</span>
              {/* Which dishes need it: coloured dots for a quick glance, names for screen readers. */}
              <span className="flex items-center gap-1">
                {item.dishNames.map((name) => {
                  const dish = byName.get(name);
                  const { icon: Icon, tileClass, iconClass } = groupStyle(dish ? groupOf(dish) : "xao");
                  return (
                    <span key={name} title={name} className={cn("flex size-6 items-center justify-center rounded-full", tileClass)}>
                      <Icon aria-hidden className={cn("size-3.5", iconClass)} strokeWidth={2} />
                    </span>
                  );
                })}
                <span className="sr-only">Cho: {item.dishNames.join(", ")}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
