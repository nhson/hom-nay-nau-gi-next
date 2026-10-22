import { foldText } from "./selectors";
import type { Category, Dish, MealType, Region } from "./types";

/** A dish as the Quản trị viên writes it: everything except the id the system assigns. */
export interface DishDraft {
  mealType: MealType;
  category: Category | null;
  chay: boolean;
  region: Region | null;
  name: string;
  time: number | null;
  ingredients: string[];
  steps: string[];
}

export type DishProblemCode =
  | "name-required"
  | "name-duplicate"
  | "category-required"
  | "category-not-allowed"
  | "ingredients-required"
  | "time-invalid"
  | "chay-toi";

/** What is wrong and where; the wording lives in the UI. `index` is the line within `ingredients` / `steps`. */
export interface DishProblem {
  code: DishProblemCode;
  field: "name" | "category" | "ingredients" | "steps" | "time";
  index?: number;
}

/**
 * Whether the text uses the word "tỏi". Whole word, diacritics kept: "tối" (evening) is not "tỏi".
 * Text is compared composed (NFC) so it matches however the accent was typed.
 */
export function mentionsToi(text: string): boolean {
  return /(?<![\p{L}\p{M}])tỏi(?![\p{L}\p{M}])/iu.test(text.normalize("NFC"));
}

/** Trims the name and drops blank ingredient and step lines: what is actually stored. */
export function normalizeDraft(draft: DishDraft): DishDraft {
  const keep = (lines: string[]) => lines.map((line) => line.trim()).filter((line) => line !== "");
  return { ...draft, name: draft.name.trim(), ingredients: keep(draft.ingredients), steps: keep(draft.steps) };
}

/**
 * Everything that stops a draft from being published. `others` is the whole catalog (hidden dishes
 * included, so a hidden dish still owns its name); `selfId` is the dish being edited, which may keep
 * its own name. A Chay dish must not use tỏi (ADR-0003: that promise is why the catalog is central).
 */
export function validateDish(
  draft: DishDraft,
  others: readonly Pick<Dish, "id" | "name">[],
  selfId?: string,
): DishProblem[] {
  const problems: DishProblem[] = [];

  const name = draft.name.trim();
  if (name === "") {
    problems.push({ code: "name-required", field: "name" });
  } else {
    const key = foldText(name);
    if (others.some((other) => other.id !== selfId && foldText(other.name) === key)) {
      problems.push({ code: "name-duplicate", field: "name" });
    }
  }

  if (draft.mealType === "buacom" && draft.category === null) {
    problems.push({ code: "category-required", field: "category" });
  }
  if (draft.mealType === "buatomonuoc" && draft.category !== null) {
    problems.push({ code: "category-not-allowed", field: "category" });
  }

  if (!draft.ingredients.some((line) => line.trim() !== "")) {
    problems.push({ code: "ingredients-required", field: "ingredients" });
  }

  if (draft.time !== null && (!Number.isInteger(draft.time) || draft.time <= 0)) {
    problems.push({ code: "time-invalid", field: "time" });
  }

  if (draft.chay) {
    draft.ingredients.forEach((line, index) => {
      if (mentionsToi(line)) problems.push({ code: "chay-toi", field: "ingredients", index });
    });
    draft.steps.forEach((line, index) => {
      if (mentionsToi(line)) problems.push({ code: "chay-toi", field: "steps", index });
    });
  }

  return problems;
}

/** The legacy id prefix: x / c / m for the three Nhóm món, t for Bữa 1 món. */
export function dishIdPrefix(draft: Pick<DishDraft, "mealType" | "category">): "x" | "c" | "m" | "t" {
  if (draft.mealType === "buatomonuoc") return "t";
  return draft.category === "canh" ? "c" : draft.category === "man" ? "m" : "x";
}

/** The next free id for a prefix: one more than the highest existing number. */
export function nextDishId(prefix: string, existingIds: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let highest = 0;
  for (const id of existingIds) {
    const match = pattern.exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}${highest + 1}`;
}
