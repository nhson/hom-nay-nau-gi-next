import { describe, expect, it } from "vitest";
import { validateDish } from "./dish-rules";
import { checkMenuName, MENU_BATCH_LIMIT, MENU_NAME_LIMIT, namesToAdd, readMenuReply, readWrittenDish, startingTick } from "./menu-photo";
import { dish } from "./testing";

// An Ảnh thực đơn starts as whatever dish names the AI model read off the menu. These tests pin what that turns into.

describe("reading the dish names off a menu", () => {
  it("returns the dish names the model found", () => {
    expect(readMenuReply({ readable: true, dishes: [{ name: "Canh chua cá lóc", kind: "mon" }, { name: "Cá kho tộ", kind: "mon" }] })).toEqual({
      ok: true,
      names: ["Canh chua cá lóc", "Cá kho tộ"],
    });
  });

  it("says when the photo could not be read", () => {
    expect(readMenuReply({ readable: false, dishes: [] })).toEqual({ ok: false, reason: "unreadable" });
    for (const garbage of [null, 42, "xin lỗi", "{ not json", [{ name: "Phở" }]]) {
      expect(readMenuReply(garbage)).toEqual({ ok: false, reason: "unreadable" });
    }
  });

  it("says when the menu has no dish names", () => {
    expect(readMenuReply({ readable: true, dishes: [] })).toEqual({ ok: false, reason: "no_dishes" });
    expect(readMenuReply({ readable: true })).toEqual({ ok: false, reason: "no_dishes" });
    expect(readMenuReply({ readable: true, dishes: [{ name: "  " }, { name: "" }] })).toEqual({ ok: false, reason: "no_dishes" });
  });

  it("leaves out drinks and desserts the model marked as such", () => {
    const reply = {
      readable: true,
      dishes: [
        { name: "Bún bò Huế", kind: "mon" },
        { name: "Trà đá", kind: "do-uong" },
        { name: "Chè ba màu", kind: "trang-mieng" },
        { name: "Rau muống xào" },
      ],
    };
    expect(readMenuReply(reply)).toEqual({ ok: true, names: ["Bún bò Huế", "Rau muống xào"] });
    expect(readMenuReply({ readable: true, dishes: [{ name: "Trà đá", kind: "do-uong" }] })).toEqual({ ok: false, reason: "no_dishes" });
  });

  it("accepts names sent as plain text instead of objects", () => {
    expect(readMenuReply({ readable: true, dishes: ["Phở bò", "Gà luộc"] })).toEqual({ ok: true, names: ["Phở bò", "Gà luộc"] });
    expect(readMenuReply(JSON.stringify({ readable: true, dishes: ["Phở bò"] }))).toEqual({ ok: true, names: ["Phở bò"] });
  });

  it("cleans bullets, numbering and prices off the names", () => {
    const reply = {
      readable: true,
      dishes: ["1. Canh chua cá lóc", "- Cá kho tộ 65k", "• Gà luộc ....... 120.000đ", "3) Rau muống xào tỏi - 35,000 VND", "Đậu hũ sốt cà (45K)"],
    };
    expect(readMenuReply(reply)).toEqual({
      ok: true,
      names: ["Canh chua cá lóc", "Cá kho tộ", "Gà luộc", "Rau muống xào tỏi", "Đậu hũ sốt cà"],
    });
  });

  it("keeps a number that belongs to the dish name", () => {
    expect(readMenuReply({ readable: true, dishes: ["Chè 3 màu", "Gà nướng 5 vị"] })).toEqual({ ok: true, names: ["Chè 3 màu", "Gà nướng 5 vị"] });
  });

  it("merges a name repeated across photos, ignoring case, accents and spaces", () => {
    const reply = { readable: true, dishes: ["Phở bò", "PHỞ BÒ", "pho  bo", "Phở bò tái"] };
    expect(readMenuReply(reply)).toEqual({ ok: true, names: ["Phở bò", "Phở bò tái"] });
  });

  it("drops entries too long to be a dish name and caps a very long menu", () => {
    const long = "Món " + "rất ".repeat(30) + "dài";
    expect(readMenuReply({ readable: true, dishes: [long, "Gà luộc"] })).toEqual({ ok: true, names: ["Gà luộc"] });
    const many = Array.from({ length: 60 }, (_, i) => `Món số ${i + 1}`);
    const result = readMenuReply({ readable: true, dishes: many });
    expect(result.ok && result.names.length).toBe(MENU_NAME_LIMIT);
    expect(result.ok && result.names[0]).toBe("Món số 1");
  });
});

describe("which names start ticked", () => {
  const catalog = [
    dish({ id: "c3", name: "Canh chua cá lóc" }),
    dish({ id: "c9", name: "Canh bí đỏ nấu tôm", retired: true }),
  ];
  const pending = [{ id: "p1", name: "Gà kho gừng" }];

  it("ticks a dish the catalog does not have", () => {
    expect(startingTick("Bò lúc lắc", catalog, pending)).toEqual({ ticked: true, match: null });
  });

  it("unticks a name already in the Danh mục món, exactly or nearly, and says which dish", () => {
    expect(startingTick("Canh chua cá lóc", catalog, pending)).toEqual({
      ticked: false,
      match: { of: "dish", id: "c3", name: "Canh chua cá lóc", hidden: false },
    });
    expect(startingTick("canh chua ca loc", catalog, pending)).toMatchObject({ ticked: false, match: { id: "c3" } });
    expect(startingTick("Canh chua cá lốc", catalog, pending)).toMatchObject({ ticked: false, match: { id: "c3" } });
  });

  it("unticks a name that matches a hidden dish, and says it is hidden", () => {
    expect(startingTick("Canh bí đỏ nấu tôm", catalog, pending)).toEqual({
      ticked: false,
      match: { of: "dish", id: "c9", name: "Canh bí đỏ nấu tôm", hidden: true },
    });
  });

  it("unticks a name already waiting on the Chờ duyệt list", () => {
    expect(startingTick("Gà kho gừng", catalog, pending)).toEqual({
      ticked: false,
      match: { of: "pending", id: "p1", name: "Gà kho gừng", hidden: false },
    });
  });

  it("follows the name as the Quản trị viên edits it", () => {
    expect(startingTick("Canh chua cá lóc", catalog, pending).ticked).toBe(false);
    expect(startingTick("Canh chua tôm", catalog, pending).ticked).toBe(true);
  });

  it("does not tick an empty name", () => {
    expect(startingTick("   ", catalog, pending)).toEqual({ ticked: false, match: null });
  });
});

describe("the recipe the model writes for one name", () => {
  const written = {
    name: "Canh chua cá lóc miền Tây",
    mealType: "buacom",
    category: "canh",
    chay: false,
    region: "nam",
    time: "40 phút",
    ingredients: ["Cá lóc 500g", "Me chua 50g"],
    steps: ["1. Sơ chế cá", "2. Nấu nước me"],
  };

  it("becomes a dish draft that keeps the name the Quản trị viên sent", () => {
    expect(readWrittenDish(written, "Canh chua cá lóc")).toEqual({
      ok: true,
      draft: {
        name: "Canh chua cá lóc",
        mealType: "buacom",
        category: "canh",
        chay: false,
        region: "nam",
        time: 40,
        ingredients: ["Cá lóc 500g", "Me chua 50g"],
        steps: ["Sơ chế cá", "Nấu nước me"],
      },
    });
  });

  it("is rejected when the model sent no usable recipe", () => {
    for (const garbage of [null, "xin lỗi", { name: "Canh chua cá lóc" }, { isRecipe: false }]) {
      expect(readWrittenDish(garbage, "Canh chua cá lóc")).toEqual({ ok: false });
    }
  });

  it("is judged by the dish form like any other dish: chay with tỏi cannot be approved", () => {
    const result = readWrittenDish({ ...written, chay: true, ingredients: ["Đậu hũ", "Tỏi phi"] }, "Đậu hũ sốt cà");
    if (!result.ok) throw new Error("rejected");
    expect(validateDish(result.draft, [])).toContainEqual({ code: "chay-toi", field: "ingredients", index: 1 });
  });
});

describe("a name the Quản trị viên sends to be written", () => {
  it("is trimmed and kept", () => {
    expect(checkMenuName("  Bò lúc lắc ")).toBe("Bò lúc lắc");
  });

  it("is refused when empty or too long to be a dish name", () => {
    expect(checkMenuName("   ")).toBeNull();
    expect(checkMenuName("Món " + "rất ".repeat(30))).toBeNull();
  });
});

describe("adding names to the checklist", () => {
  const row = (name: string, ticked = true) => ({ name, ticked, match: null });

  it("adds new names after the ones already there", () => {
    expect(namesToAdd([row("Bò lúc lắc")], [row("Gà luộc"), row("Rau muống xào")])).toEqual([row("Gà luộc"), row("Rau muống xào")]);
  });

  it("skips a name already on the list, ignoring case, accents and spaces, and repeats among the new ones", () => {
    expect(namesToAdd([row("pho bo")], [row("Phở bò"), row("Gà luộc"), row("GÀ  LUỘC")])).toEqual([row("Gà luộc")]);
  });

  it("keeps a different dish that only starts the same", () => {
    expect(namesToAdd([row("Phở bò")], [row("Phở bò tái")])).toEqual([row("Phở bò tái")]);
  });

  it("keeps whatever else each new row carries", () => {
    expect(namesToAdd([], [{ ...row("Gà luộc"), key: 7 }])).toEqual([{ ...row("Gà luộc"), key: 7 }]);
  });

  it("never ticks more than the batch limit across old and new names", () => {
    const current = Array.from({ length: MENU_BATCH_LIMIT - 1 }, (_, i) => row(`Món ${i + 1}`));
    const added = namesToAdd(current, [row("Món mới A"), row("Món mới B"), row("Món mới C", false)]);
    expect(added).toEqual([row("Món mới A"), row("Món mới B", false), row("Món mới C", false)]);
  });
});

