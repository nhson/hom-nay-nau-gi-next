import type { ResolvedCatalog } from "./catalog";
import { recordCooked } from "./history";
import {
  generateBuaComMenu,
  generateMonNuocMenu,
  isMenuStale,
  rerollMonNuoc,
  rerollSlot,
} from "./menu";
import type { PersonalState } from "./personal";
import { buildShoppingList, pruneTicks, setTick } from "./shopping";
import type { Category, Menu, Rng } from "./types";

export type Action =
  /** Open / return to the app: generate a fresh menu if today has none. */
  | { type: "ensure-today" }
  | { type: "random-menu" }
  | { type: "cook-one-dish" }
  | { type: "reroll"; target: Category | "monnuoc" }
  | { type: "toggle-chay" }
  | { type: "mark-cooked" }
  | { type: "set-tick"; key: string; checked: boolean };

/** What the UI should tell the user; the wording lives in the UI. */
export type Notice =
  | { code: "groups-missing"; groups: Category[]; chay: boolean }
  | { code: "no-alternative" }
  | { code: "no-one-dish" }
  | { code: "cooked" };

export interface ActionContext {
  catalog: ResolvedCatalog;
  /** Device-local date, YYYY-MM-DD. */
  today: string;
  rng?: Rng;
}

export interface ActionResult {
  state: PersonalState;
  notice?: Notice;
}

function riceMenu(state: PersonalState, ctx: ActionContext): ActionResult {
  const { menu, missing } = generateBuaComMenu(ctx.catalog.pickable, state.history, ctx.today, {
    chay: state.chayFilter,
    rng: ctx.rng,
  });
  return {
    state: { ...state, todayMenu: menu, ticks: {} },
    notice: missing.length > 0 ? { code: "groups-missing", groups: missing, chay: state.chayFilter } : undefined,
  };
}

function oneDishMenu(state: PersonalState, ctx: ActionContext): ActionResult {
  const menu = generateMonNuocMenu(ctx.catalog.pickable, state.history, ctx.today, {
    chay: state.chayFilter,
    rng: ctx.rng,
  });
  if (!menu) return { state, notice: { code: "no-one-dish" } };
  return { state: { ...state, todayMenu: menu, ticks: {} } };
}

function withMenu(state: PersonalState, menu: Menu, ctx: ActionContext): PersonalState {
  const byId = new Map(ctx.catalog.resolvable.map((dish) => [dish.id, dish]));
  const dishes = menu.dishIds.flatMap((id) => byId.get(id) ?? []);
  return {
    ...state,
    todayMenu: menu,
    ticks: pruneTicks(state.ticks, buildShoppingList(dishes)),
  };
}

/** Pure state transition for every user action on the Hôm nay screen. */
export function reduce(state: PersonalState, action: Action, ctx: ActionContext): ActionResult {
  switch (action.type) {
    case "ensure-today":
      return isMenuStale(state.todayMenu, ctx.today) ? riceMenu(state, ctx) : { state };

    case "random-menu":
      // Always a Bữa cơm 3 món: Bữa 1 món is only ever a deliberate choice.
      return riceMenu(state, ctx);

    case "cook-one-dish":
      return oneDishMenu(state, ctx);

    case "reroll": {
      const menu = state.todayMenu;
      if (action.target === "monnuoc") {
        if (!menu || menu.mealType !== "buatomonuoc") return oneDishMenu(state, ctx);
        const result = rerollMonNuoc(menu, ctx.catalog.pickable, state.history, {
          chay: state.chayFilter,
          rng: ctx.rng,
        });
        return result.ok
          ? { state: withMenu(state, result.menu, ctx) }
          : { state, notice: { code: "no-alternative" } };
      }
      if (!menu || menu.mealType !== "buacom") return riceMenu(state, ctx);
      const result = rerollSlot(menu, action.target, ctx.catalog.pickable, state.history, {
        chay: state.chayFilter,
        rng: ctx.rng,
      });
      return result.ok
        ? { state: withMenu(state, result.menu, ctx) }
        : { state, notice: { code: "no-alternative" } };
    }

    case "toggle-chay": {
      const next = { ...state, chayFilter: !state.chayFilter };
      // Regenerate in the current mode so what is on screen always matches the toggle.
      return state.todayMenu?.mealType === "buatomonuoc" ? oneDishMenu(next, ctx) : riceMenu(next, ctx);
    }

    case "mark-cooked":
      if (!state.todayMenu) return { state };
      return {
        state: { ...state, history: recordCooked(state.history, state.todayMenu) },
        notice: { code: "cooked" },
      };

    case "set-tick":
      return { state: { ...state, ticks: setTick(state.ticks, action.key, action.checked) } };
  }
}
