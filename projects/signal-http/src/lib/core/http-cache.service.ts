import { inject, Injectable } from '@angular/core';
import { IDB_CACHE_ADAPTER } from './idb-cache';

export interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

@Injectable({ providedIn: 'root' })
export class HttpCacheService {
  private readonly store = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly adapter = inject(IDB_CACHE_ADAPTER, { optional: true });

  get(key: string): CacheEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, data: unknown): void {
    const entry: CacheEntry = { data, fetchedAt: Date.now() };
    this.store.set(key, entry);
    void this.adapter?.set(key, entry);
  }

  /** Writes directly to the in-memory store without propagating to the adapter. Used for hydration. */
  restore(key: string, entry: CacheEntry): void {
    this.store.set(key, entry);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): void {
    this.store.delete(key);
    void this.adapter?.delete(key);
  }

  clear(): void {
    this.store.clear();
    void this.adapter?.clear();
  }

  isExpired(key: string, staleTime: number): boolean {
    const entry = this.store.get(key);
    if (!entry) return true;
    return Date.now() - entry.fetchedAt > staleTime;
  }

  // ── In-flight deduplication ─────────────────────────────────────────────

  getInflight(key: string): Promise<unknown> | undefined {
    return this.inflight.get(key);
  }

  setInflight(key: string, promise: Promise<unknown>): void {
    this.inflight.set(key, promise);
  }

  deleteInflight(key: string): void {
    this.inflight.delete(key);
  }

  // ── Inspection ─────────────────────────────────────────────────────────────

  entries(): Array<[string, CacheEntry]> {
    return Array.from(this.store.entries());
  }
}
