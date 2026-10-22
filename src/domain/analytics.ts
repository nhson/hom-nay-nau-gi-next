import type { Action, ActionResult } from "./actions";
import type { PersonalState } from "./personal";
import type { Dish } from "./types";

/**
 * Product analytics events. Names and properties are identical to the legacy app so the north-star
 * metric (mark_cooked per week) and the reroll / cook-through / recipe ratios stay comparable.
 * Properties never contain personal content: category, flags and the name of a public catalog dish.
 */
export interface AnalyticsEvent {
  name: string;
  props?: Record<string, string | boolean>;
}

/** The menu produced by an action that regenerated it: legacy fired the matching "random" event. */
function randomEventFor(after: PersonalState): AnalyticsEvent {
  return { name: after.todayMenu?.mealType === "buatomonuoc" ? "random_monnuoc" : "random_menu" };
}

/**
 * Events for a user action, derived from what actually happened (an action that changed nothing,
 * like a reroll with no alternative, emits nothing). Automatic actions such as the new-day menu
 * emit nothing: only the user's own taps are counted.
 */
export function eventsFor(action: Action, before: PersonalState, result: ActionResult): AnalyticsEvent[] {
  const after = result.state;
  switch (action.type) {
    case "random-menu":
      return [{ name: "random_menu" }];

    case "cook-one-dish":
      return after !== before ? [{ name: "random_monnuoc" }] : [];

    case "reroll": {
      if (after === before) return [];
      if (action.target === "monnuoc") {
        // A reroll with no Bữa 1 món on screen starts one instead.
        return before.todayMenu?.mealType === "buatomonuoc"
          ? [{ name: "reroll_dish", props: { category: "buatomonuoc" } }]
          : [{ name: "random_monnuoc" }];
      }
      return before.todayMenu?.mealType === "buacom"
        ? [{ name: "reroll_dish", props: { category: action.target } }]
        : [{ name: "random_menu" }];
    }

    case "toggle-chay": {
      const events: AnalyticsEvent[] = [{ name: "toggle_chay", props: { on: after.chayFilter } }];
      if (after.todayMenu !== before.todayMenu) events.push(randomEventFor(after));
      return events;
    }

    case "mark-cooked":
      return result.notice?.code === "cooked" ? [{ name: "mark_cooked" }] : [];

    case "save-favorite":
      return result.notice?.code === "favorite-saved" ? [{ name: "save_favorite" }] : [];

    case "use-favorite":
      return result.notice?.code === "favorite-applied" ? [{ name: "use_favorite" }] : [];

    case "delete-favorite":
      return after.favorites.length < before.favorites.length ? [{ name: "delete_favorite" }] : [];

    case "ensure-today":
    case "set-tick":
    case "dismiss-install-hint":
      return [];
  }
}

/** Opening a recipe (from today's menu or the dish library). Every dish is a public catalog dish. */
export function viewRecipeEvent(dish: Pick<Dish, "name">): AnalyticsEvent {
  return { name: "view_recipe", props: { dish: dish.name } };
}
