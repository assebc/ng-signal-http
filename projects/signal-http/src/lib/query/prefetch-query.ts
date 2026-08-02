import { inject } from '@angular/core';
import { SignalHttpClient } from '../core/signal-http-client';
import { HttpCacheService } from '../core/http-cache.service';
import { buildCacheKey } from '../core/cache-key';
import { RequestConfig } from '../types';

/**
 * Eagerly warms the cache for a URL before the component that needs it mounts.
 * Must be called in an injection context (e.g. a route resolver or `ngOnInit` of a parent).
 *
 * - If the cache already has a fresh entry (within `staleTime`), no request is made.
 * - Errors are silently swallowed — the query that eventually mounts will retry.
 *
 * @param urlOrConfig - URL string or full `RequestConfig`.
 * @param options.staleTime - Age (ms) below which an existing cache entry is considered fresh.
 *                            When omitted, any existing entry is treated as fresh and skipped.
 */
export function prefetchQuery<T = unknown>(
  urlOrConfig: string | RequestConfig,
  options?: { staleTime?: number }
): Promise<void> {
  const httpClient = inject(SignalHttpClient);
  const cache = inject(HttpCacheService);

  const key = buildCacheKey(urlOrConfig);

  // Skip if already fresh.
  if (options?.staleTime !== undefined) {
    if (!cache.isExpired(key, options.staleTime)) return Promise.resolve();
  } else {
    // No staleTime supplied — skip if any entry exists.
    if (cache.has(key)) return Promise.resolve();
  }

  const config: RequestConfig =
    typeof urlOrConfig === 'string'
      ? { url: urlOrConfig, method: 'GET' }
      : urlOrConfig;

  return httpClient
    .executeRequest<T>(config)
    .then(data => {
      cache.set(key, data);
    })
    .catch(() => {
      // Prefetch failures are non-fatal; swallow silently.
    });
}
