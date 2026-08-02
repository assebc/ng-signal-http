import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { querySignal } from './query-signal';
import { provideSignalHttp } from '../core/providers';
import { HttpClientResult } from '../types';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const PENDING = new Promise<never>(noop);

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('querySignal', () => {
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

  // ─── Initial state ──────────────────────────────────────────────────────

  describe('initial state (non-lazy)', () => {
    it('data starts as null', () => {
      fetchMock.mockReturnValueOnce(PENDING);
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items');
      });
      expect(result.data()).toBeNull();
    });

    it('loading starts as true', () => {
      fetchMock.mockReturnValueOnce(PENDING);
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items');
      });
      expect(result.loading()).toBe(true);
    });

    it('error starts as null', () => {
      fetchMock.mockReturnValueOnce(PENDING);
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items');
      });
      expect(result.error()).toBeNull();
    });

    it('status starts as loading', () => {
      fetchMock.mockReturnValueOnce(PENDING);
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items');
      });
      expect(result.status()).toBe('loading');
    });
  });

  describe('initial state (lazy)', () => {
    it('loading starts as false', () => {
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true });
      });
      expect(result.loading()).toBe(false);
    });

    it('status starts as idle', () => {
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true });
      });
      expect(result.status()).toBe('idle');
    });

    it('does not call fetch on init', () => {
      TestBed.runInInjectionContext(() => {
        querySignal('/items', { lazy: true });
      });
      TestBed.flushEffects();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('initialValue option', () => {
    it('data starts as the provided initialValue', () => {
      fetchMock.mockReturnValueOnce(PENDING);
      let result!: HttpClientResult<string[]>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<string[]>('/items', { initialValue: ['seed'] });
      });
      expect(result.data()).toEqual(['seed']);
    });
  });

  // ─── Successful fetch ───────────────────────────────────────────────────

  describe('successful fetch via refetch()', () => {
    it('sets data to the response body', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse([{ id: 1 }]));
      let result!: HttpClientResult<{ id: number }[]>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ id: number }[]>('/items', { lazy: true });
      });
      await result.refetch();
      expect(result.data()).toEqual([{ id: 1 }]);
    });

    it('sets status to success', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true });
      });
      await result.refetch();
      expect(result.status()).toBe('success');
    });

    it('sets loading to false', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true });
      });
      await result.refetch();
      expect(result.loading()).toBe(false);
    });

    it('calls onSuccess with the response data', async () => {
      const onSuccess = vi.fn();
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ value: 42 }));
      let result!: HttpClientResult<{ value: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ value: number }>('/items', { lazy: true, onSuccess });
      });
      await result.refetch();
      expect(onSuccess).toHaveBeenCalledWith({ value: 42 });
    });
  });

  // ─── Failed fetch ───────────────────────────────────────────────────────

  describe('failed fetch via refetch()', () => {
    it('sets error signal', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true });
      });
      await result.refetch();
      expect(result.error()).toBeInstanceOf(Error);
      expect(result.error()?.message).toBe('network down');
    });

    it('sets status to error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'));
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true });
      });
      await result.refetch();
      expect(result.status()).toBe('error');
    });

    it('sets loading to false on error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'));
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true });
      });
      await result.refetch();
      expect(result.loading()).toBe(false);
    });

    it('calls onError with the error', async () => {
      const onError = vi.fn();
      const err = new Error('oops');
      fetchMock.mockRejectedValueOnce(err);
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true, onError });
      });
      await result.refetch();
      expect(onError).toHaveBeenCalledWith(err);
    });

    it('data stays null after error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'));
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true });
      });
      await result.refetch();
      expect(result.data()).toBeNull();
    });
  });

  // ─── Retry ──────────────────────────────────────────────────────────────

  describe('retry', () => {
    it('retries the specified number of times and succeeds', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      let result!: HttpClientResult<{ ok: boolean }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ ok: boolean }>('/items', { lazy: true, retry: 2 });
      });
      await result.refetch();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.data()).toEqual({ ok: true });
    });

    it('sets error after all retries are exhausted', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockRejectedValueOnce(new Error('fail 3'));

      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true, retry: 2 });
      });
      await result.refetch();

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.status()).toBe('error');
    });

    it('does not retry AbortErrors', async () => {
      const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
      fetchMock.mockRejectedValue(abortErr);

      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true, retry: 3 });
      });
      await result.refetch();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('respects shouldRetry predicate', async () => {
      const networkErr = new Error('network');
      const authErr = Object.assign(new Error('unauthorized'), { name: 'AuthError' });

      fetchMock
        .mockRejectedValueOnce(networkErr)
        .mockRejectedValueOnce(authErr);

      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', {
          lazy: true,
          retry: {
            count: 3,
            shouldRetry: (err) => err.message === 'network',
          },
        });
      });
      await result.refetch();

      // retried once (network error), stopped on authErr
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.status()).toBe('error');
    });
  });

  // ─── reset / invalidate ──────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears data, error and sets status to idle', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ x: 1 }));
      let result!: HttpClientResult<{ x: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ x: number }>('/items', { lazy: true });
      });
      await result.refetch();
      expect(result.data()).toEqual({ x: 1 });

      result.reset();

      expect(result.data()).toBeNull();
      expect(result.error()).toBeNull();
      expect(result.loading()).toBe(false);
      expect(result.status()).toBe('idle');
    });
  });

  describe('invalidate()', () => {
    it('resets lastFetchAt, causing isStale to return false', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true, staleTime: 60_000 });
      });
      await result.refetch();

      result.invalidate();

      expect(result.isStale()).toBe(false);
    });
  });

  // ─── Reactive refetch via effect ─────────────────────────────────────────

  describe('reactive refetch', () => {
    it('refetches when a signal used in the URL factory changes', async () => {
      const id = signal(1);
      fetchMock.mockResolvedValue(makeJsonResponse({ id: 1 }));

      let result!: HttpClientResult<{ id: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ id: number }>(() => `/items/${id()}`);
      });

      TestBed.flushEffects();
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/items/1');

      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 2 }));
      id.set(2);

      TestBed.flushEffects();
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toContain('/items/2');
      expect(result.data()).toEqual({ id: 2 });
    });
  });

  // ─── refetchInterval ─────────────────────────────────────────────────────

  describe('refetchInterval', () => {
    afterEach(() => vi.useRealTimers());

    it('calls fetch on each interval tick when not loading', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(makeJsonResponse({}));

      TestBed.runInInjectionContext(() => {
        querySignal('/items', { lazy: true, refetchInterval: 1000 });
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('skips the tick when a fetch is already in flight', async () => {
      vi.useFakeTimers();
      fetchMock.mockReturnValue(PENDING);

      TestBed.runInInjectionContext(() => {
        // non-lazy: starts loading immediately, so interval ticks are skipped
        querySignal('/items', { refetchInterval: 1000 });
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial auto-fetch
    });
  });

  // ─── refetchOnFocus ───────────────────────────────────────────────────────

  describe('refetchOnFocus', () => {
    afterEach(() => vi.useRealTimers());

    it('refetches when window gains focus and data is stale', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(makeJsonResponse({ v: 1 }));

      let result!: HttpClientResult<{ v: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ v: number }>('/items', {
          lazy: true,
          refetchOnFocus: true,
          staleTime: 1000,
        });
      });

      await result.refetch();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1001); // push past staleTime

      window.dispatchEvent(new Event('focus'));
      await vi.runAllTimersAsync();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not refetch on focus when data is not yet stale', async () => {
      vi.useFakeTimers();
      fetchMock.mockResolvedValue(makeJsonResponse({}));

      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', {
          lazy: true,
          refetchOnFocus: true,
          staleTime: 60_000,
        });
      });

      await result.refetch();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100); // well within staleTime
      window.dispatchEvent(new Event('focus'));
      await vi.runAllTimersAsync();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ─── refetchOnReconnect ───────────────────────────────────────────────────

  describe('refetchOnReconnect', () => {
    it('refetches when the network reconnects', async () => {
      fetchMock.mockResolvedValue(makeJsonResponse({}));

      TestBed.runInInjectionContext(() => {
        querySignal('/items', { lazy: true, refetchOnReconnect: true });
      });

      window.dispatchEvent(new Event('online'));
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not refetch on reconnect when a request is already in flight', async () => {
      fetchMock.mockReturnValue(PENDING);

      let result!: HttpClientResult<unknown>;
      TestBed.runInInjectionContext(() => {
        result = querySignal('/items', { lazy: true, refetchOnReconnect: true });
      });

      result.refetch(); // starts a never-resolving fetch → loading = true
      window.dispatchEvent(new Event('online'));
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Retry with fixed numeric delay (line 194) ────────────────────────────

  describe('retry with fixed delay', () => {
    afterEach(() => vi.useRealTimers());

    it('waits a fixed number of ms between retries', async () => {
      vi.useFakeTimers();
      fetchMock
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      let result!: HttpClientResult<{ ok: boolean }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ ok: boolean }>('/items', {
          lazy: true,
          retry: { count: 1, delay: 500 },
        });
      });

      const p = result.refetch();
      await vi.advanceTimersByTimeAsync(500);
      await p;

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.data()).toEqual({ ok: true });
    });
  });

  // ─── Cache (staleTime) ────────────────────────────────────────────────────

  describe('cache (staleTime)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(0);
    });
    afterEach(() => vi.useRealTimers());

    it('skips network on a fresh cache hit', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ n: 1 }));
      let result!: HttpClientResult<{ n: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ n: number }>('/data', { lazy: true, staleTime: 5_000 });
      });

      await result.refetch();  // t=0 — populates cache
      expect(fetchMock).toHaveBeenCalledTimes(1);

      vi.setSystemTime(3_000);  // within staleTime
      await result.refetch();   // fresh cache hit — no network
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.data()).toEqual({ n: 1 });
      expect(result.loading()).toBe(false);
      expect(result.status()).toBe('success');
    });

    it('serves stale data immediately and revalidates in the background', async () => {
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
        .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));
      let result!: HttpClientResult<{ n: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ n: number }>('/data', { lazy: true, staleTime: 5_000 });
      });

      await result.refetch();  // t=0 — populates cache with n=1
      expect(result.data()).toEqual({ n: 1 });

      vi.setSystemTime(6_000);  // past staleTime

      await result.refetch();  // stale hit: serves n=1 + kicks off background revalidation
      expect(result.data()).toEqual({ n: 1 });   // stale data served immediately
      expect(result.loading()).toBe(false);       // no loading spinner shown
      // background fetch is dispatched synchronously inside the stale hit path
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await flushPromises();  // let background fetch resolve
      expect(result.data()).toEqual({ n: 2 });   // silently updated
      expect(result.loading()).toBe(false);
    });

    it('does not show a loading spinner during background revalidation', async () => {
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
        .mockReturnValueOnce(new Promise(noop));  // background fetch stays pending
      let result!: HttpClientResult<{ n: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ n: number }>('/data', { lazy: true, staleTime: 5_000 });
      });

      await result.refetch();  // t=0 — populates cache
      vi.setSystemTime(6_000);
      await result.refetch();  // stale hit — background revalidation pending
      expect(result.loading()).toBe(false);  // no spinner during background fetch
    });

    it('clears cache on invalidate() so the next refetch goes to the network', async () => {
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
        .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));
      let result!: HttpClientResult<{ n: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ n: number }>('/data', { lazy: true, staleTime: 60_000 });
      });

      await result.refetch();  // populate cache (fresh for 60s)
      result.invalidate();     // evict cache entry

      vi.setSystemTime(1_000);  // still within staleTime, but entry was evicted
      await result.refetch();   // cache miss → network
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.data()).toEqual({ n: 2 });
    });

    it('clears cache on reset() so the next refetch goes to the network', async () => {
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
        .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));
      let result!: HttpClientResult<{ n: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ n: number }>('/data', { lazy: true, staleTime: 60_000 });
      });

      await result.refetch();  // populate cache (fresh for 60s)
      result.reset();
      expect(result.data()).toBeNull();  // state cleared

      await result.refetch();  // cache was evicted → network
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.data()).toEqual({ n: 2 });
    });

    it('does not cache responses when staleTime is not set', async () => {
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse({ n: 1 }))
        .mockResolvedValueOnce(makeJsonResponse({ n: 2 }));
      let result!: HttpClientResult<{ n: number }>;
      TestBed.runInInjectionContext(() => {
        result = querySignal<{ n: number }>('/data', { lazy: true });  // no staleTime
      });

      await result.refetch();
      await result.refetch();  // no cache → goes to network again
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.data()).toEqual({ n: 2 });
    });
  });
});
