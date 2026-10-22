// Enum values and field names are kept identical to the legacy app so a future importer
// (deferred N5) needs no data transformation beyond renames.

export type MealType = "buacom" | "buatomonuoc"; // Bữa cơm 3 món | Bữa 1 món
export type Category = "xao" | "canh" | "man"; // Nhóm món
export type Region = "bac" | "trung" | "nam";

export interface Dish {
  id: string;
  mealType: MealType;
  /** Required for `buacom`, always null for `buatomonuoc`. */
  category: Category | null;
  chay: boolean;
  region: Region | null;
  name: string;
  /** Cooking time in minutes. */
  time: number | null;
  ingredients: string[];
  steps: string[];
  /** Set by the server catalog. Retired dishes are never picked but still resolve by id. */
  retired?: boolean;
}

export interface Menu {
  dishIds: string[];
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  mealType: MealType;
}

export interface HistoryEntry {
  date: string;
  dishIds: string[];
  mealType: MealType;
}

export interface Favorite {
  id: string;
  name: string;
  dishIds: string[];
  /** Absent on favorites created by the legacy app; inferred from the dishes when missing. */
  mealType?: MealType;
  savedAt: number;
}

/** Returns a number in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;
