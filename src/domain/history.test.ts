import { describe, expect, it } from "vitest";
import {
  HISTORY_CAP,
  isMenuCooked,
  latestHistory,
  MISSING_DISH_NAME,
  recordCooked,
  resolveDishNames,
} from "./history";
import { dish } from "./testing";
import type { HistoryEntry, Menu } from "./types";

const menu = (date: string, ...dishIds: string[]): Menu => ({ dishIds, date, mealType: "buacom" });

describe("recordCooked", () => {
  it("adds a new day at the front", () => {
    const history = recordCooked([{ date: "2026-10-12", dishIds: ["a"], mealType: "buacom" }], menu("2026-10-13", "b"));
    expect(history.map((e) => e.date)).toEqual(["2026-10-13", "2026-10-12"]);
  });

  it("replaces the same day's entry in place instead of adding a second one", () => {
    const start: HistoryEntry[] = [
      { date: "2026-10-13", dishIds: ["a"], mealType: "buacom" },
      { date: "2026-10-12", dishIds: ["b"], mealType: "buacom" },
    ];
    const history = recordCooked(start, menu("2026-10-13", "c", "d"));
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ date: "2026-10-13", dishIds: ["c", "d"], mealType: "buacom" });
  });

  it("keeps the meal type so Bữa 1 món days stay distinguishable", () => {
    const history = recordCooked([], { dishIds: ["t1"], date: "2026-10-13", mealType: "buatomonuoc" });
    expect(history[0].mealType).toBe("buatomonuoc");
  });

  it(`caps history at ${HISTORY_CAP} entries, dropping the oldest`, () => {
    const full: HistoryEntry[] = Array.from({ length: HISTORY_CAP }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      dishIds: [`old${i}`],
      mealType: "buacom",
    }));
    const next = recordCooked(full, menu("2026-10-13", "new"));
    expect(next).toHaveLength(HISTORY_CAP);
    expect(next[0].dishIds).toEqual(["new"]);
    expect(next.at(-1)?.dishIds).toEqual([`old${HISTORY_CAP - 2}`]);
  });

  it("does not mutate its input", () => {
    const start: HistoryEntry[] = [];
    const ids = ["a"];
    recordCooked(start, { dishIds: ids, date: "2026-10-13", mealType: "buacom" });
    expect(start).toEqual([]);
    expect(ids).toEqual(["a"]);
  });
});

describe("latestHistory", () => {
  it("returns the first 7 entries by default", () => {
    const history: HistoryEntry[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      dishIds: [],
      mealType: "buacom",
    }));
    expect(latestHistory(history)).toHaveLength(7);
    expect(latestHistory(history, 3)).toHaveLength(3);
  });
});

describe("isMenuCooked", () => {
  const history: HistoryEntry[] = [{ date: "2026-10-13", dishIds: ["a", "b", "c"], mealType: "buacom" }];

  it("is true when today's entry holds the same dishes in any order", () => {
    expect(isMenuCooked(history, menu("2026-10-13", "c", "a", "b"), "2026-10-13")).toBe(true);
  });

  it("is false for a different dish set, a different meal type, no menu or no entry today", () => {
    expect(isMenuCooked(history, menu("2026-10-13", "a", "b", "x"), "2026-10-13")).toBe(false);
    expect(isMenuCooked(history, { dishIds: ["a", "b", "c"], date: "2026-10-13", mealType: "buatomonuoc" }, "2026-10-13")).toBe(false);
    expect(isMenuCooked(history, null, "2026-10-13")).toBe(false);
    expect(isMenuCooked(history, menu("2026-10-14", "a", "b", "c"), "2026-10-14")).toBe(false);
  });
});

describe("resolveDishNames", () => {
  it("shows (đã xoá) for dishes that no longer resolve", () => {
    const names = resolveDishNames(["a", "gone"], [dish({ id: "a", name: "Canh chua" })]);
    expect(names).toEqual(["Canh chua", MISSING_DISH_NAME]);
    expect(MISSING_DISH_NAME).toBe("(đã xoá)");
  });
});
