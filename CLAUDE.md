# CLAUDE.md — ng-signal-http

Developer reference for this workspace. Read this before touching any file.

---

## What this project is

**ng-signal-http** is a signal-native HTTP client library for Angular.
It wraps the native Fetch API and returns Angular signals directly — no `toSignal()`, no RxJS required.

Target: Angular 17+ (signals required). Zero runtime dependencies beyond `@angular/core`.

---

## Workspace layout

```
/                              ← workspace root (Nx monorepo)
├── projects/
│   ├── signal-http/           ← publishable library (npm: @assebc/ng-signal-http)
│   ├── demo/                  ← Angular SSR app that exercises the library
│   └── demo-e2e/              ← Cypress E2E tests for the demo app
├── tsconfig.base.json         ← root TypeScript config (strict mode, path aliases)
├── nx.json                    ← Nx config (vitest, cypress, eslint plugins)
├── package.json               ← root scripts + devDependencies
└── PRD.md                     ← full product requirements document
```

---

## Library source layout

```
projects/signal-http/src/
├── index.ts                   ← public API — only export from here
└── lib/
    ├── types.ts               ← all shared types and interfaces (source of truth)
    ├── core/
    │   ├── cache-key.ts           ← buildCacheKey() — includes body for non-GET
    │   ├── devtools.ts            ← withRequestLogging() interceptor
    │   ├── http-cache.service.ts  ← HttpCacheService — in-memory + IDB + plugin events
    │   ├── http-error.ts          ← HttpError class
    │   ├── idb-cache.ts           ← IdbCacheAdapter + IDB_CACHE_ADAPTER token
    │   ├── plugin.service.ts      ← PluginService (providedIn: 'root')
    │   ├── providers.ts           ← provideSignalHttp() + providePersistentCache()
    │   ├── request-utils.ts       ← attemptWithRetry, isAbortError, toError
    │   └── signal-http-client.ts  ← SignalHttpClient injectable (Fetch wrapper)
    ├── graphql/
    │   ├── graphql-error.ts       ← GraphQLRequestError
    │   ├── graphql-signal.ts      ← graphqlQuery(), graphqlMutation()
    │   └── graphql.types.ts       ← GraphQLQueryOptions, GraphQLMutationOptions, etc.
    ├── mutation/
    │   ├── mutation.types.ts      ← MutationFactory
    │   └── mutation-signal.ts     ← mutationSignal()
    ├── query/
    │   ├── paginated-query-signal.ts ← paginatedQuerySignal()
    │   ├── parallel-queries.ts       ← parallelQueries()
    │   ├── prefetch-query.ts         ← prefetchQuery()
    │   ├── query.types.ts            ← UrlFactory
    │   └── query-signal.ts           ← querySignal()
    └── websocket/
        ├── websocket.types.ts     ← WebSocketOptions, WebSocketResult, etc.
        └── websocket-signal.ts    ← websocketSignal()
```

`index.ts` is the only public surface. Never import from internal paths in consuming code.

---

## Tech stack

| Concern | Tool |
|---|---|
| Framework | Angular 21 (standalone, signals, zoneless-ready) |
| Language | TypeScript 5.9, strict mode |
| Monorepo | Nx 23 |
| Library packaging | ng-packagr 21 |
| Unit tests | Vitest (via `@nx/angular:unit-test`) |
| E2E tests | Cypress 15 |
| Linting | ESLint 9 + angular-eslint + typescript-eslint |
| Formatting | Prettier 3.6 |
| Local registry | Verdaccio (`.verdaccio/`) for publish smoke-tests |
| SSR runtime | Express 4 via `@angular/ssr` |
| IDB testing | `fake-indexeddb` (devDep, jsdom only) |

---

## Commands

```bash
npm start                 # serve the demo app (http://localhost:4200)
npm run build             # build the library
npm run build:demo        # build the demo app
npm test                  # run library unit tests
npm run test:ci           # unit tests, no watch, with coverage
npm run lint              # lint the library
npm run start:demo-e2e    # run Cypress E2E tests
```

Direct Nx equivalents when needed:

```bash
npx nx build ng-signal-http
npx nx test ng-signal-http
npx nx run ng-signal-http:lint
npx nx serve demo
npx nx e2e demo-e2e
npx nx run-many -t build        # build everything
npx nx run-many -t test         # test everything
```

---

## TypeScript config chain

```
tsconfig.base.json               ← strict flags + path alias @assebc/ng-signal-http
  └── projects/signal-http/tsconfig.json
        ├── tsconfig.lib.json    ← library build (also declares strict flags explicitly)
        └── tsconfig.spec.json   ← Vitest
  └── projects/demo/tsconfig.json
        ├── tsconfig.app.json
        └── tsconfig.spec.json
  └── projects/demo-e2e/tsconfig.json
```

Path alias in `tsconfig.base.json`:

```json
"paths": {
  "@assebc/ng-signal-http": ["./projects/signal-http/src/index.ts"]
}
```

The demo app inherits this alias automatically — import from `@assebc/ng-signal-http`, not relative paths.

---

## Key types (from `lib/types.ts`)

All shared types live in one file. This is the source of truth — do not duplicate types elsewhere.

| Type | Purpose |
|---|---|
| `SignalHttpConfig` | Global config passed to `provideSignalHttp()` — includes `plugins` |
| `HttpInterceptor` | `request` / `response` / `error` hooks |
| `RequestConfig` | Per-request options (url, method, headers, body, params, timeout, signal) |
| `RetryConfig` | Retry count + delay strategy + `shouldRetry` predicate |
| `HttpClientOptions<T>` | Options for `querySignal()` — lazy, retry, stale/refetch knobs, `select`, callbacks |
| `HttpClientResult<T>` | Return value of `querySignal()` — data/loading/error/status signals + refetch/invalidate/reset |
| `MutationOptions<TI,TO,TC>` | Callbacks for `mutationSignal()` — includes `select`, `onMutate` with context |
| `MutationResult<TI,TO>` | Return value of `mutationSignal()` — isPending/error/data signals + mutate/reset |
| `SignalHttpPlugin` | `name`, optional `interceptors[]`, `onCacheSet`, `onCacheDelete`, `onCacheClear` |
| `QueryStatus` | `'idle' \| 'loading' \| 'success' \| 'error'` |

---

## Full API surface

```typescript
// ── Setup ────────────────────────────────────────────────────────────────────
provideSignalHttp(config?: SignalHttpConfig): EnvironmentProviders
providePersistentCache(options?: IdbCacheOptions): EnvironmentProviders

// ── Reactive queries ─────────────────────────────────────────────────────────
querySignal<T>(url: string | UrlFactory, options?: HttpClientOptions<T>): HttpClientResult<T>
paginatedQuerySignal<T>(urlFactory: (page: unknown) => string, options?: PaginatedOptions<T>): PaginatedResult<T>
parallelQueries<T>(factories: UrlFactory[], options?: HttpClientOptions<T>): ParallelQueriesResult<T>
prefetchQuery(urlOrConfig: string | RequestConfig, options?: { staleTime?: number }): Promise<void>

// ── Mutations ────────────────────────────────────────────────────────────────
mutationSignal<TInput, TOutput>(factory: MutationFactory<TInput>, options?: MutationOptions<TInput, TOutput>): MutationResult<TInput, TOutput>

// ── WebSocket ────────────────────────────────────────────────────────────────
websocketSignal<T>(url: string | UrlFactory, options?: WebSocketOptions<T>): WebSocketResult<T>

// ── GraphQL ──────────────────────────────────────────────────────────────────
graphqlQuery<TData, TVariables>(endpoint: string, document: string, options?: GraphQLQueryOptions<TData, TVariables>): HttpClientResult<TData>
graphqlMutation<TData, TVariables>(endpoint: string, document: string, options?: GraphQLMutationOptions<TData, TVariables>): MutationResult<TVariables, TData>

// ── Imperative / low-level ───────────────────────────────────────────────────
class SignalHttpClient {
  executeRequest<T>(config: RequestConfig): Promise<T>
  get<T>(url: string, options?: RequestOptions): Promise<T>
  post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>
  put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>
  patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T>
  delete<T>(url: string, options?: RequestOptions): Promise<T>
}

// ── Devtools ─────────────────────────────────────────────────────────────────
withRequestLogging(options?: RequestLoggingOptions): HttpInterceptor
```

---

## Design rules

- **Signal-first**: every public result surface is a `Signal<T>`, never an Observable.
- **No `@angular/common/http`**: built directly on native `fetch()`.
- **No `any`**: strict TypeScript throughout. Generic inference must work without explicit annotations at call sites.
- **AbortController everywhere**: in-flight requests cancel on component destroy and when reactive deps change. Cancelled requests never update signals.
- **Never retry an AbortError**: check `error.name === 'AbortError'` before applying retry logic.
- **Interceptors are async**: all three hooks (`request`, `response`, `error`) support `Promise` return values and run in registration order (config interceptors first, then plugin interceptors).
- **Cache stores raw, select is re-applied**: `select` transforms the value at read time; the raw response is always what goes into the cache so that `select` can be applied consistently on every hit.
- **`restore()` vs `set()` in HttpCacheService**: use `restore()` during hydration — it writes to the in-memory map only, bypassing the IDB adapter and plugin events to avoid a write-back loop.
- **SSR guards**: WebSocket and window event listeners (`focus`, `online`) are no-ops on the server. Check `isPlatformBrowser` before accessing `window`.
- **Component prefix**: `sh` (e.g. `<sh-example>`). Directives use camelCase `sh` prefix.

---

## Naming conventions

| Item | Convention | Example |
|---|---|---|
| Component selector | `sh-` kebab-case | `<sh-query-demo>` |
| Directive selector | `sh` camelCase | `[shLazy]` |
| Services | `PascalCase` + `Service` suffix | `SignalHttpClient` |
| Functions (public API) | camelCase | `querySignal`, `mutationSignal` |
| Types / interfaces | PascalCase | `HttpClientResult<T>` |
| Files | kebab-case | `query-signal.ts`, `http-error.ts` |

---

## Testing requirements (from PRD)

| Area | Coverage target |
|---|---|
| Core HTTP client | 90% |
| `querySignal` | 85% |
| `mutationSignal` | 85% |
| Interceptors | 80% |
| Error handling | 90% |

Unit tests live next to source files (`*.spec.ts`). E2E tests are in `projects/demo-e2e/src/e2e/`.

### IDB tests

- Use `import 'fake-indexeddb/auto'` at the top of `idb-cache.spec.ts` — it installs `indexedDB` into `globalThis` for jsdom.
- Use a unique `dbName` per test (e.g. `test-db-${++index}`) to prevent state leaking between tests.
- `@nx/dependency-checks` is scoped to exclude `**/*.spec.ts` in `eslint.config.mjs` so test-only devDeps (`vitest`, `fake-indexeddb`) don't trigger false lint errors.

### WebSocket tests

- `MockWebSocket` must declare static constants (`static readonly CONNECTING = 0`, etc.) because replacing `globalThis.WebSocket` means `WebSocket.OPEN` resolves to the mock class's static property — without them it is `undefined`.
- Use `runInInjectionContext(fixture.componentRef.injector, cb)` (not `TestBed.runInInjectionContext`) so `DestroyRef` is component-scoped and `fixture.destroy()` correctly fires cleanup.

### APP_INITIALIZER tests

- `TestBed.inject(APP_INITIALIZER, [])` returns all registered initializer functions. Call each one directly and `await Promise.all(...)` — do not rely on `ApplicationRef.whenStable()` in zoneless test environments.

---

## Roadmap (phases from PRD)

**v0.1.0 — MVP** ✅  
`querySignal`, `mutationSignal`, `SignalHttpClient`, `provideSignalHttp`, interceptors, retry, cancellation.

**v0.2.0** ✅  
In-memory cache + SWR · request deduplication · optimistic updates · `skipOnServer` · refetch on focus/reconnect · `paginatedQuerySignal` · `parallelQueries` · `prefetchQuery` · `withRequestLogging`.

**v1.0.0** ✅  
Persistent cache (IndexedDB) · WebSocket signal integration · GraphQL adapter · plugin system · `select` transform option.

---

## Out of scope (never implement)

- Observable-based API
- Built-in auth flows (use interceptors)
- IE11 / browsers without native `fetch`
- REST-specific conventions (stay generic HTTP)
