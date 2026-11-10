"use client";

import { Bot, ChevronDown, Loader2, Play, Settings2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENT_SETTINGS_LIMITS, checkAgentSettings, runReasons, type AgentSettings } from "@/domain";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import type { AgentRun } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";
import { reasonText, RUN_STATUS_TEXT, RUN_TRIGGER_TEXT, runNote } from "./review-labels";

const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

const STATUS_CLASS: Record<AgentRun["status"], string> = {
  ok: "border-primary/30 bg-primary/10 text-primary",
  partial: "border-amber-600/35 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  skipped: "bg-muted text-muted-foreground",
  failed: "border-destructive/35 bg-destructive/10 text-destructive",
};

const FIELDS: { key: keyof AgentSettings; label: string; hint: string }[] = [
  { key: "dishesPerDay", label: "Số món mỗi ngày", hint: "0 đến 10. Chọn 0 để tạm dừng tác nhân." },
  { key: "pauseAt", label: "Tạm dừng khi có số món chờ duyệt", hint: "1 đến 100. Tác nhân nghỉ khi có từng này món đang chờ." },
  { key: "pagesPerRun", label: "Số trang đọc mỗi lần", hint: "1 đến 20. Mỗi trang dùng một lượt AI miễn phí." },
];

export function runError(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.code === "agent_running") return "Tác nhân đang chạy rồi. Đợi lần chạy đó xong.";
    if (error.code === "network") return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  }
  return "Không chạy được tác nhân. Thử lại sau.";
}

/**
 * The Tác nhân thu thập page (spec #31, moved to its own page by #41): Chạy ngay, Lần chạy gần nhất with
 * the runs before it, and Cài đặt tác nhân. The run itself happens on the server; this only starts it and shows records.
 */
export function AgentScreen() {
  const { requireLogin, refreshPendingCount: onRunFinished } = useAdmin();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const [runs, setRuns] = useState<AgentRun[] | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listRuns()
      .then((result) => {
        if (cancelled) return;
        setRuns(result.runs);
        setRunning(result.running);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) requireLogin();
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requireLogin]);

  // A run this page did not start (the daily cron): check every 15 s until it is done, then show it.
  const [mine, setMine] = useState(false);
  useEffect(() => {
    if (!running || mine) return;
    const timer = setInterval(() => {
      adminApi
        .listRuns()
        .then((result) => {
          setRuns(result.runs);
          setRunning(result.running);
          if (!result.running) onRunFinished();
        })
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [running, mine, onRunFinished]);

  async function runNow() {
    setMine(true);
    setRunning(true);
    try {
      const run = await adminApi.startRun();
      setRuns((current) => [run, ...(current ?? [])].slice(0, 30));
      toast.success(run.added > 0 ? `Tác nhân đã thêm ${run.added} món chờ duyệt.` : "Tác nhân chạy xong, không có món mới.");
      onRunFinished();
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) requireLogin();
      else toast.error(runError(error));
    } finally {
      setRunning(false);
      setMine(false);
    }
  }

  const [latest, ...earlier] = runs ?? [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 ref={heading} tabIndex={-1} className="flex items-center gap-2 font-display text-3xl font-semibold outline-none">
            <Bot aria-hidden className="size-7" /> Tác nhân thu thập
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi sáng khoảng 5 giờ, tự đọc vài trang công thức mới trên monngonmoingay.com và vnexpress.net, rồi đề xuất những món Danh mục món còn thiếu.
          </p>
        </div>
        <Button className="h-11" onClick={runNow} disabled={running || runs === null}>
          {running ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
          {running ? "Đang chạy…" : "Chạy ngay"}
        </Button>
      </div>
      <p role="status" className="-mt-2 mb-3 min-h-5 text-sm text-muted-foreground">
        {running ? "Tác nhân đang đọc các trang. Có thể mất vài phút." : ""}
      </p>

      <section aria-labelledby="runs-title" className="rounded-2xl border bg-card p-5">
        <h2 id="runs-title" className="font-display text-lg font-semibold">Lần chạy gần nhất</h2>
        {failed ? (
          <p className="mt-1 text-sm text-muted-foreground">Không tải được các lần chạy.</p>
        ) : runs === null ? (
          <div aria-busy="true" aria-label="Đang tải" className="mt-2 h-16 animate-pulse rounded-xl bg-muted" />
        ) : !latest ? (
          <p className="mt-1 text-sm text-muted-foreground">Chưa chạy lần nào. Lần chạy hằng ngày vào khoảng 5 giờ sáng.</p>
        ) : (
          <>
            <RunSummary run={latest} />
            {earlier.length > 0 && (
              <details className="group mt-3 rounded-xl border">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  Các lần chạy trước ({earlier.length})
                  <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="divide-y border-t">
                  {earlier.map((run) => (
                    <li key={run.id} className="px-3.5 py-3">
                      <RunSummary run={run} compact />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        <AgentSettingsPanel />
      </section>
    </div>
  );
}

export function RunSummary({ run, compact = false }: { run: AgentRun; compact?: boolean }) {
  const note = runNote(run);
  const reasons = runReasons(run.entries);
  return (
    <div className={cn(!compact && "mt-2 rounded-xl border bg-muted/40 p-3.5")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_CLASS[run.status])}>
          {RUN_STATUS_TEXT[run.status]}
        </span>
        <span className="font-semibold">{when(run.startedAt)}</span>
        <span className="text-muted-foreground">· {RUN_TRIGGER_TEXT[run.trigger]}</span>
      </div>
      {run.status !== "skipped" && (
        <p className="mt-1.5 text-sm">
          Đọc {run.pagesRead} trang · thêm <b>{run.added}</b> món chờ duyệt
        </p>
      )}
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
      {reasons.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
          {reasons.map((reason) => (
            <li key={`${reason.kind}-${reason.reason}-${reason.sourceId}`} className={cn(reason.kind === "error" && "text-destructive")}>
              {reasonText(reason)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Draft = Record<keyof AgentSettings, string>;

function AgentSettingsPanel() {
  const { requireLogin } = useAdmin();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [wrong, setWrong] = useState<(keyof AgentSettings)[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getAgentSettings()
      .then((settings) => {
        if (cancelled) return;
        setDraft({
          dishesPerDay: String(settings.dishesPerDay),
          pauseAt: String(settings.pauseAt),
          pagesPerRun: String(settings.pagesPerRun),
        });
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof AdminApiError && error.status === 401) requireLogin();
      });
    return () => {
      cancelled = true;
    };
  }, [requireLogin]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const values = {
      dishesPerDay: Number(draft.dishesPerDay.trim() || NaN),
      pauseAt: Number(draft.pauseAt.trim() || NaN),
      pagesPerRun: Number(draft.pagesPerRun.trim() || NaN),
    };
    const checked = checkAgentSettings(values);
    if (!checked.ok) {
      setWrong(checked.fields);
      document.getElementById(`agent-${checked.fields[0]}`)?.focus();
      return;
    }
    setWrong([]);
    setSaving(true);
    try {
      await adminApi.saveAgentSettings(checked.settings);
      toast.success("Đã lưu Cài đặt tác nhân.");
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) requireLogin();
      else if (error instanceof AdminApiError && error.fields.length > 0) setWrong(error.fields as (keyof AgentSettings)[]);
      else toast.error("Không lưu được. Thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="group mt-4 rounded-xl border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Settings2 aria-hidden className="size-4" /> Cài đặt tác nhân
        </span>
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      {draft === null ? (
        <div aria-busy="true" aria-label="Đang tải" className="m-3.5 h-24 animate-pulse rounded-xl bg-muted" />
      ) : (
        <form noValidate onSubmit={save} className="space-y-4 border-t p-3.5">
          {FIELDS.map((field) => {
            const invalid = wrong.includes(field.key);
            const limits = AGENT_SETTINGS_LIMITS[field.key];
            return (
              <div key={field.key}>
                <Label htmlFor={`agent-${field.key}`}>{field.label}</Label>
                <Input
                  id={`agent-${field.key}`}
                  type="number"
                  inputMode="numeric"
                  min={limits.min}
                  max={limits.max}
                  step={1}
                  value={draft[field.key]}
                  aria-invalid={invalid || undefined}
                  aria-describedby={`agent-${field.key}-hint`}
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                  className="mt-1.5 h-11 max-w-32"
                />
                <p id={`agent-${field.key}-hint`} className={cn("mt-1 text-sm", invalid ? "text-destructive" : "text-muted-foreground")}>
                  {invalid ? `Nhập một số nguyên từ ${limits.min} đến ${limits.max}.` : field.hint}
                </p>
              </div>
            );
          })}
          <Button type="submit" className="h-11" disabled={saving}>
            {saving && <Loader2 aria-hidden className="animate-spin" />} Lưu
          </Button>
        </form>
      )}
    </details>
  );
}
