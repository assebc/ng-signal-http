import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IdbCacheAdapter } from './idb-cache';
import { CacheEntry } from './http-cache.service';

// Each test gets its own adapter with a unique DB name to avoid cross-test state.
let dbIndex = 0;
const makeAdapter = (storeName?: string) =>
  new IdbCacheAdapter({ dbName: `test-db-${++dbIndex}`, storeName });

describe('IdbCacheAdapter', () => {
  describe('getAll()', () => {
    it('returns an empty array when the store is empty', async () => {
      const adapter = makeAdapter();
      expect(await adapter.getAll()).toEqual([]);
    });

    it('returns all stored entries as [key, CacheEntry] pairs', async () => {
      const adapter = makeAdapter();
      const entry: CacheEntry = { data: { id: 1 }, fetchedAt: 1000 };
      await adapter.set('GET:/users', entry);
      const all = await adapter.getAll();
      expect(all).toHaveLength(1);
      expect(all[0][0]).toBe('GET:/users');
      expect(all[0][1]).toEqual(entry);
    });

    it('returns [] if IDB is unavailable', async () => {
      // Adapter with a name that will fail on open (simulated by closing first then corrupting)
      // We can't easily corrupt IDB in fake-indexeddb, so we test the real error path
      // by temporarily disabling indexedDB.
      const original = (globalThis as Record<string, unknown>)['indexedDB'];
      (globalThis as Record<string, unknown>)['indexedDB'] = undefined;
      const adapter = makeAdapter();
      const result = await adapter.getAll();
      expect(result).toEqual([]);
      (globalThis as Record<string, unknown>)['indexedDB'] = original;
    });
  });

  describe('set() + getAll()', () => {
    it('persists multiple entries', async () => {
      const adapter = makeAdapter();
      await adapter.set('key-a', { data: 'a', fetchedAt: 100 });
      await adapter.set('key-b', { data: 'b', fetchedAt: 200 });
      const all = await adapter.getAll();
      expect(all).toHaveLength(2);
    });

    it('overwrites an existing entry for the same key', async () => {
      const adapter = makeAdapter();
      await adapter.set('key', { data: 'old', fetchedAt: 1 });
      await adapter.set('key', { data: 'new', fetchedAt: 2 });
      const all = await adapter.getAll();
      expect(all).toHaveLength(1);
      expect(all[0][1].data).toBe('new');
    });

    it('does not throw when IDB is unavailable', async () => {
      const original = (globalThis as Record<string, unknown>)['indexedDB'];
      (globalThis as Record<string, unknown>)['indexedDB'] = undefined;
      const adapter = makeAdapter();
      await expect(adapter.set('k', { data: null, fetchedAt: 0 })).resolves.toBeUndefined();
      (globalThis as Record<string, unknown>)['indexedDB'] = original;
    });
  });

  describe('delete()', () => {
    it('removes a specific entry', async () => {
      const adapter = makeAdapter();
      await adapter.set('key-a', { data: 'a', fetchedAt: 1 });
      await adapter.set('key-b', { data: 'b', fetchedAt: 2 });
      await adapter.delete('key-a');
      const all = await adapter.getAll();
      expect(all).toHaveLength(1);
      expect(all[0][0]).toBe('key-b');
    });

    it('is a no-op for a key that does not exist', async () => {
      const adapter = makeAdapter();
      await expect(adapter.delete('missing')).resolves.toBeUndefined();
    });
  });

  describe('clear()', () => {
    it('removes all entries', async () => {
      const adapter = makeAdapter();
      await adapter.set('key-a', { data: 'a', fetchedAt: 1 });
      await adapter.set('key-b', { data: 'b', fetchedAt: 2 });
      await adapter.clear();
      expect(await adapter.getAll()).toEqual([]);
    });
  });

  describe('custom storeName', () => {
    it('uses the configured store name', async () => {
      const adapter = makeAdapter('my-store');
      await adapter.set('k', { data: 42, fetchedAt: 1 });
      expect(await adapter.getAll()).toHaveLength(1);
    });
  });
});
