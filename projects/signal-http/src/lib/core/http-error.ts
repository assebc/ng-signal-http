/**
 * Error thrown when an HTTP request receives a non-2xx response.
 * Extends the native `Error` class and adds HTTP-specific helpers.
 *
 * @example
 * effect(() => {
 *   const err = query.error();
 *   if (err instanceof HttpError && err.isUnauthorized) router.navigate(['/login']);
 * });
 */
export class HttpError extends Error {
  /**
   * @param message - Human-readable error description.
   * @param status - HTTP status code (e.g. 404, 500).
   * @param response - The raw `Response` object, if available.
   */
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: Response
  ) {
    super(message);
    this.name = 'HttpError';
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isTimeout(): boolean { 
    return this.status === 408;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}