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
      history: [{ date: "2026-10-13", dishIds: ["x1"], mealType: "buacom" as const }],
      favorites: [{ id: "f1", name: "Tối nay", dishIds: ["x1"], mealType: "buacom" as const, savedAt: 5 }],
      todayMenu: { date: "2026-10-14", dishIds: ["x1"], mealType: "buacom" as const },
      ticks: { hành: true },
      chayFilter: true,
      installHintDismissed: true,
    };
    expect(normalizePersonalState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("loads a state saved before the install hint existed as not dismissed", () => {
    const legacy = { schemaVersion: 1, history: [], favorites: [], todayMenu: null, ticks: {}, chayFilter: true };
    expect(normalizePersonalState(legacy).installHintDismissed).toBe(false);
  });

  it.each(["yes", 1, null, {}])("ignores a bad install hint value %j", (value) => {
    expect(normalizePersonalState({ installHintDismissed: value }).installHintDismissed).toBe(false);
  });

  it("treats a record with no schemaVersion as version 0 and stamps the current version", () => {
    const result = normalizePersonalState({ chayFilter: true });
    expect(result.schemaVersion).toBe(PERSONAL_SCHEMA_VERSION);
    expect(result.chayFilter).toBe(true);
  });

  it("drops malformed entries instead of throwing", () => {
    const result = normalizePersonalState({
      history: [{ date: "2026-10-13", dishIds: ["a"] }, { date: 5 }, "nope"],
      favorites: [{ id: "f", name: "n", dishIds: ["a"] }, { id: "g" }],
      todayMenu: { date: 3 },
      ticks: { a: true, b: false, c: "yes" },
    });
    expect(result.history).toEqual([{ date: "2026-10-13", dishIds: ["a"], mealType: "buacom" }]);
    expect(result.favorites).toEqual([{ id: "f", name: "n", dishIds: ["a"], savedAt: 0 }]);
    expect(result.todayMenu).toBeNull();
    expect(result.ticks).toEqual({ a: true });
  });
});

describe("old per-device dish data (custom, edited, hidden dishes)", () => {
  const legacy = {
    customDishes: [dish({ id: "custom:1", name: "Món nhà làm" })],
    overrides: { x1: dish({ id: "x1", name: "Bản sửa" }) },
    hiddenIds: ["x2"],
  };

  it("is carried through untouched, so the next save writes it back and it is not erased", () => {
    const once = normalizePersonalState({ chayFilter: true, user: legacy });
    expect(once.user).toEqual(legacy);
    // Persist and reload twice: still identical.
    const twice = normalizePersonalState(JSON.parse(JSON.stringify(once)));
    expect(twice.user).toEqual(legacy);
  });

  it("is carried even when it is malformed: it is never interpreted", () => {
    expect(normalizePersonalState({ user: "garbage" }).user).toBe("garbage");
    expect(normalizePersonalState({ user: { customDishes: [{ id: "broken" }] } }).user).toEqual({
      customDishes: [{ id: "broken" }],
    });
  });

  it("is absent when nothing was stored, and does not affect any other field", () => {
    expect(normalizePersonalState({}).user).toBeUndefined();
    const withLegacy = normalizePersonalState({ chayFilter: true, ticks: { a: true }, user: legacy });
    expect(withLegacy.chayFilter).toBe(true);
    expect(withLegacy.ticks).toEqual({ a: true });
  });
});
