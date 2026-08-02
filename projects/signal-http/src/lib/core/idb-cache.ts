import { InjectionToken } from '@angular/core';
import { CacheEntry } from './http-cache.service';

export interface IdbCacheOptions {
  /** IDB database name. Defaults to `'ng-signal-http-cache'`. */
  dbName?: string;
  /** IDB object store name. Defaults to `'cache'`. */
  storeName?: string;
}

export const IDB_CACHE_ADAPTER = new InjectionToken<IdbCacheAdapter | null>(
  'IDB_CACHE_ADAPTER'
);

/**
 * Thin async wrapper around the IndexedDB API.
 * All write operations fail silently — in-memory cache always works even if IDB is unavailable.
 */
export class IdbCacheAdapter {
  private readonly dbName: string;
  private readonly storeName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(options?: IdbCacheOptions) {
    this.dbName = options?.dbName ?? 'ng-signal-http-cache';
    this.storeName = options?.storeName ?? 'cache';
  }

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(this.storeName)) {
          req.result.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        this.dbPromise = null;
        reject(req.error);
      };
    });
    return this.dbPromise;
  }

  private idbRequest<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(): Promise<Array<[string, CacheEntry]>> {
    try {
      const db = await this.open();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const [keys, values] = await Promise.all([
        this.idbRequest<IDBValidKey[]>(store.getAllKeys()),
        this.idbRequest<CacheEntry[]>(store.getAll()),
      ]);
      return (keys as string[]).map((k, i) => [k, values[i]]);
    } catch {
      return [];
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      const db = await this.open();
      const store = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName);
      await this.idbRequest(store.put(entry, key));
    } catch { /* silently fail */ }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await this.open();
      const store = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName);
      await this.idbRequest(store.delete(key));
    } catch { /* silently fail */ }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.open();
      const store = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName);
      await this.idbRequest(store.clear());
    } catch { /* silently fail */ }
  }
}
