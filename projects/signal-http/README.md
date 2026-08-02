# ng-signal-http

[![npm version](https://img.shields.io/npm/v/@assebc/ng-signal-http)](https://www.npmjs.com/package/@assebc/ng-signal-http)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@assebc/ng-signal-http)](https://bundlephobia.com/package/@assebc/ng-signal-http)
[![license](https://img.shields.io/npm/l/@assebc/ng-signal-http)](https://github.com/assebc/ng-signal-http/blob/master/LICENSE)
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
| Caching / SWR | Manual | Built-in |
| WebSocket | Separate library | Built-in |
| GraphQL | Separate library | Built-in |
| Persistent cache | Manual | Built-in (IndexedDB) |

**Before**

```typescript
export class UsersComponent {
  private http = inject(HttpClient);
  users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });
  // loading? error? refetch? — all manual.
}
```

**After**

```typescript
export class UsersComponent {
  users = querySignal<User[]>('/api/users');
  // users.data(), users.loading(), users.error(), users.refetch() — built-in.
}
```

---

## Install

```bash
npm install @assebc/ng-signal-http
```

Peer dependencies: `@angular/core` and `@angular/common` ≥ 17.

---

## Setup

Call `provideSignalHttp()` once in `app.config.ts`:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideSignalHttp } from '@assebc/ng-signal-http';

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
import { querySignal } from '@assebc/ng-signal-http';

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
import { mutationSignal } from '@assebc/ng-signal-http';

interface CreateUser { name: string; email: string; }
interface User { id: number; name: string; email: string; }

@Component({
  template: `
    <button (click)="submit()" [disabled]="newUser.isPending()">Create</button>
    @if (newUser.data()) { <p>Created: {{ newUser.data()?.id }}</p> }
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

`querySignal` tracks every signal read inside the URL factory and automatically refetches when any of them change. The previous in-flight request is cancelled.

```typescript
@Component({ template: `<p>{{ user.data()?.name }}</p>` })
export class UserComponent {
  userId = signal(1);
  user = querySignal<User>(() => `/users/${this.userId()}`);
}
```

### Lazy queries

```typescript
search = querySignal<Result[]>(() => `/search?q=${this.query()}`, { lazy: true });

// fetch only when explicitly triggered
this.search.refetch();
```

### Polling

```typescript
stats = querySignal('/dashboard/stats', { refetchInterval: 30_000 });
```

### Refetch on focus / reconnect

```typescript
feed = querySignal('/feed', {
  staleTime: 60_000,
  refetchOnFocus: true,
  refetchOnReconnect: true,
});
```

### Skip on server (SSR)

```typescript
// This query will not fire during server-side rendering.
userData = querySignal('/me', { skipOnServer: true });
```

### Response transform

```typescript
// Use `select` to reshape the raw response before setting the data signal.
const names = querySignal<string[]>('/users', {
  select: (raw) => (raw as User[]).map(u => u.name),
});
```

---

## Caching (stale-while-revalidate)

```typescript
querySignal('/users', {
  staleTime: 60_000,        // data is fresh for 60 s after fetch
  refetchOnFocus: true,     // revalidate when window regains focus (only if stale)
  refetchOnReconnect: true, // revalidate when network reconnects
})
```

- **Fresh hit** — cached data served immediately, no network request.
- **Stale hit** — cached data served immediately; a background request updates the signal when done.
- **Miss** — normal fetch; result stored for future hits.

Use `result.isStale()` to check whether current data is past its `staleTime`.  
Use `result.invalidate()` to mark data as stale and trigger a background refetch next time.

### Request deduplication

Multiple `querySignal` instances with the same URL/body share a single in-flight request. No extra configuration needed.

### Persistent cache (IndexedDB)

```typescript
// app.config.ts
providers: [
  provideSignalHttp({ baseUrl: 'https://api.example.com' }),
  providePersistentCache({ dbName: 'my-app-cache' }),
]
```

On startup the in-memory cache is hydrated from IndexedDB — components see stale data instantly before any network request fires. All subsequent writes are stored through to IndexedDB. SSR-safe (no IDB access on the server).

### Pre-fetch

```typescript
// In a route resolver — prime the cache before the component mounts
await prefetchQuery('/users', { staleTime: 60_000 });
```

---

## Mutations

```typescript
updatePost = mutationSignal<{ id: number; title: string }, Post>(
  ({ id, ...body }) => ({ url: `/posts/${id}`, method: 'PUT', body }),
  {
    onSuccess: (post) => console.log('Updated:', post.title),
    onError: (err) => console.error('Failed:', err.message),
    onSettled: (data, err) => console.log('Done', data, err),
  },
);

await this.updatePost.mutate({ id: 1, title: 'New title' });
```

Calling `mutate()` while a previous request is in flight cancels the previous one.

### Optimistic updates

```typescript
const todoList = inject(TodoStore);

deleteTodo = mutationSignal<number, void>(
  (id) => ({ url: `/todos/${id}`, method: 'DELETE' }),
  {
    onMutate: (id) => {
      const prev = todoList.snapshot(); // save current state
      todoList.remove(id);              // apply optimistic update
      return prev;                      // this becomes the rollback context
    },
    onError: (err, id, prev) => {
      todoList.restore(prev);           // roll back on failure
    },
  },
);
```

---

## WebSocket

```typescript
import { websocketSignal } from '@assebc/ng-signal-http';

@Component({ template: `<p>{{ feed.data()?.price }}</p>` })
export class TickerComponent {
  feed = websocketSignal<StockTick>('wss://api.example.com/ticker', {
    reconnect: { maxAttempts: 5, delay: (n) => 1000 * 2 ** n },
    onOpen: () => this.feed.send({ type: 'subscribe', symbol: 'BTC' }),
  });
}
```

- `feed.data()` — latest message (`T | null`)
- `feed.status()` — `'connecting' | 'open' | 'closed' | 'error'`
- `feed.send(value)` — JSON-serialises objects; no-op when not open
- `feed.close()` — manual close, suppresses reconnect
- `feed.reconnect()` — manual reconnect, resets attempt counter

The URL can be a signal-reading factory — changing signals reconnect to the new URL automatically and cancel the previous connection.

---

## GraphQL

```typescript
import { graphqlQuery, graphqlMutation } from '@assebc/ng-signal-http';

// Query
const users = graphqlQuery<{ users: User[] }>(
  '/graphql',
  'query { users { id name } }',
);

// Reactive variables — re-fetches when userId() changes
const user = graphqlQuery<{ user: User }, { id: number }>(
  '/graphql',
  'query GetUser($id: ID!) { user(id: $id) { id name } }',
  { variables: () => ({ id: userId() }) },
);

// Mutation
const createUser = graphqlMutation<{ createUser: User }, { name: string }>(
  '/graphql',
  'mutation CreateUser($name: String!) { createUser(name: $name) { id } }',
);
const { createUser: created } = await createUser.mutate({ name: 'Alice' });
```

GraphQL `errors` are surfaced as `GraphQLRequestError` on the `error` signal and cause `mutate()` to reject. The `data` signal holds the unwrapped `response.data` value directly.

---

## Pagination

```typescript
import { paginatedQuerySignal } from '@assebc/ng-signal-http';

const posts = paginatedQuerySignal<Post[]>(
  (cursor) => ({ url: '/posts', method: 'GET', params: { cursor: String(cursor ?? '') } }),
  {
    getNextPageParam: (lastPage) => lastPage.at(-1)?.id ?? undefined,
    onError: (err) => console.error(err),
  },
);

// Template
posts.pages()             // Post[][]
posts.loading()           // initial load
posts.isFetchingNextPage()
posts.hasNextPage()
await posts.fetchNextPage()
posts.reset()
```

---

## Parallel queries

```typescript
import { parallelQueries } from '@assebc/ng-signal-http';

const result = parallelQueries<unknown>([
  () => '/products',
  () => '/categories',
  () => '/tags',
]);

result.data()    // (unknown | null)[] — one entry per factory, in order
result.loading() // true while any query is loading
result.errors()  // (Error | null)[]
result.status()  // 'loading' | 'success' | 'error'
```

---

## Interceptors

All hooks are optional and may return a `Promise`. They run in registration order.

```typescript
provideSignalHttp({
  interceptors: [
    {
      request: async (config) => ({
        ...config,
        headers: { ...config.headers, Authorization: `Bearer ${getToken()}` },
      }),
      response: async (res) => { console.log('←', res.status); return res; },
      error: async (err) => {
        if (err instanceof HttpError && err.isUnauthorized) await refreshToken();
        return err;
      },
    },
  ],
});
```

---

## Plugin system

A plugin bundles interceptors and cache lifecycle hooks under one named unit.

```typescript
import { SignalHttpPlugin, provideSignalHttp } from '@assebc/ng-signal-http';

const analyticsPlugin: SignalHttpPlugin = {
  name: 'analytics',
  interceptors: [timingInterceptor],
  onCacheSet: (key, data) => analytics.track('cache_set', { key }),
  onCacheDelete: (key) => analytics.track('cache_delete', { key }),
  onCacheClear: () => analytics.track('cache_clear'),
};

// app.config.ts
provideSignalHttp({ plugins: [analyticsPlugin] })
```

---

## Devtools

```typescript
import { withRequestLogging, provideSignalHttp } from '@assebc/ng-signal-http';

provideSignalHttp({
  interceptors: [withRequestLogging({ verbose: true })],
})
// Logs: → GET /users, ← 200 /users (42ms), etc.
```

---

## Error handling

```typescript
import { HttpError, querySignal } from '@assebc/ng-signal-http';

const post = querySignal<Post>('/posts/1');

effect(() => {
  const err = post.error();
  if (!err) return;
  if (err instanceof HttpError) {
    if (err.isNotFound)     router.navigate(['/404']);
    if (err.isUnauthorized) router.navigate(['/login']);
    if (err.isServerError)  console.error(`Server error ${err.status}`);
  }
});
```

### Retry

```typescript
// Retry 3 times immediately
querySignal('/data', { retry: 3 });

// Custom backoff
querySignal('/data', {
  retry: {
    count: 4,
    delay: (attempt) => 1000 * 2 ** (attempt - 1),
    shouldRetry: (err) => !(err instanceof HttpError && err.isClientError),
  },
});
```

`AbortError` is never retried.

---

## Full API reference

### `provideSignalHttp(config?)`

```typescript
provideSignalHttp(config?: SignalHttpConfig): EnvironmentProviders
```

| `SignalHttpConfig` | Type | Description |
|---|---|---|
| `baseUrl` | `string` | Prefix prepended to all relative URLs |
| `headers` | `Record<string, string>` | Default headers for every request |
| `timeout` | `number` | Global timeout in ms |
| `interceptors` | `HttpInterceptor[]` | Global request/response/error hooks |
| `plugins` | `SignalHttpPlugin[]` | Plugins (interceptors + cache hooks) |

### `providePersistentCache(options?)`

```typescript
providePersistentCache(options?: IdbCacheOptions): EnvironmentProviders
```

| `IdbCacheOptions` | Type | Default |
|---|---|---|
| `dbName` | `string` | `'ng-signal-http-cache'` |
| `storeName` | `string` | `'cache'` |

---

### `querySignal<T>(url, options?)`

```typescript
querySignal<T>(url: string | UrlFactory, options?: HttpClientOptions<T>): HttpClientResult<T>
```

**Options (`HttpClientOptions<T>`)**

| Option | Type | Default | Description |
|---|---|---|---|
| `initialValue` | `T` | `null` | Signal value before first success |
| `lazy` | `boolean` | `false` | Skip the initial fetch |
| `retry` | `number \| RetryConfig` | — | Retry on failure |
| `staleTime` | `number` | — | Ms after which cached data is stale |
| `refetchInterval` | `number` | — | Poll interval in ms |
| `refetchOnFocus` | `boolean` | `false` | Revalidate on window focus (if stale) |
| `refetchOnReconnect` | `boolean` | `false` | Revalidate on network reconnect |
| `skipOnServer` | `boolean` | `false` | Skip all fetches during SSR |
| `select` | `(raw: unknown) => T` | — | Transform raw response before setting signal |
| `onSuccess` | `(data: T) => void` | — | Called after successful fetch |
| `onError` | `(error: Error) => void` | — | Called after failed fetch |

**Return value (`HttpClientResult<T>`)**

| Property | Type | Description |
|---|---|---|
| `data` | `Signal<T \| null>` | Response data |
| `loading` | `Signal<boolean>` | `true` while in flight |
| `error` | `Signal<Error \| null>` | Last error; cleared on new fetch |
| `status` | `Signal<HttpClientStatus>` | `'idle' \| 'loading' \| 'success' \| 'error'` |
| `isStale` | `Signal<boolean>` | `true` if data is past `staleTime` |
| `refetch()` | `() => Promise<void>` | Trigger a new fetch |
| `invalidate()` | `() => void` | Mark data stale, clear cache entry |
| `reset()` | `() => void` | Abort + restore initial state |

---

### `mutationSignal<TInput, TOutput, TContext>(factory, options?)`

```typescript
mutationSignal<TInput, TOutput, TContext = unknown>(
  requestFactory: (input: TInput) => RequestConfig,
  options?: MutationOptions<TInput, TOutput, TContext>
): MutationResult<TInput, TOutput>
```

**Options (`MutationOptions<TInput, TOutput, TContext>`)**

| Option | Type | Description |
|---|---|---|
| `onMutate` | `(input: TInput) => TContext \| Promise<TContext>` | Runs before network request; return value is rollback context |
| `onSuccess` | `(data: TOutput, input: TInput) => void` | Called on success |
| `onError` | `(error: Error, input: TInput, context: TContext \| undefined) => void` | Called on failure |
| `onSettled` | `(data: TOutput \| null, error: Error \| null, input: TInput) => void` | Called after either outcome |
| `select` | `(raw: unknown) => TOutput` | Transform raw response before setting signal |

**Return value (`MutationResult<TInput, TOutput>`)**

| Property | Type | Description |
|---|---|---|
| `isPending` | `Signal<boolean>` | `true` while in flight |
| `data` | `Signal<TOutput \| null>` | Last successful response |
| `error` | `Signal<Error \| null>` | Last error |
| `mutate(input)` | `(input: TInput) => Promise<TOutput>` | Trigger the request |
| `reset()` | `() => void` | Clear all state |

---

### `websocketSignal<T>(url, options?)`

```typescript
websocketSignal<T>(url: string | (() => string), options?: WebSocketOptions<T>): WebSocketResult<T>
```

**Options (`WebSocketOptions<T>`)**

| Option | Type | Description |
|---|---|---|
| `deserialize` | `(event: MessageEvent) => T` | Custom message parser (default: `JSON.parse`) |
| `reconnect` | `boolean \| ReconnectConfig` | Auto-reconnect on unexpected close |
| `initialValue` | `T` | Signal value before first message |
| `onOpen` | `() => void` | Called when socket opens |
| `onClose` | `(event: CloseEvent) => void` | Called when socket closes |
| `onError` | `(event: Event) => void` | Called on socket error |
| `onMessage` | `(data: T) => void` | Called for each message |

**`ReconnectConfig`**

| Option | Type | Default |
|---|---|---|
| `maxAttempts` | `number` | `5` |
| `delay` | `number \| ((attempt: number) => number)` | `1000 * 2^(attempt-1)` |

**Return value (`WebSocketResult<T>`)**

| Property | Type | Description |
|---|---|---|
| `data` | `Signal<T \| null>` | Latest message |
| `status` | `Signal<WebSocketStatus>` | `'connecting' \| 'open' \| 'closed' \| 'error'` |
| `error` | `Signal<Event \| null>` | Last error event |
| `send(data)` | `(data: unknown) => void` | Send a message (JSON-serialises objects) |
| `close()` | `() => void` | Close and disable reconnect |
| `reconnect()` | `() => void` | Reconnect and reset attempt counter |

---

### `graphqlQuery<TData, TVariables>(endpoint, document, options?)`

```typescript
graphqlQuery<TData, TVariables>(
  endpoint: string,
  document: string,
  options?: GraphQLQueryOptions<TData, TVariables>
): HttpClientResult<TData>
```

`GraphQLQueryOptions` extends `HttpClientOptions` (minus `select`) and adds:

| Option | Type | Description |
|---|---|---|
| `variables` | `TVariables \| (() => TVariables)` | Query variables; factory tracks signal reads |

---

### `graphqlMutation<TData, TVariables>(endpoint, document, options?)`

```typescript
graphqlMutation<TData, TVariables, TContext>(
  endpoint: string,
  document: string,
  options?: GraphQLMutationOptions<TData, TVariables, TContext>
): MutationResult<TVariables, TData>
```

`GraphQLMutationOptions` extends `MutationOptions` (minus `select`).

---

### `paginatedQuerySignal<T>(urlFactory, options?)`

```typescript
paginatedQuerySignal<T>(
  urlFactory: (pageParam: unknown) => string | RequestConfig,
  options?: PaginatedOptions<T>
): PaginatedResult<T>
```

**Options (`PaginatedOptions<T>`)**

| Option | Type | Description |
|---|---|---|
| `getNextPageParam` | `(lastPage: T, allPages: T[]) => unknown` | Returns the next page param; `undefined` means no more pages |
| `lazy` | `boolean` | Skip the initial fetch |
| `retry` | `number \| RetryConfig` | Retry on failure |
| `onSuccess` | `(data: T, pageParam: unknown) => void` | Called after each page loads |
| `onError` | `(error: Error) => void` | Called on failure |

**Return value (`PaginatedResult<T>`)**

| Property | Type | Description |
|---|---|---|
| `pages` | `Signal<T[]>` | All loaded pages in order |
| `loading` | `Signal<boolean>` | `true` during initial load |
| `isFetchingNextPage` | `Signal<boolean>` | `true` while loading next page |
| `hasNextPage` | `Signal<boolean>` | `false` when `getNextPageParam` returns `undefined` |
| `error` | `Signal<Error \| null>` | Last error |
| `fetchNextPage()` | `() => Promise<void>` | Load the next page |
| `reset()` | `() => void` | Clear all pages and reset state |

---

### `parallelQueries<T>(factories, options?)`

```typescript
parallelQueries<T>(
  factories: Array<() => string | RequestConfig>,
  options?: HttpClientOptions<T>
): ParallelQueriesResult<T>
```

**Return value (`ParallelQueriesResult<T>`)**

| Property | Type | Description |
|---|---|---|
| `data` | `Signal<(T \| null)[]>` | Results in factory order |
| `loading` | `Signal<boolean>` | `true` while any query is loading |
| `errors` | `Signal<(Error \| null)[]>` | Per-query errors |
| `status` | `Signal<HttpClientStatus>` | Aggregate status |
| `refetchAll()` | `() => Promise<void>` | Re-trigger all queries |
| `resetAll()` | `() => void` | Reset all queries |

---

### `SignalHttpClient`

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

---

### `HttpError`

```typescript
class HttpError extends Error {
  readonly status: number;
  readonly response?: Response;

  get isClientError(): boolean   // 4xx
  get isServerError(): boolean   // 5xx
  get isTimeout(): boolean       // 408
  get isNotFound(): boolean      // 404
  get isUnauthorized(): boolean  // 401
  get isForbidden(): boolean     // 403
}
```

---

### `GraphQLRequestError`

```typescript
class GraphQLRequestError extends Error {
  readonly errors: GraphQLError[];
}
```

Thrown (and set on the `error` signal) when a GraphQL response contains `errors` or has no `data`.

---

### `RequestConfig`

```typescript
interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  timeout?: number;      // overrides global timeout
  signal?: AbortSignal;  // merged with the internal AbortController
}
```

---

### `RetryConfig`

```typescript
interface RetryConfig {
  count: number;
  delay?: number | ((attempt: number) => number);
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
| `pipe(switchMap(...))` | reactive factory: `` () => `/users/${id()}` `` |
| `pipe(retry(3))` | `{ retry: 3 }` option |
| `pipe(catchError(...))` | `result.error()` + `onError` callback |
| `http.post<T>(url, body)` → `Observable` | `mutationSignal(...)` |

See the full [MIGRATION.md](https://github.com/assebc/ng-signal-http/blob/master/MIGRATION.md) for a step-by-step guide.

---

## Browser support

Any browser with native `fetch`: Chrome/Edge 90+, Firefox 88+, Safari 14+. No IE11.

SSR is fully supported — window events (`focus`, `online`) and WebSocket connections are skipped on the server. Use `skipOnServer: true` to also skip fetches during SSR.

---

## License

MIT
