# Migrating from HttpClient to ng-signal-http

This guide walks through replacing Angular's `HttpClient` with `@assebc/ng-signal-http`. You can migrate incrementally — the two can coexist in the same app.

---

## Why migrate

| | `HttpClient` | `ng-signal-http` |
|---|---|---|
| Return type | `Observable<T>` | `Signal<T>` |
| Loading state | Manual | Built-in |
| Error state | Manual | Built-in |
| Auto-refetch on signal change | Manual `effect` | Automatic |
| Request cancellation | Manual `takeUntilDestroyed` | Automatic |
| Retry | Manual `retry()` pipe | Built-in |
| RxJS required | Yes | No |
| Bundle overhead | ~25 KB (HttpClient + RxJS) | <15 KB |

---

## 1. Install

```bash
npm install @assebc/ng-signal-http
```

---

## 2. Replace the provider

**Before**

```typescript
// app.config.ts
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()]
};
```

**After**

```typescript
// app.config.ts
import { provideSignalHttp } from '@assebc/ng-signal-http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSignalHttp({ baseUrl: 'https://api.example.com' })
  ]
};
```

If you are migrating incrementally and need both providers temporarily, that is fine — they are independent.

---

## 3. Migrate GET requests

### Simple fetch

**Before**

```typescript
export class UsersComponent {
  private http = inject(HttpClient);
  users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });
  loading = false;
  error: Error | null = null;

  ngOnInit() {
    this.loading = true;
    this.http.get<User[]>('/api/users').subscribe({
      next: (data) => { this.users = data; this.loading = false; },
      error: (err) => { this.error = err; this.loading = false; },
    });
  }
}
```

**After**

```typescript
export class UsersComponent {
  users = querySignal<User[]>(() => '/api/users');
  // users.data(), users.loading(), users.error() are ready immediately
}
```

### Reactive fetch (refetch when signal changes)

**Before**

```typescript
export class UserDetailComponent {
  userId = input.required<number>();
  private http = inject(HttpClient);

  user = toSignal(
    toObservable(this.userId).pipe(
      switchMap(id => this.http.get<User>(`/api/users/${id}`))
    )
  );
}
```

**After**

```typescript
export class UserDetailComponent {
  userId = input.required<number>();

  user = querySignal<User>(() => `/api/users/${this.userId()}`);
  // refetches automatically when userId() changes; previous request is cancelled
}
```

### With options

```typescript
const result = querySignal<Post[]>(() => '/api/posts', {
  initialValue: [],
  lazy: true,             // don't fetch until refetch() is called
  retry: 3,              // retry up to 3 times on failure
  onSuccess: (data) => console.log('loaded', data.length),
  onError: (err) => console.error(err),
});
```

---

## 4. Migrate mutations (POST / PUT / PATCH / DELETE)

**Before**

```typescript
export class CreateUserComponent {
  private http = inject(HttpClient);
  isPending = false;
  result: User | null = null;
  error: Error | null = null;

  submit(dto: CreateUserDto) {
    this.isPending = true;
    this.http.post<User>('/api/users', dto).subscribe({
      next: (user) => { this.result = user; this.isPending = false; },
      error: (err) => { this.error = err; this.isPending = false; },
    });
  }
}
```

**After**

```typescript
export class CreateUserComponent {
  createUser = mutationSignal<CreateUserDto, User>(
    (body) => ({ url: '/api/users', method: 'POST', body }),
    {
      onSuccess: (user) => console.log('created', user.id),
      onError: (err) => console.error(err),
    }
  );

  submit(dto: CreateUserDto) {
    this.createUser.mutate(dto);
  }
}
```

---

## 5. Migrate interceptors

HttpClient interceptors implement `HttpInterceptor` from `@angular/common/http`. ng-signal-http uses a simpler object shape.

**Before**

```typescript
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${getToken()}`)
    });
    return next.handle(authReq);
  }
}

// app.config.ts
providers: [
  provideHttpClient(withInterceptorsFromDi()),
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
]
```

**After**

```typescript
// app.config.ts
import { HttpInterceptor, provideSignalHttp } from '@assebc/ng-signal-http';

const authInterceptor: HttpInterceptor = {
  request: async (config) => ({
    ...config,
    headers: { ...config.headers, Authorization: `Bearer ${getToken()}` },
  }),
};

providers: [
  provideSignalHttp({ interceptors: [authInterceptor] })
]
```

All three hooks are optional and support `async`/`Promise`:

```typescript
const loggingInterceptor: HttpInterceptor = {
  request: async (config) => { console.log('→', config.url); return config; },
  response: async (res) => { console.log('←', res.status); return res; },
  error: async (err) => { console.error('✗', err.message); throw err; },
};
```

---

## 6. Migrate direct imperative calls (services / guards)

If you use `HttpClient` directly in a service without signals, use `SignalHttpClient`:

**Before**

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}
```

**After**

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(SignalHttpClient);

  getUser(id: number): Promise<User> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  deleteUser(id: number): Promise<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}
```

---

## 7. Remove old HttpClient imports

Once migration is complete:

```bash
# Check for any remaining HttpClient usage
grep -r "HttpClient\|HttpClientModule\|@angular/common/http" src/
```

Remove from `app.config.ts`:

```typescript
// Remove these:
import { provideHttpClient } from '@angular/common/http';
// provideHttpClient() from providers array
```

---

## Common pitfalls

**`toSignal()` wrapping** — you no longer need it. `querySignal` returns signals directly.

**Manual unsubscribe** — you no longer need `takeUntilDestroyed()` or `ngOnDestroy`. Requests cancel automatically when the host is destroyed.

**Error handling in subscribe** — replace `.subscribe({ error: ... })` with the `onError` option or read `result.error()` in the template.

**Retry pipes** — remove `retry()`, `catchError()`, and `retryWhen()` pipes. Use the `retry` option on `querySignal`.

**HttpHeaders / HttpParams** — these classes are not used. Pass plain objects: `headers: { 'X-Custom': 'value' }`, `params: { page: '1' }`.
