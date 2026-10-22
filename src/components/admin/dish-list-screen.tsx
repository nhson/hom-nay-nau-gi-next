"use client";

import { Eye, EyeOff, Pencil, Plus, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { foldText } from "@/domain";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { groupOf, groupStyle, type GroupKey } from "@/lib/category-style";
import { REGION_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AdminDish } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "xao", label: "Xào" },
  { key: "canh", label: "Canh" },
  { key: "man", label: "Món mặn" },
  { key: "bowl", label: "Bữa 1 món" },
];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

// Compact on a desktop, a full 44px touch target on a phone.
const rowButton = "h-9 max-md:h-11";

const chip = (on: boolean) =>
  cn(
    "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
  );

export function DishListScreen() {
  const { setVersion, requireLogin } = useAdmin();
  const [dishes, setDishes] = useState<AdminDish[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [group, setGroup] = useState<GroupKey | "all">("all");
  const [chayOnly, setChayOnly] = useState(false);
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<AdminDish | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // The button that opened the dialog: kept in a ref because state is already cleared when Radix restores focus.
  const opener = useRef<HTMLElement | null>(null);

  // Moving to a new page: put focus on its heading so keyboard and screen-reader users start at the top.
  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listDishes()
      .then((catalog) => {
        if (cancelled) return;
        setDishes(catalog.dishes);
        setVersion(catalog.version);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) requireLogin();
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setVersion, requireLogin]);

  const visible = useMemo(() => {
    const needle = foldText(query);
    return (dishes ?? []).filter(
      (dish) =>
        (group === "all" || groupOf(dish) === group) &&
        (!chayOnly || dish.chay) &&
        (!hiddenOnly || dish.retired) &&
        (needle === "" || foldText(dish.name).includes(needle)),
    );
  }, [dishes, group, chayOnly, hiddenOnly, query]);

  async function setHidden(dish: AdminDish, retired: boolean) {
    setBusyId(dish.id);
    try {
      const saved = await adminApi.setHidden(dish.id, retired);
      setDishes((current) => (current ?? []).map((item) => (item.id === dish.id ? saved.dish : item)));
      setVersion(saved.version);
      toast.success(
        retired
          ? `Đã ẩn “${dish.name}”. Danh mục lên v${saved.version}.`
          : `Đã hiện lại “${dish.name}”. Danh mục lên v${saved.version}.`,
      );
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) requireLogin();
      else toast.error("Chưa cập nhật được. Thử lại.");
    } finally {
      setBusyId(null);
    }
  }

  function clearFilters() {
    setGroup("all");
    setChayOnly(false);
    setHiddenOnly(false);
    setQuery("");
  }

  const total = dishes?.length ?? 0;
  const hidden = dishes?.filter((dish) => dish.retired).length ?? 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
            Danh mục món
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mọi thay đổi có hiệu lực ngay trên máy của mọi người ở lần mở app kế tiếp.
          </p>
        </div>
        <dl className="flex flex-wrap gap-2.5 md:ml-auto max-md:w-full">
          <Stat label="Tổng số món" value={total} />
          <Stat label="Đang dùng" value={total - hidden} />
          <Stat label="Đã ẩn" value={hidden} />
        </dl>
      </div>

      <div className="rounded-2xl border bg-card">
        <div role="search" className="flex flex-wrap items-center gap-2.5 border-b p-3.5">
          <div className="relative min-w-52 flex-[1_1_16rem]">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Tìm món"
              placeholder="Tìm món, không cần gõ dấu"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="rounded-xl bg-background pl-9"
            />
          </div>
          <div role="group" aria-label="Lọc món" className="contents">
            <button type="button" aria-pressed={group === "all"} className={chip(group === "all")} onClick={() => setGroup("all")}>
              Tất cả
            </button>
            {GROUPS.map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={group === key} className={chip(group === key)} onClick={() => setGroup(key)}>
                <span aria-hidden className={cn("size-2 rounded-full bg-current", groupStyle(key).iconClass)} />
                {label}
              </button>
            ))}
            <button type="button" aria-pressed={chayOnly} className={chip(chayOnly)} onClick={() => setChayOnly((on) => !on)}>
              Chay
            </button>
            <button type="button" aria-pressed={hiddenOnly} className={chip(hiddenOnly)} onClick={() => setHiddenOnly((on) => !on)}>
              Đã ẩn
            </button>
          </div>
          <Link href="/admin/dishes/new" className={cn(buttonVariants({ variant: "turmeric" }), "md:ml-auto")}>
            <Plus aria-hidden /> Thêm món
          </Link>
        </div>

        {failed ? (
          <div role="alert" className="p-10 text-center text-muted-foreground">
            Không tải được danh sách món.
            <div className="mt-3">
              <Button variant="outline" onClick={() => location.reload()}>
                Thử lại
              </Button>
            </div>
          </div>
        ) : dishes === null ? (
          <div aria-busy="true" aria-label="Đang tải" className="m-3.5 h-64 animate-pulse rounded-xl bg-muted" />
        ) : (
          <table role="table" aria-label="Danh mục món" className="w-full border-collapse text-sm max-md:block">
            <thead role="rowgroup" className="max-md:sr-only">
              <tr role="row">
                {["Món", "Nhóm món", "Vùng miền", "Thời gian", "Cập nhật", "Trạng thái"].map((title) => (
                  <th key={title} role="columnheader" scope="col" className="border-b px-3.5 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {title}
                  </th>
                ))}
                <th role="columnheader" scope="col" className="border-b px-3.5 py-2.5">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="max-md:block">
              {visible.map((dish) => (
                <DishRow
                  key={dish.id}
                  dish={dish}
                  busy={busyId === dish.id}
                  onHide={(button) => {
                    opener.current = button;
                    setConfirming(dish);
                  }}
                  onShow={() => setHidden(dish, false)}
                />
              ))}
            </tbody>
          </table>
        )}

        {dishes !== null && visible.length === 0 && (
          <div className="px-5 py-14 text-center text-muted-foreground">
            <SearchX aria-hidden className="mx-auto mb-3 size-8" />
            <p className="font-display text-lg font-semibold text-foreground">Không có món nào khớp</p>
            <p className="mt-1">Thử bỏ bớt bộ lọc, hoặc tìm bằng từ ngắn hơn như “canh” hay “cá”.</p>
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Xoá bộ lọc
            </Button>
          </div>
        )}
      </div>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            // The row's button is the opener; hand focus back to it.
            if (!opener.current) return;
            event.preventDefault();
            opener.current.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Ẩn “{confirming?.name}”?</DialogTitle>
            <DialogDescription>Món không bị xoá, chỉ ngừng xuất hiện với người dùng:</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Không còn được gợi ý và không hiện ở tab Món ăn.</li>
            <li>Thực đơn hôm nay đang có món này vẫn giữ nguyên tới ngày mai.</li>
            <li>Lịch sử và yêu thích trên máy mọi người vẫn hiện đúng tên món.</li>
            <li>Bạn có thể hiện lại bất cứ lúc nào.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Giữ lại
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90 dark:text-background"
              onClick={() => {
                const target = confirming;
                setConfirming(null);
                if (target) void setHidden(target, true);
              }}
            >
              <EyeOff aria-hidden /> Ẩn món
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-2xl border bg-card px-3.5 py-2 max-md:flex-1">
      <dd className="font-display text-xl font-semibold">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function DishRow({
  dish,
  busy,
  onHide,
  onShow,
}: {
  dish: AdminDish;
  busy: boolean;
  onHide: (opener: HTMLElement) => void;
  onShow: () => void;
}) {
  const style = groupStyle(groupOf(dish));
  const hidden = dish.retired;
  return (
    <tr
      role="row"
      className={cn(
        "border-b last:border-b-0 hover:bg-muted/50 max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-x-2.5 max-md:gap-y-1.5 max-md:px-3.5 max-md:py-3",
        hidden && "text-muted-foreground",
      )}
    >
      <td role="cell" className="px-3.5 py-3 max-md:p-0">
        <div className={cn("font-semibold", hidden && "line-through decoration-muted-foreground/60")}>{dish.name}</div>
        <div className="text-xs font-normal text-muted-foreground">
          Mã {dish.id}
          {dish.region && <span className="md:hidden"> · {REGION_LABEL[dish.region]}</span>}
        </div>
      </td>
      <td role="cell" className="px-3.5 py-3 max-md:col-start-1 max-md:p-0">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
            <span aria-hidden className={cn("size-2 rounded-full bg-current", style.iconClass)} />
            {style.label}
          </span>
          {dish.chay && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Chay</span>}
        </span>
      </td>
      <td role="cell" className="px-3.5 py-3 max-md:hidden">
        {dish.region ? REGION_LABEL[dish.region] : "—"}
      </td>
      <td role="cell" className="px-3.5 py-3 max-md:hidden">
        {dish.time ? `${dish.time} phút` : "—"}
      </td>
      <td role="cell" className="px-3.5 py-3 max-md:hidden">
        {shortDate(dish.updatedAt)}
      </td>
      <td role="cell" className="px-3.5 py-3 max-md:col-start-2 max-md:row-start-1 max-md:p-0 max-md:text-right">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            hidden ? "border bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          )}
        >
          {hidden ? "Đã ẩn" : "Đang dùng"}
        </span>
      </td>
      <td role="cell" className="px-3.5 py-3 max-md:col-span-2 max-md:p-0">
        <div className="flex justify-end gap-1.5">
          <Link href={`/admin/dishes/${encodeURIComponent(dish.id)}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), rowButton)}>
            <Pencil aria-hidden /> Sửa
            <span className="sr-only"> {dish.name}</span>
          </Link>
          {hidden ? (
            <Button variant="ghost" size="sm" className={rowButton} disabled={busy} onClick={onShow}>
              <Eye aria-hidden /> Hiện lại
              <span className="sr-only"> {dish.name}</span>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className={rowButton} disabled={busy} onClick={(event) => onHide(event.currentTarget)}>
              <EyeOff aria-hidden /> Ẩn
              <span className="sr-only"> {dish.name}</span>
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
