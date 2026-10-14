import {
  addCustomDish,
  deleteDish,
  makeCustomDishId,
  resetDish,
  restoreDish,
  saveDish,
  type ResolvedCatalog,
} from "./catalog";
import { applyFavorite, createFavorite, deleteFavorite } from "./favorites";
import { recordCooked } from "./history";
import {
  generateBuaComMenu,
  generateMonNuocMenu,
  isMenuStale,
  rerollMonNuoc,
  rerollSlot,
} from "./menu";
import { eventsFor, type AnalyticsEvent } from "./analytics";
import type { PersonalState } from "./personal";
import { buildShoppingList, pruneTicks, setTick } from "./shopping";
import type { Category, Dish, Menu, Rng } from "./types";

export type Action =
  /** Open / return to the app: generate a fresh menu if today has none. */
  | { type: "ensure-today" }
  | { type: "random-menu" }
  | { type: "cook-one-dish" }
  | { type: "reroll"; target: Category | "monnuoc" }
  | { type: "toggle-chay" }
  | { type: "mark-cooked" }
  | { type: "set-tick"; key: string; checked: boolean }
  /** `id: null` adds a custom dish; otherwise edits that dish (a catalog dish becomes an override). */
  | { type: "save-dish"; id: string | null; dish: Omit<Dish, "id"> }
  | { type: "delete-dish"; id: string }
  | { type: "restore-dish"; id: string }
  | { type: "reset-dish"; id: string }
  | { type: "save-favorite"; name: string }
  | { type: "use-favorite"; id: string }
  | { type: "delete-favorite"; id: string };

/** What the UI should tell the user; the wording lives in the UI. */
export type Notice =
  | { code: "groups-missing"; groups: Category[]; chay: boolean }
  | { code: "no-alternative" }
  | { code: "no-one-dish" }
  | { code: "cooked" }
  | { code: "dish-saved" }
  | { code: "favorite-saved" }
  | { code: "favorite-applied" }
  | { code: "no-menu-to-save" }
  | { code: "favorite-unavailable" };

export interface ActionContext {
  /** The user's view of the catalog (edits and deletions applied). */
  catalog: ResolvedCatalog;
  /** The server catalog as received, before the user's edits: tells catalog dishes from custom ones. */
  catalogDishes: readonly Dish[];
  /** Unique string for new custom dishes and favorites (injected: the domain has no crypto). */
  newId: () => string;
  /** Epoch milliseconds. */
  now: number;
  /** Device-local date, YYYY-MM-DD. */
  today: string;
  rng?: Rng;
}

export interface ActionResult {
  state: PersonalState;
  notice?: Notice;
  /** Analytics events for what the user just did; the UI sends them, the domain only describes them. */
  events: AnalyticsEvent[];
}

type StepResult = Omit<ActionResult, "events">;

function riceMenu(state: PersonalState, ctx: ActionContext): StepResult {
  const { menu, missing } = generateBuaComMenu(ctx.catalog.pickable, state.history, ctx.today, {
    chay: state.chayFilter,
    rng: ctx.rng,
  });
  return {
    state: { ...state, todayMenu: menu, ticks: {} },
    notice: missing.length > 0 ? { code: "groups-missing", groups: missing, chay: state.chayFilter } : undefined,
  };
}

function oneDishMenu(state: PersonalState, ctx: ActionContext): StepResult {
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

/** Pure state transition for every user action. */
export function reduce(state: PersonalState, action: Action, ctx: ActionContext): ActionResult {
  const step = apply(state, action, ctx);
  return { ...step, events: eventsFor(action, state, { ...step, events: [] }) };
}

function apply(state: PersonalState, action: Action, ctx: ActionContext): StepResult {
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

    case "save-dish": {
      const user = action.id
        ? saveDish(state.user, ctx.catalogDishes, { ...action.dish, id: action.id })
        : addCustomDish(state.user, { ...action.dish, id: makeCustomDishId(ctx.newId()) });
      return { state: { ...state, user }, notice: { code: "dish-saved" } };
    }

    case "delete-dish":
      return { state: { ...state, user: deleteDish(state.user, ctx.catalogDishes, action.id) } };

    case "restore-dish":
      return { state: { ...state, user: restoreDish(state.user, action.id) } };

    case "reset-dish":
      return { state: { ...state, user: resetDish(state.user, action.id) } };

    case "save-favorite": {
      if (!state.todayMenu) return { state, notice: { code: "no-menu-to-save" } };
      const favorite = createFavorite(state.todayMenu, action.name, ctx.newId(), ctx.now);
      return {
        state: { ...state, favorites: [favorite, ...state.favorites] },
        notice: { code: "favorite-saved" },
      };
    }

    case "use-favorite": {
      const favorite = state.favorites.find((candidate) => candidate.id === action.id);
      const menu = favorite && applyFavorite(favorite, ctx.today, ctx.catalog.resolvable);
      if (!menu) return { state, notice: { code: "favorite-unavailable" } };
      return {
        state: { ...state, todayMenu: menu, ticks: {} },
        notice: { code: "favorite-applied" },
      };
    }

    case "delete-favorite":
      return { state: { ...state, favorites: deleteFavorite(state.favorites, action.id) } };
  }
}
