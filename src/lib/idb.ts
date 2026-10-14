// A tiny key-value layer over IndexedDB. Every failure (private mode, quota, blocked, no
// IndexedDB at all) resolves quietly: the app keeps working in memory and simply does not persist.

const DB_NAME = "hom-nay-nau-gi";
const STORE = "kv";

let connection: Promise<IDBDatabase | null> | null = null;

/**
 * One connection is kept open for the life of the page, so a write starts in the same tick as the
 * tap that caused it (opening per write left a window where a quick reload lost the change).
 */
function open(): Promise<IDBDatabase | null> {
  connection ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading or the browser closing the database: reconnect on next use.
        db.onclose = db.onversionchange = () => {
          db.close();
          connection = null;
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return connection;
}

export async function idbGet(key: string): Promise<unknown> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
