import { describe, expect, it } from "vitest";
import { reduce, type Action, type ActionContext } from "./actions";
import { viewRecipeEvent } from "./analytics";
import { resolveCatalog } from "./catalog";
import { EMPTY_PERSONAL_STATE, type PersonalState } from "./personal";
import { bowl, dish, firstPick } from "./testing";

const TODAY = "2026-10-14";
const DISHES = [
  dish({ id: "x1", category: "xao", name: "Xào 1" }),
  dish({ id: "x2", category: "xao", name: "Xào 2" }),
  dish({ id: "c1", category: "canh", name: "Canh" }),
  dish({ id: "m1", category: "man", name: "Mặn" }),
  bowl({ id: "t1", name: "Phở" }),
  bowl({ id: "t2", name: "Bún" }),
];
const ctx: ActionContext = {
  catalog: resolveCatalog(DISHES),
  newId: () => "uid",
  now: 1,
  today: TODAY,
  rng: firstPick,
};
const riceMenu = { date: TODAY, dishIds: ["x1", "c1", "m1"], mealType: "buacom" as const };
const bowlMenu = { date: TODAY, dishIds: ["t1"], mealType: "buatomonuoc" as const };
const withState = (overrides: Partial<PersonalState>): PersonalState => ({ ...EMPTY_PERSONAL_STATE, ...overrides });

function events(action: Action, state: PersonalState = EMPTY_PERSONAL_STATE) {
  return reduce(state, action, ctx).events;
}

describe("analytics events keep the legacy names and properties", () => {
  it("random_menu and random_monnuoc", () => {
    expect(events({ type: "random-menu" })).toEqual([{ name: "random_menu" }]);
    expect(events({ type: "cook-one-dish" })).toEqual([{ name: "random_monnuoc" }]);
  });

  it("reroll_dish carries the Nhóm món, or buatomonuoc for Bữa 1 món", () => {
    expect(events({ type: "reroll", target: "xao" }, withState({ todayMenu: riceMenu }))).toEqual([
      { name: "reroll_dish", props: { category: "xao" } },
    ]);
    expect(events({ type: "reroll", target: "monnuoc" }, withState({ todayMenu: bowlMenu }))).toEqual([
      { name: "reroll_dish", props: { category: "buatomonuoc" } },
    ]);
  });

  it("toggle_chay carries the new state and is followed by the regeneration event", () => {
    expect(events({ type: "toggle-chay" }, withState({ todayMenu: riceMenu }))).toEqual([
      { name: "toggle_chay", props: { on: true } },
      { name: "random_menu" },
    ]);
  });

  it("mark_cooked and save_favorite", () => {
    expect(events({ type: "mark-cooked" }, withState({ todayMenu: riceMenu }))).toEqual([{ name: "mark_cooked" }]);
    expect(events({ type: "save-favorite", name: "x" }, withState({ todayMenu: riceMenu }))).toEqual([{ name: "save_favorite" }]);
  });

  it("use_favorite and delete_favorite", () => {
    const favorite = { id: "f", name: "n", dishIds: ["x1"], mealType: "buacom" as const, savedAt: 1 };
    const state = withState({ favorites: [favorite] });
    expect(events({ type: "use-favorite", id: "f" }, state)).toEqual([{ name: "use_favorite" }]);
    expect(events({ type: "delete-favorite", id: "f" }, state)).toEqual([{ name: "delete_favorite" }]);
  });
});

describe("analytics only counts what the user actually did", () => {
  it("emits nothing for the automatic new-day menu or for ticks", () => {
    expect(events({ type: "ensure-today" })).toEqual([]);
    expect(events({ type: "set-tick", key: "a", checked: true })).toEqual([]);
  });

  it("never emits the dish events that no longer exist, whatever the user does", () => {
    const favorite = { id: "f", name: "n", dishIds: ["x1"], mealType: "buacom" as const, savedAt: 1 };
    const state = withState({ todayMenu: riceMenu, favorites: [favorite] });
    const everyAction: Action[] = [
      { type: "ensure-today" },
      { type: "random-menu" },
      { type: "cook-one-dish" },
      { type: "reroll", target: "xao" },
      { type: "toggle-chay" },
      { type: "mark-cooked" },
      { type: "set-tick", key: "a", checked: true },
      { type: "save-favorite", name: "x" },
      { type: "use-favorite", id: "f" },
      { type: "delete-favorite", id: "f" },
    ];
    const emitted = everyAction.flatMap((action) => events(action, state)).map((event) => event.name);
    expect(emitted.length).toBeGreaterThan(5); // the actions really do emit events
    expect(emitted.filter((name) => ["add_dish", "edit_dish", "delete_dish"].includes(name))).toEqual([]);
  });

  it("emits nothing when a reroll finds no alternative or an action is refused", () => {
    expect(events({ type: "reroll", target: "canh" }, withState({ todayMenu: riceMenu }))).toEqual([]);
    expect(events({ type: "mark-cooked" })).toEqual([]);
    expect(events({ type: "save-favorite", name: "x" })).toEqual([]);
    expect(events({ type: "use-favorite", id: "missing" })).toEqual([]);
  });

  it("a reroll with the wrong mode on screen reports the menu it started instead", () => {
    expect(events({ type: "reroll", target: "monnuoc" }, withState({ todayMenu: riceMenu }))).toEqual([{ name: "random_monnuoc" }]);
    expect(events({ type: "reroll", target: "xao" }, withState({ todayMenu: bowlMenu }))).toEqual([{ name: "random_menu" }]);
  });
});

describe("viewRecipeEvent", () => {
  it("names the catalog dish", () => {
    expect(viewRecipeEvent({ name: "Canh chua" })).toEqual({ name: "view_recipe", props: { dish: "Canh chua" } });
  });
});
