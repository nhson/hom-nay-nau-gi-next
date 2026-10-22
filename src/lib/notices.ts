import type { Notice } from "@/domain";
import { CATEGORY_LABEL } from "./labels";

/** Vietnamese wording for the domain's notices. */
export function noticeMessage(notice: Notice): string {
  switch (notice.code) {
    case "groups-missing":
      return notice.chay
        ? `Chưa đủ món chay cho nhóm: ${notice.groups.map((g) => CATEGORY_LABEL[g]).join(", ")}`
        : `Chưa đủ món cho nhóm: ${notice.groups.map((g) => CATEGORY_LABEL[g]).join(", ")}`;
    case "no-alternative":
      return "Không còn món khác trong nhóm này";
    case "no-one-dish":
      return "Chưa có món Bữa 1 món nào phù hợp";
    case "cooked":
      return "Đã ghi nhận thực đơn hôm nay!";
    case "favorite-saved":
      return "Đã lưu vào yêu thích!";
    case "favorite-applied":
      return "Đã áp dụng thực đơn yêu thích!";
    case "no-menu-to-save":
      return "Chưa có thực đơn để lưu";
    case "favorite-unavailable":
      return "Các món trong thực đơn này đã bị xoá";
  }
}
