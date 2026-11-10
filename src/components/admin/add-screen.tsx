"use client";

import { Camera, FileUp, PenLine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import type { PendingDish } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";
import { ImportPanel } from "./import-panel";
import { MenuCard } from "./menu-card";

/** The Thêm món tabs, by their value in the address (`?cach=`). The first is the default. */
const WAYS: { key: "anh" | "file"; label: string; icon: LucideIcon }[] = [
  { key: "anh", label: "Ảnh thực đơn / Gõ tên", icon: Camera },
  { key: "file", label: "Nhập từ file", icon: FileUp },
];

/** Where Thêm món opens on a tab: `/admin/add?cach=file`. The default tab has no parameter. */
const addHref = (way: (typeof WAYS)[number]["key"]) => (way === "anh" ? "/admin/add" : `/admin/add?cach=${way}`);

/**
 * Thêm món (spec #41, tabs since feat-021): every way to add a dish on one page. "Ảnh thực đơn / Gõ tên"
 * and "Nhập từ file" put dishes in Chờ duyệt; Tự nhập công thức is the hand-written form, published at once.
 * The tab is in the address, so a link or bookmark opens it and Back returns to the other one.
 */
export function AddScreen() {
  const way = useSearchParams().get("cach") === "file" ? "file" : "anh";
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  return (
    <div>
      <div className="mb-5">
        <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          Thêm món
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Chọn một cách để thêm món vào Danh mục món.</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <nav aria-label="Cách thêm món" className="inline-flex flex-wrap rounded-xl border bg-muted p-1">
          {WAYS.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={addHref(key)}
              aria-current={way === key ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                way === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/admin/dishes/new" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
            <PenLine aria-hidden /> Tự nhập công thức
          </Link>
          <span className="text-sm text-muted-foreground">Đăng ngay, không qua Chờ duyệt.</span>
        </div>
      </div>

      {way === "file" ? <ImportPanel /> : <MenuPanel />}
    </div>
  );
}

/** Ảnh thực đơn and Gõ tên món: one checklist, one "Tạo món" (the AI writes each recipe into Chờ duyệt). */
function MenuPanel() {
  const { requireLogin, refreshPendingCount } = useAdmin();
  const [pending, setPending] = useState<PendingDish[] | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listPending()
      .then((result) => {
        if (cancelled) return;
        setPending(result.items);
        setConfigured(result.readerConfigured);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) requireLogin();
        // Otherwise the card still works; typed names simply start ticked.
      });
    return () => {
      cancelled = true;
    };
  }, [requireLogin]);

  function created(item: PendingDish) {
    setPending((current) => [item, ...(current ?? [])]);
    refreshPendingCount();
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">AI viết công thức; món vào Chờ duyệt.</p>
      <MenuCard configured={configured} pending={pending ?? []} onConfigured={setConfigured} onCreated={created} />
    </>
  );
}
