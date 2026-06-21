# ng-signal-http

Signal-native HTTP client for Angular. Returns signals directly — no `toSignal()`, no observable boilerplate.

Built on the native Fetch API and Angular's signal primitives for the post-zoneless Angular era.

---

## Why

Angular's `HttpClient` returns observables. Using them with signals means wrapping every call in `toSignal()`, managing loading/error state manually, and carrying an RxJS dependency. `ng-signal-http` removes all of that:

**Before**
```typescript
export class UsersComponent {
  private http = inject(HttpClient);

  users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });
  // loading state? error state? refetch? manual work.
}
```

**After**
```typescript
export class UsersComponent {
  users = querySignal<User[]>(() => '/api/users');
  // users.data(), users.loading(), users.error(), users.refetch() — done.
}
```

---

## Install

```bash
npm install ng-signal-http
```

**Peer dependencies** — install these if you haven't already:

```bash
npm install @angular/core @angular/common
```

**Requirements:** Angular 17+ (signals required), modern browsers (Chrome/Edge 90+, Firefox 88+, Safari 14+).

---

## Setup

Register the provider once in your app config:

```typescript
// app.config.ts
import { provideSignalHttp } from 'ng-signal-http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSignalHttp({
      baseUrl: 'https://api.example.com',
      timeout: 30_000,
    }),
  ],
};
```

---

## Usage

### GET requests — `querySignal`

```typescript
import { querySignal } from 'ng-signal-http';

@Component({
  template: `
    @if (users.loading()) { <p>Loading…</p> }
    @if (users.error()) { <p>Error: {{ users.error()?.message }}</p> }
    @for (user of users.data(); track user.id) {
      <p>{{ user.name }}</p>
    }
    <button (click)="users.refetch()">Refresh</button>
  `,
})
export class UsersComponent {
  users = querySignal<User[]>(() => '/api/users');
}
```

#### Reactive queries — auto-refetch on dependency change

```typescript
export class UserDetailComponent {
  userId = input.required<number>();

  user = querySignal<User>(() => `/api/users/${this.userId()}`);
  // Automatically refetches whenever userId() changes.
}
```

#### Lazy queries

```typescript
search = querySignal<Result[]>(() => `/api/search?q=${this.query()}`, {
  lazy: true, // don't fetch on init
});
```

Call `search.refetch()` when you're ready to trigger the first request.

#### Options

```typescript
querySignal<T>(
  urlFactory: () => string | RequestConfig,
  options?: {
    initialValue?: T
    lazy?: boolean
    retry?: number | RetryConfig
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
  }
)
```

#### Return value

| Property | Type | Description |
|---|---|---|
| `data` | `Signal<T \| null>` | Response data |
| `loading` | `Signal<boolean>` | `true` while a request is in flight |
| `error` | `Signal<Error \| null>` | Last error, or `null` |
| `status` | `Signal<'idle' \| 'loading' \| 'success' \| 'error'>` | Explicit state machine value |
| `refetch()` | `() => Promise<void>` | Manually trigger a new request |
| `reset()` | `() => void` | Clear data, error, and status back to idle |

---

### Mutations — `mutationSignal`

Use for POST, PUT, PATCH, and DELETE requests. Never fires automatically.

```typescript
import { mutationSignal } from 'ng-signal-http';

@Component({
  template: `
    <button (click)="createUser({ name: 'Alice' })" [disabled]="newUser.isPending()">
      Create
    </button>
    @if (newUser.error()) { <p>{{ newUser.error()?.message }}</p> }
  `,
})
export class CreateUserComponent {
  newUser = mutationSignal<CreateUserDto, User>(
    (input) => ({ method: 'POST', url: '/api/users', body: input }),
    {
      onSuccess: (user) => console.log('Created:', user),
    }
  );

  createUser = this.newUser.mutate;
}
```

#### Options

```typescript
mutationSignal<TInput, TOutput>(
  requestFactory: (input: TInput) => RequestConfig,
  options?: {
    onSuccess?: (data: TOutput, input: TInput) => void
    onError?: (error: Error, input: TInput) => void
    onSettled?: (data: TOutput | null, error: Error | null, input: TInput) => void
  }
)
```

#### Return value

| Property | Type | Description |
|---|---|---|
| `isPending` | `Signal<boolean>` | `true` while the mutation is in flight |
| `data` | `Signal<TOutput \| null>` | Last successful response |
| `error` | `Signal<Error \| null>` | Last error, or `null` |
| `mutate` | `(input: TInput) => Promise<TOutput>` | Trigger the mutation |
| `reset()` | `() => void` | Clear data and error back to idle |

---

### Direct HTTP calls — `SignalHttpClient`

For imperative code (guards, resolvers, services):

```typescript
import { SignalHttpClient } from 'ng-signal-http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(SignalHttpClient);

  async login(credentials: Credentials): Promise<Token> {
    return this.http.post<Token>('/auth/login', credentials);
  }
}
```

Available methods: `get`, `post`, `put`, `patch`, `delete`, `request`.

---

### Interceptors

```typescript
provideSignalHttp({
  baseUrl: 'https://api.example.com',
  interceptors: [
    {
      request: async (config) => ({
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }),
    },
  ],
})
```

Interceptors run in registration order. All three hooks (`request`, `response`, `error`) are optional and support async.

---

### Retry

```typescript
querySignal<User[]>(() => '/api/users', {
  retry: {
    count: 3,
    delay: (attempt) => 2 ** attempt * 1000, // exponential backoff
    condition: (error) => error.status !== 401, // don't retry auth errors
  },
})
```

`AbortError` (cancellation / component destroy) is never retried.

---

## Configuration reference — `provideSignalHttp`

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `''` | Prepended to all relative URLs |
| `timeout` | `number` | `0` (none) | Request timeout in milliseconds |
| `headers` | `Record<string, string>` | `{}` | Default headers on every request |
| `interceptors` | `Interceptor[]` | `[]` | Request / response / error interceptors |

---

## Comparison to HttpClient

| Feature | HttpClient | ng-signal-http |
|---|---|---|
| Return type | Observable | Signal |
| Loading state | Manual | Built-in |
| Error state | Manual | Built-in |
| Auto-refetch on signal change | No | Yes |
| Request cancellation | Manual | Automatic |
| Retry | Manual | Built-in |
| RxJS required | Yes | No |
| Based on | XMLHttpRequest | Fetch API |

---

## Roadmap

**v0.1.0 (MVP)**
- `querySignal`, `mutationSignal`, `SignalHttpClient`
- Interceptors, retry, cancellation
- TypeScript-strict API

**v0.2.0**
- In-memory cache with TTL
- Stale-while-revalidate
- Optimistic updates
- SSR skip-fetch support
- Refetch on window focus / network reconnect

**v1.0.0**
- Persistent cache (IndexedDB)
- WebSocket signal integration
- GraphQL adapter
- Plugin system

---

## License

MIT
