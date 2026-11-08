"use client";

import { Camera, ChevronRight, ImagePlus, Inbox, Loader2, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { groupOf, groupStyle } from "@/lib/category-style";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { cn } from "@/lib/utils";
import { MAX_PHOTOS, type PendingDish } from "@/shared/schemas";
import { useAdmin } from "./admin-frame";
import { sourceLabel } from "./review-labels";

/** The Vietnamese message for a failed photo read (the API only says which failure). */
function readFailureMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "Có lỗi khi đọc ảnh. Thử lại.";
  switch (error.code) {
    case "not_a_recipe":
      return "Ảnh này không giống một công thức nấu ăn. Thử ảnh khác.";
    case "unreadable":
      return "Không đọc được công thức trong ảnh (mờ, tối hoặc bị cắt). Chụp lại rõ hơn rồi thử lại.";
    case "reader_rate_limited":
      return "Các mô hình AI miễn phí đã hết lượt cho hôm nay. Thử lại sau.";
    case "reader_unavailable":
      return "Dịch vụ AI đang bận hoặc không trả lời. Thử lại sau ít phút.";
    case "reader_not_configured":
      return "Chưa bật đọc ảnh công thức: máy chủ chưa có khoá OpenRouter.";
    case "payload_too_large":
      return "Ảnh quá lớn. Chọn ít ảnh hơn hoặc ảnh nhỏ hơn.";
    case "bad_request":
      return "Ảnh không hợp lệ. Chọn ảnh JPEG, PNG hoặc WebP.";
    case "network":
      return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
    default:
      return "Có lỗi khi đọc ảnh. Thử lại.";
  }
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

interface Photo {
  key: number;
  name: string;
  url: string;
}

export function ReviewListScreen() {
  const router = useRouter();
  const { requireLogin, setPendingCount } = useAdmin();
  const [items, setItems] = useState<PendingDish[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [failed, setFailed] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const nextKey = useRef(0);

  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listPending()
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setConfigured(result.readerConfigured);
        setPendingCount(result.items.length);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) requireLogin();
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requireLogin, setPendingCount]);

  function showProblem(message: string) {
    setProblem(message);
    requestAnimationFrame(() => problemRef.current?.focus());
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setProblem(null);
    if (photos.length + files.length > MAX_PHOTOS) {
      return showProblem(`Chọn tối đa ${MAX_PHOTOS} ảnh cho một công thức.`);
    }
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
    if (photos.length === 0 || reading) return;
    setProblem(null);
    setReading(true);
    try {
      const pending = await adminApi.readPhotos(photos.map((photo) => photo.url));
      setPendingCount((items?.length ?? 0) + 1);
      toast.success("Đã đọc xong. Kiểm tra lại rồi Duyệt.");
      router.push(`/admin/review/${encodeURIComponent(pending.id)}`);
    } catch (error) {
      setReading(false);
      if (error instanceof AdminApiError && error.status === 401) return requireLogin();
      if (error instanceof AdminApiError && error.code === "reader_not_configured") setConfigured(false);
      showProblem(readFailureMessage(error));
    }
  }

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

      <section aria-labelledby="upload-title" className="mb-6 rounded-2xl border bg-card p-5">
        <h2 id="upload-title" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Camera aria-hidden className="size-5" /> Tải ảnh công thức
        </h2>
        <p id="upload-hint" className="mt-1 text-sm text-muted-foreground">
          Chụp hoặc chọn 1 đến {MAX_PHOTOS} ảnh của <b>một</b> công thức (trang sách, giấy viết tay, ảnh chụp màn hình). Ảnh chỉ dùng để đọc rồi bỏ, không lưu lại.
        </p>

        {!configured && (
          <p className="mt-3 rounded-xl border bg-muted p-3 text-sm">
            Chưa bật đọc ảnh công thức: máy chủ chưa có khoá OpenRouter (<code>OPENROUTER_API_KEY</code>).
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
                  disabled={reading}
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
          <input
            ref={input}
            id="recipe-photos"
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={pick}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-describedby="upload-hint"
            disabled={!configured || reading || preparing || photos.length >= MAX_PHOTOS}
            onClick={() => input.current?.click()}
          >
            <ImagePlus aria-hidden /> {photos.length === 0 ? "Chọn ảnh" : "Thêm ảnh"}
          </Button>
          <Button type="button" size="lg" disabled={!configured || reading || preparing || photos.length === 0} onClick={read}>
            {reading ? (
              <>
                <Loader2 aria-hidden className="animate-spin" /> Đang đọc công thức…
              </>
            ) : (
              <>
                <Sparkles aria-hidden /> Đọc công thức
              </>
            )}
          </Button>
          <p role="status" className="text-sm text-muted-foreground">
            {preparing ? "Đang chuẩn bị ảnh…" : reading ? "Đang đọc công thức, thường mất vài giây đến một phút." : ""}
          </p>
        </div>
      </section>

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
            <p className="mt-1">Tải ảnh một công thức ở trên để bắt đầu.</p>
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
