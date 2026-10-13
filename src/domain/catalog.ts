import type { Dish, UserCatalogState } from "./types";

export const EMPTY_USER_CATALOG: UserCatalogState = {
  customDishes: [],
  overrides: {},
  hiddenIds: [],
};

const CUSTOM_PREFIX = "custom:";

/** Custom ids can never collide with seed ids (x1, c1, m1, t1 ...). */
export function makeCustomDishId(uniquePart: string): string {
  return `${CUSTOM_PREFIX}${uniquePart}`;
}

export function isCustomDishId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX);
}

export interface ResolvedCatalog {
  /** Everything that can be looked up by id: used for history, favorites and today's menu. */
  resolvable: Dish[];
  /** What random may pick and what the dish bank lists: resolvable minus retired dishes. */
  pickable: Dish[];
  /** Catalog dishes the user deleted on this device, for the restore list. */
  hidden: Dish[];
}

/**
 * Effective dish = the user's override if there is one, else the catalog dish. A retired flag always
 * comes from the catalog (the server decides a dish is gone), even for an overridden dish. Hidden
 * dishes no longer resolve; retired ones still do, so old records stay readable.
 */
export function resolveCatalog(
  catalog: readonly Dish[],
  user: UserCatalogState = EMPTY_USER_CATALOG,
): ResolvedCatalog {
  const hiddenIds = new Set(user.hiddenIds);
  const effective = (dish: Dish): Dish => {
    const override = user.overrides[dish.id];
    return override ? { ...override, id: dish.id, retired: dish.retired ?? false } : dish;
  };

  const resolvable: Dish[] = [];
  const hidden: Dish[] = [];
  const seen = new Set<string>();
  for (const dish of catalog) {
    seen.add(dish.id);
    if (hiddenIds.has(dish.id)) {
      if (!dish.retired) hidden.push(effective(dish));
      continue;
    }
    resolvable.push(effective(dish));
  }
  for (const dish of user.customDishes) {
    if (!seen.has(dish.id)) resolvable.push(dish);
  }
  return {
    resolvable,
    pickable: resolvable.filter((dish) => !dish.retired),
    hidden,
  };
}

export function hasOverride(user: UserCatalogState, id: string): boolean {
  return id in user.overrides;
}

export function addCustomDish(user: UserCatalogState, dish: Dish): UserCatalogState {
  return { ...user, customDishes: [...user.customDishes, dish] };
}

/** Saves an edit: a catalog dish becomes an override, a custom dish is replaced in place. */
export function saveDish(
  user: UserCatalogState,
  catalog: readonly Dish[],
  dish: Dish,
): UserCatalogState {
  if (catalog.some((candidate) => candidate.id === dish.id)) {
    return { ...user, overrides: { ...user.overrides, [dish.id]: dish } };
  }
  return {
    ...user,
    customDishes: user.customDishes.map((existing) => (existing.id === dish.id ? dish : existing)),
  };
}

/** Deleting a catalog dish only hides it on this device; a custom dish is removed. */
export function deleteDish(
  user: UserCatalogState,
  catalog: readonly Dish[],
  id: string,
): UserCatalogState {
  if (catalog.some((candidate) => candidate.id === id)) {
    return user.hiddenIds.includes(id) ? user : { ...user, hiddenIds: [...user.hiddenIds, id] };
  }
  return { ...user, customDishes: user.customDishes.filter((dish) => dish.id !== id) };
}

export function restoreDish(user: UserCatalogState, id: string): UserCatalogState {
  return { ...user, hiddenIds: user.hiddenIds.filter((hiddenId) => hiddenId !== id) };
}

/** Drops the user's edit so the catalog version shows again. */
export function resetDish(user: UserCatalogState, id: string): UserCatalogState {
  const overrides = { ...user.overrides };
  delete overrides[id];
  return { ...user, overrides };
}
