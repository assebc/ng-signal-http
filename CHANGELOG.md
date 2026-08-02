# Changelog

All notable changes to `ng-signal-http` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-08-02

### Added

- **Persistent cache** — `providePersistentCache(options?)` writes every cache entry through to IndexedDB and hydrates the in-memory cache on startup; SSR-safe (no-op on the server)
- **`IdbCacheAdapter`** — thin async wrapper around the raw IndexedDB API; lazy `open()`, silent-fail write ops, `getAll()` for hydration; injectable via `IDB_CACHE_ADAPTER` token
- **WebSocket signal** — `websocketSignal<T>(url, options?)` returns a reactive `WebSocketResult<T>` with `data`, `status`, `send`, `close`, `reconnect` and auto-reconnect with exponential back-off
  - Reactive URL factory: changing signal deps automatically reconnects to the new URL
  - `ReconnectConfig` — `maxAttempts` and custom `delay(attempt)` function
  - SSR guard — no-op on the server; `status` stays `'closed'`
- **GraphQL adapter**
  - `graphqlQuery<TData, TVariables>(endpoint, document, options?)` — POST-based query; unwraps `response.data`, surfaces `response.errors` as `GraphQLRequestError`; reactive variables factory supported
  - `graphqlMutation<TData, TVariables>(endpoint, document, options?)` — same unwrapping; imperative via `.mutate(variables)`
  - `GraphQLRequestError` — extends `Error`; carries `errors: GraphQLError[]`; message is all error messages joined by `'; '`
- **Plugin system** — `SignalHttpPlugin` interface (`name`, `interceptors?`, `onCacheSet?`, `onCacheDelete?`, `onCacheClear?`) registered via `provideSignalHttp({ plugins: [...] })`; `PluginService` injectable for advanced use
- **`select` option** — `HttpClientOptions.select` and `MutationOptions.select` transform the raw response before it is stored in signals and passed to callbacks; cache always stores the raw value so `select` is re-applied on every cache hit

### Changed

- `SignalHttpClient` now merges plugin interceptors with config interceptors at request time
- `buildCacheKey` includes the serialised request body when present — required for GraphQL to distinguish queries with different variables
- `HttpCacheService` emits plugin lifecycle events (`onCacheSet`, `onCacheDelete`, `onCacheClear`) and accepts an optional `IDB_CACHE_ADAPTER`; new `restore()` method writes to in-memory store only (used during hydration to prevent write-back loops)
- `onSuccess` callback now receives the already-transformed value (post-`select`) consistently across all fetch paths (fresh hit, stale hit, inflight join, normal fetch)

---

## [0.2.0] — 2026-07-01

### Added

- **In-memory cache with SWR** — `staleTime` option on `querySignal`; fresh hits skip the network, stale hits serve cached data immediately and revalidate silently in the background
- **`isStale` signal** and **`invalidate()`** method on `HttpClientResult`
- **Request deduplication** — concurrent `querySignal` calls for the same URL join the single in-flight `Promise` instead of firing duplicate requests
- **Optimistic updates** — `onMutate` callback on `mutationSignal` runs before the network request and returns a rollback context passed to `onError`
- **`skipOnServer`** — query does not fetch when running in an SSR context; status stays `'idle'`
- **`refetchOnFocus`** — re-fetches when the browser window regains focus (skipped if data is not stale)
- **`refetchOnReconnect`** — re-fetches when the browser comes back online
- **`refetchInterval`** — polls at a fixed interval; skipped while a fetch is in flight
- **`paginatedQuerySignal<T>(urlFactory, options?)`** — cursor/page-based infinite scroll with `pages`, `hasNextPage`, `isFetchingNextPage`, `fetchNextPage`
- **`parallelQueries<T>(factories, options?)`** — run N queries simultaneously and expose a single combined result handle
- **`prefetchQuery(urlOrConfig, options?)`** — prime the cache before a component mounts; call from route resolvers or guards
- **`withRequestLogging(options?)`** — devtools interceptor that logs requests, responses, and errors to the browser console

### Changed

- `querySignal` `reset()` now also clears the cache entry for the current URL

---

## [0.1.0] — 2026-06-01

### Added

- **`querySignal<T>(url, options?)`** — reactive GET query; re-fetches automatically when signal dependencies inside the URL factory change; in-flight request cancelled on component destroy and on dep change
- **`mutationSignal<TInput, TOutput>(factory, options?)`** — imperative POST / PUT / PATCH / DELETE with `isPending`, `data`, `error` signals and `mutate()` / `reset()` methods
- **`SignalHttpClient`** — injectable Fetch wrapper with `executeRequest()`, `get()`, `post()`, `put()`, `patch()`, `delete()` methods; accepts timeout, custom headers, and an `AbortSignal`
- **`provideSignalHttp(config?)`** — environment provider for global config: `baseUrl`, `timeout`, `headers`, `interceptors`
- **`HttpError`** — typed error class with `status`, `statusText`, `isClientError`, `isServerError`, `isNotFound`, `isUnauthorized`, `isForbidden`, `isTimeout` helpers
- **Interceptor pipeline** — async `request`, `response`, and `error` hooks; run in registration order; support `Promise` return values
- **Retry** — `retry` option accepts a count or `RetryConfig` (`count`, `delay`, `shouldRetry`); `AbortError` is never retried
- **Request cancellation** — `AbortController` per request; cancelled on component destroy and when reactive deps change; cancelled requests never update signals
- **TypeScript strict mode** — generic inference requires no explicit annotations at call sites; no `any` in the public API
- **Zero runtime dependencies** beyond `@angular/core`
