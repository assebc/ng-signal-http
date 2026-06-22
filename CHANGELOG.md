# Changelog

All notable changes to `ng-signal-http` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- `querySignal<T>()` — reactive GET query with auto-refetch on signal dependency change
- `mutationSignal<TInput, TOutput>()` — imperative POST/PUT/PATCH/DELETE with signal state
- `SignalHttpClient` — injectable low-level Fetch wrapper with `executeRequest`
- `provideSignalHttp()` — environment provider for global configuration
- `HttpError` — typed error class with `isClientError`, `isServerError`, `isNotFound`, `isUnauthorized`, `isForbidden`, `isTimeout` helpers
- Interceptor pipeline — async `request`, `response`, and `error` hooks in registration order
- Retry logic with fixed delay, custom delay function, and `shouldRetry` predicate; `AbortError` never retried
- Request cancellation via `AbortController` — in-flight requests cancelled on component destroy and reactive dep change
- `staleTime`, `refetchInterval`, `refetchOnFocus`, `refetchOnReconnect` options for `querySignal`
- `isStale` signal and `invalidate()` method on `HttpClientResult`
- SSR support — window event listeners skipped on non-browser platforms
- Full TypeScript strict mode; generic inference requires no explicit annotations at call sites
- Zero runtime dependencies beyond `@angular/core`
