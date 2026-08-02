import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { paginatedQuerySignal, PaginatedResult } from './paginated-query-signal';
import { provideSignalHttp } from '../core/providers';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('paginatedQuerySignal', () => {
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

  it('fetches first page on init (non-lazy)', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse([{ id: 1 }]));
    TestBed.runInInjectionContext(() => {
      paginatedQuerySignal<{ id: number }[]>(() => '/items');
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lazy: does not fetch on init', () => {
    TestBed.runInInjectionContext(() => {
      paginatedQuerySignal(() => '/items', { lazy: true });
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pages contains first page result after fetch', async () => {
    const page1 = [{ id: 1 }, { id: 2 }];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(page1));
    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items', { lazy: true });
    });

    const fetchNextPage = async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse(page1));
      await TestBed.runInInjectionContext(() =>
        paginatedQuerySignal<{ id: number }[]>(() => '/items')
      );
    };
    void fetchNextPage;

    // Use lazy + manual trigger to control timing.
    fetchMock.mockResolvedValueOnce(makeJsonResponse(page1));
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items');
    });
    await flushPromises();
    expect(result.pages()).toHaveLength(1);
    expect(result.pages()[0]).toEqual(page1);
  });

  it('fetchNextPage() appends to pages', async () => {
    const page1 = [{ id: 1 }];
    const page2 = [{ id: 2 }];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(page1));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items', {
        getNextPageParam: () => 2,
      });
    });
    await flushPromises();
    expect(result.pages()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(makeJsonResponse(page2));
    await result.fetchNextPage();

    expect(result.pages()).toHaveLength(2);
    expect(result.pages()[1]).toEqual(page2);
  });

  it('hasNextPage is false when getNextPageParam returns undefined', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse([{ id: 1 }]));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items', {
        getNextPageParam: () => undefined,
      });
    });
    await flushPromises();
    expect(result.hasNextPage()).toBe(false);
  });

  it('hasNextPage is false when empty array returned (no getNextPageParam)', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse([]));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items');
    });
    await flushPromises();
    expect(result.hasNextPage()).toBe(false);
  });

  it('hasNextPage is true when non-empty array returned (no getNextPageParam)', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse([{ id: 1 }]));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items');
    });
    await flushPromises();
    expect(result.hasNextPage()).toBe(true);
  });

  it('isFetchingNextPage is true during next-page fetch, false after', async () => {
    const page1 = [{ id: 1 }];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(page1));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items', {
        getNextPageParam: () => 2,
      });
    });
    await flushPromises();

    // Set up a pending next-page fetch.
    let resolveFetch!: (v: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    fetchMock.mockReturnValueOnce(pendingFetch);

    const fetchPromise = result.fetchNextPage();
    expect(result.isFetchingNextPage()).toBe(true);

    resolveFetch(makeJsonResponse([{ id: 2 }]));
    await fetchPromise;
    expect(result.isFetchingNextPage()).toBe(false);
  });

  it('loading is true during first page, false after', async () => {
    let resolveFetch!: (v: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    fetchMock.mockReturnValueOnce(pendingFetch);

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items');
    });

    expect(result.loading()).toBe(true);

    resolveFetch(makeJsonResponse([{ id: 1 }]));
    await flushPromises();
    expect(result.loading()).toBe(false);
  });

  it('error is set when a page fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('server error'));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items');
    });
    await flushPromises();

    expect(result.error()).toBeInstanceOf(Error);
    expect(result.error()?.message).toBe('server error');
  });

  it('fetchNextPage() is a no-op when hasNextPage is false', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse([]));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items');
    });
    await flushPromises();
    expect(result.hasNextPage()).toBe(false);

    await result.fetchNextPage();
    // No second fetch should have been made.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reset() clears all state and allows refetching from page 1', async () => {
    const page1 = [{ id: 1 }];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(page1));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items', { lazy: true });
    });

    // Manually kick off first fetch via accessing the result (lazy mode).
    fetchMock.mockResolvedValueOnce(makeJsonResponse(page1));
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items');
    });
    await flushPromises();
    expect(result.pages()).toHaveLength(1);

    result.reset();

    expect(result.pages()).toHaveLength(0);
    expect(result.loading()).toBe(false);
    expect(result.isFetchingNextPage()).toBe(false);
    expect(result.hasNextPage()).toBe(false);
    expect(result.error()).toBeNull();
  });

  it('fetchNextPage() is a no-op when already fetching next page', async () => {
    const page1 = [{ id: 1 }];
    fetchMock.mockResolvedValueOnce(makeJsonResponse(page1));

    let result!: PaginatedResult<{ id: number }[]>;
    TestBed.runInInjectionContext(() => {
      result = paginatedQuerySignal<{ id: number }[]>(() => '/items', {
        getNextPageParam: () => 2,
      });
    });
    await flushPromises();

    // Pending second page fetch.
    const pendingFetch = new Promise<never>(noop);
    fetchMock.mockReturnValueOnce(pendingFetch);

    void result.fetchNextPage(); // starts fetching
    await result.fetchNextPage(); // should be a no-op

    // Only one additional fetch for page 2.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
