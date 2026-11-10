import { sameDishName } from "./collector";
import { mentionsToi, normalizeDraft, type DishDraft } from "./dish-rules";
import { DISH_NAME_MAX } from "./menu-photo";
import { linesFrom, minutesFrom, similarNames } from "./pending-dish";
import { foldText } from "./selectors";
import type { Category, Dish, MealType, Region } from "./types";

/** Nhập từ file limits (spec #41): one file holds at most this many dishes and this many bytes. */
export const DISH_FILE_MAX_DISHES = 200;
export const DISH_FILE_MAX_BYTES = 1_000_000;

export type DishFileRefusal = "not_json" | "no_dishes" | "too_many";

/** A field of a dish in the file, as the file names it. */
export type DishFileField = "mealType" | "category" | "chay" | "region" | "time" | "ingredients" | "steps";

/** Something the Quản trị viên should know about one dish of the file; the UI words it. */
export type DishFileWarning =
  | { code: "missing"; field: DishFileField }
  | { code: "unrecognised"; field: DishFileField }
  | { code: "name-cut" }
  /** A chay dish that mentions tỏi: Duyệt will refuse it until it is fixed. */
  | { code: "chay-toi" }
  /** Looks like a dish already known or earlier in the file; added anyway, the Quản trị viên decides. */
  | { code: "possible-duplicate"; name: string };

export interface DishFileRow {
  /** The dish's position in the file, from 1. */
  row: number;
  draft: DishDraft;
  warnings: DishFileWarning[];
}

export interface DishFileSkip {
  row: number;
  name?: string;
  reason: "no_name" | "duplicate" | "repeated_in_file";
}

export type DishFileReading =
  | { ok: true; add: DishFileRow[]; skipped: DishFileSkip[] }
  | { ok: false; refusal: DishFileRefusal };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const absent = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/** Folded and without spaces, so "Bữa cơm 3 món", "bua com 3 mon" and "buacom3mon" are one key. */
const key = (text: string) => foldText(text).replace(/\s+/g, "");

const MEAL_TYPE_WORDS: Record<string, MealType> = {
  buacom: "buacom",
  buacom3mon: "buacom",
  com: "buacom",
  com3mon: "buacom",
  buatomonuoc: "buatomonuoc",
  bua1mon: "buatomonuoc",
  "1mon": "buatomonuoc",
  tomonuoc: "buatomonuoc",
  monnuoc: "buatomonuoc",
};
const CATEGORY_WORDS: Record<string, Category> = {
  xao: "xao",
  monxao: "xao",
  canh: "canh",
  moncanh: "canh",
  man: "man",
  monman: "man",
};
const REGION_WORDS: Record<string, Region> = {
  bac: "bac",
  mienbac: "bac",
  trung: "trung",
  mientrung: "trung",
  nam: "nam",
  miennam: "nam",
};
const CHAY_WORDS: Record<string, boolean> = {
  co: true,
  c: true,
  yes: true,
  y: true,
  true: true,
  chay: true,
  monchay: true,
  x: true,
  "1": true,
  khong: false,
  k: false,
  no: false,
  n: false,
  false: false,
  "0": false,
};

/** A code or Vietnamese words for one of `words`: the value, null when absent, or undefined when not recognised. */
function wordOf<T>(words: Record<string, T>, value: unknown): T | null | undefined {
  if (absent(value)) return null;
  if (typeof value === "boolean" || typeof value === "number") return words[String(value)];
  return typeof value === "string" ? words[key(value)] : undefined;
}

/** A list of text lines from a list or one text; undefined when the value is neither. */
function linesOf(value: unknown): string[] | undefined {
  if (absent(value)) return [];
  if (typeof value === "string") return linesFrom(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) return linesFrom(value);
  return undefined;
}

/** One dish of the file as a draft and its warnings; null when it has no name. */
function readRow(value: unknown): { draft: DishDraft; warnings: DishFileWarning[] } | null {
  if (!isRecord(value)) return null;
  const rawName = typeof value.name === "string" || typeof value.name === "number" ? String(value.name).trim() : "";
  if (rawName === "") return null;

  const warnings: DishFileWarning[] = [];
  const note = (field: DishFileField, found: unknown, raw: unknown, required: boolean) => {
    if (found === undefined) warnings.push({ code: "unrecognised", field });
    else if (required && absent(raw)) warnings.push({ code: "missing", field });
  };

  const name = rawName.length > DISH_NAME_MAX ? rawName.slice(0, DISH_NAME_MAX).trimEnd() : rawName;

  const mealType = wordOf(MEAL_TYPE_WORDS, value.mealType);
  note("mealType", mealType, value.mealType, true);
  const meal = mealType ?? "buacom";

  const category = meal === "buatomonuoc" ? null : wordOf(CATEGORY_WORDS, value.category);
  note("category", category, value.category, meal === "buacom");

  const chay = wordOf(CHAY_WORDS, value.chay);
  note("chay", chay, value.chay, false);

  const region = wordOf(REGION_WORDS, value.region);
  note("region", region, value.region, false);

  const time = absent(value.time) ? null : (minutesFrom(value.time) ?? undefined);
  note("time", time, value.time, false);

  const ingredients = linesOf(value.ingredients);
  note("ingredients", ingredients, value.ingredients, true);
  const steps = linesOf(value.steps);
  note("steps", steps, value.steps, true);

  const draft = normalizeDraft({
    name,
    mealType: meal,
    category: category ?? null,
    chay: chay ?? false,
    region: region ?? null,
    time: time ?? null,
    ingredients: ingredients ?? [],
    steps: steps ?? [],
  });
  // A list given but with only blank lines is as good as missing.
  for (const field of ["ingredients", "steps"] as const) {
    const listed = field === "ingredients" ? ingredients : steps;
    if (listed && draft[field].length === 0 && !absent(value[field])) warnings.push({ code: "missing", field });
  }
  if (draft.chay && [draft.name, ...draft.ingredients, ...draft.steps].some(mentionsToi)) warnings.push({ code: "chay-toi" });
  if (name !== rawName) warnings.unshift({ code: "name-cut" });
  return { draft, warnings };
}

/**
 * A Nhập từ file: the file's text as the Món chờ duyệt it proposes. `knownNames` are the Danh mục món
 * (hidden dishes included) and the Món chờ duyệt. Runs in the browser for the preview and again on the
 * server for the save. The file never changes an existing dish: ids and other extra fields are ignored.
 */
export function readDishFile(text: string, knownNames: readonly string[]): DishFileReading {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, refusal: "not_json" };
  }
  const rows = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.dishes) ? data.dishes : null;
  if (!rows || rows.length === 0) return { ok: false, refusal: "no_dishes" };
  if (rows.length > DISH_FILE_MAX_DISHES) return { ok: false, refusal: "too_many" };

  const add: DishFileRow[] = [];
  const skipped: DishFileSkip[] = [];
  rows.forEach((value: unknown, index) => {
    const row = index + 1;
    const read = readRow(value);
    if (!read) return skipped.push({ row, reason: "no_name" });
    const { name } = read.draft;
    if (knownNames.some((known) => sameDishName(name, known))) return skipped.push({ row, name, reason: "duplicate" });
    const earlier = add.map((item) => item.draft.name);
    if (earlier.some((known) => sameDishName(name, known))) return skipped.push({ row, name, reason: "repeated_in_file" });
    for (const like of [...knownNames, ...earlier].filter((known) => similarNames(name, known))) {
      read.warnings.push({ code: "possible-duplicate", name: like });
    }
    add.push({ row, ...read });
  });
  return { ok: true, add, skipped };
}

/** "Tải file mẫu": a Nhập từ file with one Bữa cơm 3 món and one Bữa 1 món, in the Xuất JSON shape. */
export function dishFileTemplate(): string {
  const dishes = [
    {
      name: "Canh chua cá lóc",
      mealType: "buacom",
      category: "canh",
      chay: false,
      region: "nam",
      time: 30,
      ingredients: ["Cá lóc 400g", "Cà chua 2 quả", "Dứa 1/4 quả", "Me chua 1 thìa", "Giá, đậu bắp, rau ngổ"],
      steps: ["Sơ chế cá, cắt khúc, ướp chút muối.", "Nấu nước me, cho cà chua và dứa vào.", "Thả cá, nêm nếm, cho rau và tắt bếp."],
    },
    {
      name: "Phở bò",
      mealType: "buatomonuoc",
      category: null,
      chay: false,
      region: "bac",
      time: 180,
      ingredients: ["Bánh phở 500g", "Thịt bò 300g", "Xương bò 1kg", "Hành, gừng, quế, hồi"],
      steps: ["Hầm xương với hành gừng nướng và gia vị.", "Trụng bánh phở, xếp thịt bò.", "Chan nước dùng nóng, thêm hành và rau thơm."],
    },
  ];
  return `${JSON.stringify({ dishes }, null, 2)}\n`;
}

/** The numbers on Tổng quan: shown and hidden dishes, and the shown ones per Nhóm món and for Bữa 1 món. */
export interface CatalogCounts {
  shown: number;
  hidden: number;
  xao: number;
  canh: number;
  man: number;
  buatomonuoc: number;
}

export function catalogCounts(dishes: readonly Pick<Dish, "mealType" | "category" | "retired">[]): CatalogCounts {
  const counts: CatalogCounts = { shown: 0, hidden: 0, xao: 0, canh: 0, man: 0, buatomonuoc: 0 };
  for (const item of dishes) {
    if (item.retired) {
      counts.hidden++;
      continue;
    }
    counts.shown++;
    if (item.mealType === "buatomonuoc") counts.buatomonuoc++;
    else if (item.category) counts[item.category]++;
  }
  return counts;
}
