import { describe, expect, it } from "vitest";
import { generateBuaComMenu, localDateString } from "@/domain";
import { dishSchema } from "@/shared/schemas";
import { SEED_DISHES } from "./dishes";

const count = (predicate: (dish: (typeof SEED_DISHES)[number]) => boolean) =>
  SEED_DISHES.filter(predicate).length;

describe("seed catalog integrity", () => {
  it("has the 73 dishes of the legacy app, split by group", () => {
    expect(SEED_DISHES).toHaveLength(73);
    expect(count((d) => d.category === "xao")).toBe(20);
    expect(count((d) => d.category === "canh")).toBe(23);
    expect(count((d) => d.category === "man")).toBe(21);
    expect(count((d) => d.mealType === "buatomonuoc")).toBe(9);
    expect(count((d) => d.chay)).toBe(27);
  });

  it("has unique ids and unique names", () => {
    expect(new Set(SEED_DISHES.map((d) => d.id)).size).toBe(SEED_DISHES.length);
    expect(new Set(SEED_DISHES.map((d) => d.name)).size).toBe(SEED_DISHES.length);
  });

  it("keeps the legacy id scheme: x/c/m for Nhóm món, t for Bữa 1 món", () => {
    const prefix = { xao: "x", canh: "c", man: "m" } as const;
    for (const dish of SEED_DISHES) {
      const expected = dish.mealType === "buatomonuoc" ? "t" : prefix[dish.category!];
      expect(dish.id).toMatch(new RegExp(`^${expected}\\d+$`));
    }
  });

  it("every dish satisfies the shared API schema (category rule, regions, non-empty fields)", () => {
    for (const dish of SEED_DISHES) {
      const parsed = dishSchema.safeParse(dish);
      expect(parsed.success, `${dish.id} ${dish.name}`).toBe(true);
    }
  });

  it("every dish has at least one ingredient and one step", () => {
    for (const dish of SEED_DISHES) {
      expect(dish.ingredients.length, dish.id).toBeGreaterThan(0);
      expect(dish.steps.length, dish.id).toBeGreaterThan(0);
    }
  });

  it("no Chay dish uses tỏi anywhere (hành boa-rô is the substitute)", () => {
    for (const dish of SEED_DISHES.filter((d) => d.chay)) {
      const text = [dish.name, ...dish.ingredients, ...dish.steps].join("\n").normalize("NFC").toLowerCase();
      expect(text, `${dish.id} ${dish.name}`).not.toContain("tỏi");
    }
  });

  it("offers enough Chay choices in every Nhóm món and in Bữa 1 món", () => {
    for (const category of ["xao", "canh", "man"] as const) {
      expect(count((d) => d.chay && d.category === category), category).toBeGreaterThanOrEqual(3);
    }
    expect(count((d) => d.chay && d.mealType === "buatomonuoc")).toBeGreaterThanOrEqual(1);
  });

  it("can always build a complete Chay menu from the seed", () => {
    const today = localDateString(new Date(2026, 9, 13));
    const { menu, missing } = generateBuaComMenu(SEED_DISHES, [], today, { chay: true });
    expect(missing).toEqual([]);
    expect(menu.dishIds).toHaveLength(3);
  });
});
