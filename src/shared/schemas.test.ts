import { describe, expect, it } from "vitest";
import type { Dish } from "@/domain";
import { dish } from "@/domain/testing";
import { apiErrorSchema, catalogResponseSchema, dishSchema, healthResponseSchema } from "./schemas";

// Compile-time guarantee that what the API validates is assignable to the domain's Dish.
const _typesAgree = (parsed: ReturnType<typeof dishSchema.parse>): Dish => parsed;
void _typesAgree;

describe("dishSchema", () => {
  it("accepts a valid dish and defaults retired to false", () => {
    const parsed = dishSchema.parse(dish());
    expect(parsed.retired).toBe(false);
  });

  it("enforces the Nhóm món rule in both directions", () => {
    expect(dishSchema.safeParse(dish({ mealType: "buacom", category: null })).success).toBe(false);
    expect(dishSchema.safeParse(dish({ mealType: "buatomonuoc", category: "xao" })).success).toBe(false);
    expect(dishSchema.safeParse(dish({ mealType: "buatomonuoc", category: null })).success).toBe(true);
  });

  it("rejects empty ingredients, blank names, bad regions and non-positive times", () => {
    expect(dishSchema.safeParse(dish({ ingredients: [] })).success).toBe(false);
    expect(dishSchema.safeParse(dish({ name: "" })).success).toBe(false);
    expect(dishSchema.safeParse({ ...dish(), region: "mars" }).success).toBe(false);
    expect(dishSchema.safeParse(dish({ time: 0 })).success).toBe(false);
  });
});

describe("response schemas", () => {
  it("catalog response needs a non-negative integer version and valid dishes", () => {
    expect(catalogResponseSchema.safeParse({ version: 1, dishes: [dish()] }).success).toBe(true);
    expect(catalogResponseSchema.safeParse({ version: -1, dishes: [] }).success).toBe(false);
    expect(catalogResponseSchema.safeParse({ version: 1.5, dishes: [] }).success).toBe(false);
    expect(catalogResponseSchema.safeParse({ version: 1, dishes: [dish({ ingredients: [] })] }).success).toBe(false);
  });

  it("error envelope only allows known codes", () => {
    expect(apiErrorSchema.safeParse({ error: { code: "internal_error", message: "x" } }).success).toBe(true);
    expect(apiErrorSchema.safeParse({ error: { code: "nope", message: "x" } }).success).toBe(false);
  });

  it("health response", () => {
    expect(healthResponseSchema.safeParse({ status: "ok", database: "up" }).success).toBe(true);
    expect(healthResponseSchema.safeParse({ status: "ok" }).success).toBe(false);
  });
});
