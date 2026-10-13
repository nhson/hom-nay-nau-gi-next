import type { Category, Dish, MealType, Region } from "./types";

/** Raw values as typed into the dish form. */
export interface DishFormInput {
  name: string;
  mealType: MealType;
  category: Category | "";
  /** Minutes, as typed. */
  time: string;
  region: Region | "";
  chay: boolean;
  /** Comma-separated. */
  ingredients: string;
  /** One step per line. */
  steps: string;
}

export type DishFormErrors = {
  name?: "required";
  category?: "required";
  time?: "invalid";
};

export type DishFormResult =
  | { ok: true; dish: Omit<Dish, "id"> }
  | { ok: false; errors: DishFormErrors };

export function normalizeDishForm(input: DishFormInput): DishFormResult {
  const errors: DishFormErrors = {};
  const name = input.name.trim();
  if (name === "") errors.name = "required";
  if (input.mealType === "buacom" && input.category === "") errors.category = "required";

  const timeText = input.time.trim();
  let time: number | null = null;
  if (timeText !== "") {
    const parsed = Number(timeText);
    if (Number.isInteger(parsed) && parsed >= 1) time = parsed;
    else errors.time = "invalid";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    dish: {
      name,
      mealType: input.mealType,
      category: input.mealType === "buatomonuoc" || input.category === "" ? null : input.category,
      chay: input.chay,
      region: input.region === "" ? null : input.region,
      time,
      ingredients: input.ingredients
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
      steps: input.steps
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    },
  };
}

export function dishToFormInput(dish: Dish): DishFormInput {
  return {
    name: dish.name,
    mealType: dish.mealType,
    category: dish.category ?? "",
    time: dish.time === null ? "" : String(dish.time),
    region: dish.region ?? "",
    chay: dish.chay,
    ingredients: dish.ingredients.join(", "),
    steps: dish.steps.join("\n"),
  };
}
