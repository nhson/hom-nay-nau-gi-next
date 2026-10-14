import { describe, expect, it } from "vitest";
import { resolveCatalog } from "./catalog";
import { EMPTY_PERSONAL_STATE } from "./personal";
import { menuDishes, selectToday } from "./selectors";
import { bowl, dish } from "./testing";

const TODAY = "2026-10-14";
const DISHES = [
  dish({ id: "x1", category: "xao", name: "Xào", ingredients: ["Hành", "Tỏi"] }),
  dish({ id: "c1", category: "canh", name: "Canh", ingredients: ["hành"] }),
  dish({ id: "m1", category: "man", name: "Mặn", ingredients: ["Thịt"] }),
  bowl({ id: "t1", name: "Phở" }),
];
const catalog = resolveCatalog(DISHES);

describe("menuDishes", () => {
  it("orders a Bữa cơm 3 món Xào -> Canh -> Món mặn regardless of stored order", () => {
    const menu = { date: TODAY, dishIds: ["m1", "x1", "c1"], mealType: "buacom" as const };
    expect(menuDishes(menu, catalog.resolvable).map((d) => d.id)).toEqual(["x1", "c1", "m1"]);
  });

  it("skips dishes that no longer resolve", () => {
    const menu = { date: TODAY, dishIds: ["x1", "gone"], mealType: "buacom" as const };
    expect(menuDishes(menu, catalog.resolvable).map((d) => d.id)).toEqual(["x1"]);
  });

  it("is empty without a menu", () => {
    expect(menuDishes(null, catalog.resolvable)).toEqual([]);
  });
});

describe("selectToday", () => {
  const menu = { date: TODAY, dishIds: ["x1", "c1", "m1"], mealType: "buacom" as const };

  it("merges shopping items across dishes and reflects ticks", () => {
    const view = selectToday({ ...EMPTY_PERSONAL_STATE, todayMenu: menu, ticks: { hành: true } }, catalog, TODAY);
    const onion = view.shopping.find((item) => item.key === "hành");
    expect(onion).toMatchObject({ checked: true, dishNames: ["Xào", "Canh"] });
    expect(view.shopping).toHaveLength(3);
  });

  it("reports cooked only when the recorded entry equals the menu on screen", () => {
    const history = [{ date: TODAY, dishIds: ["x1", "c1", "m1"], mealType: "buacom" as const }];
    expect(selectToday({ ...EMPTY_PERSONAL_STATE, todayMenu: menu, history }, catalog, TODAY).cooked).toBe(true);
    const other = { ...menu, dishIds: ["x1", "c1"] };
    expect(selectToday({ ...EMPTY_PERSONAL_STATE, todayMenu: other, history }, catalog, TODAY).cooked).toBe(false);
  });

  it("lists recent history with dd/mm labels and a placeholder for deleted dishes", () => {
    const history = [{ date: "2026-10-13", dishIds: ["x1", "gone"], mealType: "buacom" as const }];
    const view = selectToday({ ...EMPTY_PERSONAL_STATE, history }, catalog, TODAY);
    expect(view.recent).toEqual([
      { date: "2026-10-13", label: "13/10", names: ["Xào", "(đã xoá)"], mealType: "buacom" },
    ]);
  });
});
