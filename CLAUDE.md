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
    │   ├── http-error.ts      ← HttpError class
    │   ├── signal-http-client.ts  ← SignalHttpClient injectable (Fetch wrapper)
    │   └── providers.ts       ← provideSignalHttp() environment provider
    ├── query/
    │   ├── query.types.ts     ← QueryOptions, QueryResult, UrlFactory
    │   └── query-signal.ts    ← querySignal() function
    └── mutation/
        ├── mutation.types.ts  ← MutationOptions, MutationResult
        └── mutation-signal.ts ← mutationSignal() function
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
| `SignalHttpConfig` | Global config passed to `provideSignalHttp()` |
| `HttpInterceptor` | `request` / `response` / `error` hooks |
| `RequestConfig` | Per-request options (url, method, headers, body, params, timeout, signal) |
| `RetryConfig` | Retry count + delay strategy + `shouldRetry` predicate |
| `HttpClientOptions<T>` | Options for `querySignal()` — lazy, retry, stale/refetch knobs, callbacks |
| `HttpClientResult<T>` | Return value of `querySignal()` — data/loading/error/status signals + refetch/invalidate/reset |
| `MutationOptions<TI,TO>` | Callbacks for `mutationSignal()` |
| `MutationResult<TI,TO>` | Return value of `mutationSignal()` — isPending/error/data signals + mutate/reset |

---

## API surface (MVP)

```typescript
// Setup — call once in app.config.ts
provideSignalHttp(config?: SignalHttpConfig): EnvironmentProviders

// GET requests — reactive, auto-refetch on signal dependency change
querySignal<T>(urlFactory: () => string | RequestConfig, options?: HttpClientOptions<T>): HttpClientResult<T>

// POST / PUT / PATCH / DELETE — user-triggered
mutationSignal<TInput, TOutput>(
  requestFactory: (input: TInput) => RequestConfig,
  options?: MutationOptions<TInput, TOutput>
): MutationResult<TInput, TOutput>

// Direct imperative calls (guards, services)
class SignalHttpClient {
  get / post / put / patch / delete / request
}
```

---

## Design rules

- **Signal-first**: every public result surface is a `Signal<T>`, never an Observable.
- **No `@angular/common/http`**: built directly on native `fetch()`.
- **No `any`**: strict TypeScript throughout. Generic inference must work without explicit annotations at call sites.
- **AbortController everywhere**: in-flight requests cancel on component destroy and when reactive deps change. Cancelled requests never update signals.
- **Never retry an AbortError**: check `error.name === 'AbortError'` before applying retry logic.
- **Interceptors are async**: all three hooks (`request`, `response`, `error`) support `Promise` return values and run in registration order.
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

Critical test cases:
- Successful GET returns data signal
- Failed request sets error signal, clears loading
- Loading transitions: idle → loading → success / error
- Request cancels when component destroys
- Retry executes N times with backoff; AbortError is not retried
- Interceptors modify request config and response
- Reactive query refetches when signal dependency changes

---

## Roadmap (phases from PRD)

**v0.1.0 — MVP (current)**
`querySignal`, `mutationSignal`, `SignalHttpClient`, `provideSignalHttp`, interceptors, retry, cancellation.

**v0.2.0**
In-memory cache with TTL, stale-while-revalidate, optimistic updates, request deduplication, SSR skip-fetch, refetch on focus/reconnect.

**v1.0.0**
Persistent cache (IndexedDB), WebSocket signal integration, GraphQL adapter, plugin system.

---

## Out of scope (never implement)

- Observable-based API
- Built-in auth flows (use interceptors)
- IE11 / browsers without native `fetch`
- GraphQL client (Phase 3 adapter only)
- REST-specific conventions (stay generic HTTP)
