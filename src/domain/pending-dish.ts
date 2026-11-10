import { mentionsToi, normalizeDraft, type DishDraft } from "./dish-rules";
import { foldText } from "./selectors";
import type { Category, Dish, MealType, Region } from "./types";

/** Why a model reply did not become a Món chờ duyệt. */
export type RecipeRejection = "not_a_recipe" | "unreadable" | "invalid_shape";

export type RecipeReading = { ok: true; draft: DishDraft } | { ok: false; reason: RecipeRejection };

const MEAL_TYPES: readonly MealType[] = ["buacom", "buatomonuoc"];
const CATEGORIES: readonly Category[] = ["xao", "canh", "man"];
const REGIONS: readonly Region[] = ["bac", "trung", "nam"];

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/**
 * A recipe the AI model answered, as a dish draft or the reason it is not one. The shape it is asked
 * for lives in `writeDishInstructions` (menu-photo), next to its only caller. The reply is untrusted:
 * anything the model got wrong is either repaired here or caught by `validateDish` on Duyệt.
 */
export function readRecipeReply(reply: unknown): RecipeReading {
  const data = modelObject(reply);
  if (!data) return { ok: false, reason: "invalid_shape" };
  if (data.isRecipe === false) return { ok: false, reason: "not_a_recipe" };
  if (data.readable === false) return { ok: false, reason: "unreadable" };

  const mealType = oneOf(MEAL_TYPES, data.mealType) ?? "buacom";
  const draft: DishDraft = {
    name: typeof data.name === "string" ? data.name : "",
    mealType,
    category: mealType === "buatomonuoc" ? null : oneOf(CATEGORIES, data.category),
    chay: data.chay === true || data.chay === "true",
    region: oneOf(REGIONS, data.region),
    time: minutesFrom(data.time),
    ingredients: linesFrom(data.ingredients),
    steps: linesFrom(data.steps),
  };
  const normalized = normalizeDraft(draft);
  if (normalized.ingredients.length === 0 && normalized.steps.length === 0) return { ok: false, reason: "invalid_shape" };
  return { ok: true, draft: normalized };
}

/** Minutes from a number or from text such as "45 phút", "1 giờ 30 phút", "2 tiếng". Null when there is no positive time. */
export function minutesFrom(value: unknown): number | null {
  let minutes: number;
  if (typeof value === "number") {
    minutes = value;
  } else if (typeof value === "string") {
    const text = value.normalize("NFC").toLowerCase();
    const hours = /(\d+(?:[.,]\d+)?)\s*(?:giờ|tiếng|h\b)/u.exec(text);
    const mins = /(\d+)\s*(?:phút|p\b|min)/u.exec(text);
    if (hours || mins) {
      minutes = (hours ? Number(hours[1].replace(",", ".")) * 60 : 0) + (mins ? Number(mins[1]) : 0);
    } else if (/^\s*\d+\s*$/.test(text)) {
      minutes = Number(text);
    } else {
      return null;
    }
  } else {
    return null;
  }
  const rounded = Math.round(minutes);
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null;
}

/** A list of lines from an array or one block of text, without bullets or step numbers ("- ", "1. ", "Bước 2:"). */
export function linesFrom(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.map((item) => String(item)) : typeof value === "string" ? value.split(/\r?\n/) : [];
  return raw.map((line) =>
    line
      .trim()
      .replace(/^(?:[-•*·–]\s*|\d+\s*[.)]\s+|bước\s*\d+\s*[:.)-]?\s*)/iu, ""),
  );
}

/** The model's reply as a JSON object, whether it came parsed or as text; null when it is not one. */
export function modelObject(reply: unknown): Record<string, unknown> | null {
  const data = typeof reply === "string" ? parseJsonText(reply) : reply;
  return isRecord(data) ? data : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The JSON object in a text answer: the whole text, or the first `{ ... }` block (models like to add prose or a code fence). */
function parseJsonText(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Where a Món chờ duyệt came from: an Ảnh thực đơn (the AI wrote the recipe), the Tác nhân thu thập
 * (a real page), a Nhập từ file (no AI), or the old recipe-photo upload, kept only for items made before it was replaced.
 */
export const PENDING_SOURCE_KINDS = ["menu", "agent", "file", "photo"] as const;
export type PendingSourceKind = (typeof PENDING_SOURCE_KINDS)[number];

/** Something the Quản trị viên should look at before Duyệt. Derived when read, so it follows the catalog as it is now. */
export type PendingWarning =
  | { code: "ai-written" }
  /** A dish from a file still lacks something Duyệt needs (the file left it out or it was not understood). */
  | { code: "missing"; field: "category" | "ingredients" | "steps" }
  | { code: "chay-toi" }
  | { code: "possible-duplicate"; of: "dish" | "pending"; id: string; name: string; hidden: boolean };

/**
 * The warnings for one Món chờ duyệt: a recipe the AI wrote itself (Ảnh thực đơn), a chay dish that mentions tỏi, and names that look like a dish
 * already in the Danh mục món (hidden ones included: they still own their name) or another Món chờ duyệt.
 */
export function pendingWarnings(
  draft: Pick<DishDraft, "name" | "chay" | "ingredients" | "steps"> & Partial<Pick<DishDraft, "mealType" | "category">> & { sourceKind?: PendingSourceKind },
  catalog: readonly Pick<Dish, "id" | "name" | "retired">[],
  pending: readonly { id: string; name: string }[],
  selfId?: string,
): PendingWarning[] {
  const warnings: PendingWarning[] = [];
  if (draft.sourceKind === "menu") warnings.push({ code: "ai-written" });
  if (draft.sourceKind === "file") {
    if (draft.mealType === "buacom" && !draft.category) warnings.push({ code: "missing", field: "category" });
    if (draft.ingredients.length === 0) warnings.push({ code: "missing", field: "ingredients" });
    if (draft.steps.length === 0) warnings.push({ code: "missing", field: "steps" });
  }
  if (draft.chay && [draft.name, ...draft.ingredients, ...draft.steps].some(mentionsToi)) {
    warnings.push({ code: "chay-toi" });
  }
  for (const other of catalog) {
    if (similarNames(draft.name, other.name)) {
      warnings.push({ code: "possible-duplicate", of: "dish", id: other.id, name: other.name, hidden: other.retired === true });
    }
  }
  for (const other of pending) {
    if (other.id !== selfId && similarNames(draft.name, other.name)) {
      warnings.push({ code: "possible-duplicate", of: "pending", id: other.id, name: other.name, hidden: false });
    }
  }
  return warnings;
}

const words = (name: string) => foldText(name).split(/\s+/).filter(Boolean);

/**
 * Whether two dish names probably mean the same dish: equal once case, accents and spaces are ignored;
 * a near miss (a typo); or one name is the other plus extra words ("Phở bò" / "Phở bò Hà Nội").
 * A single shared word ("Canh") is not enough.
 */
export function similarNames(a: string, b: string): boolean {
  const left = words(a);
  const right = words(b);
  if (left.length === 0 || right.length === 0) return false;
  const x = left.join(" ");
  const y = right.join(" ");
  if (x === y) return true;
  const longest = Math.max(x.length, y.length);
  if (longest >= 6 && 1 - editDistance(x, y) / longest >= 0.85) return true;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  if (short.length < 2 || short.length === long.length) return false;
  for (let start = 0; start + short.length <= long.length; start++) {
    if (short.every((word, i) => long[start + i] === word)) return true;
  }
  return false;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}
