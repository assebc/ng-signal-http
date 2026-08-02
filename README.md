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
  users = querySignal<User[]>('/users');
  // users.data(), users.loading(), users.error(), users.status() — all reactive
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
| Caching / SWR | Manual | Built-in |
| WebSocket | Separate | Built-in |
| GraphQL | Separate | Built-in |

---

## API

### `provideSignalHttp(config?)`

Register once in `app.config.ts`. Accepts global defaults and an optional plugin list.

```typescript
provideSignalHttp({
  baseUrl: 'https://api.example.com',
  timeout: 30_000,
  headers: { 'X-API-Version': '2' },
  interceptors: [authInterceptor],
  plugins: [loggingPlugin],
})
```

### `querySignal<T>(url, options?)`

Reactive GET — re-runs when signal dependencies inside the URL factory change.

```typescript
const result = querySignal<User[]>(() => `/users?page=${page()}`);

result.data()       // T | null
result.loading()    // boolean
result.error()      // Error | null
result.status()     // 'idle' | 'loading' | 'success' | 'error'
result.isStale()    // boolean
result.refetch()    // re-trigger manually
result.invalidate() // mark stale without fetching
result.reset()      // abort + restore initial state
```

Key options: `lazy`, `retry`, `staleTime`, `refetchInterval`, `refetchOnFocus`, `refetchOnReconnect`, `skipOnServer`, `select`, `onSuccess`, `onError`.

### `mutationSignal<TInput, TOutput>(factory, options?)`

Imperative POST / PUT / PATCH / DELETE — never runs automatically.

```typescript
const mutation = mutationSignal<CreateUserDto, User>(
  (input) => ({ url: '/users', method: 'POST', body: input }),
  {
    onMutate: (input) => captureSnapshot(), // runs before network; return value is rollback context
    onSuccess: (data, input) => { /* ... */ },
    onError: (err, input, snapshot) => rollback(snapshot),
    onSettled: (data, err, input) => { /* ... */ },
  }
);

mutation.isPending()        // boolean
mutation.data()             // TOutput | null
mutation.error()            // Error | null
await mutation.mutate(dto)  // → Promise<TOutput>
mutation.reset()
```

### `websocketSignal<T>(url, options?)`

Reactive WebSocket — updates the `data` signal on every message.

```typescript
const feed = websocketSignal<StockTick>('wss://api.example.com/feed', {
  reconnect: { maxAttempts: 5, delay: (n) => 1000 * 2 ** n },
});

feed.data()    // T | null — latest message
feed.status()  // 'connecting' | 'open' | 'closed' | 'error'
feed.send({ type: 'subscribe', channel: 'BTC' })
feed.close()
feed.reconnect()
```

Pass a signal-reading factory as the URL to reconnect automatically when signals change.

### `graphqlQuery<TData, TVariables>(endpoint, document, options?)`

GraphQL query — unwraps `response.data`, surfaces `response.errors` as `GraphQLRequestError`.

```typescript
// Static query
const users = graphqlQuery<{ users: User[] }>('/graphql', 'query { users { id name } }');

// Reactive variables — re-fetches when userId() changes
const user = graphqlQuery<{ user: User }, { id: number }>(
  '/graphql',
  'query GetUser($id: ID!) { user(id: $id) { id name } }',
  { variables: () => ({ id: userId() }) },
);
```

### `graphqlMutation<TData, TVariables>(endpoint, document, options?)`

GraphQL mutation — same unwrapping and error surfacing as `graphqlQuery`.

```typescript
const create = graphqlMutation<{ createUser: User }, { name: string }>(
  '/graphql',
  'mutation CreateUser($name: String!) { createUser(name: $name) { id } }',
);
const { createUser } = await create.mutate({ name: 'Alice' });
```

### `paginatedQuerySignal<T>(urlFactory, options?)`

Infinite-scroll / load-more pagination with a stable `pages` signal.

```typescript
const posts = paginatedQuerySignal<Post[]>(
  (page) => `/posts?cursor=${page}`,
  { getNextPageParam: (last) => last.at(-1)?.cursor }
);

posts.pages()            // T[][]
posts.hasNextPage()      // boolean
posts.isFetchingNextPage()
await posts.fetchNextPage()
```

### `parallelQueries<T>(factories, options?)`

Run N queries simultaneously and combine their results into a single reactive handle.

```typescript
const combined = parallelQueries<unknown>([
  () => '/products',
  () => '/categories',
]);
combined.data()    // (T | null)[]
combined.loading() // true while any query is loading
```

### `prefetchQuery(urlOrConfig, options?)`

Prime the cache before a component mounts — call in a route resolver or guard.

```typescript
await prefetchQuery('/users', { staleTime: 60_000 });
```

### `providePersistentCache(options?)`

IndexedDB persistence — hydrates in-memory cache on startup, writes through on every set. SSR-safe.

```typescript
providers: [
  provideSignalHttp({ baseUrl: '...' }),
  providePersistentCache({ dbName: 'my-app-cache' }),
]
```

### Plugin system

Bundle interceptors and cache hooks under a named unit registered via `provideSignalHttp`.

```typescript
const analyticsPlugin: SignalHttpPlugin = {
  name: 'analytics',
  onCacheSet: (key, data) => track('cache_set', { key }),
  onCacheDelete: (key) => track('cache_delete', { key }),
  interceptors: [timingInterceptor],
};

provideSignalHttp({ plugins: [analyticsPlugin] })
```

### `withRequestLogging(options?)`

Devtools interceptor — logs requests, responses, and errors to the console.

```typescript
provideSignalHttp({
  interceptors: [withRequestLogging({ verbose: true })]
})
```

### `SignalHttpClient`

Injectable service for imperative calls in guards, resolvers, and services.

```typescript
const http = inject(SignalHttpClient);
const user = await http.executeRequest<User>({ url: '/users/1', method: 'GET' });
```

---

## Caching

`staleTime` enables in-memory caching with stale-while-revalidate:

```typescript
querySignal('/feed', {
  staleTime: 60_000,        // serve cache instantly; revalidate in background if older than 60 s
  refetchOnFocus: true,     // revalidate when window regains focus
  refetchOnReconnect: true, // revalidate when network reconnects
  refetchInterval: 30_000,  // poll every 30 s
})
```

- **Fresh hit** — cached data served immediately, no network request.
- **Stale hit** — cached data served immediately; background revalidation updates the signal silently.
- **Miss** — normal fetch; result stored in cache for future hits.

Add `providePersistentCache()` to survive page reloads via IndexedDB.

---

## Interceptors

Async hooks that run in registration order across every request:

```typescript
const authInterceptor: HttpInterceptor = {
  request: async (config) => ({
    ...config,
    headers: { ...config.headers, Authorization: `Bearer ${getToken()}` },
  }),
  error: async (err) => {
    if (err instanceof HttpError && err.isUnauthorized) await refreshToken();
    return err;
  },
};
```

---

## Reactive queries

Signal reads inside the URL factory are tracked automatically. Changing them re-fetches and cancels the previous in-flight request:

```typescript
export class UserDetailComponent {
  userId = input.required<number>();
  user = querySignal<User>(() => `/users/${this.userId()}`);
}
```

---

## Roadmap

**v0.1.0 — MVP** ✅  
`querySignal`, `mutationSignal`, `SignalHttpClient`, `provideSignalHttp`, interceptors, retry, cancellation.

**v0.2.0** ✅  
In-memory cache + SWR · request deduplication · optimistic updates · `skipOnServer` · refetch on focus/reconnect · `paginatedQuerySignal` · `parallelQueries` · `prefetchQuery` · `withRequestLogging`.

**v1.0.0** ✅  
Persistent cache (IndexedDB) · WebSocket signal integration · GraphQL adapter · plugin system.

---

## Migration from HttpClient

See **[MIGRATION.md](MIGRATION.md)** for a step-by-step guide.

---

## Contributing & development

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full guide.

```bash
npm install        # install deps
npm start          # demo app → http://localhost:4200
npm test           # unit tests
npm run test:ci    # unit tests with coverage
npm run build      # build the library
npm run lint       # lint
```

---

## License

MIT
