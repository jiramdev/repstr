"use client";

export type OutboxOp =
  | { kind: "create"; clientKey: string; sessionId: string; set: Record<string, unknown> }
  | { kind: "update"; clientKey: string; sessionId: string; entryId: string; set: Record<string, unknown> }
  | { kind: "delete"; clientKey: string; sessionId: string; entryId: string };

type StoredOp = OutboxOp & { id: string; createdAt: number };

const DB_NAME = "repiq-outbox";
const STORE = "ops";

export const OUTBOX_KEY = "repiq:outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

function clientId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueOp(op: OutboxOp) {
  const stored: StoredOp = { ...op, id: clientId(), createdAt: Date.now() };
  await withStore("readwrite", (store) => store.add(stored));
  return stored.id;
}

export async function listOps(): Promise<StoredOp[]> {
  return withStore("readonly", (store) => store.getAll());
}

export async function removeOp(id: string) {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function clearOutbox() {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const request = tx.objectStore(STORE).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function clearOutboxAndStorage() {
  try {
    const drop = indexedDB.deleteDatabase(DB_NAME);
    drop.onerror = () => {};
  } catch {
    // IndexedDB unavailable (private mode): nothing to clear.
  }
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("repiq:")) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
