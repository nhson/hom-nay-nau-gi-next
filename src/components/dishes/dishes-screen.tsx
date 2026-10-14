"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { BOWL_LABEL, CATEGORY_LABEL, REGION_LABEL } from "@/lib/labels";
import { useApp } from "../app-provider";
import { DishFormDialog } from "./dish-form-dialog";

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
  const [form, setForm] = useState<{ dish: Dish | null; edited: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<Dish | null>(null);

  if (!ready) return <div aria-busy="true" aria-label="Đang tải" className="h-40 animate-pulse rounded-xl bg-muted" />;

  const rows = selectDishBank(catalog, state.user, filter, chayOnly);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc món">
        {FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
        <Button variant={chayOnly ? "default" : "outline"} aria-pressed={chayOnly} onClick={() => setChayOnly(!chayOnly)}>
          Chay
        </Button>
      </div>

      <Button className="mt-4 w-full" onClick={() => setForm({ dish: null, edited: false })}>
        <Plus aria-hidden /> Thêm món mới
      </Button>

      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        {rows.length} món
      </p>

      {rows.length === 0 ? (
        <p className="mt-2 rounded-xl border bg-card p-4 text-center text-muted-foreground">Không có món nào phù hợp.</p>
      ) : (
        <ul className="mt-2 divide-y rounded-xl border bg-card">
          {rows.map(({ dish, edited }) => (
            <li key={dish.id} className="flex items-center gap-2 py-2 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{dish.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{dish.category ? CATEGORY_LABEL[dish.category] : BOWL_LABEL}</span>
                  {dish.time !== null && <span>· {dish.time} phút</span>}
                  {dish.chay && <Badge variant="secondary">Chay</Badge>}
                  {dish.region && <Badge variant="outline">{REGION_LABEL[dish.region]}</Badge>}
                  {edited && <Badge variant="outline">Đã sửa</Badge>}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Sửa ${dish.name}`} onClick={() => setForm({ dish, edited })}>
                <Pencil aria-hidden />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Xoá ${dish.name}`} onClick={() => setToDelete(dish)}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {catalog.hidden.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Món đã xoá</h2>
          <ul className="divide-y rounded-xl border bg-card">
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
