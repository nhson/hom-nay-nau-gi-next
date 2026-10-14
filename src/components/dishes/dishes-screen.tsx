"use client";

import { Clock, Leaf, Pencil, Plus, RotateCcw, Search, SearchX, Trash2 } from "lucide-react";
import { useState } from "react";
import { selectDishBank, type BankFilter, type Dish } from "@/domain";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupOf, groupStyle, type GroupKey } from "@/lib/category-style";
import { BOWL_LABEL, CATEGORY_LABEL, REGION_LABEL } from "@/lib/labels";
import { useApp } from "../app-provider";
import { GroupTile } from "../group-tile";
import { DishFormDialog } from "./dish-form-dialog";
import { RecipeDialog } from "./recipe-dialog";

const GROUP_ORDER: GroupKey[] = ["xao", "canh", "man", "bowl"];

const FILTERS: { value: BankFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "xao", label: CATEGORY_LABEL.xao },
  { value: "canh", label: CATEGORY_LABEL.canh },
  { value: "man", label: CATEGORY_LABEL.man },
  { value: "buatomonuoc", label: BOWL_LABEL },
];

export function DishesScreen() {
  const { ready, state, catalog, dispatch } = useApp();
  const [filter, setFilter] = useState<BankFilter>("all");
  const [chayOnly, setChayOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [recipe, setRecipe] = useState<Dish | null>(null);
  const [form, setForm] = useState<{ dish: Dish | null; edited: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<Dish | null>(null);

  if (!ready) return <div aria-busy="true" aria-label="Đang tải" className="h-40 animate-pulse rounded-2xl bg-muted" />;

  const rows = selectDishBank(catalog, state.user, filter, chayOnly, query);
  const groups = GROUP_ORDER.map((group) => ({ group, rows: rows.filter(({ dish }) => groupOf(dish) === group) })).filter(
    ({ rows: groupRows }) => groupRows.length > 0,
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {rows.length} món
        </p>
        <Button className="rounded-full" onClick={() => setForm({ dish: null, edited: false })}>
          <Plus aria-hidden /> Thêm món mới
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-8 text-center">
          <SearchX aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-muted-foreground">Không có món nào phù hợp.</p>
        </div>
      ) : (
        groups.map(({ group, rows: groupRows }) => {
          const { label } = groupStyle(group);
          return (
            <section key={group} aria-labelledby={`bank-${group}`} className="mt-5">
              <h2 id={`bank-${group}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <GroupTile group={group} className="size-8 rounded-lg [&_svg]:size-4" />
                {label}
                <span className="font-normal text-muted-foreground tabular-nums">({groupRows.length})</span>
              </h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
                {groupRows.map(({ dish, edited }) => (
                  <li key={dish.id} className="flex items-center gap-1 pr-1">
                    <button
                      type="button"
                      aria-label={`Xem công thức ${dish.name}`}
                      onClick={() => setRecipe(dish)}
                      className="min-h-14 min-w-0 flex-1 rounded-lg py-2 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-muted/60"
                    >
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
                        {edited && <Badge variant="outline">Đã sửa</Badge>}
                      </span>
                    </button>
                    <Button variant="ghost" size="icon" aria-label={`Sửa ${dish.name}`} onClick={() => setForm({ dish, edited })}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Xoá ${dish.name}`} onClick={() => setToDelete(dish)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {catalog.hidden.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Món đã xoá</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {catalog.hidden.map((dish) => (
              <li key={dish.id} className="flex items-center gap-2 py-2 pr-2 pl-4">
                <span className="flex-1">{dish.name}</span>
                <Button variant="outline" onClick={() => dispatch({ type: "restore-dish", id: dish.id })}>
                  <RotateCcw aria-hidden /> Khôi phục
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecipeDialog dish={recipe} onClose={() => setRecipe(null)} />

      <DishFormDialog
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        dish={form?.dish ?? null}
        edited={form?.edited ?? false}
        onSave={(id, dish) => dispatch({ type: "save-dish", id, dish })}
        onReset={(id) => dispatch({ type: "reset-dish", id })}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá &ldquo;{toDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.id.startsWith("custom:")
                ? "Món này sẽ bị xoá khỏi thiết bị của bạn."
                : "Món có sẵn chỉ bị ẩn trên thiết bị này; bạn có thể khôi phục lại ở mục Món đã xoá."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => toDelete && dispatch({ type: "delete-dish", id: toDelete.id })}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
