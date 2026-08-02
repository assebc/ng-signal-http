import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { parallelQueries, ParallelQueriesResult } from './parallel-queries';
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

describe('parallelQueries', () => {
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

  it('fires all queries (verifies fetch call count)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ a: 1 }))
      .mockResolvedValueOnce(makeJsonResponse({ b: 2 }))
      .mockResolvedValueOnce(makeJsonResponse({ c: 3 }));

    let result!: ParallelQueriesResult<{ a?: number; b?: number; c?: number }>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<{ a?: number; b?: number; c?: number }>(
        [() => '/a', () => '/b', () => '/c'],
        { lazy: true }
      );
    });

    await result.refetchAll();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('data contains all results', async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
      .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));

    let result!: ParallelQueriesResult<{ n: number }>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<{ n: number }>(
        [() => '/a', () => '/b'],
        { lazy: true }
      );
    });

    await result.refetchAll();

    expect(result.data()).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('loading is true while any query is loading', () => {
    const pending = new Promise<never>(noop);
    fetchMock
      .mockReturnValueOnce(pending)
      .mockReturnValueOnce(pending);

    let result!: ParallelQueriesResult<unknown>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<unknown>([() => '/a', () => '/b']);
    });

    expect(result.loading()).toBe(true);
  });

  it('loading is false when all queries complete', async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
      .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));

    let result!: ParallelQueriesResult<{ n: number }>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<{ n: number }>([() => '/a', () => '/b'], { lazy: true });
    });

    await result.refetchAll();

    expect(result.loading()).toBe(false);
  });

  it('status is success when all succeed', async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
      .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));

    let result!: ParallelQueriesResult<{ n: number }>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<{ n: number }>([() => '/a', () => '/b'], { lazy: true });
    });

    await result.refetchAll();

    expect(result.status()).toBe('success');
  });

  it('status is error when any query fails', async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
      .mockRejectedValueOnce(new Error('fail'));

    let result!: ParallelQueriesResult<{ n: number }>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<{ n: number }>([() => '/a', () => '/b'], { lazy: true });
    });

    await result.refetchAll();

    expect(result.status()).toBe('error');
  });

  it('errors contains per-query errors', async () => {
    const err = new Error('query b failed');
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
      .mockRejectedValueOnce(err);

    let result!: ParallelQueriesResult<{ n: number }>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<{ n: number }>([() => '/a', () => '/b'], { lazy: true });
    });

    await result.refetchAll();

    const errors = result.errors();
    expect(errors[0]).toBeNull();
    expect(errors[1]).toBeInstanceOf(Error);
    expect(errors[1]?.message).toBe('query b failed');
  });

  it('refetchAll() triggers refetch on all queries', async () => {
    // Initial fetches
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
      .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));

    let result!: ParallelQueriesResult<{ n: number }>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<{ n: number }>([() => '/a', () => '/b'], { lazy: true });
    });

    await result.refetchAll();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Refetch round
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ n: 10 }))
      .mockResolvedValueOnce(makeJsonResponse({ n: 20 }));

    await result.refetchAll();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.data()).toEqual([{ n: 10 }, { n: 20 }]);
  });

  it('resetAll() resets all queries', async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
      .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));

    let result!: ParallelQueriesResult<{ n: number }>;
    TestBed.runInInjectionContext(() => {
      result = parallelQueries<{ n: number }>([() => '/a', () => '/b'], { lazy: true });
    });

    await result.refetchAll();
    expect(result.data()).toEqual([{ n: 1 }, { n: 2 }]);

    result.resetAll();

    expect(result.data()).toEqual([null, null]);
    expect(result.status()).toBe('idle');
  });
});
