import { describe, expect, it } from "vitest";
import { resolveCatalog } from "./catalog";
import { EMPTY_PERSONAL_STATE } from "./personal";
import { foldText, menuDishes, selectDishBank, selectFavorites, selectToday } from "./selectors";
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

describe("selectDishBank (a read-only library)", () => {
  const dishes = [
    dish({ id: "m1", category: "man", name: "Thịt kho" }),
    dish({ id: "x2", category: "xao", name: "Đậu xào", chay: true }),
    dish({ id: "x1", category: "xao", name: "Bắp cải xào" }),
    dish({ id: "x3", category: "xao", name: "Âu xào" }),
    bowl({ id: "t1", name: "Phở" }),
    dish({ id: "old", category: "canh", name: "Cũ", retired: true }),
  ];
  const resolved = resolveCatalog(dishes);
  const ids = (filter: Parameters<typeof selectDishBank>[1], chayOnly = false, query = "") =>
    selectDishBank(resolved, filter, chayOnly, query).map((dish) => dish.id);

  it("sorts by group (Xào, Canh, Mặn, Bữa 1 món) then name with Vietnamese collation", () => {
    const names = selectDishBank(resolved, "all", false).map((dish) => dish.name);
    expect(names).toEqual(["Âu xào", "Bắp cải xào", "Đậu xào", "Thịt kho", "Phở"]);
  });

  it("filters by group and Chay independently, and never lists retired dishes", () => {
    expect(ids("xao", true)).toEqual(["x2"]);
    expect(ids("buatomonuoc")).toEqual(["t1"]);
    expect(ids("canh")).toEqual([]);
  });

  it("searches ignoring case and accents, anywhere in the name, combined with the filters", () => {
    expect(foldText("Đậu HŨ Xào")).toBe("dau hu xao");
    expect(ids("all", false, "XAO")).toEqual(["x3", "x1", "x2"]);
    expect(ids("all", false, "dau")).toEqual(["x2"]);
    expect(ids("man", false, "xao")).toEqual([]);
    expect(ids("all", false, "   ")).toHaveLength(5);
    expect(ids("all", false, "khong co")).toEqual([]);
  });
});

describe("selectFavorites", () => {
  it("resolves names, flags removed dishes and marks a favorite with no dish left as unusable", () => {
    const favorites = [
      { id: "a", name: "A", dishIds: ["x1", "custom:gone"], savedAt: 1 },
      { id: "b", name: "B", dishIds: ["custom:gone"], savedAt: 2 },
    ];
    const rows = selectFavorites({ ...EMPTY_PERSONAL_STATE, favorites }, catalog);
    expect(rows[0]).toMatchObject({ dishNames: ["Xào", "(đã xoá)"], usable: true });
    expect(rows[1]).toMatchObject({ dishNames: ["(đã xoá)"], usable: false });
  });
});
