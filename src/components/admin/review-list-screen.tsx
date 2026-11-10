"use client";

import { CheckCheck, ChevronRight, Inbox, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { groupOf, groupStyle } from "@/lib/category-style";
import { problemMessage } from "@/lib/dish-problems";
import { cn } from "@/lib/utils";
import type { BulkApproveResponse, PendingDish } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";
import { sourceLabel } from "./review-labels";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

type Failure = BulkApproveResponse["failed"][number];

/** Why one Món chờ duyệt could not be approved, in words. */
function failureText(failure: Failure): string {
  if (failure.reason === "not_found") return "Không còn trong Chờ duyệt (đã được duyệt hoặc bỏ ở nơi khác).";
  return [...new Set(failure.issues.map(problemMessage))].join(" ");
}

/** The outcome of the last bulk Duyệt, shown above the list until the next one. */
interface Summary {
  approved: number;
  failed: { name: string; text: string }[];
}

export function ReviewListScreen() {
  const { requireLogin, setPendingCount, setVersion } = useAdmin();
  const [items, setItems] = useState<PendingDish[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [reasons, setReasons] = useState<ReadonlyMap<string, string>>(new Map());
  const [approving, setApproving] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listPending()
      .then((result) => !cancelled && setItems(result.items))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) requireLogin();
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requireLogin]);

  // The badge in the admin menu follows the list, however it changed.
  useEffect(() => {
    if (items) setPendingCount(items.length);
  }, [items, setPendingCount]);

  useEffect(() => {
    if (summary) summaryRef.current?.focus();
  }, [summary]);

  const all = items ?? [];
  const chosen = all.filter((item) => selected.has(item.id));
  const everything = all.length > 0 && chosen.length === all.length;

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function approveChosen() {
    if (chosen.length === 0) return;
    setApproving(true);
    try {
      const result = await adminApi.approveMany(chosen.map((item) => item.id));
      const done = new Set(result.approved.map((item) => item.id));
      // A dish another tab already approved or discarded is gone too.
      const gone = new Set(result.failed.filter((item) => item.reason === "not_found").map((item) => item.id));
      const names = new Map(all.map((item) => [item.id, item.name || "Chưa có tên"]));
      if (result.approved.length > 0) setVersion(result.version);
      setItems((current) => (current ?? []).filter((item) => !done.has(item.id) && !gone.has(item.id)));
      // Those that could not be approved stay selected, with their reason, so they can be opened and fixed.
      const stuck = result.failed.filter((item) => item.reason !== "not_found");
      setSelected(new Set(stuck.map((item) => item.id)));
      setReasons(new Map(stuck.map((item) => [item.id, failureText(item)])));
      setSummary({
        approved: result.approved.length,
        failed: result.failed.map((item) => ({ name: names.get(item.id) ?? item.id, text: failureText(item) })),
      });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) requireLogin();
      else toast.error("Không duyệt được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          Chờ duyệt
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Món do AI đề xuất hoặc nhập từ file. Người dùng chưa thấy món nào ở đây cho tới khi bạn Duyệt.
        </p>
      </div>

      {summary && (
        <div ref={summaryRef} role="alert" tabIndex={-1} className="mb-4 rounded-2xl border bg-card p-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <p className="font-semibold">
            Đã duyệt {summary.approved} món.
            {summary.failed.length > 0 && ` ${summary.failed.length} món chưa duyệt được:`}
          </p>
          {summary.failed.length > 0 && (
            <ul className="mt-1.5 space-y-1 text-destructive">
              {summary.failed.map((item, index) => (
                <li key={index}>
                  <b>{item.name}</b>: {item.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section aria-labelledby="list-title" className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <h2 id="list-title" className="mr-auto font-display text-lg font-semibold">
            Món đang chờ{all.length > 0 ? ` (${all.length})` : ""}
          </h2>
          {all.length > 0 && (
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
                <Checkbox
                  checked={everything ? true : chosen.length > 0 ? "indeterminate" : false}
                  onCheckedChange={() => setSelected(everything ? new Set() : new Set(all.map((item) => item.id)))}
                />
                Chọn tất cả
              </label>
              <Button className="h-11" disabled={chosen.length === 0 || approving} onClick={approveChosen}>
                {approving ? <Loader2 aria-hidden className="animate-spin" /> : <CheckCheck aria-hidden />}
                Duyệt các món đã chọn ({chosen.length})
              </Button>
            </>
          )}
        </div>
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
            <p className="mt-1">
              Vào{" "}
              <Link href="/admin/add" className="font-semibold text-primary underline-offset-4 hover:underline">
                Thêm món
              </Link>
              ,{" "}
              <Link href="/admin/add?cach=file" className="font-semibold text-primary underline-offset-4 hover:underline">
                Nhập từ file
              </Link>{" "}
              hoặc chạy{" "}
              <Link href="/admin/agent" className="font-semibold text-primary underline-offset-4 hover:underline">
                Tác nhân thu thập
              </Link>{" "}
              để bắt đầu.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <PendingRow
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                reason={reasons.get(item.id) ?? null}
                onSelect={(on) => toggle(item.id, on)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PendingRow({
  item,
  selected,
  reason,
  onSelect,
}: {
  item: PendingDish;
  selected: boolean;
  reason: string | null;
  onSelect: (on: boolean) => void;
}) {
  const style = groupStyle(groupOf(item));
  const warnings = item.warnings.length;
  const name = item.name || "Chưa có tên";
  return (
    <li className="flex items-center gap-1 pl-3">
      <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
        <Checkbox checked={selected} onCheckedChange={(on) => onSelect(on === true)} aria-label={`Chọn ${name}`} />
      </label>
      <Link
        href={`/admin/review/${encodeURIComponent(item.id)}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-5 pl-1 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <div className="min-w-0 flex-1">
          <div className={cn("font-semibold", !item.name && "text-muted-foreground italic")}>{name}</div>
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
          {reason && <p className="mt-1.5 text-sm text-destructive">Chưa duyệt được: {reason}</p>}
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
