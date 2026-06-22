# ng-signal-http

[![npm version](https://img.shields.io/npm/v/ng-signal-http)](https://www.npmjs.com/package/ng-signal-http)
[![bundle size](https://img.shields.io/bundlephobia/minzip/ng-signal-http)](https://bundlephobia.com/package/ng-signal-http)
[![license](https://img.shields.io/npm/l/ng-signal-http)](https://github.com/assebc/ng-signal-http/blob/master/LICENSE)
[![Angular](https://img.shields.io/badge/Angular-17%2B-red)](https://angular.dev)

Signal-native HTTP client for Angular. Wraps the native Fetch API and returns Angular signals directly — no `toSignal()`, no RxJS required.

Built for the post-zoneless Angular era using only `@angular/core` primitives.

---

## Why ng-signal-http?

| Feature | `@angular/common/http` | `ng-signal-http` |
|---|---|---|
| Returns | `Observable` | `Signal` |
| RxJS required | Yes | No |
| Loading state | Manual | Built-in |
| Error state | Manual | Built-in |
| Reactive refetch | Manual (`switchMap`) | Automatic |
| Request cancellation | Manual (`takeUntil`) | Automatic |
| Retry | Manual (`retryWhen`) | Built-in |
| Bundle size | ~25 KB | < 15 KB |

**Before**

```typescript
export class UsersComponent {
  private http = inject(HttpClient);
  users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });
  // loading? error? refetch? — manual work.
}
```

**After**

```typescript
export class UsersComponent {
  users = querySignal<User[]>('/api/users');
  // users.data(), users.loading(), users.error(), users.refetch() — done.
}
```

---

## Install

```bash
npm install ng-signal-http
```

Peer dependencies: `@angular/core` and `@angular/common` ≥ 17.

---

## Setup

Call `provideSignalHttp()` once in `app.config.ts`:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideSignalHttp } from 'ng-signal-http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSignalHttp({
      baseUrl: 'https://api.example.com',
      timeout: 10_000,
    }),
  ],
};
```

---

## Basic usage

### GET — `querySignal`

```typescript
import { Component } from '@angular/core';
import { querySignal } from 'ng-signal-http';

interface User { id: number; name: string; }

@Component({
  template: `
    @if (user.loading()) { <p>Loading…</p> }
    @if (user.error()) { <p>Error: {{ user.error()?.message }}</p> }
    @if (user.data()) { <p>{{ user.data()?.name }}</p> }
  `,
})
export class UserComponent {
  user = querySignal<User>('/users/1');
}
```

### POST / PUT / PATCH / DELETE — `mutationSignal`

```typescript
import { Component } from '@angular/core';
import { mutationSignal } from 'ng-signal-http';

interface CreateUser { name: string; email: string; }
interface User { id: number; name: string; email: string; }

@Component({
  template: `
    <button (click)="submit()" [disabled]="newUser.isPending()">Create</button>
    @if (newUser.data()) { <p>Created id: {{ newUser.data()?.id }}</p> }
    @if (newUser.error()) { <p>{{ newUser.error()?.message }}</p> }
  `,
})
export class CreateUserComponent {
  newUser = mutationSignal<CreateUser, User>(
    (input) => ({ url: '/users', method: 'POST', body: input }),
  );

  submit() {
    this.newUser.mutate({ name: 'Alice', email: 'alice@example.com' });
  }
}
```

---

## Reactive queries

`querySignal` tracks every signal read inside the URL factory and automatically refetches when any of them change:

```typescript
import { Component, signal } from '@angular/core';
import { querySignal } from 'ng-signal-http';

@Component({
  template: `
    <input type="number" [value]="userId()" (input)="userId.set(+$event.target.value)" />
    @if (user.loading()) { <span>Loading…</span> }
    <p>{{ user.data()?.name }}</p>
  `,
})
export class UserComponent {
  userId = signal(1);

  // Automatically refetches whenever userId() changes.
  user = querySignal<User>(() => `/users/${this.userId()}`);
}
```

### Lazy queries

```typescript
search = querySignal<Result[]>(() => `/search?q=${this.query()}`, { lazy: true });

onSearch() {
  this.search.refetch();
}
```

### Polling

```typescript
stats = querySignal('/dashboard/stats', { refetchInterval: 30_000 });
```

### Refetch on focus / reconnect

```typescript
feed = querySignal('/feed', {
  staleTime: 60_000,        // only refetch if data is older than 60 s
  refetchOnFocus: true,     // refetch when window regains focus (if stale)
  refetchOnReconnect: true, // refetch when network comes back online
});
```

---

## Mutations

```typescript
import { mutationSignal } from 'ng-signal-http';

updatePost = mutationSignal<{ id: number; title: string }, Post>(
  ({ id, ...body }) => ({ url: `/posts/${id}`, method: 'PUT', body }),
  {
    onSuccess: (post) => console.log('Updated:', post.title),
    onError: (err) => console.error('Failed:', err.message),
    onSettled: (data, err) => console.log('Done', data, err),
  },
);

// Calling mutate() while a previous request is in flight cancels the previous one.
await this.updatePost.mutate({ id: 1, title: 'New title' });
```

---

## Interceptors

All hooks are optional and may return a `Promise`. They run in registration order.

```typescript
provideSignalHttp({
  baseUrl: 'https://api.example.com',
  interceptors: [
    {
      // Attach an auth token to every request
      request: async (config) => ({
        ...config,
        headers: { ...config.headers, Authorization: `Bearer ${getToken()}` },
      }),

      // Log every response
      response: async (response) => {
        console.log(response.status, response.url);
        return response;
      },

      // Transform or react to errors
      error: async (err) => {
        if (err instanceof HttpError && err.isUnauthorized) {
          await refreshToken();
        }
        return err;
      },
    },
  ],
});
```

---

## Error handling

Failed requests set the `error` signal to an `HttpError` with convenience getters:

```typescript
import { HttpError, querySignal } from 'ng-signal-http';
import { effect } from '@angular/core';

const post = querySignal<Post>('/posts/1');

effect(() => {
  const err = post.error();
  if (!err) return;
  if (err instanceof HttpError) {
    if (err.isNotFound)     console.log('Not found');
    if (err.isUnauthorized) router.navigate(['/login']);
    if (err.isServerError)  console.error(`Server error ${err.status}`);
  }
});
```

### Retry

```typescript
// Retry up to 3 times immediately
querySignal('/data', { retry: 3 });

// Custom retry with exponential backoff
querySignal('/data', {
  retry: {
    count: 4,
    delay: (attempt) => 1000 * 2 ** (attempt - 1),
    shouldRetry: (err) => !(err instanceof HttpError && err.isClientError),
  },
});
```

`AbortError` (request cancellation or component destroy) is never retried.

---

## Full API reference

### `provideSignalHttp(config?)`

Registers the library. Call once in `app.config.ts`.

```typescript
provideSignalHttp(config?: SignalHttpConfig): EnvironmentProviders
```

| `SignalHttpConfig` | Type | Description |
|---|---|---|
| `baseUrl` | `string` | Prefix prepended to all relative URLs |
| `headers` | `Record<string, string>` | Default headers sent with every request |
| `timeout` | `number` | Global request timeout in ms |
| `interceptors` | `HttpInterceptor[]` | Request / response / error hooks |

---

### `querySignal<T>(url, options?)`

```typescript
querySignal<T>(url: string | UrlFactory, options?: HttpClientOptions<T>): HttpClientResult<T>
```

`UrlFactory`: `() => string | RequestConfig`

**Options (`HttpClientOptions<T>`)**

| Option | Type | Default | Description |
|---|---|---|---|
| `initialValue` | `T` | `null` | Signal value before the first successful fetch |
| `lazy` | `boolean` | `false` | Skip the initial fetch; call `refetch()` manually |
| `retry` | `number \| RetryConfig` | — | Retry on failure |
| `staleTime` | `number` | — | Ms after which data is considered stale |
| `refetchInterval` | `number` | — | Poll interval in ms |
| `refetchOnFocus` | `boolean` | `false` | Refetch on window focus (only if stale) |
| `refetchOnReconnect` | `boolean` | `false` | Refetch when network reconnects |
| `onSuccess` | `(data: T) => void` | — | Called after a successful fetch |
| `onError` | `(error: Error) => void` | — | Called after a failed fetch |

**Return value (`HttpClientResult<T>`)**

| Property | Type | Description |
|---|---|---|
| `data` | `Signal<T \| null>` | Response data; `null` until first success |
| `loading` | `Signal<boolean>` | `true` while a request is in flight |
| `error` | `Signal<Error \| null>` | Last error; cleared when a new fetch starts |
| `status` | `Signal<'idle' \| 'loading' \| 'success' \| 'error'>` | Explicit state machine value |
| `isStale` | `Signal<boolean>` | `true` if data is older than `staleTime` |
| `refetch()` | `() => Promise<void>` | Manually trigger a new fetch |
| `invalidate()` | `() => void` | Mark data as stale without triggering a fetch |
| `reset()` | `() => void` | Abort in-flight request and restore initial state |

---

### `mutationSignal<TInput, TOutput>(factory, options?)`

```typescript
mutationSignal<TInput, TOutput>(
  requestFactory: (input: TInput) => RequestConfig,
  options?: MutationOptions<TInput, TOutput>
): MutationResult<TInput, TOutput>
```

**Options (`MutationOptions<TInput, TOutput>`)**

| Option | Type | Description |
|---|---|---|
| `onSuccess` | `(data: TOutput, input: TInput) => void` | Called on success |
| `onError` | `(error: Error, input: TInput) => void` | Called on failure |
| `onSettled` | `(data: TOutput \| null, error: Error \| null, input: TInput) => void` | Called after either outcome |

**Return value (`MutationResult<TInput, TOutput>`)**

| Property | Type | Description |
|---|---|---|
| `isPending` | `Signal<boolean>` | `true` while the request is in flight |
| `data` | `Signal<TOutput \| null>` | Last successful response |
| `error` | `Signal<Error \| null>` | Last error |
| `mutate(input)` | `(input: TInput) => Promise<TOutput>` | Trigger the request |
| `reset()` | `() => void` | Clear all state |

---

### `SignalHttpClient`

Injectable service for imperative HTTP calls — guards, resolvers, one-off effects.

```typescript
@Injectable({ providedIn: 'root' })
class SignalHttpClient {
  get<T>(url: string, options?: Partial<RequestConfig>): Signal<T | null>
  post<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Signal<T | null>
  put<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Signal<T | null>
  patch<T>(url: string, body?: unknown, options?: Partial<RequestConfig>): Signal<T | null>
  delete<T>(url: string, options?: Partial<RequestConfig>): Signal<T | null>
  executeRequest<T>(config: RequestConfig): Promise<T>
}
```

`get` / `post` / `put` / `patch` / `delete` return a `Signal<T | null>` and must be called from an injection context. Use `executeRequest` for async/await patterns:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(SignalHttpClient);

  async login(credentials: Credentials): Promise<Token> {
    return this.http.executeRequest<Token>({
      url: '/auth/login',
      method: 'POST',
      body: credentials,
    });
  }
}
```

---

### `HttpError`

```typescript
class HttpError extends Error {
  readonly status: number;
  readonly response?: Response;

  get isClientError(): boolean  // 4xx
  get isServerError(): boolean  // 5xx
  get isTimeout(): boolean      // 408
  get isNotFound(): boolean     // 404
  get isUnauthorized(): boolean // 401
  get isForbidden(): boolean    // 403
}
```

---

### `RequestConfig`

```typescript
interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  timeout?: number;      // overrides the global timeout for this request
  signal?: AbortSignal;  // merged with the internal AbortController
}
```

---

### `RetryConfig`

```typescript
interface RetryConfig {
  count: number;
  delay?: number | ((attempt: number) => number);   // ms; defaults to 0
  shouldRetry?: (error: Error, attempt: number) => boolean;
}
```

---

## Migration from `HttpClient`

| Before (`@angular/common/http`) | After (`ng-signal-http`) |
|---|---|
| `imports: [HttpClientModule]` | `providers: [provideSignalHttp()]` |
| `inject(HttpClient).get<T>(url)` → `Observable<T>` | `querySignal<T>(url)` → `HttpClientResult<T>` |
| `async pipe` + manual loading flag | `result.data()` + `result.loading()` |
| `pipe(takeUntil(destroy$))` | automatic — cancelled on destroy |
| `pipe(switchMap(...))` for reactive deps | reactive factory: `` () => `/users/${id()}` `` |
| `pipe(retry(3))` | `{ retry: 3 }` option |
| `pipe(catchError(...))` | `result.error()` signal + `onError` callback |
| `http.post<T>(url, body)` → `Observable<T>` | `mutationSignal(...)` → `MutationResult<T>` |

---

## Browser support

Any browser with native `fetch` support: Chrome/Edge 90+, Firefox 88+, Safari 14+. No IE11.

SSR is fully supported — window events (`focus`, `online`) are skipped on the server.

---

## License

MIT
