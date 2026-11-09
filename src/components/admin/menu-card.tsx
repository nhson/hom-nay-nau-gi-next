"use client";

import { Camera, Check, ImagePlus, Loader2, Plus, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkMenuName, MENU_BATCH_LIMIT, startingTick, type NameMatch } from "@/domain";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { cn } from "@/lib/utils";
import { MAX_PHOTOS, type AdminDish, type PendingDish } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";

/** The Vietnamese message for a failed call to the AI (the API only says which failure). */
function failureMessage(error: unknown, task: "read" | "write"): string {
  const fallback = task === "read" ? "Có lỗi khi đọc ảnh. Thử lại." : "Có lỗi khi viết công thức. Thử lại.";
  if (!(error instanceof AdminApiError)) return fallback;
  switch (error.code) {
    case "no_dishes":
      return "Không tìm thấy tên món nào trong ảnh. Thử ảnh khác, hoặc gõ tên món ở dưới.";
    case "unreadable":
      return "Không đọc được thực đơn trong ảnh (mờ, tối hoặc bị cắt). Chụp lại rõ hơn rồi thử lại.";
    case "unusable_answer":
      return "AI không viết được công thức dùng được. Thử lại.";
    case "reader_rate_limited":
      return "Các mô hình AI miễn phí đã hết lượt cho hôm nay. Thử lại sau.";
    case "reader_unavailable":
      return "Dịch vụ AI đang bận hoặc không trả lời. Thử lại sau ít phút.";
    case "reader_not_configured":
      return "Chưa bật AI: máy chủ chưa có khoá OpenRouter.";
    case "payload_too_large":
      return "Ảnh quá lớn. Chọn ít ảnh hơn hoặc ảnh nhỏ hơn.";
    case "bad_request":
      return task === "read" ? "Ảnh không hợp lệ. Chọn ảnh JPEG, PNG hoặc WebP." : "Tên món không hợp lệ (1 đến 60 ký tự).";
    case "network":
      return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
    default:
      return fallback;
  }
}

/** Why a name starts unticked, in words. */
function matchHint(match: NameMatch): string {
  if (match.of === "pending") return "đang chờ duyệt";
  return `đã có (${match.id}${match.hidden ? ", đã ẩn" : ""})`;
}

interface Photo {
  key: number;
  name: string;
  url: string;
}

interface Row {
  key: number;
  name: string;
  ticked: boolean;
  match: NameMatch | null;
}

type Status = "waiting" | "writing" | "done" | "failed" | "left";
interface Job {
  key: number;
  name: string;
  status: Status;
  pendingId?: string;
}

const STATUS_TEXT: Record<Status, string> = {
  waiting: "Chờ viết",
  writing: "Đang viết…",
  done: "Xong",
  failed: "Lỗi",
  left: "Chưa tạo",
};

/**
 * Ảnh thực đơn (spec #36): photos of a menu → a checklist of dish names → "Tạo món" writes one recipe
 * per ticked name, one request at a time, each becoming a Món chờ duyệt. Nothing runs in the background:
 * closing the page stops, and what is written is already saved.
 */
export function MenuCard({
  configured,
  pending,
  onConfigured,
  onCreated,
}: {
  configured: boolean;
  /** The Món chờ duyệt already waiting, so names typed or edited here get the same starting tick as the server's. */
  pending: readonly PendingDish[];
  onConfigured: (configured: boolean) => void;
  onCreated: (item: PendingDish) => void;
}) {
  const { requireLogin } = useAdmin();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [typed, setTyped] = useState("");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const catalog = useRef<AdminDish[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const nextKey = useRef(0);

  const busy = reading || running || preparing;
  const tickedCount = rows.filter((row) => row.ticked).length;

  function showProblem(message: string) {
    setProblem(message);
    requestAnimationFrame(() => problemRef.current?.focus());
  }

  function handleAuth(error: unknown): boolean {
    if (error instanceof AdminApiError && error.status === 401) {
      requireLogin();
      return true;
    }
    if (error instanceof AdminApiError && error.code === "reader_not_configured") onConfigured(false);
    return false;
  }

  /** The catalog for ticks on typed or edited names; loaded once, the first time it is needed. */
  async function loadCatalog(): Promise<AdminDish[]> {
    if (catalog.current) return catalog.current;
    try {
      catalog.current = (await adminApi.listDishes()).dishes;
    } catch {
      catalog.current = [];
    }
    return catalog.current;
  }

  async function tickFor(name: string, othersTicked: number): Promise<Pick<Row, "ticked" | "match">> {
    const result = startingTick(name, await loadCatalog(), pending);
    return { match: result.match, ticked: result.ticked && othersTicked < MENU_BATCH_LIMIT };
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setProblem(null);
    if (photos.length + files.length > MAX_PHOTOS) return showProblem(`Chọn tối đa ${MAX_PHOTOS} ảnh cho một thực đơn.`);
    const notImage = files.find((file) => !file.type.startsWith("image/"));
    if (notImage) return showProblem(`Tệp “${notImage.name}” không phải ảnh.`);

    setPreparing(true);
    const added: Photo[] = [];
    for (const file of files) {
      try {
        added.push({ key: nextKey.current++, name: file.name, url: await shrinkPhoto(file) });
      } catch {
        setPreparing(false);
        return showProblem(`Không mở được ảnh “${file.name}”. Thử ảnh khác.`);
      }
    }
    setPreparing(false);
    setPhotos((current) => [...current, ...added]);
  }

  async function read() {
    if (photos.length === 0 || busy) return;
    setProblem(null);
    setNotice(null);
    setReading(true);
    try {
      const result = await adminApi.readMenu(photos.map((photo) => photo.url));
      // Names already on the checklist stay; the menu's names are added after them, without repeats.
      setRows((current) => {
        const known = new Set(current.map((row) => row.name.toLowerCase()));
        let ticked = current.filter((row) => row.ticked).length;
        const added = result.names
          .filter((item) => !known.has(item.name.toLowerCase()))
          .map((item) => {
            const tick = item.ticked && ticked < MENU_BATCH_LIMIT;
            if (tick) ticked++;
            return { key: nextKey.current++, name: item.name, ticked: tick, match: item.match };
          });
        return [...current, ...added];
      });
      setPhotos([]);
      setNotice(`Đã đọc ${result.names.length} tên món. Chọn món muốn tạo rồi bấm “Tạo món”.`);
    } catch (error) {
      if (!handleAuth(error)) showProblem(failureMessage(error, "read"));
    } finally {
      setReading(false);
    }
  }

  async function addTyped(event: FormEvent) {
    event.preventDefault();
    const name = checkMenuName(typed);
    if (!name) return showProblem("Gõ một tên món (1 đến 60 ký tự).");
    setProblem(null);
    const tick = await tickFor(name, tickedCount);
    setRows((current) => [...current, { key: nextKey.current++, name, ...tick }]);
    setTyped("");
  }

  function rename(key: number, name: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, name } : row)));
  }

  /** Once an edit is done, the tick follows the new name ("đã có" or not). */
  async function settleName(key: number) {
    const row = rows.find((item) => item.key === key);
    if (!row) return;
    const others = rows.filter((item) => item.ticked && item.key !== key).length;
    const tick = await tickFor(row.name, others);
    setRows((current) => current.map((item) => (item.key === key ? { ...item, ...tick } : item)));
  }

  function toggle(key: number, ticked: boolean) {
    if (ticked && tickedCount >= MENU_BATCH_LIMIT) {
      setNotice(`Mỗi lần chỉ tạo tối đa ${MENU_BATCH_LIMIT} món. Bỏ chọn một món khác trước.`);
      return;
    }
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ticked } : row)));
  }

  function remove(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  async function create() {
    const chosen = rows.filter((row) => row.ticked && checkMenuName(row.name));
    if (chosen.length === 0 || busy) return;
    setProblem(null);
    setNotice(null);
    setRunning(true);
    const list: Job[] = chosen.map((row) => ({ key: row.key, name: checkMenuName(row.name) ?? row.name, status: "waiting" }));
    setJobs(list);
    setRows((current) => current.filter((row) => !chosen.some((item) => item.key === row.key)));
    const update = (key: number, patch: Partial<Job>) =>
      setJobs((current) => current?.map((job) => (job.key === key ? { ...job, ...patch } : job)) ?? null);

    let stopped: string | null = null;
    let done = 0;
    for (const job of list) {
      if (stopped) {
        update(job.key, { status: "left" });
        continue;
      }
      update(job.key, { status: "writing" });
      try {
        const item = await adminApi.writeDish(job.name);
        onCreated(item);
        done++;
        update(job.key, { status: "done", pendingId: item.id });
      } catch (error) {
        if (handleAuth(error)) {
          stopped = "login";
          update(job.key, { status: "left" });
        } else if (error instanceof AdminApiError && (error.code === "reader_rate_limited" || error.code === "reader_not_configured")) {
          stopped = failureMessage(error, "write");
          update(job.key, { status: "left" });
        } else {
          update(job.key, { status: "failed" });
        }
      }
    }
    setRunning(false);
    if (stopped && stopped !== "login") showProblem(`${stopped} Đã tạo ${done} món; các món còn lại được ghi “Chưa tạo”.`);
    else if (done > 0) toast.success(`Đã tạo ${done} món chờ duyệt.`);
  }

  /** Puts the names that failed or were never written back on the checklist, ticked. */
  function retryLeftovers() {
    if (!jobs) return;
    const again = jobs.filter((job) => job.status === "failed" || job.status === "left").slice(0, MENU_BATCH_LIMIT);
    setRows((current) => [
      ...current.map((row) => ({ ...row, ticked: false })),
      ...again.map((job) => ({ key: nextKey.current++, name: job.name, ticked: true, match: null })),
    ]);
    setJobs(null);
  }

  const leftovers = jobs?.filter((job) => job.status === "failed" || job.status === "left").length ?? 0;
  const writing = jobs?.findIndex((job) => job.status === "writing") ?? -1;

  return (
    <section aria-labelledby="upload-title" className="mb-6 rounded-2xl border bg-card p-5">
      <h2 id="upload-title" className="flex items-center gap-2 font-display text-lg font-semibold">
        <Camera aria-hidden className="size-5" /> Tải ảnh thực đơn
      </h2>
      <p id="upload-hint" className="mt-1 text-sm text-muted-foreground">
        Chụp hoặc chọn 1 đến {MAX_PHOTOS} ảnh của <b>một</b> thực đơn (thực đơn quán, thực đơn tuần, ảnh chụp màn hình). AI đọc tên món; bạn chọn món muốn tạo, AI viết công thức để bạn kiểm tra. Ảnh chỉ dùng để đọc rồi bỏ.
      </p>

      {!configured && (
        <p className="mt-3 rounded-xl border bg-muted p-3 text-sm">
          Chưa bật AI: máy chủ chưa có khoá OpenRouter (<code>OPENROUTER_API_KEY</code>).
        </p>
      )}

      {problem && (
        <div
          ref={problemRef}
          role="alert"
          tabIndex={-1}
          className="mt-3 flex gap-2.5 rounded-xl border border-destructive/35 bg-destructive/10 p-3.5 text-sm text-destructive outline-none focus-visible:ring-3 focus-visible:ring-destructive/40"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div>{problem}</div>
        </div>
      )}

      {photos.length > 0 && (
        <ul aria-label="Ảnh đã chọn" className="mt-4 flex flex-wrap gap-3">
          {photos.map((photo, index) => (
            <li key={photo.key} className="relative">
              {/* A local data URL: next/image adds nothing here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Ảnh ${index + 1}`} className="size-24 rounded-xl border object-cover" />
              <button
                type="button"
                disabled={busy}
                onClick={() => setPhotos((current) => current.filter((item) => item.key !== photo.key))}
                className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border bg-background shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <X aria-hidden className="size-4" />
                <span className="sr-only">Bỏ ảnh {index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <input ref={input} id="menu-photos" type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={pick} />
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-describedby="upload-hint"
          disabled={!configured || busy || photos.length >= MAX_PHOTOS}
          onClick={() => input.current?.click()}
        >
          <ImagePlus aria-hidden /> {photos.length === 0 ? "Chọn ảnh" : "Thêm ảnh"}
        </Button>
        <Button type="button" size="lg" disabled={!configured || busy || photos.length === 0} onClick={read}>
          {reading ? (
            <>
              <Loader2 aria-hidden className="animate-spin" /> Đang đọc thực đơn…
            </>
          ) : (
            <>
              <Sparkles aria-hidden /> Đọc thực đơn
            </>
          )}
        </Button>
      </div>

      <p role="status" className="mt-2 min-h-5 text-sm text-muted-foreground">
        {preparing
          ? "Đang chuẩn bị ảnh…"
          : reading
            ? "Đang đọc thực đơn, thường mất vài giây đến một phút."
            : running && writing >= 0 && jobs
              ? `Đang viết ${writing + 1}/${jobs.length}: ${jobs[writing].name}`
              : (notice ?? "")}
      </p>

      <div className="mt-4 border-t pt-4">
        <h3 id="names-title" className="font-display text-base font-semibold">
          Món muốn tạo{rows.length > 0 ? ` (đã chọn ${tickedCount}/${MENU_BATCH_LIMIT})` : ""}
        </h3>
        {rows.length > 0 && (
          <ul aria-labelledby="names-title" className="mt-2 divide-y rounded-xl border">
            {rows.map((row, index) => (
              <li key={row.key} className="flex items-center gap-2.5 px-3 py-2">
                <input
                  type="checkbox"
                  checked={row.ticked}
                  disabled={busy}
                  onChange={(event) => toggle(row.key, event.target.checked)}
                  aria-label={`Chọn “${row.name || `món ${index + 1}`}”`}
                  className="size-5 shrink-0 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <Input
                    value={row.name}
                    disabled={busy}
                    maxLength={60}
                    aria-label={`Tên món ${index + 1}`}
                    onChange={(event) => rename(row.key, event.target.value)}
                    onBlur={() => settleName(row.key)}
                    className="h-9"
                  />
                  {row.match && <p className="mt-1 text-xs text-muted-foreground">{matchHint(row.match)}</p>}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(row.key)}
                  className="grid size-9 shrink-0 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <X aria-hidden className="size-4" />
                  <span className="sr-only">Bỏ “{row.name || `món ${index + 1}`}” khỏi danh sách</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addTyped} className="mt-3 flex gap-2">
          <Input
            value={typed}
            disabled={busy}
            maxLength={60}
            placeholder="Gõ thêm tên món, vd. Canh chua cá lóc"
            aria-label="Thêm tên món"
            onChange={(event) => setTyped(event.target.value)}
            className="h-10"
          />
          <Button type="submit" variant="outline" disabled={busy || !typed.trim()}>
            <Plus aria-hidden /> Thêm
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button type="button" size="lg" disabled={!configured || busy || tickedCount === 0} onClick={create}>
            {running ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
            {running ? "Đang tạo món…" : `Tạo món (${tickedCount})`}
          </Button>
          <p className="text-xs text-muted-foreground">Mỗi món là một lượt gọi AI miễn phí; tối đa {MENU_BATCH_LIMIT} món một lần.</p>
        </div>
      </div>

      {jobs && (
        <div className="mt-4 border-t pt-4">
          <h3 id="jobs-title" className="font-display text-base font-semibold">
            Tiến độ
          </h3>
          <ol aria-labelledby="jobs-title" className="mt-2 divide-y rounded-xl border">
            {jobs.map((job) => (
              <li key={job.key} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 font-medium">{job.name}</span>
                {job.status === "done" && job.pendingId ? (
                  <Link
                    href={`/admin/review/${encodeURIComponent(job.pendingId)}`}
                    className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    <Check aria-hidden className="size-4" /> {STATUS_TEXT.done}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      job.status === "failed" || job.status === "left" ? "font-semibold text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {job.status === "writing" && <Loader2 aria-hidden className="size-4 animate-spin" />}
                    {STATUS_TEXT[job.status]}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {!running && leftovers > 0 && (
            <Button type="button" variant="outline" className="mt-3" onClick={retryLeftovers}>
              <RotateCcw aria-hidden /> Thử lại các món chưa tạo ({leftovers})
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
