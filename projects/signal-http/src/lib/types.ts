import { Signal } from '@angular/core';

// ─── Config ────────────────────────────────────────────────

/**
 * Global configuration passed to `provideSignalHttp()`.
 *
 * @example
 * provideSignalHttp({ baseUrl: 'https://api.example.com', timeout: 10_000 });
 */
export interface SignalHttpConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
  interceptors?: HttpInterceptor[];
}

// ─── Interceptors ───────────────────────────────────────────

/**
 * Hooks that intercept every request, response, or error in the pipeline.
 * All three hooks are optional and may return a `Promise`.
 * Interceptors run in registration order.
 *
 * @example
 * const authInterceptor: HttpInterceptor = {
 *   request: async (config) => ({
 *     ...config,
 *     headers: { ...config.headers, Authorization: `Bearer ${getToken()}` },
 *   }),
 * };
 */
export interface HttpInterceptor {
  request?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  response?: (response: Response) => Response | Promise<Response>;
  error?: (error: Error) => Error | Promise<never>;
}

// ─── Request ────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Per-request options. Passed to `SignalHttpClient.executeRequest()` or
 * returned by a `UrlFactory` to provide method and body alongside the URL.
 *
 * @example
 * const config: RequestConfig = {
 *   url: '/users/1',
 *   method: 'GET',
 *   params: { expand: 'address' },
 * };
 */
export interface RequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  /** Overrides the global timeout for this request. */
  timeout?: number;
  /** Merged with the internal `AbortController` signal. */
  signal?: AbortSignal;
}

// ─── Retry ──────────────────────────────────────────────────

/**
 * Fine-grained retry configuration for `querySignal`.
 * `AbortError` is never retried regardless of this config.
 *
 * @example
 * const retry: RetryConfig = {
 *   count: 3,
 *   delay: (attempt) => 1000 * 2 ** (attempt - 1),
 *   shouldRetry: (err) => !(err instanceof HttpError && err.isClientError),
 * };
 */
export interface RetryConfig {
  count: number;
  delay?: number | ((attempt: number) => number);
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

// ─── Http Client ──────────────────────────────────────────────────

export type HttpClientStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Options for `querySignal()`.
 *
 * @template T - The expected response data type.
 *
 * @example
 * querySignal('/users', { retry: 3, refetchOnFocus: true, staleTime: 60_000 });
 */
export interface HttpClientOptions<T> {
  initialValue?: T;
  lazy?: boolean;
  retry?: number | RetryConfig;
  staleTime?: number;
  refetchInterval?: number;
  refetchOnFocus?: boolean;
  refetchOnReconnect?: boolean;
  /**
   * When `true`, all fetches (initial, reactive, and manual `refetch()`) are skipped
   * when running on the server. Status stays `idle`, data stays `null` (or `initialValue`).
   * Use this to avoid server-side requests that should only happen in the browser.
   */
  skipOnServer?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

/**
 * State and control handle returned by `querySignal()`.
 *
 * @template T - The response data type.
 *
 * @example
 * const result = querySignal<User>('/users/1');
 * effect(() => console.log(result.status(), result.data()));
 */
export interface HttpClientResult<T> {
  readonly data: Signal<T | null>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<Error | null>;
  readonly status: Signal<HttpClientStatus>;
  readonly isStale: Signal<boolean>;
  refetch: () => Promise<void>;
  invalidate: () => void;
  reset: () => void;
}

// Public-facing aliases for the names used in the exported API
export type QueryStatus = HttpClientStatus;
export type QueryResult<T> = HttpClientResult<T>;
export type RequestOptions<T> = HttpClientOptions<T>;

// ─── Mutation ───────────────────────────────────────────────

/**
 * Lifecycle callbacks for `mutationSignal()`.
 *
 * @template TInput - The input type passed to `mutate()`.
 * @template TOutput - The response data type.
 * @template TContext - Optional context returned by `onMutate` and passed to `onError` for rollback.
 *
 * @example
 * // Optimistic update with rollback
 * mutationSignal(factory, {
 *   onMutate: (input) => {
 *     const prev = cache.get('GET:/todos');
 *     cache.set('GET:/todos', [...currentTodos, { ...input, id: -1 }]);
 *     return prev; // rollback context
 *   },
 *   onError: (err, input, prev) => {
 *     if (prev) cache.set('GET:/todos', prev.data);
 *   },
 * });
 */
export interface MutationOptions<TInput, TOutput, TContext = unknown> {
  /** Called before the network request. Return value becomes the rollback context. */
  onMutate?: (input: TInput) => TContext | Promise<TContext>;
  onSuccess?: (data: TOutput, input: TInput) => void;
  /** `context` is the value returned by `onMutate`, or `undefined` if `onMutate` was not provided. */
  onError?: (error: Error, input: TInput, context: TContext | undefined) => void;
  onSettled?: (data: TOutput | null, error: Error | null, input: TInput) => void;
}

/**
 * State and control handle returned by `mutationSignal()`.
 *
 * @template TInput - The input type passed to `mutate()`.
 * @template TOutput - The response data type.
 *
 * @example
 * const create = mutationSignal<NewUser, User>(factory);
 * await create.mutate({ name: 'Alice' });
 */
export interface MutationResult<TInput, TOutput> {
  readonly isPending: Signal<boolean>;
  readonly error: Signal<Error | null>;
  readonly data: Signal<TOutput | null>;
  mutate: (input: TInput) => Promise<TOutput>;
  reset: () => void;
}