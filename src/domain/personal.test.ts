import { describe, expect, it } from "vitest";
import {
  EMPTY_PERSONAL_STATE,
  PERSONAL_SCHEMA_VERSION,
  normalizePersonalState,
} from "./personal";
import { dish } from "./testing";

describe("normalizePersonalState", () => {
  it.each([null, undefined, "x", 42, [], true])("falls back to empty for %j", (stored) => {
    expect(normalizePersonalState(stored)).toEqual(EMPTY_PERSONAL_STATE);
  });

  it("round-trips a valid current-version state", () => {
    const state = {
      ...EMPTY_PERSONAL_STATE,
      user: { customDishes: [dish({ id: "custom:1" })], overrides: { x1: dish({ id: "x1" }) }, hiddenIds: ["x2"] },
      history: [{ date: "2026-10-13", dishIds: ["x1"], mealType: "buacom" as const }],
      favorites: [{ id: "f1", name: "Tối nay", dishIds: ["x1"], mealType: "buacom" as const, savedAt: 5 }],
      todayMenu: { date: "2026-10-14", dishIds: ["x1"], mealType: "buacom" as const },
      ticks: { hành: true },
      chayFilter: true,
    };
    expect(normalizePersonalState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("treats a record with no schemaVersion as version 0 and stamps the current version", () => {
    const result = normalizePersonalState({ chayFilter: true });
    expect(result.schemaVersion).toBe(PERSONAL_SCHEMA_VERSION);
    expect(result.chayFilter).toBe(true);
  });

  it("drops malformed entries instead of throwing", () => {
    const result = normalizePersonalState({
      user: {
        customDishes: [dish({ id: "custom:ok" }), { id: "broken" }, null],
        overrides: { good: dish({ id: "ignored" }), bad: { name: 1 } },
        hiddenIds: ["a", 7],
      },
      history: [{ date: "2026-10-13", dishIds: ["a"] }, { date: 5 }, "nope"],
      favorites: [{ id: "f", name: "n", dishIds: ["a"] }, { id: "g" }],
      todayMenu: { date: 3 },
      ticks: { a: true, b: false, c: "yes" },
    });
    expect(result.user.customDishes.map((d) => d.id)).toEqual(["custom:ok"]);
    expect(Object.keys(result.user.overrides)).toEqual(["good"]);
    expect(result.user.overrides.good.id).toBe("good");
    expect(result.user.hiddenIds).toEqual([]);
    expect(result.history).toEqual([{ date: "2026-10-13", dishIds: ["a"], mealType: "buacom" }]);
    expect(result.favorites).toEqual([{ id: "f", name: "n", dishIds: ["a"], savedAt: 0 }]);
    expect(result.todayMenu).toBeNull();
    expect(result.ticks).toEqual({ a: true });
  });

  it("rejects a dish whose category contradicts its meal type", () => {
    const result = normalizePersonalState({
      user: {
        customDishes: [
          dish({ id: "c1", mealType: "buatomonuoc", category: "xao" }),
          dish({ id: "c2", mealType: "buacom", category: null }),
        ],
      },
    });
    expect(result.user.customDishes).toEqual([]);
  });
});
