import type { Dish, Rng } from "./types";

/** Test fixture factory. Defaults to a plain Xào dish. */
export function dish(overrides: Partial<Dish> = {}): Dish {
  return {
    id: "d1",
    mealType: "buacom",
    category: "xao",
    chay: false,
    region: null,
    name: "Món test",
    time: 10,
    ingredients: ["a"],
    steps: ["bước 1"],
    ...overrides,
  };
}

/** A Bữa 1 món fixture (no category). */
export function bowl(overrides: Partial<Dish> = {}): Dish {
  return dish({ id: "t1", mealType: "buatomonuoc", category: null, name: "Phở", ...overrides });
}

/** Deterministic RNG that cycles through the given values. */
export function sequenceRng(...values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

export const firstPick: Rng = () => 0;
export const lastPick: Rng = () => 0.999999;
