import { describe, expect, it } from "vitest";
import { buildBuaComMenu, filterDishes, pickMonNuoc, pickRandom } from "./selection";
import { dish, firstPick, lastPick, sequenceRng } from "./testing";

// The first four describe blocks are the legacy logic.js parity baseline (18 tests ported).

describe("filterDishes", () => {
  it("filters by mealType", () => {
    const dishes = [
      dish({ id: "a", mealType: "buacom" }),
      dish({ id: "b", mealType: "buatomonuoc", category: null }),
    ];
    expect(filterDishes(dishes, { mealType: "buatomonuoc" }).map((d) => d.id)).toEqual(["b"]);
  });

  it("filters by category", () => {
    const dishes = [dish({ id: "a", category: "xao" }), dish({ id: "b", category: "canh" })];
    expect(filterDishes(dishes, { category: "canh" }).map((d) => d.id)).toEqual(["b"]);
  });

  it("filters by chay when chay is true", () => {
    const dishes = [dish({ id: "a", chay: true }), dish({ id: "b", chay: false })];
    expect(filterDishes(dishes, { chay: true }).map((d) => d.id)).toEqual(["a"]);
  });

  it("does not filter on chay when it is missing or false", () => {
    const dishes = [dish({ id: "a", chay: true }), dish({ id: "b", chay: false })];
    expect(filterDishes(dishes, {}).map((d) => d.id)).toEqual(["a", "b"]);
    expect(filterDishes(dishes, { chay: false }).map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("combines several conditions", () => {
    const dishes = [
      dish({ id: "a", mealType: "buatomonuoc", category: null, chay: true }),
      dish({ id: "b", mealType: "buatomonuoc", category: null, chay: false }),
      dish({ id: "c", mealType: "buacom", category: "xao", chay: true }),
    ];
    const result = filterDishes(dishes, { mealType: "buatomonuoc", chay: true });
    expect(result.map((d) => d.id)).toEqual(["a"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterDishes([dish({ id: "a", category: "xao" })], { category: "canh" })).toEqual([]);
  });
});

describe("pickRandom", () => {
  it("returns null for an empty pool", () => {
    expect(pickRandom([], [])).toBeNull();
  });

  it("never returns a dish in avoidIds while others exist", () => {
    const pool = [dish({ id: "a" }), dish({ id: "b" }), dish({ id: "c" })];
    const rng = sequenceRng(0, 0.25, 0.5, 0.75, 0.999);
    for (let i = 0; i < 20; i++) {
      expect(pickRandom(pool, ["a", "b"], rng)?.id).toBe("c");
    }
  });

  it("falls back to the whole pool when avoidIds excludes everything", () => {
    const pool = [dish({ id: "a" }), dish({ id: "b" })];
    expect(["a", "b"]).toContain(pickRandom(pool, ["a", "b"], firstPick)?.id);
  });

  it("returns the only dish of a single-dish pool", () => {
    expect(pickRandom([dish({ id: "a" })], [], firstPick)?.id).toBe("a");
  });
});

describe("buildBuaComMenu", () => {
  it("always returns the three Nhóm món keys", () => {
    const dishes = [
      dish({ id: "x1", category: "xao" }),
      dish({ id: "c1", category: "canh" }),
      dish({ id: "m1", category: "man" }),
    ];
    const menu = buildBuaComMenu(dishes, { rng: firstPick });
    expect(Object.keys(menu).sort()).toEqual(["canh", "man", "xao"]);
    expect(menu.xao?.id).toBe("x1");
    expect(menu.canh?.id).toBe("c1");
    expect(menu.man?.id).toBe("m1");
  });

  it("is null for a group with no dish matching the chay filter", () => {
    const dishes = [
      dish({ id: "x1", category: "xao", chay: false }),
      dish({ id: "c1", category: "canh", chay: true }),
      dish({ id: "m1", category: "man", chay: false }),
    ];
    const menu = buildBuaComMenu(dishes, { chay: true, rng: firstPick });
    expect(menu.xao).toBeNull();
    expect(menu.canh?.id).toBe("c1");
    expect(menu.man).toBeNull();
  });

  it("applies avoidIdsByCategory per group", () => {
    const dishes = [
      dish({ id: "x1", category: "xao" }),
      dish({ id: "x2", category: "xao" }),
      dish({ id: "c1", category: "canh" }),
      dish({ id: "m1", category: "man" }),
    ];
    const menu = buildBuaComMenu(dishes, { avoidIdsByCategory: { xao: ["x1"] }, rng: firstPick });
    expect(menu.xao?.id).toBe("x2");
  });

  it("ignores Bữa 1 món dishes", () => {
    const dishes = [
      dish({ id: "x1", category: "xao" }),
      dish({ id: "pho1", category: null, mealType: "buatomonuoc" }),
      dish({ id: "c1", category: "canh" }),
      dish({ id: "m1", category: "man" }),
    ];
    expect(buildBuaComMenu(dishes, { rng: firstPick }).xao?.id).toBe("x1");
  });
});

describe("pickMonNuoc", () => {
  it("is null when there is no Bữa 1 món dish", () => {
    expect(pickMonNuoc([dish({ id: "x1", mealType: "buacom" })])).toBeNull();
  });

  it("only picks from Bữa 1 món dishes", () => {
    const dishes = [
      dish({ id: "x1", mealType: "buacom" }),
      dish({ id: "pho1", mealType: "buatomonuoc", category: null }),
    ];
    expect(pickMonNuoc(dishes, { rng: firstPick })?.id).toBe("pho1");
  });

  it("applies the chay filter", () => {
    const dishes = [
      dish({ id: "pho1", mealType: "buatomonuoc", category: null, chay: false }),
      dish({ id: "bunchay1", mealType: "buatomonuoc", category: null, chay: true }),
    ];
    expect(pickMonNuoc(dishes, { chay: true, rng: firstPick })?.id).toBe("bunchay1");
  });

  it("avoids avoidId", () => {
    const dishes = [
      dish({ id: "pho1", mealType: "buatomonuoc", category: null }),
      dish({ id: "bun1", mealType: "buatomonuoc", category: null }),
    ];
    expect(pickMonNuoc(dishes, { avoidId: "pho1", rng: firstPick })?.id).toBe("bun1");
  });
});

describe("randomness is injected", () => {
  it("maps rng output onto the candidate list", () => {
    const pool = [dish({ id: "a" }), dish({ id: "b" }), dish({ id: "c" })];
    expect(pickRandom(pool, [], firstPick)?.id).toBe("a");
    expect(pickRandom(pool, [], () => 0.5)?.id).toBe("b");
    expect(pickRandom(pool, [], lastPick)?.id).toBe("c");
  });

  it("never indexes out of range even if rng returns exactly 1", () => {
    const pool = [dish({ id: "a" }), dish({ id: "b" })];
    expect(pickRandom(pool, [], () => 1)?.id).toBe("b");
  });
});
