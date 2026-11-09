import { RECIPE_SOURCES, type RunReason } from "@/domain";
import type { AgentRun, PendingDish, PendingWarningView } from "@/shared/schemas";

/** Where a Món chờ duyệt came from, in words. */
export function sourceLabel(item: Pick<PendingDish, "source">): string {
  if (item.source.kind === "menu") return "Ảnh thực đơn";
  if (item.source.kind === "photo") return "Ảnh công thức";
  const site = sourceSite(item.source.url);
  return site ? `Tác nhân thu thập · ${site}` : "Tác nhân thu thập";
}

/** The Nguồn công thức a page belongs to, by name, or null. */
export function sourceSite(url: string | null): string | null {
  if (!url) return null;
  return RECIPE_SOURCES.find((source) => url.startsWith(`${source.origin}/`))?.name ?? null;
}

const SOURCE_NAMES: Record<string, string> = Object.fromEntries(RECIPE_SOURCES.map((source) => [source.id, source.name]));

export const RUN_STATUS_TEXT: Record<AgentRun["status"], string> = {
  ok: "Xong",
  partial: "Xong một phần",
  skipped: "Bỏ qua",
  failed: "Lỗi",
};

export const RUN_TRIGGER_TEXT: Record<AgentRun["trigger"], string> = { cron: "Hằng ngày", manual: "Chạy ngay" };

/** Why a run did nothing or stopped early, in words; null when it ran to the end. */
export function runNote(run: Pick<AgentRun, "skipped" | "stoppedBy">): string | null {
  if (run.skipped === "paused") return "Đang tạm dừng: Số món mỗi ngày là 0.";
  if (run.skipped === "too_many_waiting") return "Đã có nhiều món chờ duyệt. Duyệt hoặc bỏ bớt để tác nhân chạy tiếp.";
  if (run.stoppedBy === "rate_limited") return "Dừng sớm: các mô hình AI miễn phí đã hết lượt cho hôm nay.";
  if (run.stoppedBy === "not_configured") return "Chưa bật AI: máy chủ chưa có khoá OpenRouter.";
  if (run.stoppedBy === "deadline") return "Dừng sớm: hết thời gian cho một lần chạy. Lần sau đọc tiếp.";
  return null;
}

const REASON_TEXT: Record<RunReason["reason"], string> = {
  duplicate: "trùng món đã có hoặc đang chờ",
  not_a_recipe: "không phải công thức món ăn",
  unreadable: "không đọc được nội dung",
  not_kept: "để dành cho lần sau",
  robots: "trang không cho phép đọc (robots.txt)",
  source: "không tải được danh sách món",
  page: "không tải được",
  reader: "AI không trả lời được",
};

/** One grouped skip or error of a run, in words: "vnexpress.net: 2 trang không phải công thức món ăn". */
export function reasonText(reason: RunReason): string {
  const where = SOURCE_NAMES[reason.sourceId] ?? "Tác nhân";
  const whole = reason.reason === "robots" || reason.reason === "source";
  return `${where}: ${whole ? "" : `${reason.count} trang `}${REASON_TEXT[reason.reason]}`;
}

/** The Vietnamese wording of a warning (the API only says which one and about what). */
export function warningText(warning: PendingWarningView): string {
  if (warning.code === "ai-written") return "AI tự viết công thức, hãy kiểm tra nguyên liệu, lượng và các bước.";
  if (warning.code === "chay-toi") {
    return "Món chay có nhắc “tỏi”. Sửa nguyên liệu, các bước, hoặc tắt “Món chay” trước khi Duyệt.";
  }
  if (warning.of === "pending") return `Có thể trùng với một món chờ duyệt khác: “${warning.name}”.`;
  return `Có thể trùng với “${warning.name}” (${warning.id}${warning.hidden ? ", đã ẩn" : ""}) trong Danh mục món.`;
}

/** Where a duplicate warning points, so the Quản trị viên can compare. */
export function warningHref(warning: PendingWarningView): string | null {
  if (warning.code !== "possible-duplicate") return null;
  return warning.of === "pending"
    ? `/admin/review/${encodeURIComponent(warning.id)}`
    : `/admin/dishes/${encodeURIComponent(warning.id)}`;
}
