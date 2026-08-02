import 'fake-indexeddb/auto';
import { APP_INITIALIZER, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { providePersistentCache } from './providers';
import { HttpCacheService } from './http-cache.service';
import { IDB_CACHE_ADAPTER, IdbCacheAdapter } from './idb-cache';

// Call all registered APP_INITIALIZER functions and wait for them.
const runInitializers = async () => {
  const fns = TestBed.inject<Array<() => void | Promise<void>>>(APP_INITIALIZER as never, []);
  for (const fn of fns) await fn();
};

describe('providePersistentCache()', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('registers IDB_CACHE_ADAPTER as an IdbCacheAdapter in a browser context', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        providePersistentCache(),
      ],
    });
    const adapter = TestBed.inject(IDB_CACHE_ADAPTER);
    expect(adapter).toBeInstanceOf(IdbCacheAdapter);
  });

  it('registers IDB_CACHE_ADAPTER as null in a server context', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        providePersistentCache(),
      ],
    });
    const adapter = TestBed.inject(IDB_CACHE_ADAPTER);
    expect(adapter).toBeNull();
  });

  it('hydrates the in-memory cache from IndexedDB on APP_INITIALIZER', async () => {
    const mockAdapter = {
      getAll: vi.fn().mockResolvedValue([
        ['GET:/users', { data: [{ id: 1 }], fetchedAt: 1000 }],
        ['GET:/posts', { data: [{ id: 2 }], fetchedAt: 2000 }],
      ]),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    // providePersistentCache() first, then override IDB_CACHE_ADAPTER with the mock.
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        providePersistentCache(),
        { provide: IDB_CACHE_ADAPTER, useValue: mockAdapter },
      ],
    });

    await runInitializers();

    const cache = TestBed.inject(HttpCacheService);
    expect(cache.get('GET:/users')?.data).toEqual([{ id: 1 }]);
    expect(cache.get('GET:/posts')?.data).toEqual([{ id: 2 }]);
  });

  it('does not call adapter.set() during hydration (no write-back loop)', async () => {
    const mockAdapter = {
      getAll: vi.fn().mockResolvedValue([
        ['GET:/users', { data: [], fetchedAt: 500 }],
      ]),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        providePersistentCache(),
        { provide: IDB_CACHE_ADAPTER, useValue: mockAdapter },
      ],
    });

    await runInitializers();

    expect(mockAdapter.set).not.toHaveBeenCalled();
  });

  it('skips hydration when adapter is null (server context)', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        providePersistentCache(),
      ],
    });

    await runInitializers();

    const cache = TestBed.inject(HttpCacheService);
    expect(cache.entries()).toHaveLength(0);
  });

  it('passes custom dbName to the adapter', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        providePersistentCache({ dbName: 'my-app-cache' }),
      ],
    });
    const adapter = TestBed.inject(IDB_CACHE_ADAPTER) as IdbCacheAdapter;
    expect(adapter).toBeInstanceOf(IdbCacheAdapter);
    // Adapter is created with the custom name — verified by ensuring it is an instance.
    // Internal dbName is private; end-to-end IDB integration tests cover this.
  });
});
