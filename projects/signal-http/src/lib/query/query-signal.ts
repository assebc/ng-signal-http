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
import { HttpClientOptions, HttpClientResult, HttpClientStatus, RequestConfig, RetryConfig } from '../types';
import { UrlFactory } from './query.types';

/**
 * Creates a reactive GET query bound to the current Angular injection context.
 *
 * Fetches immediately (unless `lazy: true`) and re-fetches automatically whenever
 * any signal read inside the `url` factory changes. The in-flight request is
 * aborted when the host component or service is destroyed.
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
 * // With options
 * const data = querySignal('/feed', {
 *   retry: 3,
 *   refetchOnFocus: true,
 *   staleTime: 60_000,
 *   onError: (err) => console.error(err),
 * });
 */
export function querySignal<T>(
  url: string | UrlFactory,
  options?: HttpClientOptions<T>
): HttpClientResult<T> {
  const httpClient = inject(SignalHttpClient);
  const destroyRef = inject(DestroyRef);
  const injector = inject(Injector);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  const factory: UrlFactory = typeof url === 'string' ? () => url : url;

  const data = signal<T | null>(options?.initialValue ?? null);
  const loading = signal<boolean>(!options?.lazy);
  const error = signal<Error | null>(null);
  const status = signal<HttpClientStatus>(options?.lazy ? 'idle' : 'loading');
  const lastFetchAt = signal<number>(0);

  const isStale = computed(() => {
    if (!options?.staleTime || lastFetchAt() === 0) return false;
    return Date.now() - lastFetchAt() > options.staleTime;
  });

  let abortController: AbortController | undefined;

  const doFetch = async (): Promise<void> => {
    abortController?.abort();
    abortController = new AbortController();

    loading.set(true);
    status.set('loading');
    error.set(null);

    try {
      const urlResult = untracked(factory);
      const requestConfig: RequestConfig =
        typeof urlResult === 'string'
          ? { url: urlResult, method: 'GET' }
          : urlResult;

      const result = await attemptWithRetry<T>(httpClient, requestConfig, abortController.signal, options?.retry);
      data.set(result);
      status.set('success');
      lastFetchAt.set(Date.now());
      options?.onSuccess?.(result);
    } catch (e) {
      if (isAbortError(e)) return;
      const err = toError(e);
      error.set(err);
      status.set('error');
      options?.onError?.(err);
    } finally {
      loading.set(false);
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
      if (!loading()) doFetch();
    }, options.refetchInterval);
    destroyRef.onDestroy(() => clearInterval(id));
  }

  if (options?.refetchOnFocus && isBrowser) {
    const handler = () => {
      if (isStale() && !loading()) doFetch();
    };
    window.addEventListener('focus', handler);
    destroyRef.onDestroy(() => window.removeEventListener('focus', handler));
  }

  if (options?.refetchOnReconnect && isBrowser) {
    const handler = () => {
      if (!loading()) doFetch();
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
    invalidate: () => lastFetchAt.set(0),
    reset: () => {
      abortController?.abort();
      data.set(options?.initialValue ?? null);
      loading.set(false);
      error.set(null);
      status.set('idle');
      lastFetchAt.set(0);
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function attemptWithRetry<T>(
  client: SignalHttpClient,
  config: RequestConfig,
  signal: AbortSignal,
  retry?: number | RetryConfig,
  attempt = 1
): Promise<T> {
  try {
    return await client.executeRequest<T>({ ...config, signal });
  } catch (e) {
    const err = toError(e);
    if (shouldRetry(err, attempt, retry)) {
      await sleep(getRetryDelay(attempt, retry));
      return attemptWithRetry(client, config, signal, retry, attempt + 1);
    }
    throw err;
  }
}

function shouldRetry(err: Error, attempt: number, retry?: number | RetryConfig): boolean {
  if (isAbortError(err)) return false;
  const config = normalizeRetry(retry);
  if (!config || attempt > config.count) return false;
  return config.shouldRetry ? config.shouldRetry(err, attempt) : true;
}

function getRetryDelay(attempt: number, retry?: number | RetryConfig): number {
  const config = normalizeRetry(retry);
  if (!config?.delay) return 0;
  return typeof config.delay === 'function' ? config.delay(attempt) : config.delay;
}

function normalizeRetry(retry?: number | RetryConfig): RetryConfig | undefined {
  if (retry === undefined) return undefined;
  return typeof retry === 'number' ? { count: retry } : retry;
}

function isAbortError(e: unknown): e is Error {
  return e instanceof Error && e.name === 'AbortError';
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
