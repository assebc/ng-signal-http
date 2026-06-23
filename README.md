# @assebc/ng-signal-http

Signal-native HTTP client for Angular. Wraps the native Fetch API and returns Angular signals directly — no `toSignal()`, no RxJS required.

[![npm](https://img.shields.io/npm/v/@assebc/ng-signal-http)](https://www.npmjs.com/package/@assebc/ng-signal-http)
[![GitHub Packages](https://img.shields.io/github/v/release/assebc/ng-signal-http)](https://github.com/assebc/ng-signal-http/pkgs/npm/ng-signal-http)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Requires Angular 17+.**

---

## Install

```bash
npm install @assebc/ng-signal-http
```

---

## Quick start

**1. Register the provider**

```typescript
// app.config.ts
import { provideSignalHttp } from '@assebc/ng-signal-http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSignalHttp({ baseUrl: 'https://api.example.com' })
  ]
};
```

**2. Fetch data**

```typescript
import { querySignal } from '@assebc/ng-signal-http';

export class UsersComponent {
  users = querySignal<User[]>(() => '/users');
  // users.data(), users.loading(), users.error() are all ready
}
```

**3. Mutate data**

```typescript
import { mutationSignal } from '@assebc/ng-signal-http';

export class CreateUserComponent {
  createUser = mutationSignal<CreateUserDto, User>(
    (input) => ({ url: '/users', method: 'POST', body: input })
  );

  onSubmit(dto: CreateUserDto) {
    this.createUser.mutate(dto);
  }
}
```

---

## Why not `HttpClient + toSignal()`?

| | `HttpClient` | `@assebc/ng-signal-http` |
|---|---|---|
| Return type | `Observable<T>` | `Signal<T>` |
| Loading state | Manual | Built-in |
| Error state | Manual | Built-in |
| Auto-refetch on deps | Manual effect | Automatic |
| RxJS required | Yes | No |
| Request cancellation | Manual | Automatic |
| Retry | Manual | Built-in |

```typescript
// Before
export class UsersComponent {
  private http = inject(HttpClient);
  users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });
  // loading/error state: manual
  // refetch: manual effect
}

// After
export class UsersComponent {
  users = querySignal<User[]>(() => '/api/users');
  // users.data(), users.loading(), users.error(), users.refetch() — built-in
}
```

---

## API

### `provideSignalHttp(config?)`

Register once in `app.config.ts`:

```typescript
provideSignalHttp({
  baseUrl: 'https://api.example.com',
  timeout: 30_000,
  headers: { 'X-API-Version': '2' },
  interceptors: [authInterceptor]
})
```

### `querySignal<T>(urlFactory, options?)`

For GET requests. Re-runs automatically when signal dependencies inside `urlFactory` change.

```typescript
const result = querySignal<User[]>(() => `/users?page=${page()}`);

result.data()     // T | null
result.loading()  // boolean
result.error()    // Error | null
result.status()   // 'idle' | 'loading' | 'success' | 'error'
result.refetch()  // manually re-run
result.reset()    // clear state
```

Options: `initialValue`, `lazy`, `retry`, `onSuccess`, `onError`.

### `mutationSignal<TInput, TOutput>(requestFactory, options?)`

For POST / PUT / PATCH / DELETE. Never executes automatically — user-triggered only.

```typescript
const mutation = mutationSignal<CreateUserDto, User>(
  (input) => ({ url: '/users', method: 'POST', body: input })
);

mutation.isPending()   // boolean
mutation.data()        // TOutput | null
mutation.error()       // Error | null
mutation.mutate(input)
mutation.reset()
```

Options: `onSuccess`, `onError`, `onSettled`.

### `SignalHttpClient`

Injectable service for imperative calls in services or guards:

```typescript
export class UserService {
  private http = inject(SignalHttpClient);

  getUser(id: number) {
    return this.http.get<User>(`/users/${id}`);
  }
}
```

### Interceptors

All three hooks (`request`, `response`, `error`) support async functions and run in registration order:

```typescript
const authInterceptor: HttpInterceptor = {
  request: async (config) => ({
    ...config,
    headers: { ...config.headers, Authorization: `Bearer ${getToken()}` }
  })
};

provideSignalHttp({ interceptors: [authInterceptor] })
```

---

## Reactive queries

Signal dependencies inside `urlFactory` are tracked automatically. When they change, the query re-runs and the previous in-flight request is cancelled:

```typescript
export class UserDetailComponent {
  userId = input.required<number>();

  user = querySignal<User>(() => `/users/${this.userId()}`);
  // re-fetches whenever userId changes, previous request cancelled
}
```

---

## Retry

```typescript
querySignal(() => '/users', {
  retry: { count: 3, delay: (attempt) => 1000 * 2 ** attempt }
})
```

`AbortError` is never retried. Retry logic applies to both queries and mutations.

---

## MVP features

- Native Fetch wrapper — no `@angular/common/http` dependency
- Signal-native queries with auto-refetch on reactive dependencies
- Signal-native mutations (POST / PUT / PATCH / DELETE)
- Request / response / error interceptors (async, run in order)
- Automatic request cancellation via `AbortController` on destroy and dep change
- Retry with exponential backoff, configurable per-request
- Full TypeScript inference — no explicit generic annotations needed at call sites
- Zero runtime dependencies beyond `@angular/core`

---

## Roadmap

**v0.2.0**
In-memory cache with TTL · stale-while-revalidate · optimistic updates · request deduplication · SSR skip-fetch · refetch on focus / reconnect

**v1.0.0**
Persistent cache (IndexedDB) · WebSocket signal integration · GraphQL adapter · plugin system

---

## Contributing & development

```
/
├── projects/signal-http/   ← library source
├── projects/demo/          ← Angular SSR demo app
└── projects/demo-e2e/      ← Cypress E2E tests
```

```bash
npm install                # install deps
npm start                  # demo app → http://localhost:4200
npm test                   # unit tests
npm run build              # build the library
npm run lint               # lint
npm run start:demo-e2e     # Cypress E2E
```

Releases are triggered by pushing a version tag — CI publishes to both npm and GitHub Packages:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

---

## License

MIT
