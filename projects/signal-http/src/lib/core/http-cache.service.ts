import { Injectable } from '@angular/core';

export interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

@Injectable({ providedIn: 'root' })
export class HttpCacheService {
  private readonly store = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  get(key: string): CacheEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, data: unknown): void {
    this.store.set(key, { data, fetchedAt: Date.now() });
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
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
}
