"use client";

import { ChevronRight, Inbox, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { groupOf, groupStyle } from "@/lib/category-style";
import { cn } from "@/lib/utils";
import type { PendingDish } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";
import { AgentCard } from "./agent-card";
import { MenuCard } from "./menu-card";
import { sourceLabel } from "./review-labels";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

export function ReviewListScreen() {
  const { requireLogin, setPendingCount } = useAdmin();
  const [items, setItems] = useState<PendingDish[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  // Bumped after a Chạy ngay, so the list shows what the agent added.
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listPending()
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setConfigured(result.readerConfigured);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) requireLogin();
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requireLogin, reloads]);

  function added(item: PendingDish) {
    setItems((current) => [item, ...(current ?? [])]);
  }

  // The badge in the admin bar follows the list, however it changed.
  useEffect(() => {
    if (items) setPendingCount(items.length);
  }, [items, setPendingCount]);

  return (
    <div>
      <div className="mb-5">
        <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          Chờ duyệt
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Món do AI đề xuất. Người dùng chưa thấy món nào ở đây cho tới khi bạn Duyệt.
        </p>
      </div>

      <AgentCard onRunFinished={() => setReloads((count) => count + 1)} />

      <MenuCard configured={configured} pending={items ?? []} onConfigured={setConfigured} onCreated={added} />

      <section aria-labelledby="list-title" className="rounded-2xl border bg-card">
        <h2 id="list-title" className="border-b px-5 py-3.5 font-display text-lg font-semibold">
          Món đang chờ{items && items.length > 0 ? ` (${items.length})` : ""}
        </h2>
        {failed ? (
          <div role="alert" className="p-10 text-center text-muted-foreground">
            Không tải được danh sách món chờ duyệt.
            <div className="mt-3">
              <Button variant="outline" onClick={() => location.reload()}>
                Thử lại
              </Button>
            </div>
          </div>
        ) : items === null ? (
          <div aria-busy="true" aria-label="Đang tải" className="m-3.5 h-40 animate-pulse rounded-xl bg-muted" />
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground">
            <Inbox aria-hidden className="mx-auto mb-3 size-8" />
            <p className="font-display text-lg font-semibold text-foreground">Chưa có món nào chờ duyệt</p>
            <p className="mt-1">Chạy tác nhân, tải ảnh một thực đơn hoặc gõ tên món ở trên để bắt đầu.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <PendingRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PendingRow({ item }: { item: PendingDish }) {
  const style = groupStyle(groupOf(item));
  const warnings = item.warnings.length;
  return (
    <li>
      <Link
        href={`/admin/review/${encodeURIComponent(item.id)}`}
        className="flex items-center gap-3 px-5 py-3.5 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <div className="min-w-0 flex-1">
          <div className={cn("font-semibold", !item.name && "text-muted-foreground italic")}>{item.name || "Chưa có tên"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-0.5 font-semibold text-foreground">
              <span aria-hidden className={cn("size-2 rounded-full bg-current", style.iconClass)} />
              {style.label}
            </span>
            {item.chay && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">Chay</span>}
            {warnings > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/35 bg-destructive/10 px-2.5 py-0.5 font-semibold text-destructive">
                <TriangleAlert aria-hidden className="size-3" /> {warnings} cảnh báo
              </span>
            )}
            <span>
              {sourceLabel(item)} · {shortDate(item.createdAt)}
            </span>
          </div>
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
