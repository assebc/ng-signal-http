import { TestBed } from '@angular/core/testing';
import { HttpCacheService } from './http-cache.service';

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
