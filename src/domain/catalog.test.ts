import { describe, expect, it } from "vitest";
import { catalogCounts, resolveCatalog } from "./catalog";
import { bowl, dish } from "./testing";

const catalog = [
  dish({ id: "x1", name: "Rau muống xào hành boa-rô" }),
  dish({ id: "x2", name: "Rau lang" }),
  dish({ id: "x3", name: "Su su", retired: true }),
];

describe("resolveCatalog (the catalog is read-only on a device)", () => {
  it("every catalog dish resolves, in catalog order, and exactly that: nothing else is offered", () => {
    expect(resolveCatalog(catalog)).toEqual({
      resolvable: catalog,
      pickable: [catalog[0], catalog[1]],
    });
  });

  it("a retired dish still resolves (old history and favorites stay readable) but is never pickable", () => {
    const { resolvable, pickable } = resolveCatalog(catalog);
    expect(resolvable.map((d) => d.id)).toContain("x3");
    expect(pickable.map((d) => d.id)).not.toContain("x3");
  });

  it("a dish id that is not in the catalog does not resolve", () => {
    expect(resolveCatalog(catalog).resolvable.some((d) => d.id === "custom:abc")).toBe(false);
  });

  it("an empty catalog resolves to nothing", () => {
    expect(resolveCatalog([])).toEqual({ resolvable: [], pickable: [] });
  });
});

describe("the dish counts on Tổng quan", () => {
  it("counts shown and hidden dishes, and the shown ones per Nhóm món and for Bữa 1 món", () => {
    const dishes = [
      dish({ id: "x1" }),
      dish({ id: "x2" }),
      dish({ id: "x3", retired: true }),
      dish({ id: "c1", category: "canh" }),
      dish({ id: "m1", category: "man", retired: true }),
      bowl({ id: "t1" }),
    ];
    expect(catalogCounts(dishes)).toEqual({ shown: 4, hidden: 2, xao: 2, canh: 1, man: 0, buatomonuoc: 1 });
    expect(catalogCounts([])).toEqual({ shown: 0, hidden: 0, xao: 0, canh: 0, man: 0, buatomonuoc: 0 });
  });
});
