import { describe, expect, it } from "vitest";
import { dishToFormInput, normalizeDishForm, type DishFormInput } from "./form";
import { dish } from "./testing";

const valid: DishFormInput = {
  name: "  Canh chua cá lóc ",
  mealType: "buacom",
  category: "canh",
  time: "30",
  region: "nam",
  chay: false,
  ingredients: "cá lóc, me ,, cà chua",
  steps: "Làm sạch cá\r\n\nNấu canh\n",
};

describe("normalizeDishForm", () => {
  it("trims the name and splits ingredients on commas and steps on lines", () => {
    const result = normalizeDishForm(valid);
    expect(result).toEqual({
      ok: true,
      dish: {
        name: "Canh chua cá lóc",
        mealType: "buacom",
        category: "canh",
        chay: false,
        region: "nam",
        time: 30,
        ingredients: ["cá lóc", "me", "cà chua"],
        steps: ["Làm sạch cá", "Nấu canh"],
      },
    });
  });

  it("forces category to null for Bữa 1 món, whatever was left in the form", () => {
    const result = normalizeDishForm({ ...valid, mealType: "buatomonuoc", category: "canh" });
    expect(result.ok && result.dish.category).toBeNull();
  });

  it("requires a name", () => {
    expect(normalizeDishForm({ ...valid, name: "   " })).toEqual({ ok: false, errors: { name: "required" } });
  });

  it("requires a category for Bữa cơm 3 món but not for Bữa 1 món", () => {
    expect(normalizeDishForm({ ...valid, category: "" })).toEqual({ ok: false, errors: { category: "required" } });
    expect(normalizeDishForm({ ...valid, mealType: "buatomonuoc", category: "" }).ok).toBe(true);
  });

  it("accepts an empty time as null and rejects non-positive or non-integer times", () => {
    const empty = normalizeDishForm({ ...valid, time: "  " });
    expect(empty.ok && empty.dish.time).toBeNull();
    for (const time of ["0", "-5", "abc", "1.5"]) {
      expect(normalizeDishForm({ ...valid, time })).toEqual({ ok: false, errors: { time: "invalid" } });
    }
  });

  it("maps an empty region to null and reports every error at once", () => {
    const ok = normalizeDishForm({ ...valid, region: "" });
    expect(ok.ok && ok.dish.region).toBeNull();
    expect(normalizeDishForm({ ...valid, name: "", category: "", time: "x" })).toEqual({
      ok: false,
      errors: { name: "required", category: "required", time: "invalid" },
    });
  });
});

describe("dishToFormInput", () => {
  it("round-trips through the form", () => {
    const original = dish({
      name: "Canh chua",
      category: "canh",
      region: "nam",
      time: 25,
      ingredients: ["cá", "me"],
      steps: ["a", "b"],
    });
    const result = normalizeDishForm(dishToFormInput(original));
    const { id: _id, retired: _retired, ...expected } = original;
    void _id;
    void _retired;
    expect(result).toEqual({ ok: true, dish: expected });
  });
});
