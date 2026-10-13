import { describe, expect, it } from "vitest";
import {
  generateBuaComMenu,
  generateMonNuocMenu,
  isMenuStale,
  recentDishIds,
  rerollMonNuoc,
  rerollSlot,
  sortIdsByCategoryOrder,
} from "./menu";
import { bowl, dish, firstPick } from "./testing";
import type { Dish, HistoryEntry, Menu } from "./types";

const TODAY = "2026-10-13";

function entry(date: string, ...dishIds: string[]): HistoryEntry {
  return { date, dishIds, mealType: "buacom" };
}

function lookup(dishes: readonly Dish[]) {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  return (id: string) => byId.get(id);
}

describe("recentDishIds", () => {
  it("includes today and the previous 3 days, excludes older entries", () => {
    const history = [
      entry("2026-10-13", "today"),
      entry("2026-10-10", "three-days-ago"),
      entry("2026-10-09", "four-days-ago"),
    ];
    expect(recentDishIds(history, TODAY).sort()).toEqual(["three-days-ago", "today"]);
  });

  it("deduplicates ids and ignores malformed dates", () => {
    const history = [entry("2026-10-12", "a", "b"), entry("2026-10-11", "a"), entry("bad", "z")];
    expect(recentDishIds(history, TODAY).sort()).toEqual(["a", "b"]);
  });

  it("honours a custom window", () => {
    const history = [entry("2026-10-11", "a")];
    expect(recentDishIds(history, TODAY, 2)).toEqual([]);
    expect(recentDishIds(history, TODAY, 3)).toEqual(["a"]);
  });
});

describe("sortIdsByCategoryOrder", () => {
  const dishes = [
    dish({ id: "x1", category: "xao" }),
    dish({ id: "c1", category: "canh" }),
    dish({ id: "m1", category: "man" }),
  ];

  it("orders Xào -> Canh -> Món mặn regardless of input order", () => {
    expect(sortIdsByCategoryOrder(["m1", "x1", "c1"], lookup(dishes))).toEqual(["x1", "c1", "m1"]);
    expect(sortIdsByCategoryOrder(["c1", "m1", "x1"], lookup(dishes))).toEqual(["x1", "c1", "m1"]);
  });

  it("drops ids that no longer resolve", () => {
    expect(sortIdsByCategoryOrder(["m1", "ghost", "x1"], lookup(dishes))).toEqual(["x1", "m1"]);
  });
});

describe("isMenuStale", () => {
  it("is stale when missing or from another day", () => {
    expect(isMenuStale(null, TODAY)).toBe(true);
    expect(isMenuStale({ dishIds: [], date: "2026-10-12", mealType: "buacom" }, TODAY)).toBe(true);
  });

  it("is fresh when generated today", () => {
    expect(isMenuStale({ dishIds: [], date: TODAY, mealType: "buacom" }, TODAY)).toBe(false);
  });
});

describe("generateBuaComMenu", () => {
  const dishes = [
    dish({ id: "x1", category: "xao" }),
    dish({ id: "x2", category: "xao" }),
    dish({ id: "c1", category: "canh" }),
    dish({ id: "m1", category: "man" }),
  ];

  it("produces one dish per group in fixed order, dated today", () => {
    const { menu, missing } = generateBuaComMenu(dishes, [], TODAY, { rng: firstPick });
    expect(menu).toEqual({ dishIds: ["x1", "c1", "m1"], date: TODAY, mealType: "buacom" });
    expect(missing).toEqual([]);
  });

  it("avoids dishes cooked in the last 4 days", () => {
    const { menu } = generateBuaComMenu(dishes, [entry("2026-10-12", "x1")], TODAY, {
      rng: firstPick,
    });
    expect(menu.dishIds[0]).toBe("x2");
  });

  it("still fills a slot when every dish in the group was cooked recently", () => {
    const history = [entry("2026-10-12", "c1")];
    const { menu } = generateBuaComMenu(dishes, history, TODAY, { rng: firstPick });
    expect(menu.dishIds).toContain("c1");
  });

  it("reports groups without a matching dish under the chay filter", () => {
    const withChay = [...dishes, dish({ id: "c2", category: "canh", chay: true })];
    const { menu, missing } = generateBuaComMenu(withChay, [], TODAY, { chay: true, rng: firstPick });
    expect(menu.dishIds).toEqual(["c2"]);
    expect(missing).toEqual(["xao", "man"]);
  });
});

describe("generateMonNuocMenu", () => {
  it("builds a single-dish Bữa 1 món menu", () => {
    const menu = generateMonNuocMenu([dish(), bowl({ id: "t1" })], [], TODAY, { rng: firstPick });
    expect(menu).toEqual({ dishIds: ["t1"], date: TODAY, mealType: "buatomonuoc" });
  });

  it("applies the chay filter and returns null when nothing matches", () => {
    const dishes = [bowl({ id: "t1", chay: false }), bowl({ id: "t2", chay: true })];
    expect(generateMonNuocMenu(dishes, [], TODAY, { chay: true, rng: firstPick })?.dishIds).toEqual(["t2"]);
    expect(generateMonNuocMenu([bowl({ chay: false })], [], TODAY, { chay: true })).toBeNull();
  });

  it("prefers a dish not cooked recently", () => {
    const dishes = [bowl({ id: "t1" }), bowl({ id: "t2" })];
    const history = [{ date: "2026-10-12", dishIds: ["t1"], mealType: "buatomonuoc" as const }];
    expect(generateMonNuocMenu(dishes, history, TODAY, { rng: firstPick })?.dishIds).toEqual(["t2"]);
  });
});

describe("rerollSlot", () => {
  const dishes = [
    dish({ id: "x1", category: "xao" }),
    dish({ id: "x2", category: "xao" }),
    dish({ id: "c1", category: "canh" }),
    dish({ id: "c2", category: "canh" }),
    dish({ id: "m1", category: "man" }),
    dish({ id: "m2", category: "man" }),
  ];
  const menu: Menu = { dishIds: ["x1", "c1", "m1"], date: TODAY, mealType: "buacom" };

  it.each([
    ["xao", ["x2", "c1", "m1"]],
    ["canh", ["x1", "c2", "m1"]],
    ["man", ["x1", "c1", "m2"]],
  ] as const)("rerolling %s changes only that slot and keeps the order", (category, expected) => {
    const result = rerollSlot(menu, category, dishes, [], { rng: firstPick });
    expect(result).toEqual({ ok: true, menu: { ...menu, dishIds: [...expected] } });
  });

  it("keeps the order after a chain of rerolls on different slots", () => {
    let current = menu;
    for (const category of ["man", "xao", "canh", "man", "xao"] as const) {
      const result = rerollSlot(current, category, dishes, [], { rng: firstPick });
      if (!result.ok) throw new Error("expected a reroll");
      current = result.menu;
      expect(current.dishIds.map((id) => id[0])).toEqual(["x", "c", "m"]);
    }
  });

  it("never returns the dish being replaced, even when the alternative was cooked recently", () => {
    const history = [entry("2026-10-12", "x2")];
    const result = rerollSlot(menu, "xao", dishes, history, { rng: firstPick });
    expect(result).toEqual({ ok: true, menu: { ...menu, dishIds: ["x2", "c1", "m1"] } });
  });

  it("prefers an alternative that was not cooked recently", () => {
    const three = [...dishes, dish({ id: "x3", category: "xao" })];
    const history = [entry("2026-10-12", "x2")];
    const result = rerollSlot(menu, "xao", three, history, { rng: firstPick });
    expect(result).toEqual({ ok: true, menu: { ...menu, dishIds: ["x3", "c1", "m1"] } });
  });

  it("reports no alternative when the group has only the current dish", () => {
    const only = [dish({ id: "x1", category: "xao" }), dish({ id: "c1", category: "canh" }), dish({ id: "m1", category: "man" })];
    expect(rerollSlot(menu, "xao", only, [])).toEqual({ ok: false, reason: "no-alternative" });
  });

  it("stays inside Chay dishes while the filter is on", () => {
    const mixed = [
      dish({ id: "x1", category: "xao", chay: true }),
      dish({ id: "x2", category: "xao", chay: false }),
      dish({ id: "x3", category: "xao", chay: true }),
      dish({ id: "c1", category: "canh", chay: true }),
      dish({ id: "m1", category: "man", chay: true }),
    ];
    const result = rerollSlot(menu, "xao", mixed, [], { chay: true, rng: firstPick });
    expect(result).toEqual({ ok: true, menu: { ...menu, dishIds: ["x3", "c1", "m1"] } });
  });

  it("fills a slot that was missing from the menu", () => {
    const partial: Menu = { dishIds: ["x1", "m1"], date: TODAY, mealType: "buacom" };
    const result = rerollSlot(partial, "canh", dishes, [], { rng: firstPick });
    expect(result).toEqual({ ok: true, menu: { ...partial, dishIds: ["x1", "c1", "m1"] } });
  });

  it("does not apply to a Bữa 1 món menu", () => {
    const bowlMenu: Menu = { dishIds: ["t1"], date: TODAY, mealType: "buatomonuoc" };
    expect(rerollSlot(bowlMenu, "xao", dishes, [])).toEqual({ ok: false, reason: "not-applicable" });
  });
});

describe("rerollMonNuoc", () => {
  const dishes = [bowl({ id: "t1" }), bowl({ id: "t2", chay: true })];
  const menu: Menu = { dishIds: ["t1"], date: TODAY, mealType: "buatomonuoc" };

  it("swaps to a different Bữa 1 món dish", () => {
    expect(rerollMonNuoc(menu, dishes, [], { rng: firstPick })).toEqual({
      ok: true,
      menu: { ...menu, dishIds: ["t2"] },
    });
  });

  it("reports no alternative when the filter leaves only the current dish", () => {
    expect(rerollMonNuoc(menu, dishes, [], { chay: false, rng: firstPick }).ok).toBe(true);
    expect(rerollMonNuoc({ ...menu, dishIds: ["t2"] }, dishes, [], { chay: true })).toEqual({
      ok: false,
      reason: "no-alternative",
    });
  });

  it("does not apply to a Bữa cơm 3 món menu", () => {
    const rice: Menu = { dishIds: ["x1"], date: TODAY, mealType: "buacom" };
    expect(rerollMonNuoc(rice, dishes, [])).toEqual({ ok: false, reason: "not-applicable" });
  });
});
