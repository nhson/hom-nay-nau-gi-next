"use client";

import { ArrowRight, Inbox, Loader2, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { catalogCounts, type CatalogCounts } from "@/domain";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { groupStyle, type GroupKey } from "@/lib/category-style";
import { cn } from "@/lib/utils";
import type { AgentRunsResponse } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";
import { runError, RunSummary } from "./agent-screen";

/** One block's data: loading, failed, or there. Each block of Tổng quan loads and fails on its own. */
type Load<T> = { state: "loading" } | { state: "failed" } | { state: "ready"; value: T };

const GROUPS: { key: GroupKey; count: keyof CatalogCounts }[] = [
  { key: "xao", count: "xao" },
  { key: "canh", count: "canh" },
  { key: "man", count: "man" },
  { key: "bowl", count: "buatomonuoc" },
];

/** Tổng quan (spec #41): the admin home. How the catalog stands, what waits on Chờ duyệt, and the agent's last run. */
export function OverviewScreen() {
  const { requireLogin, setVersion, pendingCount, setPendingCount, refreshPendingCount } = useAdmin();
  const heading = useRef<HTMLHeadingElement>(null);
  const [catalog, setCatalog] = useState<Load<{ version: number; counts: CatalogCounts }>>({ state: "loading" });
  const [pending, setPending] = useState<Load<number>>({ state: "loading" });
  const [runs, setRuns] = useState<Load<AgentRunsResponse>>({ state: "loading" });
  const [starting, setStarting] = useState(false);

  useEffect(() => heading.current?.focus(), []);

  /** A 401 sends the Quản trị viên to sign-in; anything else only marks the one block as failed. */
  const failed = useCallback(
    (fail: () => void) => (error: unknown) => {
      if (error instanceof AdminApiError && error.status === 401) requireLogin();
      else fail();
    },
    [requireLogin],
  );

  useEffect(() => {
    adminApi
      .listDishes()
      .then((result) => {
        setVersion(result.version);
        setCatalog({ state: "ready", value: { version: result.version, counts: catalogCounts(result.dishes) } });
      })
      .catch(failed(() => setCatalog({ state: "failed" })));
    adminApi
      .listPending()
      .then((result) => {
        setPendingCount(result.items.length);
        setPending({ state: "ready", value: result.items.length });
      })
      .catch(failed(() => setPending({ state: "failed" })));
    adminApi
      .listRuns()
      .then((result) => setRuns({ state: "ready", value: result }))
      .catch(failed(() => setRuns({ state: "failed" })));
  }, [failed, setVersion, setPendingCount]);

  // The menu badge can change from here (Chạy ngay); the block follows it.
  const waiting = pendingCount ?? (pending.state === "ready" ? pending.value : null);
  const running = starting || (runs.state === "ready" && runs.value.running);

  async function runNow() {
    setStarting(true);
    try {
      const run = await adminApi.startRun();
      setRuns((current) => ({
        state: "ready",
        value: { running: false, runs: [run, ...(current.state === "ready" ? current.value.runs : [])] },
      }));
      refreshPendingCount();
      toast.success(run.added > 0 ? `Tác nhân đã thêm ${run.added} món chờ duyệt.` : "Tác nhân chạy xong, không có món mới.");
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) requireLogin();
      else toast.error(runError(error));
    } finally {
      setStarting(false);
    }
  }

  const latest = runs.state === "ready" ? runs.value.runs[0] : undefined;

  return (
    <div>
      <div className="mb-5">
        <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">
          Tổng quan
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Danh mục món, món chờ duyệt và tác nhân thu thập, trong một trang.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2.5">
        <Link href="/admin/add" className={cn(buttonVariants({ variant: "turmeric", size: "lg" }), "h-11")}>
          <Plus aria-hidden /> Thêm món
        </Link>
        <Button size="lg" variant="outline" className="h-11" onClick={runNow} disabled={running || runs.state === "loading"}>
          {running ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
          {running ? "Tác nhân đang chạy…" : "Chạy ngay"}
        </Button>
        <Link href="/admin/review" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
          <Inbox aria-hidden /> Chờ duyệt
        </Link>
      </div>
      <p role="status" className="sr-only">
        {starting ? "Tác nhân đang đọc các trang. Có thể mất vài phút." : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block id="catalog" title="Danh mục món" href="/admin/dishes" linkText="Mở Danh mục món" load={catalog} failText="Không tải được Danh mục món.">
          {(value) => (
            <>
              <p className="text-sm text-muted-foreground">Phiên bản v{value.version}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Count label="Đang dùng" value={value.counts.shown} />
                <Count label="Đã ẩn" value={value.counts.hidden} />
                {GROUPS.map(({ key, count }) => {
                  const style = groupStyle(key);
                  return (
                    <Count
                      key={key}
                      label={
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className={cn("size-2 rounded-full bg-current", style.iconClass)} />
                          {style.label}
                        </span>
                      }
                      value={value.counts[count]}
                    />
                  );
                })}
              </dl>
            </>
          )}
        </Block>

        <div className="grid content-start gap-4">
          <Block
            id="pending"
            title="Chờ duyệt"
            href="/admin/review"
            linkText="Mở Chờ duyệt"
            load={waiting === null ? pending : { state: "ready", value: waiting }}
            failText="Không tải được số món chờ duyệt."
          >
            {(count) => (
              <p className="text-sm">
                {count > 0 ? (
                  <>
                    <b className="font-display text-2xl">{count}</b> món đang chờ bạn duyệt.
                  </>
                ) : (
                  "Không có món nào đang chờ."
                )}
              </p>
            )}
          </Block>

          <Block id="agent" title="Tác nhân thu thập" href="/admin/agent" linkText="Mở Tác nhân thu thập" load={runs} failText="Không tải được các lần chạy.">
            {() =>
              latest ? (
                <RunSummary run={latest} />
              ) : (
                <p className="text-sm text-muted-foreground">Chưa chạy lần nào. Lần chạy hằng ngày vào khoảng 5 giờ sáng.</p>
              )
            }
          </Block>
        </div>
      </div>
    </div>
  );
}

function Block<T>({
  id,
  title,
  href,
  linkText,
  load,
  failText,
  children,
}: {
  id: string;
  title: string;
  href: string;
  linkText: string;
  load: Load<T>;
  failText: string;
  children: (value: T) => ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border bg-card p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="font-display text-lg font-semibold">
          {title}
        </h2>
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {linkText} <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      {load.state === "loading" ? (
        <div aria-busy="true" aria-label="Đang tải" className="h-16 animate-pulse rounded-xl bg-muted" />
      ) : load.state === "failed" ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {failText}
        </p>
      ) : (
        children(load.value)
      )}
    </section>
  );
}

function Count({ label, value }: { label: ReactNode; value: number }) {
  return (
    <div className="flex flex-col-reverse rounded-xl border bg-background px-3.5 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold">{value}</dd>
    </div>
  );
}
