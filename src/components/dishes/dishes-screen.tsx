"use client";

import { ChevronRight, Clock, Leaf, Search, SearchX } from "lucide-react";
import { useState } from "react";
import { selectDishBank, type BankFilter, type Dish } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupOf, groupStyle, type GroupKey } from "@/lib/category-style";
import { BOWL_LABEL, CATEGORY_LABEL, REGION_LABEL } from "@/lib/labels";
import { useApp } from "../app-provider";
import { GroupTile } from "../group-tile";
import { RecipeDialog } from "./recipe-dialog";

const GROUP_ORDER: GroupKey[] = ["xao", "canh", "man", "bowl"];

const FILTERS: { value: BankFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "xao", label: CATEGORY_LABEL.xao },
  { value: "canh", label: CATEGORY_LABEL.canh },
  { value: "man", label: CATEGORY_LABEL.man },
  { value: "buatomonuoc", label: BOWL_LABEL },
];

/** The Danh mục món as a read-only library: find a dish, read its recipe. Content is managed centrally. */
export function DishesScreen() {
  const { ready, catalog } = useApp();
  const [filter, setFilter] = useState<BankFilter>("all");
  const [chayOnly, setChayOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [recipe, setRecipe] = useState<Dish | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);

  if (!ready) return <div aria-busy="true" aria-label="Đang tải" className="h-40 animate-pulse rounded-2xl bg-muted" />;

  const dishes = selectDishBank(catalog, filter, chayOnly, query);
  const groups = GROUP_ORDER.map((group) => ({ group, dishes: dishes.filter((dish) => groupOf(dish) === group) })).filter(
    ({ dishes: groupDishes }) => groupDishes.length > 0,
  );

  return (
    <div>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Tìm món"
          placeholder="Tìm món (VD: canh chua, ca loc)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-2xl bg-card pl-10"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Lọc món">
        {FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            className="rounded-full"
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
        <Button
          variant={chayOnly ? "default" : "outline"}
          aria-pressed={chayOnly}
          className="rounded-full"
          onClick={() => setChayOnly(!chayOnly)}
        >
          <Leaf aria-hidden /> Chay
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {dishes.length} món
      </p>

      {groups.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
          <SearchX aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-muted-foreground">Không có món nào phù hợp.</p>
        </div>
      ) : (
        groups.map(({ group, dishes: groupDishes }) => {
          const { label } = groupStyle(group);
          return (
            <section key={group} aria-labelledby={`bank-${group}`} className="mt-5">
              <h2 id={`bank-${group}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <GroupTile group={group} className="size-8 rounded-lg [&_svg]:size-4" />
                {label}
                <span className="font-normal text-muted-foreground tabular-nums">({groupDishes.length})</span>
              </h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
                {groupDishes.map((dish) => (
                  <li key={dish.id}>
                    <button
                      type="button"
                      aria-label={`Xem công thức ${dish.name}`}
                      onClick={(event) => {
                        setOpener(event.currentTarget);
                        setRecipe(dish);
                      }}
                      className="flex min-h-14 w-full items-center gap-2 py-2 pr-3 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-muted/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{dish.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {dish.time !== null && (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock aria-hidden className="size-3" /> {dish.time} phút
                            </span>
                          )}
                          {dish.chay && (
                            <Badge variant="secondary" className="gap-1">
                              <Leaf aria-hidden className="size-3" /> Chay
                            </Badge>
                          )}
                          {dish.region && <Badge variant="outline">{REGION_LABEL[dish.region]}</Badge>}
                        </span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <RecipeDialog dish={recipe} onClose={() => setRecipe(null)} returnFocusTo={opener} />
    </div>
  );
}
