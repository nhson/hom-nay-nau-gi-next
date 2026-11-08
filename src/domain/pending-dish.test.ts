import { describe, expect, it } from "vitest";
import { validateDish } from "./dish-rules";
import { pendingWarnings, readRecipeReply } from "./pending-dish";
import { dish } from "./testing";

// A Món chờ duyệt starts as whatever the AI model answered. These tests pin what that answer turns into.

const canhChua = {
  isRecipe: true,
  readable: true,
  name: "Canh chua cá lóc",
  mealType: "buacom",
  category: "canh",
  chay: false,
  region: "nam",
  time: 30,
  ingredients: ["Cá lóc 400g", "Cà chua 2 quả"],
  steps: ["Sơ chế cá", "Nấu nước me"],
};

describe("reading the model's reply", () => {
  it("turns a well-formed recipe into a dish draft", () => {
    expect(readRecipeReply(canhChua)).toEqual({
      ok: true,
      draft: {
        name: "Canh chua cá lóc",
        mealType: "buacom",
        category: "canh",
        chay: false,
        region: "nam",
        time: 30,
        ingredients: ["Cá lóc 400g", "Cà chua 2 quả"],
        steps: ["Sơ chế cá", "Nấu nước me"],
      },
    });
  });

  it("reads the reply when the model sends it as JSON text, with or without a code fence", () => {
    const fenced = "Đây là công thức:\n```json\n" + JSON.stringify(canhChua) + "\n```";
    expect(readRecipeReply(JSON.stringify(canhChua))).toMatchObject({ ok: true, draft: { name: "Canh chua cá lóc" } });
    expect(readRecipeReply(fenced)).toMatchObject({ ok: true, draft: { name: "Canh chua cá lóc" } });
  });

  it("says when the photo is not a recipe", () => {
    expect(readRecipeReply({ isRecipe: false, readable: true })).toEqual({ ok: false, reason: "not_a_recipe" });
  });

  it("says when the photo could not be read", () => {
    expect(readRecipeReply({ isRecipe: true, readable: false })).toEqual({ ok: false, reason: "unreadable" });
  });

  it("rejects an answer that is not a recipe object at all", () => {
    for (const garbage of [null, 42, "xin lỗi, tôi không giúp được", "{ not json", [canhChua]]) {
      expect(readRecipeReply(garbage)).toEqual({ ok: false, reason: "invalid_shape" });
    }
  });

  it("rejects a recipe with neither ingredients nor steps", () => {
    expect(readRecipeReply({ ...canhChua, ingredients: [], steps: [] })).toEqual({ ok: false, reason: "invalid_shape" });
    expect(readRecipeReply({ ...canhChua, ingredients: undefined, steps: undefined })).toEqual({ ok: false, reason: "invalid_shape" });
  });
});

describe("repairing what models commonly get wrong", () => {
  const read = (patch: Record<string, unknown>) => {
    const result = readRecipeReply({ ...canhChua, ...patch });
    if (!result.ok) throw new Error(`rejected: ${result.reason}`);
    return result.draft;
  };

  it("reads a cooking time written as text", () => {
    expect(read({ time: "45" }).time).toBe(45);
    expect(read({ time: "45 phút" }).time).toBe(45);
    expect(read({ time: "1 giờ 30 phút" }).time).toBe(90);
    expect(read({ time: "2 tiếng" }).time).toBe(120);
    expect(read({ time: 12.6 }).time).toBe(13);
  });

  it("leaves the time empty when there is no usable time", () => {
    expect(read({ time: "vừa chín tới" }).time).toBeNull();
    expect(read({ time: 0 }).time).toBeNull();
    expect(read({ time: -5 }).time).toBeNull();
    expect(read({ time: undefined }).time).toBeNull();
  });

  it("splits ingredients and steps that arrive as one block of text", () => {
    const draft = read({ ingredients: "Cá lóc 400g\nCà chua 2 quả\n\n", steps: "Sơ chế cá\nNấu nước me" });
    expect(draft.ingredients).toEqual(["Cá lóc 400g", "Cà chua 2 quả"]);
    expect(draft.steps).toEqual(["Sơ chế cá", "Nấu nước me"]);
  });

  it("drops list bullets and step numbers, since the app numbers steps itself", () => {
    const draft = read({ ingredients: ["- Cá lóc 400g", "• Cà chua 2 quả", "* Me"], steps: ["1. Sơ chế cá", "Bước 2: Nấu nước me", "3) Nêm nếm"] });
    expect(draft.ingredients).toEqual(["Cá lóc 400g", "Cà chua 2 quả", "Me"]);
    expect(draft.steps).toEqual(["Sơ chế cá", "Nấu nước me", "Nêm nếm"]);
  });

  it("keeps a number that is part of an ingredient amount", () => {
    expect(read({ ingredients: ["2 quả cà chua", "300g rau muống"] }).ingredients).toEqual(["2 quả cà chua", "300g rau muống"]);
  });

  it("gives a Bữa 1 món no Nhóm món, even when the model sent one", () => {
    const draft = read({ mealType: "buatomonuoc", category: "canh" });
    expect(draft.mealType).toBe("buatomonuoc");
    expect(draft.category).toBeNull();
  });

  it("treats a dish with a Nhóm món but no Kiểu bữa ăn as Bữa cơm 3 món", () => {
    expect(read({ mealType: undefined, category: "man" })).toMatchObject({ mealType: "buacom", category: "man" });
  });

  it("drops values that are not in the lists the app knows", () => {
    expect(read({ category: "lẩu", region: "tay-nguyen" })).toMatchObject({ category: null, region: null });
  });

  it("reads yes/no written as text", () => {
    expect(read({ chay: "true" }).chay).toBe(true);
    expect(read({ chay: "false" }).chay).toBe(false);
  });

  it("trims the name", () => {
    expect(read({ name: "  Canh chua cá lóc \n" }).name).toBe("Canh chua cá lóc");
    expect(read({ name: undefined }).name).toBe("");
  });

  it("produces a draft the dish form judges the same way: a chay dish with tỏi cannot be approved", () => {
    const draft = read({ chay: true, ingredients: ["Đậu hũ", "Tỏi băm"] });
    expect(validateDish(draft, [])).toContainEqual({ code: "chay-toi", field: "ingredients", index: 1 });
  });
});

describe("warnings on a Món chờ duyệt", () => {
  const catalog = [
    dish({ id: "c3", name: "Canh chua cá lóc" }),
    dish({ id: "m5", name: "Cá kho tộ" }),
    dish({ id: "c9", name: "Canh bí đỏ nấu tôm", retired: true }),
    dish({ id: "t2", name: "Phở bò", mealType: "buatomonuoc", category: null }),
  ];
  const proposal = (name: string, extra: Partial<{ chay: boolean; ingredients: string[]; steps: string[] }> = {}) => ({
    name,
    chay: false,
    ingredients: ["a"],
    steps: ["b"],
    ...extra,
  });

  it("has none for a new dish", () => {
    expect(pendingWarnings(proposal("Gà kho gừng"), catalog, [])).toEqual([]);
  });

  it("warns about a dish with the same name, ignoring case, accents and spaces", () => {
    expect(pendingWarnings(proposal("canh chua  ca loc"), catalog, [])).toEqual([
      { code: "possible-duplicate", of: "dish", id: "c3", name: "Canh chua cá lóc", hidden: false },
    ]);
  });

  it("warns about a near match such as a typo or one extra word", () => {
    expect(pendingWarnings(proposal("Canh chua cá lốc"), catalog, [])).toMatchObject([{ id: "c3" }]);
    expect(pendingWarnings(proposal("Phở bò Hà Nội"), catalog, [])).toMatchObject([{ id: "t2" }]);
    expect(pendingWarnings(proposal("Cá kho"), catalog, [])).toMatchObject([{ id: "m5" }]);
  });

  it("does not warn about different dishes that only share a word", () => {
    expect(pendingWarnings(proposal("Canh chua tôm"), catalog, [])).toEqual([]);
    expect(pendingWarnings(proposal("Cá chiên"), catalog, [])).toEqual([]);
    expect(pendingWarnings(proposal("Canh"), catalog, [])).toEqual([]);
  });

  it("warns about a hidden dish too, and says it is hidden", () => {
    expect(pendingWarnings(proposal("Canh bí đỏ nấu tôm"), catalog, [])).toEqual([
      { code: "possible-duplicate", of: "dish", id: "c9", name: "Canh bí đỏ nấu tôm", hidden: true },
    ]);
  });

  it("warns about another Món chờ duyệt with the same name, but not about itself", () => {
    const pending = [
      { id: "p1", name: "Gà kho gừng" },
      { id: "p2", name: "Gà kho gừng" },
    ];
    expect(pendingWarnings(proposal("Gà kho gừng"), catalog, pending, "p1")).toEqual([
      { code: "possible-duplicate", of: "pending", id: "p2", name: "Gà kho gừng", hidden: false },
    ]);
  });

  it("does not compare a proposal without a name", () => {
    expect(pendingWarnings(proposal(""), catalog, [{ id: "p2", name: "" }])).toEqual([]);
  });

  it("warns when a chay dish mentions tỏi anywhere", () => {
    expect(pendingWarnings(proposal("Đậu hũ sốt nấm", { chay: true, steps: ["Phi tỏi thơm"] }), catalog, [])).toEqual([
      { code: "chay-toi" },
    ]);
    expect(pendingWarnings(proposal("Đậu hũ sốt nấm", { chay: false, steps: ["Phi tỏi thơm"] }), catalog, [])).toEqual([]);
    expect(pendingWarnings(proposal("Đậu hũ sốt nấm", { chay: true, steps: ["Nấu buổi tối"] }), catalog, [])).toEqual([]);
  });
});
