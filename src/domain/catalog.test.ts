import { describe, expect, it } from "vitest";
import {
  addCustomDish,
  deleteDish,
  EMPTY_USER_CATALOG,
  hasOverride,
  isCustomDishId,
  makeCustomDishId,
  resetDish,
  resolveCatalog,
  restoreDish,
  saveDish,
} from "./catalog";
import { dish } from "./testing";

const catalog = [
  dish({ id: "x1", name: "Rau muống xào hành boa-rô" }),
  dish({ id: "x2", name: "Rau lang" }),
  dish({ id: "x3", name: "Su su", retired: true }),
];

describe("resolveCatalog", () => {
  it("with no customizations: everything resolves, retired dishes are not pickable", () => {
    const { resolvable, pickable, hidden } = resolveCatalog(catalog);
    expect(resolvable.map((d) => d.id)).toEqual(["x1", "x2", "x3"]);
    expect(pickable.map((d) => d.id)).toEqual(["x1", "x2"]);
    expect(hidden).toEqual([]);
  });

  it("an override wins over the catalog dish and keeps the catalog id", () => {
    const user = { ...EMPTY_USER_CATALOG, overrides: { x1: dish({ id: "x1", name: "Món của nhà" }) } };
    const { pickable } = resolveCatalog(catalog, user);
    expect(pickable.find((d) => d.id === "x1")?.name).toBe("Món của nhà");
  });

  it("a later catalog correction never replaces an override", () => {
    const user = { ...EMPTY_USER_CATALOG, overrides: { x1: dish({ id: "x1", name: "Bản sửa của tôi" }) } };
    const corrected = catalog.map((d) => (d.id === "x1" ? { ...d, name: "Bản sửa trung tâm" } : d));
    expect(resolveCatalog(corrected, user).pickable[0].name).toBe("Bản sửa của tôi");
  });

  it("retired status comes from the catalog even for an overridden dish", () => {
    const user = { ...EMPTY_USER_CATALOG, overrides: { x3: dish({ id: "x3", name: "Su su của tôi" }) } };
    const { resolvable, pickable } = resolveCatalog(catalog, user);
    expect(resolvable.find((d) => d.id === "x3")?.name).toBe("Su su của tôi");
    expect(pickable.some((d) => d.id === "x3")).toBe(false);
  });

  it("hidden catalog dishes stop resolving and are listed for restore", () => {
    const user = { ...EMPTY_USER_CATALOG, hiddenIds: ["x2", "x3"] };
    const { resolvable, hidden } = resolveCatalog(catalog, user);
    expect(resolvable.map((d) => d.id)).toEqual(["x1"]);
    expect(hidden.map((d) => d.id)).toEqual(["x2"]); // retired dishes are not offered for restore
  });

  it("custom dishes are appended and pickable; a custom id colliding with the catalog is ignored", () => {
    const custom = dish({ id: makeCustomDishId("abc"), name: "Nhà làm" });
    const clash = dish({ id: "x1", name: "Giả mạo" });
    const user = { ...EMPTY_USER_CATALOG, customDishes: [custom, clash] };
    const { pickable } = resolveCatalog(catalog, user);
    expect(pickable.map((d) => d.id)).toEqual(["x1", "x2", "custom:abc"]);
    expect(pickable.find((d) => d.id === "x1")?.name).toBe("Rau muống xào hành boa-rô");
  });
});

describe("custom ids", () => {
  it("are recognizable and cannot look like a seed id", () => {
    expect(isCustomDishId(makeCustomDishId("u1"))).toBe(true);
    for (const seedId of ["x1", "c12", "m3", "t9"]) expect(isCustomDishId(seedId)).toBe(false);
  });
});

describe("user catalog transitions", () => {
  it("editing a catalog dish stores an override and leaves the catalog untouched", () => {
    const edited = dish({ id: "x2", name: "Rau lang kiểu nhà" });
    const user = saveDish(EMPTY_USER_CATALOG, catalog, edited);
    expect(user.overrides).toEqual({ x2: edited });
    expect(hasOverride(user, "x2")).toBe(true);
    expect(catalog[1].name).toBe("Rau lang");
  });

  it("editing a custom dish replaces it in place", () => {
    const original = dish({ id: "custom:1", name: "Cũ" });
    const start = addCustomDish(EMPTY_USER_CATALOG, original);
    const user = saveDish(start, catalog, { ...original, name: "Mới" });
    expect(user.customDishes).toEqual([{ ...original, name: "Mới" }]);
    expect(user.overrides).toEqual({});
  });

  it("deleting a catalog dish hides it once; deleting a custom dish removes it", () => {
    const hiddenOnce = deleteDish(deleteDish(EMPTY_USER_CATALOG, catalog, "x1"), catalog, "x1");
    expect(hiddenOnce.hiddenIds).toEqual(["x1"]);
    const withCustom = addCustomDish(EMPTY_USER_CATALOG, dish({ id: "custom:1" }));
    expect(deleteDish(withCustom, catalog, "custom:1").customDishes).toEqual([]);
  });

  it("restore un-hides, reset drops the override", () => {
    const hidden = deleteDish(EMPTY_USER_CATALOG, catalog, "x1");
    expect(restoreDish(hidden, "x1").hiddenIds).toEqual([]);
    const edited = saveDish(EMPTY_USER_CATALOG, catalog, dish({ id: "x1", name: "Sửa" }));
    const reset = resetDish(edited, "x1");
    expect(hasOverride(reset, "x1")).toBe(false);
    expect(resolveCatalog(catalog, reset).pickable[0].name).toBe("Rau muống xào hành boa-rô");
  });

  it("never mutates the previous state", () => {
    const before = { ...EMPTY_USER_CATALOG };
    deleteDish(before, catalog, "x1");
    saveDish(before, catalog, dish({ id: "x1" }));
    expect(before).toEqual(EMPTY_USER_CATALOG);
    expect(EMPTY_USER_CATALOG.hiddenIds).toEqual([]);
  });
});
