import { describe, expect, it } from "vitest";
import { resolveCatalog } from "./catalog";
import { dish } from "./testing";

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
