# Existing test coverage

What the suite tests today and **where each test lives**. Read this before
writing a test. Its purpose is to stop you creating
`csv-upload-validation.test.ts` when
[`csv-upload-form.dom.test.tsx`](../components/import/csv-upload-form.dom.test.tsx)
already owns that surface and is the file your case belongs in.

This file is descriptive. It records what exists.
[`testing-backlog.md`](testing-backlog.md) is prescriptive and owns what is
missing — do not add gaps or tickets here, and do not add inventory there.

Measured 2026-08-11 against the current worktree. Counts are static — `it.each`
blocks and the loop in `corpus.test.ts` expand at runtime, so the executed
figure is higher.

| | |
| --- | --- |
| Vitest files | 111 |
| Vitest cases | 584 statically, more after `.each` expansion |
| Playwright specs | 5 files, 13 cases |
| Line coverage | 75.61% with a database, 65.98% without |

---

## The first question: where does my test go?

Find the row that matches what you are testing. Add to that file. Create a new
file only when no row fits.

| Testing this | Add to |
| --- | --- |
| Pure server logic in `src/server/x/y.ts` | `src/server/x/y.test.ts`, beside it |
| A route's status codes, error mapping, auth rejection | The matching file in [`tests/api/`](../tests/api/) — see the route map below |
| A component's **rendered output** | `<component>.test.tsx`, beside it, node environment |
| A component's **interaction** — click, type, submit | `<component>.dom.test.tsx`, beside it, jsdom |
| Anything needing a real database | [`tests/integration/`](../tests/integration/) |
| A CSV file's behaviour through the pipeline | A `manifest.ts` entry, **not** a new test file |
| A full user journey in a browser | [`tests/e2e/critical-path.spec.ts`](../tests/e2e/critical-path.spec.ts) or [`tests/e2e/returning-user.spec.ts`](../tests/e2e/returning-user.spec.ts) |
| Axe, keyboard, touch targets, reduced motion | [`tests/accessibility/landing.spec.ts`](../tests/accessibility/landing.spec.ts) or [`tests/accessibility/real-data.spec.ts`](../tests/accessibility/real-data.spec.ts) |
| Chart patterns and the greyscale gate | [`tests/charts/greyscale-gate.test.ts`](../tests/charts/greyscale-gate.test.ts) (unit) or [`greyscale.spec.ts`](../tests/charts/greyscale.spec.ts) (browser) |
| Banned words, unsupported claims, tone | [`tests/copy-rules.test.tsx`](../tests/copy-rules.test.tsx) |

---

## Naming decides where a test runs

[`vitest.config.ts`](../vitest.config.ts) routes by filename. Get this wrong and
the failure is confusing rather than obvious.

| Pattern | Environment | Use it for |
| --- | --- | --- |
| `*.test.ts` | node | Server logic, pure functions, API routes |
| `*.test.tsx` | node | Components rendered with `renderToStaticMarkup`, asserted as a markup string |
| `*.dom.test.tsx` | **jsdom** | Components driven with `@testing-library/react` and `userEvent` |
| `*.spec.ts` | Playwright | Real browser. Vitest ignores these |

**A component test that clicks, types, or fires an event must be named
`*.dom.test.tsx`.** Only that glob gets jsdom. Name it `*.test.tsx` and there is
no `document`, so `render()` from Testing Library fails.

[`tests/setup/dom.ts`](../tests/setup/dom.ts) loads for every suite but guards
every import behind a `document` check. Under jsdom it registers `jest-dom`
matchers, stubs `matchMedia` and `scrollIntoView` (jsdom implements neither, and
several components call them on mount), and cleans up after each case. You do
not need to import matchers per file.

---

## Layer 1 — Server unit tests (`src/**`, 80 files)

Co-located beside the module. The strongest part of the suite: deterministic,
fixture-driven, no mocking of the thing under test. Do not disturb these.

| Area | Files | Notes |
| --- | --- | --- |
| [`src/server/metrics/`](../src/server/metrics/) | 22 | The recommendation engine. `impact` 99.1%, `ranking` 98.5%, `sufficiency` 100%, `urgency` 96.7%, `evidence` 98.1%. `trends.test.ts` covers exact-decimal direction equality and missing-data gaps. `portfolio.test.ts` covers exact-decimal rollups, partial totals, and the no-calculable-location state. `item-deep-dives.test.ts` covers exact-decimal item rollups, item-scoped recommendations, and needs-data visibility. `scheduler.test.ts` covers completed and failed jobs, including the scheduler-clock fallback when a run has no completion timestamp. `dashboard-recommendations.test.ts` covers defensive recommendation payload validation, sorting, and the five-item cap. `dashboard-state.test.ts` covers empty, insufficient, and ready business-day gates plus invalid timestamps. `precompute.test.ts` covers malformed numeric input and other precompute branches but still has substantial uncovered code |
| [`src/server/csv/`](../src/server/csv/) | 8 | `mapping` 98.4%, `security` 98.5%, `parser` 95.8%, `import-plan` 94.7%; parser tests cover long problem-example truncation; mapping reuse rejects duplicate incoming columns; import planning rejects negative non-negative labor values; security tests reject forbidden control bytes after the bounded stream sample |
| [`src/server/menu/`](../src/server/menu/) | 7 | Menu engineering, recipe graph, unit conversion, usage variance |
| [`src/server/connectors/`](../src/server/connectors/) | 8 | Square, Toast, QuickBooks, retry, health, webhooks, credentials |
| [`src/server/chat/`](../src/server/chat/) | 6 | Grounding, decline, answer format, narration, misses, assumption override |
| [`src/server/staffing/`](../src/server/staffing/) | 4 | Demand forecast, labor efficiency, shift recommendations, external signals |
| [`src/server/observability/`](../src/server/observability/) | 2 | Logger and metrics |
| [`src/server/ingestion/`](../src/server/ingestion/) | 2 | Records and reconciliation, including exact cross-source overlap intersection and unresolved-overlap inclusion guard |
| [`src/server/inventory/`](../src/server/inventory/), [`locations/`](../src/server/locations/), [`storage/`](../src/server/storage/) | 5 | Input validation, shelf-life defaults, object storage |
| [`src/chat/session-memory.test.ts`](../src/chat/session-memory.test.ts) | 1 | Outside `src/server/` — chat history truncation |

One trap: [`src/server/csv/exports.test.ts`](../src/server/csv/exports.test.ts)
tests `export-format.ts`, the pure formatter. It does **not** test `exports.ts`,
the query module, which sits at 0%. Read the imports before assuming a
co-located name means what it looks like.

## Layer 2 — API route tests (`tests/api/`, 11 files, 80+ cases)

Route handlers are plain functions taking `(Request, context)`. These call them
directly. No server, no database.

**Every one of these mocks the service beneath the route** — 27 `vi.mock` calls,
including `requireOwnedLocation` in all ten authenticated files. They prove
status mapping and request validation. They prove nothing about the service or
about ownership. Ownership is proven separately in
[`ownership-boundary.test.ts`](../tests/integration/ownership-boundary.test.ts).

| Route | Test file |
| --- | --- |
| `/api/chat`, `/api/chat/override` | [`chat.test.ts`](../tests/api/chat.test.ts) |
| `/api/items`, `/api/uploads/history`, `/api/connectors/status`, `/api/chat/misses` | [`read-routes.test.ts`](../tests/api/read-routes.test.ts) |
| `/api/items/[itemId]`, `/api/recipes` | [`items-recipes.test.ts`](../tests/api/items-recipes.test.ts) |
| `/api/locations`, `/api/locations/[locationId]` | [`locations.test.ts`](../tests/api/locations.test.ts) |
| `/api/exports/[exportType]`, `/api/observability` | [`exports-observability.test.ts`](../tests/api/exports-observability.test.ts) |
| `/api/uploads` | [`uploads.test.ts`](../tests/api/uploads.test.ts) |
| `/api/uploads/[uploadId]/commit` | [`uploads-commit.test.ts`](../tests/api/uploads-commit.test.ts) |
| `/api/uploads/[uploadId]/preview`, `/mapping` | [`uploads-preview-mapping.test.ts`](../tests/api/uploads-preview-mapping.test.ts) |
| `/api/manual-entry` | [`manual-entry.test.ts`](../tests/api/manual-entry.test.ts) |
| `/api/reconciliation` | [`reconciliation.test.ts`](../tests/api/reconciliation.test.ts) |
| `/api/health` | [`health.test.ts`](../tests/api/health.test.ts) |
| `/api/auth/[...all]` | none — Better Auth catch-all, 5 lines |

## Layer 3 — Component tests (`components/**`, 21 files)

Two idioms, split by the naming rule above.

**Node, `renderToStaticMarkup`** — assert on the markup string:
[`app-shell`](../components/app/app-shell.test.tsx),
[`chat-primitives`](../components/chat/chat-primitives.test.tsx),
[`connection-health-notice`](../components/dashboard/connection-health-notice.test.tsx),
[`dashboard-data-state`](../components/dashboard/dashboard-data-state.test.tsx),
[`location-comparison`](../components/dashboard/location-comparison.test.tsx),
[`recommendation-card`](../components/dashboard/recommendation-card.test.tsx),
[`import-history`](../components/import/import-history.test.tsx),
[`csv-mapping-review`](../components/import/csv-mapping-review.test.ts),
[`chart-primitives`](../components/charts/chart-primitives.test.ts), and four
marketing files.

**jsdom, Testing Library and `userEvent`** — the interaction suites:
[`chat-surface`](../components/chat/chat-surface.dom.test.tsx),
[`item-deep-dives`](../components/dashboard/item-deep-dives.dom.test.tsx),
[`csv-upload-form`](../components/import/csv-upload-form.dom.test.tsx),
[`manual-entry-form`](../components/import/manual-entry-form.dom.test.tsx),
[`location-manager`](../components/locations/location-manager.dom.test.tsx),
[`recipe-builder`](../components/recipes/recipe-builder.dom.test.tsx),
[`account-settings`](../components/settings/account-settings.dom.test.tsx),
[`item-master`](../components/settings/item-master.dom.test.tsx).

These eight cover the largest components in the repo. If you are adding a case
for manual entry, CSV upload, chat, locations, recipes, settings, or the item
master, **the file already exists** — extend it.

## Layer 4 — Integration tests (`tests/integration/`, 12 files, 90 cases)

Real PostgreSQL. Each runs migrate, seed, and rollback around itself.

| File | Covers |
| --- | --- |
| [`csv-import.test.ts`](../tests/integration/csv-import.test.ts) | Preview, commit, transactional write, item resolution, same-file re-import deduplication, purchase-order import through MNU-03 recipe plate-cost history, labor import through STF-02 efficiency metrics, full-year and short-history precompute, refund aggregation, business-day boundary bucketing, exact money propagation through metrics and rendered dashboard output, cross-account isolation across upload history, import planning, file preview, mapping persistence, renamed XLSX/PDF rejection before storage with no persisted history, and all four CSV export datasets through the real owner-scoped query service, including formula neutralisation from the security fixture |
| [`write-atomicity.test.ts`](../tests/integration/write-atomicity.test.ts) | A partial failure leaves no rows |
| [`manual-entry-write.test.ts`](../tests/integration/manual-entry-write.test.ts) | Manual entry writes, location scoping, item creation |
| [`ownership-boundary.test.ts`](../tests/integration/ownership-boundary.test.ts) | `requireOwnedLocation` — no session, cross-account, missing location |
| [`location-deletion.test.ts`](../tests/integration/location-deletion.test.ts) | Cascade delete across seven child tables |
| [`connector-framework.test.ts`](../tests/integration/connector-framework.test.ts) | OAuth state tokens, credential encryption, account isolation |
| [`observability-store.test.ts`](../tests/integration/observability-store.test.ts) | Health status, LLM spend, account isolation |
| [`engine-database.test.ts`](../tests/integration/engine-database.test.ts) | Precompute against the production path, evidence stored |
| [`schema-contract.test.ts`](../tests/integration/schema-contract.test.ts) | Regex over `drizzle/*.sql`. Money is `numeric`, time is `timestamptz`, no floats |
| [`auth-schema-contract.test.ts`](../tests/integration/auth-schema-contract.test.ts) | Better Auth tables, UUID ids, no OAuth or notification tables |
| [`schema-migration.test.ts`](../tests/integration/schema-migration.test.ts) | migrate → seed → rollback → migrate round trip |
| [`test-database.test.ts`](../tests/integration/test-database.test.ts) | The harness itself |

The two `*-schema-contract` files read `.sql` as text on purpose. Migrations are
text artifacts. That is the documented exception to the behaviour rule, not a
pattern to copy.

## Layer 5 — Browser tests and fixtures (9 files, including setup)

| File | Covers |
| --- | --- |
| [`e2e/setup/auth.setup.ts`](../tests/e2e/setup/auth.setup.ts) | Creates or signs into the shared owner account and saves `tests/.auth/owner.json` for dependent browser projects |
| [`e2e/setup/seed.setup.ts`](../tests/e2e/setup/seed.setup.ts) | Seeds the storage-state owner with full-year and partial-history locations, asserting real PostgreSQL counts and authenticated location visibility |
| [`e2e/critical-path.spec.ts`](../tests/e2e/critical-path.spec.ts) | Sign up → create location → import a CSV → resolve an item → commit → dashboard; transaction corpus batches 1–3, purchase-order batches 1–2, inventory batch 1, labor batch 1, and malformed batch 1 through the authenticated `/import` route |
| [`e2e/returning-user.spec.ts`](../tests/e2e/returning-user.spec.ts) | Sign in → switch location → open chat → export CSV over HTTP |
| [`e2e/staffing.spec.ts`](../tests/e2e/staffing.spec.ts) | Full-year labor comparisons and demand forecast; 14-day insufficient-history state |
| [`e2e/usage.spec.ts`](../tests/e2e/usage.spec.ts) | Full-year usage variance, waste attribution, and exclusions; 14-day missing-inventory-count state |
| [`e2e/menu-engineering.spec.ts`](../tests/e2e/menu-engineering.spec.ts) | Full-year calculated popularity and margin matrix with printed quadrant/contribution values and missing-margin exclusion; 14-day insufficient-sales-history state |
| [`e2e/recipes.spec.ts`](../tests/e2e/recipes.spec.ts) | Full-year recipe creation with an ingredient, save/reload persistence, and edit-state verification |
| [`ui/fixtures/mock-api.ts`](../tests/ui/fixtures/mock-api.ts) | Reusable scenario-keyed `page.route()` responses for mocked UI flows across chat, locations, recipes, items, and reconciliation |
| [`accessibility/landing.spec.ts`](../tests/accessibility/landing.spec.ts) | Axe on `/`, `/design/gallery`, `/design/tokens` in both themes; keyboard focus; 44px touch targets; 16px mobile type; reduced motion |
| [`accessibility/real-data.spec.ts`](../tests/accessibility/real-data.spec.ts) | Authenticated axe and grayscale screenshot sweeps across ten full-year-data screens in both themes at a mobile viewport; the dependent seed setup supplies real PostgreSQL rows and location visibility |
| [`charts/greyscale.spec.ts`](../tests/charts/greyscale.spec.ts) | `/design/gallery` desaturated at 375×900; bars keep pattern fills, lines keep dash patterns |

The e2e and UI projects load the shared owner storage state produced by the
setup project. The returning-user spec explicitly clears that state so it can
continue to exercise signup and sign-in; the critical-path signup case also
remains an explicit account-creation journey.

## Layer 6 — Suite-wide guards (`tests/`)

| File | Guards |
| --- | --- |
| [`api-route-inventory.test.ts`](../tests/api-route-inventory.test.ts) | Every `route.ts` under `app/api/` appears in the owner-scoped or public list. `readdirSync`, structural |
| [`ci-parity.test.ts`](../tests/ci-parity.test.ts) | `.github/workflows/ci.yml` runs the same stages as `pnpm ci`, and sets `REQUIRE_INTEGRATION_DB=1`. **Change one, change the other, or this fails** |
| [`copy-rules.test.tsx`](../tests/copy-rules.test.tsx) | Renders marketing and product surfaces; asserts no unsupported claim, dismissive word, or donation language |
| [`charts/greyscale-gate.test.ts`](../tests/charts/greyscale-gate.test.ts) | Exactly five patterns; every mark carries a pattern fill; no green anywhere |

---

## Shared helpers — reuse these, do not re-implement

**[`tests/helpers/api-request.ts`](../tests/helpers/api-request.ts)** — the API
route harness. `buildRequest(path, options)` builds a `Request` with query,
headers, and JSON or raw body. `callRoute(handler, request, params)` invokes a
handler with `params` wrapped in the promise Next.js passes.
`readResponse(response)` returns `{ status, body }`. `nextHeadersMock()` and
`setRequestHeaders()` stub `next/headers`.

**[`tests/helpers/test-database.ts`](../tests/helpers/test-database.ts)** — the
PostgreSQL harness. `withTestDatabase(fn)` and `withTestDatabaseUrl(fn)` run a
body against a disposable database. `openTestDatabase()` returns a handle.
`integrationDatabaseEnabled()` is true when `TEST_DATABASE_URL` points at
localhost or `TESTCONTAINERS_ENABLED=1`. With `REQUIRE_INTEGRATION_DB=1` it
throws rather than skipping — CI sets that, so a silent skip is a red build.

**[`tests/fixtures/pantry.ts`](../tests/fixtures/pantry.ts)** — the shared
domain fixtures. `messyCsvFixture` (BOM, whitespace, quoted commas, blank rows),
`partialDataLocationFixture` (14 days, no snapshots — the insufficient-data
case), `fullYearLocationFixture` (365 days plus 52 weekly snapshots — the
prediction case). Reach for these before writing new sample data.

**[`tests/fixtures/csv/manifest.ts`](../tests/fixtures/csv/manifest.ts)** —
66 real-shaped CSV files with a typed expectation each: security outcome, parse
result, mapping bands, import plan, and selected upload-size boundaries.
[`corpus.test.ts`](../tests/fixtures/csv/corpus.test.ts) loops the manifest and
drives every file through guard → parse → map → plan, one case per fixture.

To cover a new CSV shape, **add a `manifest.ts` entry, not a test file.** The
loop picks it up. A `knownIssue` field records behaviour that is currently
wrong, and the test asserts that wrong behaviour deliberately so a fix turns the
suite red. Ten fixtures carry one today. Never edit a fixture or loosen an
assertion to make a test pass — that rule outranks everything else in
[`testing-backlog.md`](testing-backlog.md).

---

## Commands

| Command | Runs |
| --- | --- |
| `pnpm test` | Vitest, unit only |
| `pnpm test:integration` | `tests/integration`, serial, needs a database |
| `pnpm test:a11y` | Playwright accessibility |
| `pnpm test:charts` | Playwright greyscale |
| `pnpm test:e2e` | Playwright journeys, on port 3001 |
| `pnpm test:coverage` | Vitest with the v8 report into `coverage/` |
| `pnpm ci` | Everything, in the order CI runs it |

Run a single file with `pnpm test path/to/file.test.ts`.

Coverage thresholds in [`vitest.config.ts`](../vitest.config.ts) are 73.05
statements, 73.05 lines, 75.35 branches, and 80.48 functions, and apply
**only** when a database is reachable. Integration suites carry roughly ten
points, so gating a laptop without Docker would fail for no reason. CI always
sets `TEST_DATABASE_URL`, so CI is always gated.

---

## Deliberately not tested

- **[`components/ui/`](../components/ui/)** — 43 files of vendored shadcn/ui
  primitives. Excluded from coverage. Do not test.
- **`src/server/db/schema.ts`** — 834 lines of Drizzle table definitions,
  excluded from coverage. The migration contract tests cover the shape.
- **`app/**/layout.tsx`, `loading.tsx`, `not-found.tsx`** — excluded from
  coverage.
- **Live LLM calls.** `src/server/chat/narration.ts` reaches a provider.
  `narration.test.ts` stubs it. No test may bill a real call.

## Where coverage is thin

Not listed here — that is
[`testing-backlog.md`](testing-backlog.md)'s job, and duplicating it guarantees
the two drift apart. Read Loops I through L there before deciding what to write
next.

---

## Keeping this file honest

Update it in the same commit whenever you add a test file, delete one, or change
a naming convention or helper signature. A stale inventory is worse than none —
it sends the next agent to a file that no longer exists.
