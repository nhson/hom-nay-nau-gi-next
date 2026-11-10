import { describe, expect, it } from "vitest";
import { dishFileTemplate, readDishFile } from "./dish-file";
import { bowl, dish } from "./testing";

// Nhập từ file (spec #41): a JSON file of dishes becomes Món chờ duyệt. These tests pin what a file turns into.

const read = (value: unknown, knownNames: string[] = []) => readDishFile(JSON.stringify(value), knownNames);

const canhChua = {
  name: "Canh chua cá lóc",
  mealType: "buacom",
  category: "canh",
  chay: false,
  region: "nam",
  time: 30,
  ingredients: ["Cá lóc 400g", "Cà chua 2 quả"],
  steps: ["Sơ chế cá", "Nấu nước me"],
};

const canhChuaDraft = {
  name: "Canh chua cá lóc",
  mealType: "buacom",
  category: "canh",
  chay: false,
  region: "nam",
  time: 30,
  ingredients: ["Cá lóc 400g", "Cà chua 2 quả"],
  steps: ["Sơ chế cá", "Nấu nước me"],
};

describe("the shape of the file", () => {
  it("reads a file in the Xuất JSON shape, ignoring version and the dishes' extra fields", () => {
    const result = read({ version: 7, dishes: [{ ...canhChua, id: "c9", retired: true, updatedAt: "x" }] });
    expect(result).toEqual({ ok: true, add: [{ row: 1, draft: canhChuaDraft, warnings: [] }], skipped: [] });
  });

  it("reads a bare list of dishes", () => {
    expect(read([canhChua])).toEqual({ ok: true, add: [{ row: 1, draft: canhChuaDraft, warnings: [] }], skipped: [] });
  });

  it("refuses text that is not JSON", () => {
    expect(readDishFile("{ dishes: [", [])).toEqual({ ok: false, refusal: "not_json" });
  });

  it("refuses JSON without a list of dishes", () => {
    expect(read({ version: 3 })).toEqual({ ok: false, refusal: "no_dishes" });
    expect(read({ dishes: "Canh chua" })).toEqual({ ok: false, refusal: "no_dishes" });
    expect(read("Canh chua")).toEqual({ ok: false, refusal: "no_dishes" });
    expect(read([])).toEqual({ ok: false, refusal: "no_dishes" });
  });

  it("refuses more than 200 dishes", () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ ...canhChua, name: `Món số ${i}` }));
    expect(read(many)).toEqual({ ok: false, refusal: "too_many" });
    expect(read(many.slice(0, 200))).toMatchObject({ ok: true });
  });
});

const first = (value: unknown, knownNames: string[] = []) => {
  const result = read([value], knownNames);
  if (!result.ok || result.add.length !== 1) throw new Error(`expected one dish to add: ${JSON.stringify(result)}`);
  return result.add[0];
};

describe("the values of a dish", () => {
  it("accepts Vietnamese words for Kiểu bữa ăn, Nhóm món and Vùng miền, with or without accents", () => {
    expect(first({ ...canhChua, mealType: "Bữa cơm 3 món", category: "Canh", region: "Miền Nam" }).draft).toEqual(canhChuaDraft);
    expect(first({ ...canhChua, mealType: "bua com", category: "mon canh", region: "mien nam" }).draft).toEqual(canhChuaDraft);
    expect(first({ ...canhChua, category: "Món xào", region: "Bắc" }).draft).toMatchObject({ category: "xao", region: "bac" });
    expect(first({ ...canhChua, category: "MẶN", region: "Miền Trung" }).draft).toMatchObject({ category: "man", region: "trung" });
  });

  it("reads a Bữa 1 món by code or words, and drops its Nhóm món", () => {
    expect(first({ ...canhChua, name: "Phở bò", mealType: "Bữa 1 món", category: "canh" })).toEqual({
      row: 1,
      draft: { ...canhChuaDraft, name: "Phở bò", mealType: "buatomonuoc", category: null },
      warnings: [],
    });
    expect(first({ ...canhChua, name: "Phở bò", mealType: "buatomonuoc", category: null }).draft.mealType).toBe("buatomonuoc");
  });

  it("accepts true/false and yes/no words for chay", () => {
    for (const yes of [true, "có", "Co", "yes", "true", "chay", "x", 1]) {
      expect(first({ ...canhChua, chay: yes }).draft.chay).toBe(true);
    }
    for (const no of [false, "không", "khong", "no", "false", "", 0]) {
      expect(first({ ...canhChua, chay: no }).draft.chay).toBe(false);
    }
  });

  it("accepts the time as minutes, a number in text, or text with phút/giờ", () => {
    expect(first({ ...canhChua, time: 45 }).draft.time).toBe(45);
    expect(first({ ...canhChua, time: "45" }).draft.time).toBe(45);
    expect(first({ ...canhChua, time: "1 giờ 30 phút" }).draft.time).toBe(90);
  });

  it("accepts ingredients and steps as a list or as text with one item per line", () => {
    const dish = first({ ...canhChua, ingredients: "Cá lóc 400g\n\n- Cà chua 2 quả\n", steps: "1. Sơ chế cá\r\n2. Nấu nước me" });
    expect(dish.draft).toEqual(canhChuaDraft);
    expect(dish.warnings).toEqual([]);
  });

  it("trims the name and cuts it at 60 characters, with a warning", () => {
    expect(first({ ...canhChua, name: "  Canh chua cá lóc  " }).draft.name).toBe("Canh chua cá lóc");
    const long = first({ ...canhChua, name: `Canh chua ${"rất ".repeat(20)}ngon` });
    expect(long.draft.name).toHaveLength(60);
    expect(long.warnings).toEqual([{ code: "name-cut" }]);
  });

  it("leaves a value it does not recognise blank, with a warning naming the field", () => {
    const dish = first({ ...canhChua, mealType: "bữa sáng", category: "lẩu", region: "Tây Nguyên", chay: "maybe", time: "lâu lắm" });
    expect(dish.draft).toEqual({ ...canhChuaDraft, mealType: "buacom", category: null, region: null, chay: false, time: null });
    expect(dish.warnings).toEqual([
      { code: "unrecognised", field: "mealType" },
      { code: "unrecognised", field: "category" },
      { code: "unrecognised", field: "chay" },
      { code: "unrecognised", field: "region" },
      { code: "unrecognised", field: "time" },
    ]);
  });

  it("only needs a name: what Duyệt will need is listed as missing", () => {
    expect(first({ name: "Canh chua cá lóc" })).toEqual({
      row: 1,
      draft: { name: "Canh chua cá lóc", mealType: "buacom", category: null, chay: false, region: null, time: null, ingredients: [], steps: [] },
      warnings: [
        { code: "missing", field: "mealType" },
        { code: "missing", field: "category" },
        { code: "missing", field: "ingredients" },
        { code: "missing", field: "steps" },
      ],
    });
  });

  it("does not ask for a Nhóm món on a Bữa 1 món, nor for the optional region, time and chay", () => {
    expect(first({ name: "Phở bò", mealType: "Bữa 1 món", ingredients: ["Bánh phở"], steps: ["Nấu"] }).warnings).toEqual([]);
    expect(first({ ...canhChua, region: null, time: null, chay: null }).warnings).toEqual([]);
  });

  it("calls a list of lines that are not text unrecognised", () => {
    expect(first({ ...canhChua, ingredients: { a: 1 } }).warnings).toEqual([{ code: "unrecognised", field: "ingredients" }]);
  });
});

describe("what is skipped and what is flagged", () => {
  it("skips a row without a name, giving its position", () => {
    expect(read([canhChua, { mealType: "buacom" }, "Phở", { name: "   " }])).toEqual({
      ok: true,
      add: [{ row: 1, draft: canhChuaDraft, warnings: [] }],
      skipped: [
        { row: 2, reason: "no_name" },
        { row: 3, reason: "no_name" },
        { row: 4, reason: "no_name" },
      ],
    });
  });

  it("skips a dish whose name is already in the Danh mục món or on Chờ duyệt, ignoring case, accents and spacing", () => {
    // Known names include hidden dishes: the caller passes them all.
    const result = read([canhChua, { ...canhChua, name: "Thịt kho trứng" }], ["CANH  CHUA ca loc", "Rau muống xào"]);
    expect(result).toMatchObject({
      ok: true,
      add: [{ row: 2, draft: { name: "Thịt kho trứng" } }],
      skipped: [{ row: 1, name: "Canh chua cá lóc", reason: "duplicate" }],
    });
  });

  it("adds only the first of two rows with the same name", () => {
    const result = read([canhChua, { ...canhChua, name: "canh chua cá lóc", time: 99 }]);
    expect(result).toEqual({
      ok: true,
      add: [{ row: 1, draft: canhChuaDraft, warnings: [] }],
      skipped: [{ row: 2, name: "canh chua cá lóc", reason: "repeated_in_file" }],
    });
  });

  it("warns about a chay dish that uses tỏi, as Chờ duyệt does", () => {
    expect(first({ ...canhChua, chay: "có", steps: ["Phi tỏi thơm"] }).warnings).toEqual([{ code: "chay-toi" }]);
    expect(first({ ...canhChua, chay: false, steps: ["Phi tỏi thơm"] }).warnings).toEqual([]);
  });

  it("adds a near match with a possible-duplicate warning naming the dish it looks like", () => {
    const fromCatalog = first({ ...canhChua, name: "Canh chua cá lóc miền Tây" }, ["Canh chua cá lóc"]);
    expect(fromCatalog.warnings).toEqual([{ code: "possible-duplicate", name: "Canh chua cá lóc" }]);

    const result = read([canhChua, { ...canhChua, name: "Canh chua cá loc ngon" }]);
    expect(result).toMatchObject({ ok: true, add: [{ warnings: [] }, { warnings: [{ code: "possible-duplicate", name: "Canh chua cá lóc" }] }] });
  });
});

describe("the template and a Xuất JSON file", () => {
  it("gives a template with one Bữa cơm 3 món and one Bữa 1 món that reads with no warnings", () => {
    const result = readDishFile(dishFileTemplate(), []);
    expect(result).toMatchObject({ ok: true, skipped: [] });
    if (!result.ok) return;
    expect(result.add.map((item) => [item.draft.mealType, item.warnings])).toEqual([
      ["buacom", []],
      ["buatomonuoc", []],
    ]);
  });

  it("reads a Xuất JSON file back into the same dishes", () => {
    const exported = {
      version: 12,
      dishes: [
        dish({ id: "x3", name: "Rau muống xào tỏi", region: "bac", time: 10, ingredients: ["Rau muống", "Tỏi"], steps: ["Xào"], retired: false }),
        dish({ id: "c2", category: "canh", name: "Canh bí", chay: true, region: null, time: null, ingredients: ["Bí"], steps: ["Nấu"], retired: true }),
        bowl({ id: "t4", name: "Bún bò Huế", region: "trung", time: 120, ingredients: ["Bún", "Bò"], steps: ["Hầm xương", "Nấu"] }),
      ],
    };
    const result = readDishFile(JSON.stringify(exported), []);
    expect(result).toEqual({
      ok: true,
      skipped: [],
      add: exported.dishes.map((d, index) => ({
        row: index + 1,
        draft: { name: d.name, mealType: d.mealType, category: d.category, chay: d.chay, region: d.region, time: d.time, ingredients: d.ingredients, steps: d.steps },
        warnings: [],
      })),
    });
  });
});
