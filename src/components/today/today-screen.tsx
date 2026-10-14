"use client";

import { Check, Dices, Soup } from "lucide-react";
import { selectToday, type Category } from "@/domain";
import { Button } from "@/components/ui/button";
import { SaveFavoriteButton } from "../favorites/save-favorite-dialog";
import { cn } from "@/lib/utils";
import { useApp } from "../app-provider";
import { DishCard } from "./dish-card";
import { HistoryList } from "./history-list";
import { ShoppingList } from "./shopping-list";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>;
}

function formatLongDate(today: string): string {
  return new Date(`${today}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function TodaySkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải" className="space-y-3">
      <div className="h-12 animate-pulse rounded-xl bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function TodayScreen() {
  const { ready, state, catalog, today, dispatch } = useApp();
  if (!ready) return <TodaySkeleton />;

  const view = selectToday(state, catalog, today);
  const isBowl = view.menu?.mealType === "buatomonuoc";

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground capitalize">{formatLongDate(today)}</p>

      <div className="flex gap-2">
        <Button variant="turmeric" size="lg" className="flex-1" onClick={() => dispatch({ type: "random-menu" })}>
          <Dices aria-hidden /> Random thực đơn
        </Button>
        <SaveFavoriteButton />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant={state.chayFilter ? "default" : "outline"}
          aria-pressed={state.chayFilter}
          onClick={() => dispatch({ type: "toggle-chay" })}
        >
          {state.chayFilter && <Check aria-hidden />} Món chay
        </Button>
        <Button
          variant={isBowl ? "default" : "outline"}
          aria-pressed={isBowl}
          onClick={() => dispatch({ type: isBowl ? "random-menu" : "cook-one-dish" })}
        >
          <Soup aria-hidden /> Nấu 1 món
        </Button>
      </div>

      {view.cooked && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
        >
          <Check aria-hidden className="size-4" /> Đã nấu thực đơn này hôm nay
        </p>
      )}

      {view.dishes.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {view.dishes.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              onReroll={() =>
                dispatch({
                  type: "reroll",
                  target: dish.mealType === "buatomonuoc" ? "monnuoc" : (dish.category as Category),
                })
              }
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border bg-card p-4 text-center text-muted-foreground">
          Bấm &ldquo;Random thực đơn&rdquo; để bắt đầu nhé!
        </p>
      )}

      <Button
        variant="outline"
        className={cn("mt-4 w-full")}
        disabled={view.dishes.length === 0}
        onClick={() => dispatch({ type: "mark-cooked" })}
      >
        <Check aria-hidden /> Đã nấu hôm nay
      </Button>

      <SectionTitle>Danh sách đi chợ</SectionTitle>
      <ShoppingList
        items={view.shopping}
        onToggle={(key, checked) => dispatch({ type: "set-tick", key, checked })}
      />

      <SectionTitle>7 ngày gần đây</SectionTitle>
      <HistoryList rows={view.recent} />
    </div>
  );
}
