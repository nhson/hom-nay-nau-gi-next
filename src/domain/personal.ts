import { EMPTY_USER_CATALOG } from "./catalog";
import type {
  Category,
  Dish,
  Favorite,
  HistoryEntry,
  MealType,
  Menu,
  Region,
  UserCatalogState,
} from "./types";

/** Everything that lives on the device (nothing personal is ever sent to a server). */
export interface PersonalState {
  schemaVersion: number;
  user: UserCatalogState;
  history: HistoryEntry[];
  favorites: Favorite[];
  todayMenu: Menu | null;
  /** Shopping ticks keyed by normalized ingredient name. */
  ticks: Record<string, boolean>;
  chayFilter: boolean;
}

export const PERSONAL_SCHEMA_VERSION = 1;

export const EMPTY_PERSONAL_STATE: PersonalState = {
  schemaVersion: PERSONAL_SCHEMA_VERSION,
  user: EMPTY_USER_CATALOG,
  history: [],
  favorites: [],
  todayMenu: null,
  ticks: {},
  chayFilter: false,
};

type Raw = Record<string, unknown>;

/**
 * Ordered migrations: entry `i` upgrades a stored record from version `i` to `i + 1`. Version 0
 * is anything stored before versioning existed. Append new steps; never edit old ones.
 */
const MIGRATIONS: ReadonlyArray<(raw: Raw) => Raw> = [(raw) => raw];

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const MEAL_TYPES: readonly string[] = ["buacom", "buatomonuoc"] satisfies MealType[];
const CATEGORIES: readonly string[] = ["xao", "canh", "man"] satisfies Category[];
const REGIONS: readonly string[] = ["bac", "trung", "nam"] satisfies Region[];

function isMealType(value: unknown): value is MealType {
  return isString(value) && MEAL_TYPES.includes(value);
}

function isDish(value: unknown): value is Dish {
  if (!isRecord(value)) return false;
  const categoryOk =
    value.mealType === "buacom"
      ? isString(value.category) && CATEGORIES.includes(value.category)
      : value.category === null;
  return (
    isString(value.id) &&
    value.id !== "" &&
    isMealType(value.mealType) &&
    categoryOk &&
    typeof value.chay === "boolean" &&
    (value.region === null || (isString(value.region) && REGIONS.includes(value.region))) &&
    isString(value.name) &&
    (value.time === null || typeof value.time === "number") &&
    isStringArray(value.ingredients) &&
    isStringArray(value.steps)
  );
}

function parseMenu(value: unknown): Menu | null {
  if (!isRecord(value) || !isStringArray(value.dishIds) || !isString(value.date)) return null;
  return {
    dishIds: value.dishIds,
    date: value.date,
    mealType: isMealType(value.mealType) ? value.mealType : "buacom",
  };
}

function parseHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): HistoryEntry[] => {
    const menu = parseMenu(entry);
    return menu ? [{ date: menu.date, dishIds: menu.dishIds, mealType: menu.mealType }] : [];
  });
}

function parseFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Favorite[] => {
    if (!isRecord(entry) || !isString(entry.id) || !isString(entry.name) || !isStringArray(entry.dishIds)) {
      return [];
    }
    return [
      {
        id: entry.id,
        name: entry.name,
        dishIds: entry.dishIds,
        savedAt: typeof entry.savedAt === "number" ? entry.savedAt : 0,
        ...(isMealType(entry.mealType) ? { mealType: entry.mealType } : {}),
      },
    ];
  });
}

function parseUser(value: unknown): UserCatalogState {
  if (!isRecord(value)) return EMPTY_USER_CATALOG;
  const overrides: Record<string, Dish> = {};
  if (isRecord(value.overrides)) {
    for (const [id, dish] of Object.entries(value.overrides)) {
      if (isDish(dish)) overrides[id] = { ...dish, id };
    }
  }
  return {
    customDishes: Array.isArray(value.customDishes) ? value.customDishes.filter(isDish) : [],
    overrides,
    hiddenIds: isStringArray(value.hiddenIds) ? value.hiddenIds : [],
  };
}

function parseTicks(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const ticks: Record<string, boolean> = {};
  for (const [key, ticked] of Object.entries(value)) {
    if (ticked === true) ticks[key] = true;
  }
  return ticks;
}

/**
 * Turns whatever was stored (missing, older, partly corrupt) into a valid current-version state.
 * Anything unusable is dropped or defaulted rather than thrown, so a bad store can never crash
 * the app.
 */
export function normalizePersonalState(stored: unknown): PersonalState {
  if (!isRecord(stored)) return EMPTY_PERSONAL_STATE;
  let raw: Raw = stored;
  const storedVersion = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  for (let version = Math.max(0, storedVersion); version < PERSONAL_SCHEMA_VERSION; version++) {
    raw = MIGRATIONS[version](raw);
  }
  return {
    schemaVersion: PERSONAL_SCHEMA_VERSION,
    user: parseUser(raw.user),
    history: parseHistory(raw.history),
    favorites: parseFavorites(raw.favorites),
    todayMenu: parseMenu(raw.todayMenu),
    ticks: parseTicks(raw.ticks),
    chayFilter: raw.chayFilter === true,
  };
}
