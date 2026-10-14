"use client";

import { CalendarDays, Check, ChefHat, Clock, Dices, Leaf, ShoppingBasket, Soup, UtensilsCrossed } from "lucide-react";
import { selectToday, type Category } from "@/domain";
import { Button } from "@/components/ui/button";
import { SaveFavoriteButton } from "../favorites/save-favorite-dialog";
import { useApp } from "../app-provider";
import { DishCard } from "./dish-card";
import { HistoryList } from "./history-list";
import { ShoppingList } from "./shopping-list";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-9 mb-3 font-display text-lg font-semibold">{children}</h2>;
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
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      <div className="h-11 animate-pulse rounded-2xl bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

export function TodayScreen() {
  const { ready, state, catalog, today, dispatch } = useApp();
  if (!ready) return <TodaySkeleton />;

  const view = selectToday(state, catalog, today);
  const isBowl = view.menu?.mealType === "buatomonuoc";
  const totalMinutes = view.dishes.reduce((sum, dish) => sum + (dish.time ?? 0), 0);

  return (
    <div>
      <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground capitalize">
        <CalendarDays aria-hidden className="size-4" /> {formatLongDate(today)}
      </p>

      <div className="flex gap-2">
        <Button variant="turmeric" size="lg" className="flex-1 shadow-sm" onClick={() => dispatch({ type: "random-menu" })}>
          <Dices aria-hidden /> Random thực đơn
        </Button>
        <SaveFavoriteButton />
      </div>

      <div className="mt-3 flex items-center gap-2">
        {/* One meal style at a time: the 3-dish rice meal or a single dish (a bowl of noodles…). */}
        <div role="group" aria-label="Kiểu bữa ăn" className="flex flex-1 gap-1 rounded-2xl bg-muted p-1">
          <Button
            variant={isBowl ? "ghost" : "default"}
            aria-pressed={!isBowl}
            className="flex-1 rounded-xl"
            onClick={() => isBowl && dispatch({ type: "random-menu" })}
          >
            <UtensilsCrossed aria-hidden /> Bữa cơm 3 món
          </Button>
          <Button
            variant={isBowl ? "default" : "ghost"}
            aria-pressed={isBowl}
            className="flex-1 rounded-xl"
            onClick={() => !isBowl && dispatch({ type: "cook-one-dish" })}
          >
            <Soup aria-hidden /> Nấu 1 món
          </Button>
        </div>
      </div>
      <Button
        variant={state.chayFilter ? "default" : "outline"}
        aria-pressed={state.chayFilter}
        className="mt-2 rounded-2xl"
        onClick={() => dispatch({ type: "toggle-chay" })}
      >
        <Leaf aria-hidden /> Món chay
      </Button>

      {view.dishes.length > 0 ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 id="menu-heading" className="font-display text-lg font-semibold">
              Thực đơn hôm nay
            </h2>
            <p className="flex items-center gap-3 text-sm text-muted-foreground tabular-nums">
              <span>{view.dishes.length} món</span>
              {totalMinutes > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden className="size-3.5" /> ~{totalMinutes} phút
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <ShoppingBasket aria-hidden className="size-3.5" /> {view.shopping.length} nguyên liệu
              </span>
            </p>
          </div>

          <ul aria-labelledby="menu-heading" className="mt-3 space-y-3">
            {view.dishes.map((dish, index) => (
              <DishCard
                key={dish.id}
                dish={dish}
                index={index}
                onReroll={() =>
                  dispatch({
                    type: "reroll",
                    target: dish.mealType === "buatomonuoc" ? "monnuoc" : (dish.category as Category),
                  })
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
          <ChefHat aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-muted-foreground">Bấm &ldquo;Random thực đơn&rdquo; để bắt đầu nhé!</p>
        </div>
      )}

      {view.dishes.length > 0 &&
        (view.cooked ? (
          <p
            role="status"
            className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Check aria-hidden className="size-4" /> Đã nấu thực đơn này hôm nay
          </p>
        ) : (
          <Button variant="outline" size="lg" className="mt-4 w-full rounded-2xl" onClick={() => dispatch({ type: "mark-cooked" })}>
            <Check aria-hidden /> Đã nấu hôm nay
          </Button>
        ))}

      <SectionTitle>Danh sách đi chợ</SectionTitle>
      <ShoppingList
        items={view.shopping}
        dishes={view.dishes}
        onToggle={(key, checked) => dispatch({ type: "set-tick", key, checked })}
      />

      <SectionTitle>7 ngày gần đây</SectionTitle>
      <HistoryList rows={view.recent} />
    </div>
  );
}
