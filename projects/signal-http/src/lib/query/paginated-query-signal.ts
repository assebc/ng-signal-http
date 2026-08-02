import { DestroyRef, inject, Signal, signal } from '@angular/core';
import { SignalHttpClient } from '../core/signal-http-client';
import { attemptWithRetry, isAbortError, toError } from '../core/request-utils';
import { RequestConfig, RetryConfig } from '../types';

export interface PaginatedOptions<T> {
  getNextPageParam?: (lastPage: T, allPages: T[]) => unknown;
  lazy?: boolean;
  retry?: number | RetryConfig;
  onSuccess?: (data: T, pageParam: unknown) => void;
  onError?: (error: Error) => void;
}

export interface PaginatedResult<T> {
  readonly pages: Signal<T[]>;
  readonly loading: Signal<boolean>;
  readonly isFetchingNextPage: Signal<boolean>;
  readonly hasNextPage: Signal<boolean>;
  readonly error: Signal<Error | null>;
  fetchNextPage: () => Promise<void>;
  reset: () => void;
}

/**
 * Creates a paginated query that accumulates pages as they are fetched.
 *
 * The first page is always fetched with `pageParam = undefined`.
 * Call `fetchNextPage()` to append subsequent pages.
 *
 * @param urlFactory - Called with the current page param; returns a URL or `RequestConfig`.
 * @param options - Pagination callbacks, lazy flag, and retry config.
 */
export function paginatedQuerySignal<T>(
  urlFactory: (pageParam: unknown) => string | RequestConfig,
  options?: PaginatedOptions<T>
): PaginatedResult<T> {
  const httpClient = inject(SignalHttpClient);
  const destroyRef = inject(DestroyRef);

  const pages = signal<T[]>([]);
  const loading = signal<boolean>(false);
  const isFetchingNextPage = signal<boolean>(false);
  const hasNextPage = signal<boolean>(false);
  const error = signal<Error | null>(null);

  let nextPageParam: unknown = undefined;
  let abortController: AbortController | undefined;

  const fetchPage = async (pageParam: unknown, isFirstPage: boolean): Promise<void> => {
    abortController?.abort();
    const ac = new AbortController();
    abortController = ac;

    if (isFirstPage) {
      loading.set(true);
    } else {
      isFetchingNextPage.set(true);
    }
    error.set(null);

    try {
      const urlResult = urlFactory(pageParam);
      const config: RequestConfig =
        typeof urlResult === 'string'
          ? { url: urlResult, method: 'GET' }
          : urlResult;

      const result = await attemptWithRetry<T>(
        httpClient,
        config,
        ac.signal,
        options?.retry
      );

      if (ac.signal.aborted) return;

      if (isFirstPage) {
        pages.set([result]);
      } else {
        pages.update(prev => [...prev, result]);
      }

      // Determine whether there is a next page.
      if (options?.getNextPageParam) {
        const allPages = pages();
        const param = options.getNextPageParam(result, allPages);
        if (param !== null && param !== undefined) {
          nextPageParam = param;
          hasNextPage.set(true);
        } else {
          nextPageParam = undefined;
          hasNextPage.set(false);
        }
      } else {
        const hasMore = Array.isArray(result) && (result as unknown[]).length > 0;
        hasNextPage.set(hasMore);
        nextPageParam = undefined;
      }

      options?.onSuccess?.(result, pageParam);
    } catch (e) {
      if (isAbortError(e)) return;
      const err = toError(e);
      error.set(err);
      options?.onError?.(err);
    } finally {
      if (isFirstPage) {
        loading.set(false);
      } else {
        isFetchingNextPage.set(false);
      }
    }
  };

  if (!options?.lazy) {
    void fetchPage(undefined, true);
  }

  destroyRef.onDestroy(() => {
    abortController?.abort();
  });

  return {
    pages: pages.asReadonly(),
    loading: loading.asReadonly(),
    isFetchingNextPage: isFetchingNextPage.asReadonly(),
    hasNextPage: hasNextPage.asReadonly(),
    error: error.asReadonly(),

    fetchNextPage: (): Promise<void> => {
      if (!hasNextPage() || loading() || isFetchingNextPage()) {
        return Promise.resolve();
      }
      return fetchPage(nextPageParam, false);
    },

    reset: (): void => {
      abortController?.abort();
      abortController = undefined;
      nextPageParam = undefined;
      pages.set([]);
      loading.set(false);
      isFetchingNextPage.set(false);
      hasNextPage.set(false);
      error.set(null);
    },
  };
}
