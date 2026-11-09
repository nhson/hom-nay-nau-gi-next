import type { PendingDish, PendingWarningView } from "@/shared/schemas";

/** Where a Món chờ duyệt came from, in words. */
export function sourceLabel(item: Pick<PendingDish, "source">): string {
  if (item.source.kind === "menu") return "Ảnh thực đơn";
  if (item.source.kind === "photo") return "Ảnh công thức";
  return "Tác nhân thu thập";
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
