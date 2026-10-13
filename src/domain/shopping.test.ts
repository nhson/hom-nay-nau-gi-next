import { describe, expect, it } from "vitest";
import { buildShoppingList, normalizeIngredientKey, pruneTicks, setTick } from "./shopping";
import { dish } from "./testing";

describe("normalizeIngredientKey", () => {
  it("ignores case and surrounding or repeated whitespace", () => {
    expect(normalizeIngredientKey("  Thịt   Ba Chỉ ")).toBe("thịt ba chỉ");
  });

  it("treats composed and decomposed Vietnamese accents as the same key", () => {
    const composed = "tỏi".normalize("NFC");
    const decomposed = "tỏi".normalize("NFD");
    expect(composed).not.toBe(decomposed);
    expect(normalizeIngredientKey(decomposed)).toBe(normalizeIngredientKey(composed));
  });
});

describe("buildShoppingList", () => {
  const rau = dish({ id: "x1", name: "Rau luộc", ingredients: ["rau muống", "muối"] });
  const canh = dish({ id: "c1", name: "Canh rau", ingredients: ["Rau Muống", "hành lá"] });

  it("merges identical ingredients and lists every dish that needs them", () => {
    const items = buildShoppingList([rau, canh]);
    expect(items.map((item) => item.key)).toEqual(["rau muống", "muối", "hành lá"]);
    expect(items[0]).toMatchObject({ label: "rau muống", dishNames: ["Rau luộc", "Canh rau"] });
  });

  it("does not repeat a dish name when it lists an ingredient twice", () => {
    const twice = dish({ name: "Món", ingredients: ["muối", " Muối "] });
    expect(buildShoppingList([twice])[0].dishNames).toEqual(["Món"]);
  });

  it("skips blank ingredient names", () => {
    expect(buildShoppingList([dish({ ingredients: ["", "  ", "tỏi"] })]).map((i) => i.key)).toEqual(["tỏi"]);
  });

  it("marks ticked ingredients", () => {
    const items = buildShoppingList([rau], { "rau muống": true });
    expect(items.map((item) => item.checked)).toEqual([true, false]);
  });

  it("is empty for no dishes", () => {
    expect(buildShoppingList([])).toEqual([]);
  });
});

describe("ticks", () => {
  it("setTick adds and removes without mutating the input", () => {
    const base = { a: true };
    const added = setTick(base, "b", true);
    expect(added).toEqual({ a: true, b: true });
    expect(setTick(added, "a", false)).toEqual({ b: true });
    expect(base).toEqual({ a: true });
  });

  it("pruneTicks keeps only ticks for ingredients still on the list", () => {
    const items = buildShoppingList([dish({ ingredients: ["muối", "tỏi"] })]);
    expect(pruneTicks({ muối: true, "rau muống": true }, items)).toEqual({ muối: true });
  });
});
