import { expect, type Page } from "@playwright/test";

/** Name of the IndexedDB database the app stores its data in (see src/lib/idb.ts). */
const DB_NAME = "hom-nay-nau-gi";

/** Names of the dishes on today's menu, in display order. */
export const menuList = (page: Page) => page.getByRole("list", { name: "Thực đơn hôm nay" });
export const menuNames = (page: Page) => menuList(page).locator("h3");

export async function openToday(page: Page) {
  await page.goto("/");
  await expect(menuNames(page).first()).toBeVisible();
}

/** The dish bank's visible dish count, e.g. 73. */
export async function dishCount(page: Page): Promise<number> {
  const text = await page.getByText(/^\d+ món$/).textContent();
  return Number(text?.replace(" món", ""));
}

/**
 * Waits until the app's pending IndexedDB writes have been committed. Transactions on one store run
 * in order, so an empty write transaction completes only after every earlier one: tests call this
 * before reloading, because a human cannot reload within milliseconds of a tap but a test can.
 */
export async function flushWrites(page: Page) {
  await page.evaluate(
    (name) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("kv", "readwrite");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    DB_NAME,
  );
}

/** Reads the app's whole stored personal state (what a device would hold). */
export async function readPersonal(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction("kv").objectStore("kv").get("personal");
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    DB_NAME,
  );
}

/**
 * Pretends this device already holds `state` from an older version of the app. Opens the app once so
 * the database exists, replaces the stored personal state, then reloads so the app boots from it.
 */
export async function seedDevice(page: Page, state: Record<string, unknown>) {
  await openToday(page);
  await flushWrites(page);
  await page.evaluate(
    ([name, value]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name as string);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(value, "personal");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [DB_NAME, state] as const,
  );
  await page.reload();
}

/** Today's date as the app computes it. Playwright config pins the browser to Asia/Ho_Chi_Minh, so use that zone here too. */
export function localToday(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}
