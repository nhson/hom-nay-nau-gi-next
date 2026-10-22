import type { DishProblem } from "@/domain";

/** The Vietnamese wording for each rule a dish can break (the domain only says which rule and where). */
export function problemMessage(problem: DishProblem): string {
  const line = (problem.index ?? 0) + 1;
  switch (problem.code) {
    case "name-required":
      return "Nhập tên món.";
    case "name-duplicate":
      return "Tên món bị trùng: đã có món tên này (không phân biệt hoa thường, dấu).";
    case "category-required":
      return "Chọn Nhóm món cho Bữa cơm 3 món.";
    case "category-not-allowed":
      return "Bữa 1 món không có Nhóm món.";
    case "ingredients-required":
      return "Cần ít nhất một nguyên liệu.";
    case "time-invalid":
      return "Thời gian phải là số phút nguyên dương.";
    case "chay-toi":
      return `${problem.field === "ingredients" ? "Nguyên liệu" : "Bước"} ${line} có “tỏi”: món chay không được dùng tỏi. Dùng hành boa-rô, hoặc tắt “Món chay”.`;
  }
}

/** The id of the form control a problem belongs to, so a summary link can focus it. */
export function problemFieldId(problem: DishProblem): string {
  switch (problem.field) {
    case "name":
      return "f-name";
    case "category":
      return "f-cat";
    case "time":
      return "f-time";
    case "ingredients":
      return `ing-${problem.index ?? 0}`;
    case "steps":
      return `step-${problem.index ?? 0}`;
  }
}
