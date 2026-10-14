import type { ShoppingItem } from "@/domain";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ShoppingListProps {
  items: ShoppingItem[];
  onToggle: (key: string, checked: boolean) => void;
}

export function ShoppingList({ items, onToggle }: ShoppingListProps) {
  if (items.length === 0) {
    return <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Chưa có món nào.</p>;
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.key}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2">
            <Checkbox aria-label={item.label} checked={item.checked} onCheckedChange={(value) => onToggle(item.key, value === true)} />
            <span className={cn("flex-1", item.checked && "text-muted-foreground line-through")}>{item.label}</span>
            <span className="max-w-[40%] text-right text-xs text-muted-foreground">{item.dishNames.join(", ")}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
