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
  return {
    catalog: resolveCatalog(DISHES),
    catalogDishes: DISHES,
    newId: () => "uid",
    now: 1000,
    today: TODAY,
    rng: firstPick,
    ...overrides,
  };
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

describe("dish management", () => {
  const form = { name: "Món mới", mealType: "buacom" as const, category: "canh" as const, chay: false, region: null, time: 15, ingredients: ["a"], steps: ["b"] };

  it("adds a custom dish with a custom id that joins the pickable pool", () => {
    const { state, notice } = reduce(stateWith(), { type: "save-dish", id: null, dish: form }, ctx({ newId: () => "abc" }));
    expect(state.user.customDishes.map((d) => d.id)).toEqual(["custom:abc"]);
    expect(notice).toEqual({ code: "dish-saved" });
    expect(resolveCatalog(DISHES, state.user).pickable.some((d) => d.id === "custom:abc")).toBe(true);
  });

  it("editing a catalog dish stores an override and leaves the catalog untouched", () => {
    const { state } = reduce(stateWith(), { type: "save-dish", id: "x1", dish: { ...form, category: "xao", name: "Xào sửa" } }, ctx());
    expect(state.user.overrides.x1.name).toBe("Xào sửa");
    expect(resolveCatalog(DISHES, state.user).resolvable.find((d) => d.id === "x1")?.name).toBe("Xào sửa");
  });

  it("deleting a catalog dish hides it; restoring and resetting undo that", () => {
    let { state } = reduce(stateWith(), { type: "delete-dish", id: "x1" }, ctx());
    expect(state.user.hiddenIds).toEqual(["x1"]);
    ({ state } = reduce(state, { type: "restore-dish", id: "x1" }, ctx()));
    expect(state.user.hiddenIds).toEqual([]);
    ({ state } = reduce(state, { type: "save-dish", id: "x1", dish: { ...form, category: "xao" } }, ctx()));
    ({ state } = reduce(state, { type: "reset-dish", id: "x1" }, ctx()));
    expect(state.user.overrides).toEqual({});
  });

  it("deleting a custom dish removes it", () => {
    let { state } = reduce(stateWith(), { type: "save-dish", id: null, dish: form }, ctx({ newId: () => "abc" }));
    ({ state } = reduce(state, { type: "delete-dish", id: "custom:abc" }, ctx()));
    expect(state.user.customDishes).toEqual([]);
  });
});

describe("favorites", () => {
  const menu = { date: TODAY, dishIds: ["x1", "c1", "m1"], mealType: "buacom" as const };

  it("saves today's menu under the given name, newest first", () => {
    const { state, notice } = reduce(stateWith({ todayMenu: menu }), { type: "save-favorite", name: "Cuối tuần" }, ctx({ newId: () => "f1", now: 7 }));
    expect(state.favorites).toEqual([{ id: "f1", name: "Cuối tuần", dishIds: ["x1", "c1", "m1"], mealType: "buacom", savedAt: 7 }]);
    expect(notice).toEqual({ code: "favorite-saved" });
  });

  it("defaults a blank name to 'Thực đơn dd/mm'", () => {
    const { state } = reduce(stateWith({ todayMenu: menu }), { type: "save-favorite", name: "  " }, ctx());
    expect(state.favorites[0].name).toBe("Thực đơn 14/10");
  });

  it("explains when there is no menu to save", () => {
    const before = stateWith();
    expect(reduce(before, { type: "save-favorite", name: "x" }, ctx())).toEqual({ state: before, notice: { code: "no-menu-to-save" } });
  });

  it("applying a favorite sets today's menu and resets ticks", () => {
    const favorite = { id: "f1", name: "n", dishIds: ["x2", "c1", "m1"], mealType: "buacom" as const, savedAt: 1 };
    const { state, notice } = reduce(stateWith({ favorites: [favorite], ticks: { hành: true } }), { type: "use-favorite", id: "f1" }, ctx());
    expect(state.todayMenu).toEqual({ date: TODAY, dishIds: ["x2", "c1", "m1"], mealType: "buacom" });
    expect(state.ticks).toEqual({});
    expect(notice).toEqual({ code: "favorite-applied" });
  });

  it("refuses a favorite whose dishes are all gone", () => {
    const favorite = { id: "f1", name: "n", dishIds: ["gone"], savedAt: 1 };
    const before = stateWith({ favorites: [favorite] });
    const result = reduce(before, { type: "use-favorite", id: "f1" }, ctx());
    expect(result.state).toBe(before);
    expect(result.notice).toEqual({ code: "favorite-unavailable" });
  });

  it("deletes a favorite", () => {
    const favorite = { id: "f1", name: "n", dishIds: ["x1"], savedAt: 1 };
    expect(reduce(stateWith({ favorites: [favorite] }), { type: "delete-favorite", id: "f1" }, ctx()).state.favorites).toEqual([]);
  });
});
