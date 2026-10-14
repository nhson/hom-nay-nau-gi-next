import { describe, expect, it } from "vitest";
import { reduce, type ActionContext } from "./actions";
import { resolveCatalog } from "./catalog";
import { EMPTY_PERSONAL_STATE, type PersonalState } from "./personal";
import { bowl, dish, firstPick } from "./testing";

const TODAY = "2026-10-14";

const DISHES = [
  dish({ id: "x1", category: "xao", name: "Xào 1", ingredients: ["Hành", "Tỏi"] }),
  dish({ id: "x2", category: "xao", name: "Xào 2", ingredients: ["Cải"] }),
  dish({ id: "c1", category: "canh", name: "Canh 1", ingredients: ["Hành"] }),
  dish({ id: "m1", category: "man", name: "Mặn 1", ingredients: ["Thịt"] }),
  dish({ id: "xc", category: "xao", chay: true, name: "Xào chay", ingredients: ["Nấm"] }),
  bowl({ id: "t1", name: "Phở" }),
  bowl({ id: "t2", name: "Bún" }),
];

function ctx(overrides: Partial<ActionContext> = {}): ActionContext {
  return { catalog: resolveCatalog(DISHES), today: TODAY, rng: firstPick, ...overrides };
}

function stateWith(overrides: Partial<PersonalState> = {}): PersonalState {
  return { ...EMPTY_PERSONAL_STATE, ...overrides };
}

describe("ensure-today", () => {
  it("generates a Bữa cơm 3 món when there is no menu", () => {
    const { state } = reduce(stateWith(), { type: "ensure-today" }, ctx());
    expect(state.todayMenu).toMatchObject({ date: TODAY, mealType: "buacom" });
    expect(state.todayMenu?.dishIds).toHaveLength(3);
  });

  it("keeps today's menu untouched", () => {
    const menu = { date: TODAY, dishIds: ["x2", "c1", "m1"], mealType: "buacom" as const };
    const before = stateWith({ todayMenu: menu });
    expect(reduce(before, { type: "ensure-today" }, ctx()).state).toBe(before);
  });

  it("regenerates a menu from an earlier day and clears its ticks", () => {
    const stale = { date: "2026-10-13", dishIds: ["x2", "c1", "m1"], mealType: "buacom" as const };
    const { state } = reduce(stateWith({ todayMenu: stale, ticks: { cải: true } }), { type: "ensure-today" }, ctx());
    expect(state.todayMenu?.date).toBe(TODAY);
    expect(state.ticks).toEqual({});
  });

  it("reports a missing group instead of failing", () => {
    const catalog = resolveCatalog(DISHES.filter((d) => d.category !== "canh"));
    const { state, notice } = reduce(stateWith(), { type: "ensure-today" }, ctx({ catalog }));
    expect(state.todayMenu?.dishIds).toHaveLength(2);
    expect(notice).toEqual({ code: "groups-missing", groups: ["canh"], chay: false });
  });
});

describe("random-menu and cook-one-dish", () => {
  it("random-menu always yields a Bữa cơm 3 món, even from a Bữa 1 món", () => {
    const bowlMenu = { date: TODAY, dishIds: ["t1"], mealType: "buatomonuoc" as const };
    const { state } = reduce(stateWith({ todayMenu: bowlMenu }), { type: "random-menu" }, ctx());
    expect(state.todayMenu?.mealType).toBe("buacom");
  });

  it("cook-one-dish yields a single Bữa 1 món dish", () => {
    const { state } = reduce(stateWith(), { type: "cook-one-dish" }, ctx());
    expect(state.todayMenu?.mealType).toBe("buatomonuoc");
    expect(state.todayMenu?.dishIds).toHaveLength(1);
  });

  it("cook-one-dish keeps the current menu and says so when no Bữa 1 món dish matches", () => {
    const catalog = resolveCatalog(DISHES.filter((d) => d.mealType === "buacom"));
    const before = stateWith();
    const { state, notice } = reduce(before, { type: "cook-one-dish" }, ctx({ catalog }));
    expect(state).toBe(before);
    expect(notice).toEqual({ code: "no-one-dish" });
  });

  it("avoids dishes cooked in the last few days", () => {
    const history = [{ date: "2026-10-13", dishIds: ["x1"], mealType: "buacom" as const }];
    const { state } = reduce(stateWith({ history }), { type: "random-menu" }, ctx());
    expect(state.todayMenu?.dishIds).toContain("x2");
    expect(state.todayMenu?.dishIds).not.toContain("x1");
  });
});

describe("reroll", () => {
  const menu = { date: TODAY, dishIds: ["x1", "c1", "m1"], mealType: "buacom" as const };

  it("replaces one slot and keeps the others", () => {
    const { state } = reduce(stateWith({ todayMenu: menu }), { type: "reroll", target: "xao" }, ctx());
    expect(state.todayMenu?.dishIds).toEqual(["x2", "c1", "m1"]);
  });

  it("prunes ticks for ingredients that left the list", () => {
    const { state } = reduce(
      stateWith({ todayMenu: menu, ticks: { tỏi: true, hành: true } }),
      { type: "reroll", target: "xao" },
      ctx(),
    );
    expect(state.ticks).toEqual({ hành: true });
  });

  it("notifies and changes nothing when the group has no alternative", () => {
    const before = stateWith({ todayMenu: menu });
    const { state, notice } = reduce(before, { type: "reroll", target: "canh" }, ctx());
    expect(state).toBe(before);
    expect(notice).toEqual({ code: "no-alternative" });
  });

  it("rerolls the single Bữa 1 món dish", () => {
    const bowlMenu = { date: TODAY, dishIds: ["t1"], mealType: "buatomonuoc" as const };
    const { state } = reduce(stateWith({ todayMenu: bowlMenu }), { type: "reroll", target: "monnuoc" }, ctx());
    expect(state.todayMenu?.dishIds).toEqual(["t2"]);
  });

  it("starts a fresh menu when the reroll target does not match the current mode", () => {
    const { state } = reduce(stateWith({ todayMenu: menu }), { type: "reroll", target: "monnuoc" }, ctx());
    expect(state.todayMenu?.mealType).toBe("buatomonuoc");
  });
});

describe("toggle-chay", () => {
  it("turns the filter on and regenerates with only Chay dishes", () => {
    const { state, notice } = reduce(stateWith(), { type: "toggle-chay" }, ctx());
    expect(state.chayFilter).toBe(true);
    expect(state.todayMenu?.dishIds).toEqual(["xc"]);
    expect(notice).toEqual({ code: "groups-missing", groups: ["canh", "man"], chay: true });
  });

  it("turns it off again", () => {
    const { state } = reduce(stateWith({ chayFilter: true }), { type: "toggle-chay" }, ctx());
    expect(state.chayFilter).toBe(false);
    expect(state.todayMenu?.dishIds).toHaveLength(3);
  });

  it("keeps Bữa 1 món mode when toggled while on a Bữa 1 món", () => {
    const bowlMenu = { date: TODAY, dishIds: ["t1"], mealType: "buatomonuoc" as const };
    const { state, notice } = reduce(stateWith({ todayMenu: bowlMenu }), { type: "toggle-chay" }, ctx());
    expect(state.chayFilter).toBe(true);
    // No Chay bowl dish in the fixtures: the menu stays and the user is told.
    expect(state.todayMenu).toBe(bowlMenu);
    expect(notice).toEqual({ code: "no-one-dish" });
  });
});

describe("mark-cooked and set-tick", () => {
  it("records today's menu and notifies", () => {
    const menu = { date: TODAY, dishIds: ["x1", "c1", "m1"], mealType: "buacom" as const };
    const { state, notice } = reduce(stateWith({ todayMenu: menu }), { type: "mark-cooked" }, ctx());
    expect(state.history).toEqual([{ date: TODAY, dishIds: ["x1", "c1", "m1"], mealType: "buacom" }]);
    expect(notice).toEqual({ code: "cooked" });
  });

  it("does nothing without a menu", () => {
    const before = stateWith();
    expect(reduce(before, { type: "mark-cooked" }, ctx())).toEqual({ state: before });
  });

  it("ticks and unticks an ingredient", () => {
    const ticked = reduce(stateWith(), { type: "set-tick", key: "hành", checked: true }, ctx()).state;
    expect(ticked.ticks).toEqual({ hành: true });
    const unticked = reduce(ticked, { type: "set-tick", key: "hành", checked: false }, ctx()).state;
    expect(unticked.ticks).toEqual({});
  });
});
