import { describe, expect, it } from "vitest";
import { applyFavorite, createFavorite, defaultFavoriteName, deleteFavorite } from "./favorites";
import { bowl, dish } from "./testing";
import type { Favorite, Menu } from "./types";

const TODAY = "2026-10-13";
const dishes = [
  dish({ id: "x1", category: "xao" }),
  dish({ id: "c1", category: "canh" }),
  dish({ id: "m1", category: "man" }),
  bowl({ id: "t1" }),
];

describe("createFavorite", () => {
  const menu: Menu = { dishIds: ["x1", "c1", "m1"], date: "2026-10-09", mealType: "buacom" };

  it("uses the given name, trimmed", () => {
    expect(createFavorite(menu, "  Mâm cuối tuần ", "f1", 1).name).toBe("Mâm cuối tuần");
  });

  it("falls back to 'Thực đơn dd/mm' for a blank name", () => {
    expect(defaultFavoriteName("2026-10-09")).toBe("Thực đơn 09/10");
    expect(createFavorite(menu, "   ", "f1", 1).name).toBe("Thực đơn 09/10");
  });

  it("stores a copy of the dishes and the meal type", () => {
    const favorite = createFavorite(menu, "x", "f1", 5);
    menu.dishIds.push("zzz");
    expect(favorite).toMatchObject({ dishIds: ["x1", "c1", "m1"], mealType: "buacom", savedAt: 5 });
    menu.dishIds.pop();
  });
});

describe("applyFavorite", () => {
  it("builds today's menu in the fixed Xào -> Canh -> Món mặn order", () => {
    const favorite: Favorite = { id: "f", name: "n", dishIds: ["m1", "x1", "c1"], mealType: "buacom", savedAt: 1 };
    expect(applyFavorite(favorite, TODAY, dishes)).toEqual({
      dishIds: ["x1", "c1", "m1"],
      date: TODAY,
      mealType: "buacom",
    });
  });

  it("restores a Bữa 1 món favorite as Bữa 1 món (legacy app lost the meal type)", () => {
    const legacy: Favorite = { id: "f", name: "n", dishIds: ["t1"], savedAt: 1 };
    expect(applyFavorite(legacy, TODAY, dishes)).toEqual({
      dishIds: ["t1"],
      date: TODAY,
      mealType: "buatomonuoc",
    });
  });

  it("infers Bữa cơm 3 món for a legacy favorite of rice dishes", () => {
    const legacy: Favorite = { id: "f", name: "n", dishIds: ["x1", "c1", "m1"], savedAt: 1 };
    expect(applyFavorite(legacy, TODAY, dishes)?.mealType).toBe("buacom");
  });

  it("drops dishes that no longer exist and returns null when none remain", () => {
    const partial: Favorite = { id: "f", name: "n", dishIds: ["x1", "gone", "m1"], mealType: "buacom", savedAt: 1 };
    expect(applyFavorite(partial, TODAY, dishes)?.dishIds).toEqual(["x1", "m1"]);
    const allGone: Favorite = { id: "f", name: "n", dishIds: ["gone"], savedAt: 1 };
    expect(applyFavorite(allGone, TODAY, dishes)).toBeNull();
  });
});

describe("deleteFavorite", () => {
  it("removes only the matching favorite", () => {
    const list: Favorite[] = [
      { id: "a", name: "A", dishIds: [], savedAt: 1 },
      { id: "b", name: "B", dishIds: [], savedAt: 2 },
    ];
    expect(deleteFavorite(list, "a").map((f) => f.id)).toEqual(["b"]);
    expect(list).toHaveLength(2);
  });
});
