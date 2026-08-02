import { SignalHttpClient } from './signal-http-client';
import { RequestConfig, RetryConfig } from '../types';

export function isAbortError(e: unknown): e is Error {
  return e instanceof Error && e.name === 'AbortError';
}

export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function attemptWithRetry<T>(
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
