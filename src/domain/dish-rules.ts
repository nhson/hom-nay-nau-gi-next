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

/** Every rule a dish can break. One list, so the API schema and the UI wording cannot drift from it. */
export const DISH_PROBLEM_CODES = [
  "name-required",
  "name-duplicate",
  "category-required",
  "category-not-allowed",
  "ingredients-required",
  "time-invalid",
  "chay-toi",
] as const;

export type DishProblemCode = (typeof DISH_PROBLEM_CODES)[number];

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

/** Trims each line and drops the blank ones. */
export function cleanLines(lines: readonly string[]): string[] {
  return lines.map((line) => line.trim()).filter((line) => line !== "");
}

/** Trims the name and drops blank ingredient and step lines: what is actually stored. */
export function normalizeDraft(draft: DishDraft): DishDraft {
  return { ...draft, name: draft.name.trim(), ingredients: cleanLines(draft.ingredients), steps: cleanLines(draft.steps) };
}

/** Minutes typed into a form: empty is "no time"; anything that is not a number stays NaN so validation rejects it. */
export function parseMinutes(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed);
}

/** "Missing" problems wait until the person tries to save; the rest are worth showing as they type. */
export function waitsForSubmit(problem: DishProblem): boolean {
  return problem.code === "name-required" || problem.code === "ingredients-required";
}

/** The page's own problems plus any the server also reported, each once. */
export function mergeProblems(own: readonly DishProblem[], reported: readonly DishProblem[]): DishProblem[] {
  const same = (a: DishProblem, b: DishProblem) => a.code === b.code && a.field === b.field && a.index === b.index;
  return [...own, ...reported.filter((extra) => !own.some((problem) => same(problem, extra)))];
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

export type DishIdPrefix = "x" | "c" | "m" | "t";

/** The legacy id prefix: x / c / m for the three Nhóm món, t for Bữa 1 món. */
export function dishIdPrefix(draft: Pick<DishDraft, "mealType" | "category">): DishIdPrefix {
  if (draft.mealType === "buatomonuoc") return "t";
  return draft.category === "canh" ? "c" : draft.category === "man" ? "m" : "x";
}

/** The next free id for a prefix: one more than the highest existing number. */
export function nextDishId(prefix: DishIdPrefix, existingIds: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let highest = 0;
  for (const id of existingIds) {
    const match = pattern.exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}${highest + 1}`;
}
