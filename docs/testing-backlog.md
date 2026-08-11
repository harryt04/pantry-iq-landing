# Testing backlog

Queue file for the overnight GNHF loops described in
[`gnhf-brainstorming.md`](gnhf-brainstorming.md). One section per loop. An
agent claims the **first unchecked item** in the section its prompt names,
does it, and ticks it in the same commit.

[`feature-backlog.md`](feature-backlog.md) owns feature work and is complete.
This file owns test coverage and defect burndown. Do not add feature tickets
here.

[`testing-coverage-existing.md`](testing-coverage-existing.md) owns the
inventory of what already exists. **Read it before you write a test.** It tells
you which file already owns the surface you are about to cover, and which
filename suffix decides whether your test gets a DOM. Record gaps here, record
inventory there.

## Claim protocol

1. Take the first unchecked `[ ]` item in your assigned section.
2. Change it to `[~]` and put your agent name after it, in the commit that
   starts the work.
3. Finish it, tick `[x]`, and note in one line what you changed.
4. If you cannot finish it, set it back to `[!]`, write why under the item,
   and pick the next one. Never delete an item.

## The rule that outranks everything else here

[`tests/fixtures/csv/manifest.ts`](../tests/fixtures/csv/manifest.ts) is the
source of truth for what each CSV fixture proves. A `knownIssue` field records
behaviour we know is **wrong**, and `corpus.test.ts` asserts that wrong
behaviour on purpose.

- Never edit a `.csv` fixture file to make a test pass.
- Never delete a fixture.
- Never loosen or delete an assertion.
- Fix the pipeline. Then update the manifest entry to the correct expectation
  and remove its `knownIssue`.
- If you cannot fix the pipeline, leave the fixture, the test, and the manifest
  untouched. Mark the item `[!]` and move on.

Assert on behavior, not on source text. No `readFileSync`-on-source tests.
Break the code a new test protects and confirm the test fails before you accept
it. `components/ui/**` is vendored and out of scope.

Exit gate for every item: `pnpm prettify`, then `pnpm ci` until green.

Then ratchet the coverage gate. [`vitest.config.ts`](../vitest.config.ts) holds
thresholds at 70.9/70.9/75.06/79.96 against 72.9% statements, 77.06% branches, 81.96% functions, and 72.9% lines measured 2026-08-11. Re-measure with
`pnpm ci:tests` and raise each threshold to the new number minus two. Never
lower one to make a build pass. Browser tests do not feed the v8 report, so
Loops I, J, and L will not move the number. That is expected, not a failure.

---

## Known issues (Loop A)

Seven fixtures document real defects in the import pipeline. Each item names
the fixture that already proves it. Fix the defect in `src/server/csv/`, add a
focused unit test beside the module you changed, then clear the `knownIssue`.

- [x] **European decimals read as thousands separators.**
      `transactions/lightspeed-sales-semicolon.csv`. `"8,50"` parses as `850`
      because `decimal()` in `import-plan.ts` strips every comma. Needs to
      respect the file's decimal convention, not guess per value.
      Resolved by selecting comma-decimal parsing for semicolon-delimited files,
      with exact-decimal regression coverage.
- [x] **Currency-coded and percentage amounts rejected.**
      `purchase-orders/po-currency-symbols-mixed.csv`. `"1,234.56 USD"` and
      `"12.5%"` are not recognized by `decimal()` and raise a generic row
      error instead of a clear currency-format message.
      Resolved with format-specific validation messages and regression coverage
      for both unsupported formats.
- [x] **Mixed-number fractions rejected.**
      `inventory/inventory-fractional-quantities.csv`. `"3 1/2"` is not
      recognized by `decimal()` and raises a row error.
      Resolved with exact mixed-number fraction parsing and corpus coverage.
- [x] **Excel serial dates rejected.**
      Resolved with 1900-system serial-date conversion and regression coverage;
      the mixed-date fixture now fails only for its intentionally blank date.
      `transactions/sales-messy-dates-mixed.csv`. A serial like `45717` fails
      `Date.parse` and raises "is not a readable date" rather than being
      recognized as a spreadsheet date.
- [x] **Preamble rows above the header are not skipped.**
      Resolved by scanning a bounded prefix for the first table header and
      preserving source row numbers for the data that follows it.
      `transactions/toast-with-preamble-rows.csv`. Header detection locks onto
      the first two lines seen, so a report title and date-range row above the
      real header make both the header and the data get misread. The import
      fails.
- [x] **Duplicate header names defeat header detection.** (Codex, iteration 4)
      Resolved by allowing repeated non-empty labels and disambiguating the
      generated column names (`Total`, `Total (2)`). Added parser regression
      coverage and corrected the fixture manifest expectation.
      The fixture `transactions/sales-duplicate-headers.csv` now detects the
      repeated `Total` labels as a valid header.
- [x] **Toast "Last, first" item names never resolve.** (Codex, iteration 6)
      `transactions/toast-menu-item-sales.csv`. Resolved with deterministic
      two-part presentation normalization (`Fillet, salmon` → `salmon fillet`)
      while preserving ING-08 exact-match-only behavior; added regression
      coverage and corrected the fixture expectation.

The first three are all `decimal()` in `import-plan.ts`. Expect them to
interact; do them in order and re-check the later two after the first lands.

---

## End-to-end import (Loop B)

`corpus.test.ts` covers guard → parse → map → plan. Nothing drives the real
`/import` route. Take **five fixtures per iteration**, in manifest order. Sign
in, open `/import`, pick the import type from the
[fixture README](../tests/fixtures/csv/README.md) table, upload the file, and
assert the visible outcome matches the fixture's `description` — preview row
count, mapping bands, and either a successful commit or the specific error.
Seed state through the API, not by clicking. Keep the e2e suite under its
wall-clock budget.

- [x] Batch 1 — `transactions/` fixtures 1–5
      Covered the first five transaction fixtures through the authenticated
      `/import` route, including preview metadata, mapping review, item
      resolution, and successful commit assertions.
- [x] Batch 2 — `transactions/` fixtures 6–10 (Codex, iteration 8)
      Covered Latin-1, UTF-8 BOM, preamble, headerless, and duplicate-header
      fixtures through the authenticated `/import` route; headerless data
      asserts the expected item-name validation error.
- [x] Batch 3 — `transactions/` fixtures 11–15 (Codex, iteration 9)
      Covered ambiguous headers, modifier normalization, refunds, mixed dates,
      and the full-year transaction file through the authenticated `/import`
      route, including preview metadata, mapping completion, validation errors,
      and successful commits.
- [x] Batch 4 — `purchase-orders/` fixtures 1–5 (Codex, iteration 10)
      Covered the first five purchase-order fixtures through the authenticated
      `/import` route, including vendor-specific mappings, item resolution, and
      successful commits. Added `PO` as an explicit external-ID alias after
      the browser path exposed a date-mapping defect in the US Foods fixture.
- [x] Batch 5 — `purchase-orders/` fixtures 6–9 (Codex, iteration 11)
      Covered received-before-ordered, unit-cost/total mismatch, mixed currency/percentage rejection, and blank received dates through the authenticated `/import` route.
- [x] Batch 6 — `inventory/` fixtures 1–7 (Codex, iteration 12)
      Covered all seven inventory fixtures through the authenticated `/import` route, including shelf-life and fractional quantities, normalized item names, new-item resolution, snapshot deduplication isolation, and the expected blank-quantity error.
- [x] Batch 7 — `labor/` fixtures 1–6 (Codex, iteration 13)
      Covered all six labor fixtures through the authenticated `/import` route, including vendor-specific mappings, scheduled-only and actual-only shifts, open shifts, successful commits, and the expected missing-hours error.
- [x] Batch 8 — `malformed/` fixtures 1–8 (Codex, iteration 14)
      Covered all eight malformed fixtures through the authenticated `/import` route, including parser warnings, safe upload/commit errors, item resolution, and successful commits.
- [x] Batch 9 — `security/` fixtures 1–5 (Codex, iteration 15)
      Covered binary masquerades, embedded null bytes, formula-looking item names, and empty files through the authenticated `/import` route, including HTTP rejection status and successful formula-row import.

---

## Downstream of import (Loop C)

Nothing proves imported rows produce correct metrics, scores, or
recommendations.

- [x] Import `transactions/sales-one-year-daily.csv`, run the precompute
      pipeline, assert Data Sufficiency crosses the four-week gate and the
      dashboard leaves the insufficient-data state.
      Covered in the real-Postgres CSV import integration suite: the fixture
      imports 1,825 rows, precompute marks prediction eligibility true, and
      the owner-scoped dashboard state is ready.
- [x] Import under four weeks of history; assert it does **not** cross the gate
      and the insufficient-data state states what is missing. (Codex, iteration 17)
      Covered a 14-day real CSV import through precompute; prediction remains
      ineligible and the persisted finding asks for four weeks of history.
- [x] `transactions/sales-with-refunds-negative.csv` — assert refunds reduce
      revenue and never surface as negative-quantity waste. (Codex, iteration 18)
      Covered the fixture through real CSV commit and precompute, asserting
      net item quantities/revenue and non-negative spoilage output.
- [x] Business-day boundary: build a fixture with a 01:30 sale and assert it
      buckets to the prior business day (tech-stack §3.10).
      Covered same-calendar-day pre- and post-boundary sales through real CSV
      commit and precompute; both demand forecast and dashboard count two
      business days.
- [x] Money never touches a float (§3.9) — assert an imported amount stays
      exact from row through metric to rendered figure. (Codex, iteration 20)
      Added a precision fixture and real-Postgres coverage from normalized
      transaction values through precompute margin output to the rendered
      dashboard dollar figure.
- [ ] `labor/*` through STF-02 labor efficiency metrics.
- [ ] `purchase-orders/*` through MNU-03 plate costing.

---

## Corpus gaps (Loop D)

One family per iteration. Every new fixture needs a `manifest.ts` entry and a
stated reason. No "more of the same" files.

- [ ] Time: DST-boundary day, timezone-suffixed timestamps, `DD/MM` vs `MM/DD`
      ambiguity.
- [ ] Scale: a 100k-row file under the cap, a 9.9 MB file, a file at exactly
      10 MB.
- [ ] Encoding: UTF-16LE with BOM, CP1252 smart quotes, mixed encodings in one
      file.
- [ ] Duplicates: the same file imported twice (INT-07 dedup), and two files
      with overlapping date ranges.
- [ ] Item resolution near-misses: trailing whitespace, plurals, `&` vs `and`,
      case-only differences.
- [ ] Adversarial security: deeply nested quotes, a header row alone exceeding
      the row limit, a highly compressible file near the cap.

---

## Behavioral test conversion (Loop E)

Replace the source-text "contract" tests with behavioral ones. This loop is
nearly finished. An audit on 2026-08-10 found only five `readFileSync` callers
left, and three of them are legitimate. Two items remain.

Exceptions that **stay** as text assertions:

- regex over `.sql` migration files in `tests/integration/schema-contract.test.ts`
  and `auth-schema-contract.test.ts` — migrations really are text artifacts;
- `tests/ci-parity.test.ts` — it reads `package.json` and the workflow file.
  Both are configuration, not application source;
- `tests/charts/greyscale-gate.test.ts` — it also renders React and inspects
  the SVG. The source scan is a second net, not the only one;
- `tests/copy-rules.test.tsx` — it renders components. One assertion reads
  `docs/brand/marketing-copy.md`, which is a document, not source.

Do not disturb the `src/server/metrics`, `staffing`, `menu`, and `connectors`
unit tests. They are good. Reuse `tests/fixtures/pantry.ts`.

- [x] `components/marketing/landing-claims.test.tsx` renders `app/page.tsx`
      and asserts on the output. A banned claim fails whether it is inlined or
      imported from a constant; verified with a deliberately injected claim.
- [ ] `tests/architecture-rules.test.ts` reads route and service source to
      prove the narration layer imports no database client and the chat route
      never writes. The rule is real; the mechanism is wrong. Move it to an
      ESLint `no-restricted-imports` rule, which fails at lint time and points
      at the offending line. Delete the test once the rule catches a
      deliberately added violation.

---

## Mutation testing (Loop F)

Each iteration: pick one `src/server/**` module, mutate one branch or boundary
by hand, run its tests, and if they still pass, write the test that catches it.
Restore the code. Log every surviving mutant found.

Ranked by uncovered lines, measured 2026-08-10. The first five hold roughly
1,550 unexercised lines between them, so start there. The last group is already
above 94% — expect few survivors and move on quickly.

- [ ] `metrics/precompute.ts` — 49.5% of 1,209 lines. The largest uncovered
      mass in the repo, and the engine Loop C depends on. Split over several
      iterations; take branches in `coverage/index.html` order.
- [ ] `menu/recipe-builder.ts` — 35.7% of 482.
- [ ] `metrics/trends.ts` — 33.8% of 358.
- [ ] `metrics/portfolio.ts` — 33.2% of 340.
- [ ] `ingestion/reconciliation.ts` — 53.7% of 367.
- [ ] `metrics/item-deep-dives.ts` — 66.7% of 345.
- [ ] `metrics/scheduler.ts` — 57.9% of 209.
- [ ] `metrics/dashboard-recommendations.ts` (50% of 72) and
      `metrics/dashboard-state.ts` (47.5% of 61).
- [ ] The well-covered set, one pass each: `import-plan.ts`, `mapping.ts`,
      `parser.ts`, `security.ts`, `impact.ts`, `urgency.ts`, `ranking.ts`,
      `sufficiency.ts`, `spoilage.ts`, `evidence.ts`.

Those percentages come from a run with no database, so the integration-only
modules — `csv/imports.ts`, `manual/manual-entry.ts`, `connectors/framework.ts`,
`ingestion/persistence.ts`, `observability/store.ts` — report 0% there and their
true figure is unknown. Re-measure with `TEST_DATABASE_URL` set before ranking
them.

---

## Security and isolation (Loop G)

- [ ] Upload a fixture as location A; assert location B's owner cannot read the
      import, preview, mapping, or export.
- [ ] Assert `security/formula-injection.csv` stays inert through the CSV
      **export** path (ING-11), not only on import.
      **Blocked on Loop K's first item.** This entry assumed the export path
      had a test to extend. It does not.
      [`src/server/csv/exports.test.ts`](../src/server/csv/exports.test.ts)
      tests `export-format.ts`, which is a pure formatter at 100%. The query
      module `exports.ts` is 149 lines at 0%, and the one API test that reaches
      it mocks it. Build that test first, then extend it here.
- [ ] Assert the guard rejects `security/renamed-xlsx.csv` and
      `security/renamed-pdf.csv` before any bytes reach storage.
- [ ] Assert a rejected upload persists nothing — no row, no file, no history
      entry.

---

## Accessibility and greyscale over real data (Loop H)

QAG-01 and QAG-02 gate the design rules but likely run against seeded or empty
states. Real data means long item names, negative figures, and empty
categories.

- [ ] Run the axe check on every screen reachable after importing a corpus
      fixture, with that data on screen.
- [ ] Run the greyscale check on the same screens. Colour is never
      load-bearing; the greyscale test is a merge gate.

---

## Browser test architecture (prerequisite for Loops I and J)

The product has **two** functional browser tests.
[`critical-path.spec.ts`](../tests/critical-path.spec.ts) and
[`returning-user.spec.ts`](../tests/returning-user.spec.ts) hold one `test()`
each. Between them they open 6 of the 17 routes. This section builds the
scaffolding those two loops need. Do it before claiming anything in them.

One fact decides the design. Sixteen of the seventeen pages are React Server
Components that call `src/server/**` directly, not over HTTP.
[`app/(app)/dashboard/page.tsx`](<../app/(app)/dashboard/page.tsx>) awaits
`getDashboardDataState`, `getDashboardTrends`, and
`listConnectorConnectionStatuses` during render. A `page.route('**/api/**')`
handler never sees that traffic. Route mocking reaches only the six client
components that fetch: `chat-surface`, `location-manager`, `recipe-builder`,
`manual-entry-form`, `reconciliation-review`, and the export control. So
browser coverage needs two layers, not one.

- [ ] Split [`playwright.config.ts`](../playwright.config.ts) into four
      projects sharing the current `webServer` block: `setup`
      (`tests/e2e/setup/`), `e2e` (`tests/e2e/`, seeded database, real stack),
      `ui` (`tests/ui/`, mocked, no database), and `design`
      (`tests/accessibility/` and `tests/charts/`, unchanged). `e2e` and `ui`
      both declare `dependencies: ['setup']`. Keep `expect.timeout` at 15s and
      `retries: 2` in CI.
- [ ] Add `tests/e2e/setup/auth.setup.ts`. Both current specs sign up from
      scratch, which is slow and is why there are only two of them. Sign up
      once, save `storageState` to `tests/.auth/owner.json`, and load it from
      `use.storageState`. Keep one spec that still exercises signup itself.
- [ ] Add `tests/e2e/setup/seed.setup.ts`. Reuse `seedDatabase()` in
      [`src/server/db/seed-database.ts`](../src/server/db/seed-database.ts),
      `fullYearLocationFixture` and `partialDataLocationFixture` in
      [`tests/fixtures/pantry.ts`](../tests/fixtures/pantry.ts), and the
      `REQUIRE_INTEGRATION_DB` guard in
      [`tests/helpers/test-database.ts`](../tests/helpers/test-database.ts).
      Provision two locations on the `storageState` account: one with a full
      year of sales and weekly snapshots, one with 14 days and no snapshots.
      That pair alone unlocks both the populated and the insufficient-data
      rendering of every screen.
- [ ] Add `tests/ui/fixtures/mock-api.ts`, a Playwright fixture that installs
      `page.route()` handlers keyed by scenario. Cover `/api/chat`,
      `/api/chat/override`, `/api/locations`, `/api/locations/:id`,
      `/api/recipes`, `/api/items`, and `/api/reconciliation`. Type the bodies
      against the real route return types, so a route change breaks the mock
      instead of drifting from it. Each handler needs `ok`, `unauthorized`,
      `forbidden`, `invalid`, `conflict`, `unavailable`, `server-error`, and
      `slow`.
- [ ] Move the two existing specs into `tests/e2e/` and drop their inline
      signup. Split `test:e2e` into `test:e2e` and `test:ui` in
      [`package.json`](../package.json), add both to `ci:browser`, and mirror
      the change in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
      [`tests/ci-parity.test.ts`](../tests/ci-parity.test.ts) enforces parity
      and fails otherwise.

---

## Screens never opened in a browser (Loop I)

`tests/e2e/`, seeded project. One screen per iteration. For each: load it
against the full-year location and assert the real figures render; reload
against the 14-day location and assert the insufficient-data state names what is
missing rather than showing zeros.

Percentages below are line coverage measured 2026-08-10.

- [ ] `/staffing` — labor efficiency.
      `components/staffing/labor-efficiency-view.tsx` is 464 lines at 0%, and
      `staffing/labor-efficiency-query.ts` is 0%.
- [ ] `/usage` — usage variance. View 231 lines at 0%,
      `menu/usage-variance-query.ts` 0%.
- [ ] `/menu-engineering` — the popularity and margin matrix. View 225 lines at
      0%, `menu/menu-engineering-query.ts` 0%. It sits outside the `(app)`
      route group; assert the shell still renders consistently.
- [ ] `/recipes` — also outside `(app)`. Create a recipe, add ingredients,
      save, reload, assert it persisted.
- [ ] `/portfolio` — the rollup across both seeded locations.
      `portfolio-rollup.tsx` 0%, `metrics/portfolio.ts` 33.2%.
- [ ] `/settings` — item master and shelf-life defaults. Edit an item, save,
      assert the change survives a reload.
- [ ] `/account` — create, rename, and delete a location. Deletion cascades
      seven tables;
      [`location-deletion.test.ts`](../tests/integration/location-deletion.test.ts)
      proves the cascade, but nothing proves the confirmation dialogue or the
      state the user lands in afterwards.
- [ ] `/forgot-password` and `/reset-password` — never rendered by any test.
      Assert the form submits and the confirmation copy appears. Email is
      authentication plumbing only (tech-stack §3.14), so assert no marketing
      or notification framing.

---

## Interaction and failure paths, backend mocked (Loop J)

`tests/ui/`, mocked project, no database. One flow per iteration. These are the
paths a healthy seeded stack cannot produce on demand.

`/api/chat` reaches a live LLM through `createNarrationService` in
[`src/server/chat/narration.ts`](../src/server/chat/narration.ts). Every chat
item below must intercept it. A browser test may never bill an LLM call.

- [ ] Chat: ask a question, assert the answer renders with its evidence and its
      stated limits.
- [ ] Chat: an assumption override round trip through `/api/chat/override`.
- [ ] Chat: 500 and 503 from `/api/chat`. The surface must degrade with a
      readable message and must not lose the typed question.
- [ ] Manual entry (`manual-entry-form.tsx`, 673 lines, 59.1%): every
      validation branch, plus a 400 from `/api/manual-entry` surfacing field
      errors.
- [ ] CSV upload: 503 from `/api/uploads` for storage down, and 409 on commit
      for unresolved items. `csv-upload-form.tsx` is 60.9%.
- [ ] CSV mapping review (`csv-mapping-review.tsx`, 34.7%): change a detected
      mapping, save, assert it persists into the next upload.
- [ ] CSV item resolution (`csv-item-resolution.tsx`, 1.1%): all three
      outcomes — match an existing item, create a new one, skip.
- [ ] Reconciliation review (`reconciliation-review.tsx`, 0%): accept a
      conflict, then reject one.
- [ ] Location manager (`location-manager.tsx`, 67.1%): duplicate-name 409,
      the delete confirmation, and the cancel path.
- [ ] Auth form (`auth-form.tsx`, 0%): wrong password, unknown email, and an
      already-registered email. No message may disclose whether an account
      exists.
- [ ] Every screen at 375×812 and in dark theme. Colour is never load-bearing
      and the greyscale check is a merge gate, but only `/design/gallery` is
      checked today.

---

## The service layer the API tests mock away (Loop K)

Every file in `tests/api/` mocks the module beneath it — 27 `vi.mock` calls,
including `requireOwnedLocation` in all ten. Those tests prove status mapping,
which is worth having, and they leave the services at zero. One module per
iteration, unit or integration as the module needs.

- [ ] `csv/exports.ts` — 149 lines at 0%. Owner scoping, and formula-injection
      neutralisation through the real query path. Unblocks the Loop G export
      item.
- [ ] `menu/usage-variance-query.ts` — 208 lines at 0%.
- [ ] `staffing/labor-efficiency-query.ts` — 143 lines at 0%.
- [ ] `menu/menu-engineering-query.ts` — 117 lines at 0%.
- [ ] `staffing/external-signal-sync.ts` — 136 lines at 0%.
- [ ] `csv/previews.ts`, `csv/uploads.ts`, and `csv/mapping-persistence.ts` —
      all 0%, all mocked in their API tests.
- [ ] `inventory/items.ts` and `locations/locations.ts` — both 0%.
- [ ] `auth/email.ts` — 0%. Assert it sends authentication mail only and never
      a notification (tech-stack §3.14).

The pure calculators these queries feed — `menu-engineering.ts`,
`labor-efficiency.ts`, `usage-variance.ts` — already have good unit tests. The
gap is the layer that hands them their rows.

---

## Ownership proven at the route, not at the helper (Loop L)

[`ownership-boundary.test.ts`](../tests/integration/ownership-boundary.test.ts)
proves `requireOwnedLocation` works. All ten files in `tests/api/` mock it.
[`api-route-inventory.test.ts`](../tests/api-route-inventory.test.ts) only
checks each route appears in a hand-maintained list. So nothing fails if a
handler forgets to call it.

- [ ] Replace the inventory check with a behavioral sweep. For every route
      under `app/api/` except `health` and `auth/[...all]`, call it with
      account A's session and account B's `locationId` against a real database,
      and assert 403 or 404. Table-driven, one case per route, nothing mocked.
- [ ] The browser equivalent: sign in as A, open
      `/dashboard?locationId=<B's id>`, assert none of B's figures render.

Verify both by deleting a `requireOwnedLocation` call from one handler. The
sweep must go red. Restore it.
