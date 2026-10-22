import { describe, expect, it } from "vitest";
import {
  dishIdPrefix,
  mentionsToi,
  nextDishId,
  normalizeDraft,
  validateDish,
  type DishDraft,
} from "./dish-rules";

function draft(overrides: Partial<DishDraft> = {}): DishDraft {
  return {
    mealType: "buacom",
    category: "xao",
    chay: false,
    region: null,
    name: "Rau muống xào",
    time: 10,
    ingredients: ["Rau muống"],
    steps: ["Xào lửa lớn"],
    ...overrides,
  };
}

describe("mentionsToi", () => {
  it.each([
    ["Tỏi băm 2 tép", true],
    ["tỏi", true],
    ["TỎI BĂM", true],
    ["Phi thơm hành, tỏi rồi cho rau vào", true],
    ["Muối, tỏi.", true],
    // "tối" (evening) and other words that merely contain the letters must not match.
    ["Bữa tối", false],
    ["tối nay", false],
    ["Hành boa-rô", false],
    ["Tỏi tây", true], // leek in some regions, but the word is tỏi: the rule is about the word.
    ["", false],
  ])("%j -> %s", (text, expected) => {
    expect(mentionsToi(text)).toBe(expected);
  });

  it("matches the word however the accent was typed (composed or decomposed)", () => {
    expect(mentionsToi("tỏi")).toBe(true); // t + o + combining hook above + i
  });
});

describe("normalizeDraft", () => {
  it("trims the name and drops blank ingredient and step lines", () => {
    const result = normalizeDraft(
      draft({ name: "  Canh chua  ", ingredients: [" Cá ", "", "  "], steps: ["Nấu", "   "] }),
    );
    expect(result.name).toBe("Canh chua");
    expect(result.ingredients).toEqual(["Cá"]);
    expect(result.steps).toEqual(["Nấu"]);
  });
});

describe("validateDish", () => {
  const others = [
    { id: "x1", name: "Canh chua cá lóc" },
    { id: "x2", name: "Rau muống xào tỏi" },
  ];

  it("accepts a complete dish", () => {
    expect(validateDish(draft(), others)).toEqual([]);
  });

  it("needs a name", () => {
    expect(validateDish(draft({ name: "   " }), others)).toEqual([{ code: "name-required", field: "name" }]);
  });

  it("refuses a name that exists, ignoring case and accents", () => {
    expect(validateDish(draft({ name: "canh CHUA ca loc" }), others)).toEqual([
      { code: "name-duplicate", field: "name" },
    ]);
  });

  it("lets a dish keep its own name when it is edited", () => {
    expect(validateDish(draft({ name: "Canh chua cá lóc" }), others, "x1")).toEqual([]);
  });

  it("needs at least one non-blank ingredient", () => {
    expect(validateDish(draft({ ingredients: ["  ", ""] }), others)).toEqual([
      { code: "ingredients-required", field: "ingredients" },
    ]);
  });

  it("needs a Nhóm món for Bữa cơm 3 món and none for Bữa 1 món", () => {
    expect(validateDish(draft({ category: null }), others)).toEqual([
      { code: "category-required", field: "category" },
    ]);
    expect(validateDish(draft({ mealType: "buatomonuoc", category: "canh" }), others)).toEqual([
      { code: "category-not-allowed", field: "category" },
    ]);
    expect(validateDish(draft({ mealType: "buatomonuoc", category: null }), others)).toEqual([]);
  });

  it("needs a positive whole number of minutes when a time is given", () => {
    expect(validateDish(draft({ time: 0 }), others)).toEqual([{ code: "time-invalid", field: "time" }]);
    expect(validateDish(draft({ time: -5 }), others)).toEqual([{ code: "time-invalid", field: "time" }]);
    expect(validateDish(draft({ time: 2.5 }), others)).toEqual([{ code: "time-invalid", field: "time" }]);
    expect(validateDish(draft({ time: null }), others)).toEqual([]);
  });

  describe("Chay dishes contain no tỏi", () => {
    it("points to the exact ingredient and step that mention it", () => {
      const problems = validateDish(
        draft({
          chay: true,
          ingredients: ["Nấm", "Tỏi băm 2 tép"],
          steps: ["Thái nấm", "Phi thơm tỏi", "Xào"],
        }),
        others,
      );
      expect(problems).toEqual([
        { code: "chay-toi", field: "ingredients", index: 1 },
        { code: "chay-toi", field: "steps", index: 1 },
      ]);
    });

    it("allows tỏi in a dish that is not Chay", () => {
      expect(validateDish(draft({ chay: false, ingredients: ["Tỏi băm"] }), others)).toEqual([]);
    });

    it("does not mistake tối (evening) for tỏi", () => {
      expect(validateDish(draft({ chay: true, steps: ["Món cho bữa tối"] }), others)).toEqual([]);
    });
  });

  it("reports every problem at once", () => {
    const problems = validateDish(draft({ name: "", ingredients: [], chay: true }), others);
    expect(problems.map((p) => p.code)).toEqual(["name-required", "ingredients-required"]);
  });
});

describe("dishIdPrefix", () => {
  it.each([
    [{ mealType: "buacom", category: "xao" }, "x"],
    [{ mealType: "buacom", category: "canh" }, "c"],
    [{ mealType: "buacom", category: "man" }, "m"],
    [{ mealType: "buatomonuoc", category: null }, "t"],
  ] as const)("%j -> %s", (input, prefix) => {
    expect(dishIdPrefix(input)).toBe(prefix);
  });
});

describe("nextDishId", () => {
  it("continues after the highest number for that prefix", () => {
    expect(nextDishId("x", ["x1", "x2", "x10", "c99", "m3"])).toBe("x11");
  });

  it("is not fooled by gaps, order or other prefixes", () => {
    expect(nextDishId("c", ["c3", "c1", "x50"])).toBe("c4");
  });

  it("starts at 1 for a prefix with no dishes yet", () => {
    expect(nextDishId("t", ["x1", "c1"])).toBe("t1");
    expect(nextDishId("m", [])).toBe("m1");
  });

  it("ignores ids that are not prefix + number", () => {
    expect(nextDishId("x", ["xa", "x", "x2b", "x4"])).toBe("x5");
  });
});
