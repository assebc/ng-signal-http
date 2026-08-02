import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SignalHttpClient } from '../core/signal-http-client';
import { HttpCacheService } from '../core/http-cache.service';
import { buildCacheKey } from '../core/cache-key';
import { attemptWithRetry, isAbortError, toError } from '../core/request-utils';
import { HttpClientOptions, HttpClientResult, HttpClientStatus, RequestConfig } from '../types';
import { UrlFactory } from './query.types';

/**
 * Creates a reactive GET query bound to the current Angular injection context.
 *
 * Fetches immediately (unless `lazy: true`) and re-fetches automatically whenever
 * any signal read inside the `url` factory changes. The in-flight request is
 * aborted when the host component or service is destroyed.
 *
 * When `staleTime` is set, responses are cached in-memory:
 * - **Fresh hit**: cached data is served immediately; no network request is made.
 * - **Stale hit**: cached data is served immediately (no loading spinner), then a
 *   background revalidation silently updates the data signal when it completes.
 * - **Miss**: normal fetch; the result is stored in the cache for future hits.
 *
 * @template T - The expected response data type.
 * @param url - A static URL string or a factory that returns a URL or `RequestConfig`.
 *              Signal reads inside the factory are tracked — changing them triggers a re-fetch.
 * @param options - Query behaviour: lazy loading, retry, stale time, polling, callbacks, etc.
 * @returns An `HttpClientResult<T>` with reactive signals and control methods.
 *
 * @example
 * // Static URL — fetch once on init
 * const posts = querySignal<Post[]>('/posts');
 *
 * @example
 * // Reactive factory — refetches when postId() changes
 * const postId = signal(1);
 * const post = querySignal<Post>(() => `/posts/${postId()}`);
 *
 * @example
 * // With caching
 * const data = querySignal('/feed', {
 *   staleTime: 60_000,
 *   refetchOnFocus: true,
 * });
 */
export function querySignal<T>(
  url: string | UrlFactory,
  options?: HttpClientOptions<T>
): HttpClientResult<T> {
  const httpClient = inject(SignalHttpClient);
  const cache = inject(HttpCacheService);
  const destroyRef = inject(DestroyRef);
  const injector = inject(Injector);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  const factory: UrlFactory = typeof url === 'string' ? () => url : url;

  const skipServer = (options?.skipOnServer ?? false) && !isBrowser;

  const data = signal<T | null>(options?.initialValue ?? null);
  const loading = signal<boolean>(!options?.lazy && !skipServer);
  const error = signal<Error | null>(null);
  const status = signal<HttpClientStatus>((options?.lazy || skipServer) ? 'idle' : 'loading');
  const lastFetchAt = signal<number>(0);

  const isStale = computed(() => {
    if (!options?.staleTime || lastFetchAt() === 0) return false;
    return Date.now() - lastFetchAt() > options.staleTime;
  });

  let abortController: AbortController | undefined;
  let revalidating = false;

  const doFetch = async (background = false): Promise<void> => {
    if (options?.skipOnServer && !isBrowser) return;

    const ac = new AbortController();

    if (background) {
      if (revalidating) return;
      revalidating = true;
      abortController = ac;  // register so destroy() can cancel the background fetch
    } else {
      abortController?.abort();
      abortController = ac;
      loading.set(true);
      status.set('loading');
      error.set(null);
    }

    try {
      const urlResult = untracked(factory);
      const requestConfig: RequestConfig =
        typeof urlResult === 'string'
          ? { url: urlResult, method: 'GET' }
          : urlResult;
      const cacheKey = buildCacheKey(urlResult);

      // Cache check — foreground only, when staleTime is configured.
      if (!background && options?.staleTime) {
        const entry = cache.get(cacheKey);
        if (entry) {
          if (!cache.isExpired(cacheKey, options.staleTime)) {
            // Fresh hit — serve from cache, skip network entirely.
            data.set(entry.data as T);
            loading.set(false);
            status.set('success');
            lastFetchAt.set(entry.fetchedAt);
            return;
          }
          // Stale hit — serve cached data immediately, then revalidate silently.
          data.set(entry.data as T);
          loading.set(false);
          status.set('success');
          lastFetchAt.set(entry.fetchedAt);
          void doFetch(true);
          return;
        }
      }

      // Deduplication — foreground only: join an in-flight request for the same key
      // rather than firing a duplicate network request.
      if (!background) {
        const inflight = cache.getInflight(cacheKey);
        if (inflight) {
          const result = await (inflight as Promise<T>);
          if (!ac.signal.aborted) {
            data.set(result);
            status.set('success');
            lastFetchAt.set(Date.now());
            if (options?.staleTime) cache.set(cacheKey, result);
            options?.onSuccess?.(result);
          }
          return;
        }
      }

      // Network fetch — register as in-flight so concurrent callers can join.
      const fetchPromise = attemptWithRetry<T>(httpClient, requestConfig, ac.signal, options?.retry);
      if (!background) {
        cache.setInflight(cacheKey, fetchPromise);
        // Clean up whether the fetch succeeds or fails. Using then(f, f) instead of
        // .finally(f) avoids propagating a rejected promise to the void discard.
        const removeInflight = () => cache.deleteInflight(cacheKey);
        void fetchPromise.then(removeInflight, removeInflight);
      }

      const result = await fetchPromise;
      data.set(result);
      status.set('success');
      lastFetchAt.set(Date.now());
      if (options?.staleTime) cache.set(cacheKey, result);
      if (!background) options?.onSuccess?.(result);
    } catch (e) {
      if (isAbortError(e)) return;
      if (!background) {
        const err = toError(e);
        error.set(err);
        status.set('error');
        options?.onError?.(err);
      }
    } finally {
      if (!background) {
        loading.set(false);
      } else {
        revalidating = false;
      }
    }
  };

  // Reactive effect — tracks signals in factory(), refetches when they change.
  // lazy skips the first run so no fetch fires on init.
  let isFirstRun = options?.lazy ?? false;
  runInInjectionContext(injector, () => {
    effect(() => {
      factory();
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      untracked(() => doFetch());
    });
  });

  if (options?.refetchInterval && isBrowser) {
    const id = setInterval(() => {
      if (!loading() && !revalidating) doFetch();
    }, options.refetchInterval);
    destroyRef.onDestroy(() => clearInterval(id));
  }

  if (options?.refetchOnFocus && isBrowser) {
    const handler = () => {
      if (isStale() && !loading() && !revalidating) doFetch();
    };
    window.addEventListener('focus', handler);
    destroyRef.onDestroy(() => window.removeEventListener('focus', handler));
  }

  if (options?.refetchOnReconnect && isBrowser) {
    const handler = () => {
      if (!loading() && !revalidating) doFetch();
    };
    window.addEventListener('online', handler);
    destroyRef.onDestroy(() => window.removeEventListener('online', handler));
  }

  destroyRef.onDestroy(() => {
    abortController?.abort();
  });

  return {
    data: data.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    status: status.asReadonly(),
    isStale,
    refetch: doFetch,
    invalidate: () => {
      const urlResult = untracked(factory);
      cache.delete(buildCacheKey(urlResult));
      lastFetchAt.set(0);
    },
    reset: () => {
      abortController?.abort();
      const urlResult = untracked(factory);
      cache.delete(buildCacheKey(urlResult));
      data.set(options?.initialValue ?? null);
      loading.set(false);
      error.set(null);
      status.set('idle');
      lastFetchAt.set(0);
    },
  };
}

