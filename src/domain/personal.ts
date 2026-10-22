import type { Favorite, HistoryEntry, MealType, Menu } from "./types";

/** Everything that lives on the device (nothing personal is ever sent to a server). */
export interface PersonalState {
  schemaVersion: number;
  /**
   * Dishes people once added, edited or hid on this device (the old "user catalog"). Devices no longer
   * read it (ADR-0003: the catalog is read-only), but it is carried through opaquely and written back
   * unchanged so the data is not erased and could be re-enabled. The key name is kept for that reason.
   */
  user?: unknown;
  history: HistoryEntry[];
  favorites: Favorite[];
  todayMenu: Menu | null;
  /** Shopping ticks keyed by normalized ingredient name. */
  ticks: Record<string, boolean>;
  chayFilter: boolean;
  /** The person closed the "install on your Home Screen" hint on this device (iPhone/iPad only). */
  installHintDismissed: boolean;
}

export const PERSONAL_SCHEMA_VERSION = 1;

export const EMPTY_PERSONAL_STATE: PersonalState = {
  schemaVersion: PERSONAL_SCHEMA_VERSION,
  history: [],
  favorites: [],
  todayMenu: null,
  ticks: {},
  chayFilter: false,
  installHintDismissed: false,
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

function isMealType(value: unknown): value is MealType {
  return isString(value) && MEAL_TYPES.includes(value);
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
    ...(raw.user !== undefined ? { user: raw.user } : {}),
    history: parseHistory(raw.history),
    favorites: parseFavorites(raw.favorites),
    todayMenu: parseMenu(raw.todayMenu),
    ticks: parseTicks(raw.ticks),
    chayFilter: raw.chayFilter === true,
    installHintDismissed: raw.installHintDismissed === true,
  };
}
