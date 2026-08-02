import { HttpInterceptor, RequestConfig } from '../types';

export interface RequestLoggingOptions {
  /** When `true`, logs the full request config inside a collapsed console group. */
  verbose?: boolean;
  /** Provide a custom logger (useful for testing). Defaults to the global `console`. */
  logger?: Pick<Console, 'group' | 'groupCollapsed' | 'groupEnd' | 'log' | 'error'>;
}

/**
 * Returns an `HttpInterceptor` that logs every request, response, and error to
 * the console (or a custom logger).
 *
 * Designed for development use — add it to `provideSignalHttp({ interceptors: [...] })`.
 *
 * @example
 * provideSignalHttp({
 *   interceptors: [withRequestLogging({ verbose: true })],
 * });
 */
export function withRequestLogging(options?: RequestLoggingOptions): HttpInterceptor {
  const log = options?.logger ?? console;

  return {
    request: (config: RequestConfig): RequestConfig => {
      const label = `→ ${config.method} ${config.url}`;
      if (options?.verbose) {
        log.groupCollapsed(label);
        log.log(config);
        log.groupEnd();
      } else {
        log.log(label);
      }
      return config;
    },

    response: (response: Response): Response => {
      log.log(`← ${response.status} ${response.url}`);
      return response;
    },

    error: (error: Error): Promise<never> => {
      log.error(error);
      return Promise.reject(error);
    },
  };
}
