# ng-signal-http — Monorepo

Nx monorepo for **ng-signal-http**, a signal-native HTTP client library for Angular, plus its demo application and E2E tests.

---

## Workspace structure

| Path | Type | Description |
|---|---|---|
| `ng-signal-http/` | Library | The publishable Angular library (`ng-signal-http` on npm) |
| `demo/` | Application | Angular SSR demo app showcasing the library |
| `demo-e2e/` | E2E | Cypress end-to-end tests for the demo app |

---

## Tech stack

| Concern | Tool / Version |
|---|---|
| Framework | Angular 21 (standalone components, signals) |
| Language | TypeScript 5.9 (strict mode) |
| Monorepo | Nx 23 |
| Library packaging | ng-packagr 21 |
| Unit tests | Vitest |
| E2E tests | Cypress 15 |
| Linting | ESLint 9 + angular-eslint + typescript-eslint |
| Formatting | Prettier 3.6 |
| Local registry | Verdaccio (for publish smoke-tests) |
| SSR runtime | Express 4 via `@angular/ssr` |
| Styles | SCSS |

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10

---

## Setup

```bash
npm install
```

---

## Common commands

### Library

```bash
# Build the library
npx nx build ng-signal-http

# Run unit tests
npx nx test ng-signal-http

# Lint
npx nx eslint:lint ng-signal-http
```

### Demo app

```bash
# Serve locally (http://localhost:4200)
npx nx serve demo

# Build for production
npx nx build demo

# Run unit tests
npx nx test demo
```

### E2E tests

```bash
npx nx e2e demo-e2e
```

### Run everything

```bash
# Build all projects
npx nx run-many -t build

# Test all projects
npx nx run-many -t test
```

---

## Publishing the library

The monorepo uses Nx Release. Before publishing, all projects are built automatically:

```bash
# Dry run — preview what would be published
npx nx release --dry-run

# Bump version, tag, and publish
npx nx release
```

For local publish testing, start Verdaccio first:

```bash
npx verdaccio --config .verdaccio/config.yml
# then publish to http://localhost:4873
```

---

## Project status

| Item | Status |
|---|---|
| PRD | Draft |
| MVP features | In progress |
| npm publish | Pending |

See [`PRD.md`](./PRD.md) for the full product requirements document.

---

## License

MIT
