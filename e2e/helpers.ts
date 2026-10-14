import { expect, type Page } from "@playwright/test";

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
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("hom-nay-nau-gi");
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
  );
}
