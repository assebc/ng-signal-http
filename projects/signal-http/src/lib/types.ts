import { Signal } from '@angular/core';

// ─── Config ────────────────────────────────────────────────

export interface SignalHttpConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
  interceptors?: HttpInterceptor[];
}

// ─── Interceptors ───────────────────────────────────────────

export interface HttpInterceptor {
  request?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  response?: (response: Response) => Response | Promise<Response>;
  error?: (error: Error) => Error | Promise<never>;
}

// ─── Request ────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  signal?: AbortSignal;
}

// ─── Retry ──────────────────────────────────────────────────

export interface RetryConfig {
  count: number;
  delay?: number | ((attempt: number) => number);
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

// ─── Http Client ──────────────────────────────────────────────────

export type HttpClientStatus = 'idle' | 'loading' | 'success' | 'error';

export interface HttpClientOptions<T> {
  initialValue?: T;
  lazy?: boolean;
  retry?: number | RetryConfig;
  staleTime?: number;
  refetchInterval?: number;
  refetchOnFocus?: boolean;
  refetchOnReconnect?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

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

// ─── Mutation ───────────────────────────────────────────────

export interface MutationOptions<TInput, TOutput> {
  onSuccess?: (data: TOutput, input: TInput) => void;
  onError?: (error: Error, input: TInput) => void;
  onSettled?: (data: TOutput | null, error: Error | null, input: TInput) => void;
}

export interface MutationResult<TInput, TOutput> {
  readonly isPending: Signal<boolean>;
  readonly error: Signal<Error | null>;
  readonly data: Signal<TOutput | null>;
  mutate: (input: TInput) => Promise<TOutput>;
  reset: () => void;
}