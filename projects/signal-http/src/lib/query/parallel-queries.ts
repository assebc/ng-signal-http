import { computed, Signal } from '@angular/core';
import { querySignal } from './query-signal';
import { HttpClientOptions, HttpClientResult, HttpClientStatus, RequestConfig } from '../types';

export interface ParallelQueriesResult<T> {
  readonly data: Signal<(T | null)[]>;
  readonly loading: Signal<boolean>;
  readonly errors: Signal<(Error | null)[]>;
  readonly status: Signal<HttpClientStatus>;
  refetchAll: () => Promise<void>;
  resetAll: () => void;
}

/**
 * Fires N queries in parallel and combines their state into a single result handle.
 *
 * Each factory in the `factories` array is passed as the first argument to an
 * internal `querySignal` — the same `options` object applies to all queries.
 *
 * @param factories - One URL/config factory per query.
 * @param options   - Shared query options (retry, lazy, staleTime, …).
 */
export function parallelQueries<T>(
  factories: Array<() => string | RequestConfig>,
  options?: HttpClientOptions<T>
): ParallelQueriesResult<T> {
  const queries: HttpClientResult<T>[] = factories.map(factory =>
    querySignal<T>(factory, options)
  );

  const data = computed<(T | null)[]>(() => queries.map(q => q.data()));

  const loading = computed<boolean>(() => queries.some(q => q.loading()));

  const errors = computed<(Error | null)[]>(() => queries.map(q => q.error()));

  const status = computed<HttpClientStatus>(() => {
    if (queries.some(q => q.loading())) return 'loading';
    if (queries.some(q => q.status() === 'error')) return 'error';
    if (queries.every(q => q.status() === 'success')) return 'success';
    return 'idle';
  });

  return {
    data,
    loading,
    errors,
    status,
    refetchAll: (): Promise<void> =>
      Promise.all(queries.map(q => q.refetch())).then(() => undefined),
    resetAll: (): void => {
      queries.forEach(q => q.reset());
    },
  };
}
