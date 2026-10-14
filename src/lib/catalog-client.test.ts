import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOG, refreshCatalog, type CachedCatalog } from "./catalog-client";

const dish = {
  id: "x1",
  mealType: "buacom",
  category: "xao",
  chay: false,
  region: null,
  name: "Rau muống xào tỏi",
  time: 10,
  ingredients: ["rau muống"],
  steps: ["Xào"],
};

const current: CachedCatalog = { version: 3, etag: '"catalog-v3"', dishes: [] };

function fakeFetch(response: Response | Error): typeof fetch {
  return (async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as typeof fetch;
}

describe("refreshCatalog", () => {
  it("returns the new catalog with its ETag when the server has a newer version", async () => {
    const response = Response.json({ version: 4, dishes: [dish] }, { headers: { ETag: '"catalog-v4"' } });
    const result = await refreshCatalog(current, fakeFetch(response));
    expect(result).toMatchObject({ status: "updated", catalog: { version: 4, etag: '"catalog-v4"' } });
  });

  it("sends the cached ETag and treats 304 as unchanged", async () => {
    let sent: HeadersInit | undefined;
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent = init?.headers;
      return new Response(null, { status: 304 });
    }) as typeof fetch;
    expect(await refreshCatalog(current, fetchImpl)).toEqual({ status: "unchanged" });
    expect(sent).toEqual({ "If-None-Match": '"catalog-v3"' });
  });

  it.each([
    ["network error", new Error("offline")],
    ["server error", new Response("{}", { status: 503 })],
    ["invalid payload", Response.json({ version: 4, dishes: [{ id: "x" }] })],
    ["empty catalog", Response.json({ version: 4, dishes: [] })],
    ["older version", Response.json({ version: 2, dishes: [dish] })],
    ["not json", new Response("<html>", { status: 200 })],
  ])("fails quietly on %s", async (_name, response) => {
    expect(await refreshCatalog(current, fakeFetch(response))).toEqual({ status: "failed" });
  });
});

describe("BUNDLED_CATALOG", () => {
  it("is the full bundled seed, usable with no network", () => {
    expect(BUNDLED_CATALOG.dishes).toHaveLength(73);
    expect(BUNDLED_CATALOG.etag).toBeNull();
  });
});
