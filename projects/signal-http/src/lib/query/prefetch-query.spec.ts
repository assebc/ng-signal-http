import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { prefetchQuery } from './prefetch-query';
import { provideSignalHttp } from '../core/providers';
import { HttpCacheService } from '../core/http-cache.service';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('prefetchQuery', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideSignalHttp({ baseUrl: 'https://api.test.com' }),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('makes a GET request for the given URL', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1 }));
    await TestBed.runInInjectionContext(() => prefetchQuery('/items'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/items');
  });

  it('stores the result in HttpCacheService', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1 }));
    await TestBed.runInInjectionContext(() => prefetchQuery('/items'));

    const cache = TestBed.inject(HttpCacheService);
    const entry = cache.get('GET:/items');
    expect(entry).toBeDefined();
    expect(entry?.data).toEqual({ id: 1 });
  });

  it('does NOT fetch when staleTime is set and cache already has a fresh entry', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1 }));

    // Populate cache first.
    await TestBed.runInInjectionContext(() => prefetchQuery('/items', { staleTime: 60_000 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call — cache is fresh, should skip.
    await TestBed.runInInjectionContext(() => prefetchQuery('/items', { staleTime: 60_000 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT fetch when no staleTime is provided and cache already has an entry', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1 }));

    // First call populates cache.
    await TestBed.runInInjectionContext(() => prefetchQuery('/cached-item'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call — entry exists, skip.
    await TestBed.runInInjectionContext(() => prefetchQuery('/cached-item'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('silently swallows errors (does not throw)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failure'));
    await expect(
      TestBed.runInInjectionContext(() => prefetchQuery('/broken'))
    ).resolves.toBeUndefined();
  });

  it('does not store anything in cache when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failure'));
    await TestBed.runInInjectionContext(() => prefetchQuery('/broken'));

    const cache = TestBed.inject(HttpCacheService);
    expect(cache.get('GET:/broken')).toBeUndefined();
  });
});
