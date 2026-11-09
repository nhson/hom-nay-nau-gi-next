import { describe, expect, it } from "vitest";
import {
  AGENT_SETTINGS_DEFAULTS,
  checkAgentSettings,
  chooseCandidates,
  listingLinks,
  MAX_FAILURES,
  PAGE_TEXT_MAX,
  pageText,
  RECIPE_SOURCES,
  rankByGaps,
  robotsAllow,
  runGate,
  runReasons,
  runStatus,
  sitemapLocations,
  slugWords,
} from "./collector";
import { bowl, dish } from "./testing";

// The Tác nhân thu thập (spec #31, ADR-0007): what it may read, what it picks, and what it records.
// Plain strings and values in, decisions out: no network, no model, no database.

const AGENT = "HomNayNauGiBot";

describe("robots.txt", () => {
  it("allows everything when there is no file or no rule for us", () => {
    expect(robotsAllow(null, AGENT, "/canh-chua/")).toBe(true);
    expect(robotsAllow("", AGENT, "/canh-chua/")).toBe(true);
    expect(robotsAllow("User-agent: Googlebot\nDisallow: /", AGENT, "/canh-chua/")).toBe(true);
  });

  it("follows the * group", () => {
    const robots = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php";
    expect(robotsAllow(robots, AGENT, "/wp-admin/edit.php")).toBe(false);
    expect(robotsAllow(robots, AGENT, "/wp-admin/admin-ajax.php")).toBe(true);
    expect(robotsAllow(robots, AGENT, "/canh-chua/")).toBe(true);
  });

  it("lets the longest matching rule win, and supports * and $ in paths", () => {
    const robots = "User-agent: *\nDisallow: /*/recipes/*/print\nDisallow: /search$\nAllow: /";
    expect(robotsAllow(robots, AGENT, "/vn/recipes/123/print")).toBe(false);
    expect(robotsAllow(robots, AGENT, "/search")).toBe(false);
    expect(robotsAllow(robots, AGENT, "/search/canh")).toBe(true);
  });

  it("uses a group that names us instead of the * group", () => {
    const robots = `User-agent: *\nAllow: /\n\nUser-agent: ${AGENT}\nDisallow: /`;
    expect(robotsAllow(robots, AGENT, "/canh-chua/")).toBe(false);
  });

  it("reads groups that list several agents, and ignores comments and case", () => {
    const robots = "# hi\nuser-agent: GPTBot\nUser-Agent: homnaynaugibot # us\ndisallow: /private/\n";
    expect(robotsAllow(robots, AGENT, "/private/x")).toBe(false);
    expect(robotsAllow(robots, AGENT, "/canh-chua/")).toBe(true);
  });

  it("treats an empty Disallow as allowing everything", () => {
    expect(robotsAllow("User-agent: *\nDisallow:", AGENT, "/canh-chua/")).toBe(true);
  });
});

describe("finding recipe pages", () => {
  it("reads the page addresses out of a sitemap or a sitemap index", () => {
    const index = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://monngonmoingay.com/monan-sitemap1.xml</loc></sitemap>
      <sitemap><loc> https://monngonmoingay.com/page-sitemap.xml </loc></sitemap></sitemapindex>`;
    expect(sitemapLocations(index)).toEqual(["https://monngonmoingay.com/monan-sitemap1.xml", "https://monngonmoingay.com/page-sitemap.xml"]);
    const map = "<urlset><url><loc>https://monngonmoingay.com/canh-chua-ca-loc/</loc><lastmod>2020</lastmod></url><url><loc>https://monngonmoingay.com/ca-kho-to/</loc></url></urlset>";
    expect(sitemapLocations(map)).toEqual(["https://monngonmoingay.com/canh-chua-ca-loc/", "https://monngonmoingay.com/ca-kho-to/"]);
    expect(sitemapLocations("<loc>https://a.vn/x?a=1&amp;b=2</loc>")).toEqual(["https://a.vn/x?a=1&b=2"]);
  });

  it("reads the article links on a listing page that match the source's pattern, once each, made absolute", () => {
    const html = `<a href="https://vnexpress.net/cach-nau-canh-chua-5138434.html">x</a>
      <a href='/thit-kho-tau-5141131.html'>y</a>
      <a href="https://vnexpress.net/cach-nau-canh-chua-5138434.html#box_comment">again</a>
      <a href="https://vnexpress.net/doi-song/cooking">section</a>
      <a href="https://other.vn/mon-ngon-5141131.html">elsewhere</a>`;
    expect(listingLinks(html, "https://vnexpress.net/doi-song/cooking", /^https:\/\/vnexpress\.net\/[a-z0-9-]+-\d{6,}\.html$/)).toEqual([
      "https://vnexpress.net/cach-nau-canh-chua-5138434.html",
      "https://vnexpress.net/thit-kho-tau-5141131.html",
    ]);
  });

  it("reads the words of a page address, which often name the dish", () => {
    expect(slugWords("https://monngonmoingay.com/canh-chua-ca-loc/")).toBe("canh chua ca loc");
    expect(slugWords("https://vnexpress.net/cach-nau-thit-kho-tau-5141131.html")).toBe("cach nau thit kho tau");
  });
});

describe("choosing which pages to read in a run", () => {
  const mmn = (slug: string) => `https://monngonmoingay.com/${slug}/`;
  const vne = (slug: string) => `https://vnexpress.net/${slug}-5100000.html`;
  const keepOrder = () => 0.999; // the shuffle leaves the order as it is

  it("takes pages not read before, alternating sources with the primary first, up to the page limit", () => {
    const result = chooseCandidates({
      sources: [
        { sourceId: "monngonmoingay", urls: [mmn("bo-luc-lac"), mmn("ga-luoc"), mmn("rau-cai-xao")] },
        { sourceId: "vnexpress", urls: [vne("meo-luoc-rau"), vne("thit-kho-tau")] },
      ],
      seen: [],
      knownNames: [],
      pagesPerRun: 4,
      rng: keepOrder,
    });
    expect(result.pick.map((c) => c.url)).toEqual([mmn("bo-luc-lac"), vne("meo-luoc-rau"), mmn("ga-luoc"), vne("thit-kho-tau")]);
    expect(result.pick[0]).toEqual({ sourceId: "monngonmoingay", url: mmn("bo-luc-lac") });
  });

  it("skips pages already read, but tries a failed page again until it failed too often", () => {
    const result = chooseCandidates({
      sources: [{ sourceId: "monngonmoingay", urls: [mmn("bo-luc-lac"), mmn("ga-luoc"), mmn("rau-cai-xao"), mmn("canh-bi")] }],
      seen: [
        { url: mmn("bo-luc-lac"), outcome: "proposed", failures: 0 },
        { url: mmn("ga-luoc"), outcome: "failed", failures: 1 },
        { url: mmn("rau-cai-xao"), outcome: "failed", failures: MAX_FAILURES },
      ],
      knownNames: [],
      pagesPerRun: 10,
      rng: keepOrder,
    });
    expect(result.pick.map((c) => c.url)).toEqual([mmn("ga-luoc"), mmn("canh-bi")]);
  });

  it("skips, without reading, a page whose address already names a dish we have", () => {
    const result = chooseCandidates({
      sources: [{ sourceId: "monngonmoingay", urls: [mmn("canh-chua-ca-loc"), mmn("bo-luc-lac")] }],
      seen: [],
      knownNames: ["Canh chua cá lóc"],
      pagesPerRun: 10,
      rng: keepOrder,
    });
    expect(result.pick.map((c) => c.url)).toEqual([mmn("bo-luc-lac")]);
    expect(result.duplicates).toEqual([{ sourceId: "monngonmoingay", url: mmn("canh-chua-ca-loc") }]);
  });

  it("picks pages in a random order, so a big backlog is not read front to back", () => {
    const urls = [mmn("a-1"), mmn("a-2"), mmn("a-3")];
    const reversed = chooseCandidates({ sources: [{ sourceId: "monngonmoingay", urls }], seen: [], knownNames: [], pagesPerRun: 3, rng: () => 0 });
    expect(reversed.pick.map((c) => c.url)).not.toEqual(urls);
    expect([...reversed.pick.map((c) => c.url)].sort()).toEqual([...urls].sort());
  });
});

describe("preferring dishes that fill gaps in the catalog", () => {
  const catalog = [
    dish({ id: "m1", category: "man", region: "nam" }),
    dish({ id: "m2", category: "man", region: "nam" }),
    dish({ id: "m3", category: "man", region: "nam" }),
    dish({ id: "x1", category: "xao", region: "nam" }),
    dish({ id: "x2", category: "xao", region: "bac" }),
    dish({ id: "c1", category: "canh", region: null }),
    bowl({ id: "t1", region: "bac" }),
    bowl({ id: "t2", region: null }),
    dish({ id: "c9", category: "canh", retired: true }),
  ];
  const draft = (name: string, extra: Partial<{ mealType: "buacom" | "buatomonuoc"; category: "xao" | "canh" | "man" | null; chay: boolean; region: "bac" | "trung" | "nam" | null }>) => ({
    name,
    mealType: "buacom" as const,
    category: "man" as const,
    chay: false,
    region: null,
    ...extra,
  });

  it("keeps the dishes that fill the biggest gaps, up to the number asked for", () => {
    const candidates = [
      draft("Thịt kho", { category: "man" }),
      draft("Canh rau ngót", { category: "canh" }),
      draft("Đậu hũ chiên", { category: "man", chay: true }),
    ];
    expect(rankByGaps(candidates, catalog, 2).map((c) => c.name)).toEqual(["Đậu hũ chiên", "Canh rau ngót"]);
  });

  it("counts a missing Vùng miền as a gap", () => {
    const candidates = [draft("Gà nướng", { category: "man", region: "nam" }), draft("Bò nướng", { category: "man", region: "trung" })];
    expect(rankByGaps(candidates, catalog, 1).map((c) => c.name)).toEqual(["Bò nướng"]);
  });

  it("keeps the original order when dishes fill the same gaps", () => {
    const candidates = [draft("A", { category: "xao" }), draft("B", { category: "xao" })];
    expect(rankByGaps(candidates, catalog, 2).map((c) => c.name)).toEqual(["A", "B"]);
  });

  it("returns nothing when asked for nothing", () => {
    expect(rankByGaps([draft("A", {})], catalog, 0)).toEqual([]);
  });
});

describe("whether a run goes ahead", () => {
  it("runs when dishes are wanted and few are waiting", () => {
    expect(runGate({ dishesPerDay: 3, pauseAt: 15 }, 14)).toEqual({ run: true });
  });

  it("is paused when dishes per day is 0", () => {
    expect(runGate({ dishesPerDay: 0, pauseAt: 15 }, 0)).toEqual({ run: false, reason: "paused" });
  });

  it("skips while too many dishes are waiting for review", () => {
    expect(runGate({ dishesPerDay: 3, pauseAt: 15 }, 15)).toEqual({ run: false, reason: "too_many_waiting" });
  });
});

describe("the agent's settings", () => {
  it("defaults to 3 dishes a day, a pause at 15 waiting, and 10 pages a run", () => {
    expect(AGENT_SETTINGS_DEFAULTS).toEqual({ dishesPerDay: 3, pauseAt: 15, pagesPerRun: 10 });
  });

  it("accepts whole numbers inside the limits", () => {
    expect(checkAgentSettings({ dishesPerDay: 0, pauseAt: 1, pagesPerRun: 20 })).toEqual({ ok: true, settings: { dishesPerDay: 0, pauseAt: 1, pagesPerRun: 20 } });
  });

  it("names each value outside its limits", () => {
    expect(checkAgentSettings({ dishesPerDay: 11, pauseAt: 0, pagesPerRun: 1.5 })).toEqual({ ok: false, fields: ["dishesPerDay", "pauseAt", "pagesPerRun"] });
    expect(checkAgentSettings({ dishesPerDay: -1, pauseAt: 101, pagesPerRun: 21 })).toEqual({ ok: false, fields: ["dishesPerDay", "pauseAt", "pagesPerRun"] });
  });
});

describe("how a run ended", () => {
  const base = { skipped: null, pagesRead: 5, added: 2, errors: 0, stoppedBy: null };

  it("is ok when it read pages and nothing went wrong", () => {
    expect(runStatus(base)).toBe("ok");
    expect(runStatus({ ...base, added: 0 })).toBe("ok");
  });

  it("is skipped when the gate stopped it", () => {
    expect(runStatus({ ...base, skipped: "paused", pagesRead: 0, added: 0 })).toBe("skipped");
  });

  it("is partial when it stopped early or hit errors along the way", () => {
    expect(runStatus({ ...base, stoppedBy: "rate_limited" })).toBe("partial");
    expect(runStatus({ ...base, stoppedBy: "deadline" })).toBe("partial");
    expect(runStatus({ ...base, errors: 1 })).toBe("partial");
  });

  it("failed when it could not read any page", () => {
    expect(runStatus({ ...base, pagesRead: 0, added: 0, errors: 2 })).toBe("failed");
    expect(runStatus({ ...base, pagesRead: 0, added: 0, stoppedBy: "not_configured" })).toBe("failed");
  });
});

describe("the reasons shown for a run", () => {
  it("groups the skip and error entries by what happened and where, in the order they first happened", () => {
    expect(
      runReasons([
        { kind: "skip", reason: "not_a_recipe", sourceId: "monngonmoingay", url: "https://a/1" },
        { kind: "error", reason: "page", sourceId: "vnexpress", url: "https://b/1" },
        { kind: "skip", reason: "not_a_recipe", sourceId: "monngonmoingay", url: "https://a/2" },
        { kind: "skip", reason: "robots", sourceId: "vnexpress" },
        { kind: "skip", reason: "not_a_recipe", sourceId: "vnexpress", url: "https://b/2" },
      ]),
    ).toEqual([
      { kind: "skip", reason: "not_a_recipe", sourceId: "monngonmoingay", count: 2 },
      { kind: "error", reason: "page", sourceId: "vnexpress", count: 1 },
      { kind: "skip", reason: "robots", sourceId: "vnexpress", count: 1 },
      { kind: "skip", reason: "not_a_recipe", sourceId: "vnexpress", count: 1 },
    ]);
  });

  it("has nothing to show for a clean run", () => {
    expect(runReasons([])).toEqual([]);
  });
});

describe("the text of a recipe page sent to the model", () => {
  const html = `<html><head><title>Canh chua cá lóc - Món Ngon Mỗi Ngày</title><style>p{color:red}</style>
    <script>var x = "<p>không phải</p>";</script></head>
    <body><nav><a>Trang chủ</a><a>Món ăn</a></nav><header>Logo</header>
    <h1>Canh chua cá lóc</h1><p>Nguyên liệu:</p><ul><li>Cá lóc 500g</li><li>Me &amp; cà chua</li></ul>
    <p>Bước 1: Sơ chế cá&nbsp;sạch.</p><!-- quảng cáo --><footer>Bản quyền</footer></body></html>`;

  it("keeps the page title and the readable text, without scripts, styles, navigation, header, footer or comments", () => {
    const page = pageText(html);
    expect(page.title).toBe("Canh chua cá lóc - Món Ngon Mỗi Ngày");
    expect(page.text).toContain("Canh chua cá lóc");
    expect(page.text).toContain("Cá lóc 500g");
    expect(page.text).toContain("Me & cà chua");
    expect(page.text).toContain("Sơ chế cá sạch.");
    for (const gone of ["không phải", "color:red", "Trang chủ", "Logo", "Bản quyền", "quảng cáo", "<"]) expect(page.text).not.toContain(gone);
  });

  it("keeps lines apart and caps the length", () => {
    expect(pageText(html).text.split("\n").length).toBeGreaterThan(3);
    const long = `<p>${"Nấu ăn. ".repeat(5000)}</p>`;
    expect(pageText(long).text.length).toBeLessThanOrEqual(PAGE_TEXT_MAX);
  });
});

describe("the Nguồn công thức", () => {
  it("are monngonmoingay.com first, then the vnexpress cooking section (ADR-0007)", () => {
    expect(RECIPE_SOURCES.map((source) => source.id)).toEqual(["monngonmoingay", "vnexpress"]);
  });

  it("recognise their own recipe page addresses and nothing else", () => {
    const [mmn, vne] = RECIPE_SOURCES;
    expect(mmn.articlePattern.test("https://monngonmoingay.com/canh-chua-ca-loc/")).toBe(true);
    expect(mmn.articlePattern.test("https://monngonmoingay.com/tim-kiem/canh/")).toBe(false);
    expect(vne.articlePattern.test("https://vnexpress.net/cach-nau-thit-kho-5141131.html")).toBe(true);
    expect(vne.articlePattern.test("https://vnexpress.net/doi-song/cooking")).toBe(false);
  });
});
