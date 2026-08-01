# Contributing to ng-signal-http

Thanks for your interest. This guide covers everything you need to get the project running locally and submit a contribution.

---

## Prerequisites

- Node.js 20+
- npm 9+

---

## Setup

```bash
git clone https://github.com/assebc/ng-signal-http.git
cd ng-signal-http
npm install
```

Verify the setup:

```bash
npm test          # unit tests
npm run lint      # ESLint
npm start         # demo app → http://localhost:4200
```

---

## Repository layout

```
projects/signal-http/     ← publishable library (edit this)
projects/demo/            ← Angular SSR demo app (exercises the library)
projects/demo-e2e/        ← Cypress E2E tests
```

The library's public surface is `projects/signal-http/src/index.ts` — only export from there.

---

## Running tests

```bash
npm test                  # unit tests, watch mode
npm run test:ci           # unit tests, single run with coverage
npm run start:demo-e2e    # Cypress E2E (requires demo app to build first)
```

Coverage targets (from PRD):

| Module | Target |
|---|---|
| `SignalHttpClient` | 90% |
| `querySignal` | 85% |
| `mutationSignal` | 85% |
| Interceptors | 80% |
| Error handling | 90% |

All new code must have tests. Bug fixes must include a test that would have caught the bug.

---

## Coding standards

- **TypeScript strict mode** — zero `any`, zero type assertions without justification.
- **No comments by default** — only add a comment when the *why* is non-obvious from the code.
- **No `@angular/common/http`** — the library wraps native `fetch()` directly.
- **Signal-first** — public result surfaces are `Signal<T>`, never `Observable<T>`.
- **AbortController everywhere** — in-flight requests must cancel on destroy and dep change.
- **Never retry an AbortError** — check `error.name === 'AbortError'` before retrying.
- **Interceptors are async** — all three hooks must support `Promise` return values.

---

## Submitting changes

1. Fork the repo and create a branch from `master`.
2. Make your changes with tests.
3. Run `npm run lint && npm run test:ci` — both must pass.
4. Open a pull request against `master`.

PR descriptions should explain *why* the change is needed. Reference an issue if one exists.

---

## Reporting bugs

Open a GitHub issue with:

- Angular version
- Library version
- Minimal reproduction (StackBlitz preferred)
- Expected vs actual behaviour

---

## Releasing

Releases are automated via GitHub Actions. Maintainers trigger a release by pushing a version tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

CI then publishes to npm and GitHub Packages automatically.

---

## License

By contributing you agree that your changes will be licensed under the [MIT License](LICENSE).
