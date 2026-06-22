import { DestroyRef, inject, Injectable, Signal, signal } from "@angular/core";
import { SIGNAL_HTTP_CONFIG } from "./providers";
import { RequestConfig } from "../types";
import { HttpError } from "./http-error";

/**
 * Low-level HTTP service that wraps the native Fetch API.
 * Prefer `querySignal` and `mutationSignal` for component use;
 * use this directly in guards, resolvers, and async effects.
 *
 * @example
 * const http = inject(SignalHttpClient);
 * const user = await http.executeRequest<User>({ url: '/users/1', method: 'GET' });
 */
@Injectable({ providedIn: 'root' })
export class SignalHttpClient {
  private readonly config = inject(SIGNAL_HTTP_CONFIG, { optional: true }) ?? {};

  /**
   * Fires a GET request and returns a read-only signal updated when the response arrives.
   * Must be called from an injection context. The request is aborted on host destroy.
   *
   * @param url - Absolute or base-relative URL.
   * @param options - Per-request overrides (headers, params, timeout, signal).
   * @returns A read-only `Signal<T | null>` — `null` until the response arrives.
   *
   * @example
   * readonly user = inject(SignalHttpClient).get<User>('/users/1');
   */
  get<T>(url: string, options?: Partial<RequestConfig>): Signal<T | null> {
    return this.createSignal<T>({ ...options, url, method: 'GET' });
  }

  /**
   * Fires a POST request and returns a read-only signal updated when the response arrives.
   * Must be called from an injection context. The request is aborted on host destroy.
   *
   * @param url - Absolute or base-relative URL.
   * @param body - Request body; serialised to JSON.
   * @param options - Per-request overrides.
   * @returns A read-only `Signal<T | null>` — `null` until the response arrives.
   *
   * @example
   * readonly result = inject(SignalHttpClient).post<Token>('/auth/login', credentials);
   */
  post<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Signal<T | null> {
    return this.createSignal<T>({ ...options, url, method: 'POST', body });
  }

  /**
   * Fires a PUT request and returns a read-only signal updated when the response arrives.
   * Must be called from an injection context. The request is aborted on host destroy.
   *
   * @param url - Absolute or base-relative URL.
   * @param body - Request body; serialised to JSON.
   * @param options - Per-request overrides.
   * @returns A read-only `Signal<T | null>` — `null` until the response arrives.
   *
   * @example
   * readonly updated = inject(SignalHttpClient).put<User>('/users/1', { name: 'Alice' });
   */
  put<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Signal<T | null> {
    return this.createSignal<T>({ ...options, url, method: 'PUT', body });
  }

  /**
   * Fires a PATCH request and returns a read-only signal updated when the response arrives.
   * Must be called from an injection context. The request is aborted on host destroy.
   *
   * @param url - Absolute or base-relative URL.
   * @param body - Partial request body; serialised to JSON.
   * @param options - Per-request overrides.
   * @returns A read-only `Signal<T | null>` — `null` until the response arrives.
   *
   * @example
   * readonly patched = inject(SignalHttpClient).patch<User>('/users/1', { email: 'new@example.com' });
   */
  patch<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Signal<T | null> {
    return this.createSignal<T>({ ...options, url, method: 'PATCH', body });
  }

  /**
   * Fires a DELETE request and returns a read-only signal updated when the response arrives.
   * Must be called from an injection context. The request is aborted on host destroy.
   *
   * @param url - Absolute or base-relative URL.
   * @param options - Per-request overrides.
   * @returns A read-only `Signal<T | null>` — `null` until the response arrives.
   *
   * @example
   * readonly deleted = inject(SignalHttpClient).delete<void>('/users/1');
   */
  delete<T>(url: string, options?: Partial<RequestConfig>): Signal<T | null> {
    return this.createSignal<T>({ ...options, url, method: 'DELETE' });
  }

  /**
   * Executes a raw HTTP request and returns a `Promise`.
   * Use this in effects, event handlers, guards, and resolvers where async/await is preferred.
   * Runs request → response → error interceptors in registration order.
   * `AbortError` is re-thrown without passing through error interceptors.
   *
   * @param config - Full request configuration including method and URL.
   * @returns A `Promise` that resolves with the parsed response body.
   * @throws `HttpError` on non-2xx responses; `AbortError` on cancellation.
   *
   * @example
   * const token = await http.executeRequest<Token>({ url: '/auth/login', method: 'POST', body: creds });
   */
  async executeRequest<T>(config: RequestConfig): Promise<T> {
    let processedConfig = { ...config };

    for (const interceptor of this.config.interceptors ?? []) {
      if (interceptor.request) {
        processedConfig = await interceptor.request(processedConfig);
      }
    }

    const url = this.buildUrl(processedConfig);
    const headers = this.buildHeaders(processedConfig);
    const timeout = processedConfig.timeout ?? this.config.timeout;

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeout) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    if (processedConfig.signal) {
      if (processedConfig.signal.aborted) {
        controller.abort(processedConfig.signal.reason);
      } else {
        processedConfig.signal.addEventListener(
          'abort',
          () => controller.abort(processedConfig.signal?.reason),
          { once: true }
        );
      }
    }

    try {
      const init: RequestInit = {
        method: processedConfig.method,
        headers,
        signal: controller.signal,
      };

      if (processedConfig.body !== undefined) {
        init.body = JSON.stringify(processedConfig.body);
      }

      let response = await fetch(url, init);

      for (const interceptor of this.config.interceptors ?? []) {
        if (interceptor.response) {
          response = await interceptor.response(response);
        }
      }

      if (!response.ok) {
        throw new HttpError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response
        );
      }

      return this.parseResponse<T>(response);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      let err = error instanceof Error ? error : new Error(String(error));

      for (const interceptor of this.config.interceptors ?? []) {
        if (interceptor.error) {
          err = await interceptor.error(err);
        }
      }

      throw err;

    } finally {
      clearTimeout(timeoutId);
    }
  }

  private createSignal<T>(config: RequestConfig): Signal<T | null> {
    const result = signal<T | null>(null);
    const controller = new AbortController();

    inject(DestroyRef).onDestroy(() => controller.abort());

    this.executeRequest<T>({ ...config, signal: controller.signal })
      .then(data => result.set(data))
      .catch((err: unknown) => {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.error('[ng-signal-http]', err);
        }
      });

    return result.asReadonly();
  }

  private buildUrl(config: RequestConfig): string {
    let url: string;

    if (config.url.startsWith('http://') || config.url.startsWith('https://')) {
      url = config.url;
    } else {
      const base = this.config.baseUrl?.replace(/\/$/, '') ?? '';
      const path = config.url.startsWith('/') ? config.url : `/${config.url}`;
      url = base ? `${base}${path}` : config.url;
    }

    if (config.params && Object.keys(config.params).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(config.params)) {
        params.append(key, String(value));
      }
      url += `?${params.toString()}`;
    }

    return url;
  }

  private buildHeaders(config: RequestConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...config.headers,
    };
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json() as Promise<T>;
    }
    return response.text() as unknown as Promise<T>;
  }
}
