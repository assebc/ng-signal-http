import { RequestConfig } from '../types';

/**
 * Derives a stable cache key from a URL string or `RequestConfig`.
 * Query params are sorted so that `?b=2&a=1` and `?a=1&b=2` produce the same key.
 */
export function buildCacheKey(urlResult: string | RequestConfig): string {
  if (typeof urlResult === 'string') return `GET:${urlResult}`;
  const { method, url, params, body } = urlResult;
  let key = `${method}:${url}`;
  if (params && Object.keys(params).length > 0) {
    const sorted = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    key += `?${sorted}`;
  }
  if (body !== undefined) {
    key += `:${JSON.stringify(body)}`;
  }
  return key;
}
