import type { Dish } from "./types";

export type Ticks = Readonly<Record<string, boolean>>;

export interface ShoppingItem {
  /** Normalized ingredient name; the key ticks are stored under. */
  key: string;
  /** First-seen spelling, trimmed. */
  label: string;
  /** Names of the menu's dishes that need this ingredient. */
  dishNames: string[];
  checked: boolean;
}

/** Case-, accent-form- and whitespace-insensitive ingredient key. */
export function normalizeIngredientKey(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildShoppingList(dishes: readonly Dish[], ticks: Ticks = {}): ShoppingItem[] {
  const items = new Map<string, ShoppingItem>();
  for (const dish of dishes) {
    for (const ingredient of dish.ingredients) {
      const key = normalizeIngredientKey(ingredient);
      if (key === "") continue;
      let item = items.get(key);
      if (!item) {
        item = { key, label: ingredient.trim(), dishNames: [], checked: ticks[key] === true };
        items.set(key, item);
      }
      if (!item.dishNames.includes(dish.name)) item.dishNames.push(dish.name);
    }
  }
  return [...items.values()];
}

export function setTick(ticks: Ticks, key: string, checked: boolean): Record<string, boolean> {
  const next = { ...ticks };
  if (checked) next[key] = true;
  else delete next[key];
  return next;
}

/** Keeps ticks only for ingredients still on the list (used after a reroll). */
export function pruneTicks(ticks: Ticks, items: readonly ShoppingItem[]): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const item of items) {
    if (ticks[item.key] === true) next[item.key] = true;
  }
  return next;
}
