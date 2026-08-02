import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HttpCacheService } from './http-cache.service';
import { IDB_CACHE_ADAPTER } from './idb-cache';

describe('HttpCacheService', () => {
  let cache: HttpCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    cache = TestBed.inject(HttpCacheService);
  });

  afterEach(() => TestBed.resetTestingModule());

  // ─── get / set / has / delete / clear ──────────────────────────────────────

  it('get() returns undefined for a missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('set() stores data and get() returns it', () => {
    cache.set('key', { value: 42 });
    expect(cache.get('key')?.data).toEqual({ value: 42 });
  });

  it('set() stamps fetchedAt with the current time', () => {
    const before = Date.now();
    cache.set('key', {});
    const after = Date.now();
    const fetchedAt = cache.get('key')?.fetchedAt ?? 0;
    expect(fetchedAt).toBeGreaterThanOrEqual(before);
    expect(fetchedAt).toBeLessThanOrEqual(after);
  });

  it('has() returns false for a missing key', () => {
    expect(cache.has('missing')).toBe(false);
  });

  it('has() returns true after set()', () => {
    cache.set('key', {});
    expect(cache.has('key')).toBe(true);
  });

  it('delete() removes the entry', () => {
    cache.set('key', {});
    cache.delete('key');
    expect(cache.has('key')).toBe(false);
  });

  it('clear() removes all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
  });

  // ─── inflight deduplication ────────────────────────────────────────────────

  it('getInflight() returns undefined for a missing key', () => {
    expect(cache.getInflight('missing')).toBeUndefined();
  });

  it('setInflight() stores a promise and getInflight() returns it', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const p = new Promise<unknown>(() => {});
    cache.setInflight('key', p);
    expect(cache.getInflight('key')).toBe(p);
  });

  it('deleteInflight() removes the promise', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    cache.setInflight('key', new Promise(() => {}));
    cache.deleteInflight('key');
    expect(cache.getInflight('key')).toBeUndefined();
  });

  // ─── entries() ─────────────────────────────────────────────────────────────

  it('entries() returns all stored [key, entry] pairs', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    const keys = cache.entries().map(([k]) => k).sort();
    expect(keys).toEqual(['a', 'b']);
  });

  // ─── restore() ─────────────────────────────────────────────────────────────

  it('restore() stores an entry in-memory', () => {
    cache.restore('key', { data: 'hydrated', fetchedAt: 999 });
    expect(cache.get('key')?.data).toBe('hydrated');
  });

  // ─── adapter write-through ─────────────────────────────────────────────────

  describe('with an IdbCacheAdapter', () => {
    let adapter: { set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      adapter = {
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: IDB_CACHE_ADAPTER, useValue: adapter }],
      });
      cache = TestBed.inject(HttpCacheService);
    });

    it('set() forwards the entry to the adapter', async () => {
      cache.set('key', { id: 1 });
      await Promise.resolve(); // let the void promise settle
      expect(adapter.set).toHaveBeenCalledOnce();
      const [key, entry] = adapter.set.mock.calls[0] as [string, { data: unknown }];
      expect(key).toBe('key');
      expect(entry.data).toEqual({ id: 1 });
    });

    it('delete() forwards the key to the adapter', async () => {
      cache.set('key', {});
      cache.delete('key');
      await Promise.resolve();
      expect(adapter.delete).toHaveBeenCalledWith('key');
    });

    it('clear() calls adapter.clear()', async () => {
      cache.set('a', 1);
      cache.clear();
      await Promise.resolve();
      expect(adapter.clear).toHaveBeenCalledOnce();
    });

    it('restore() does NOT call adapter.set()', async () => {
      cache.restore('key', { data: 'x', fetchedAt: 1 });
      await Promise.resolve();
      expect(adapter.set).not.toHaveBeenCalled();
    });
  });

  // ─── isExpired ──────────────────────────────────────────────────────────────

  describe('isExpired()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
    });
    afterEach(() => vi.useRealTimers());

    it('returns true for a missing key', () => {
      expect(cache.isExpired('missing', 5_000)).toBe(true);
    });

    it('returns false when within staleTime', () => {
      cache.set('key', {});        // fetchedAt = 0
      vi.setSystemTime(3_000);     // 3s elapsed, staleTime = 5s
      expect(cache.isExpired('key', 5_000)).toBe(false);
    });

    it('returns false at exactly the staleTime boundary', () => {
      cache.set('key', {});        // fetchedAt = 0
      vi.setSystemTime(5_000);     // exactly 5s elapsed
      expect(cache.isExpired('key', 5_000)).toBe(false);
    });

    it('returns true when beyond staleTime', () => {
      cache.set('key', {});        // fetchedAt = 0
      vi.setSystemTime(5_001);     // 1ms past staleTime
      expect(cache.isExpired('key', 5_000)).toBe(true);
    });
  });
});
