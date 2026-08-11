# Testing backlog

Queue file for the overnight GNHF loops described in
[`gnhf-brainstorming.md`](gnhf-brainstorming.md). One section per loop. An
agent claims the **first unchecked item** in the section its prompt names,
does it, and ticks it in the same commit.

[`feature-backlog.md`](feature-backlog.md) owns feature work and is complete.
This file owns test coverage and defect burndown. Do not add feature tickets
here.

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

---

## Known issues (Loop A)

Seven fixtures document real defects in the import pipeline. Each item names
the fixture that already proves it. Fix the defect in `src/server/csv/`, add a
focused unit test beside the module you changed, then clear the `knownIssue`.

- [ ] **European decimals read as thousands separators.**
      `transactions/lightspeed-sales-semicolon.csv`. `"8,50"` parses as `850`
      because `decimal()` in `import-plan.ts` strips every comma. Needs to
      respect the file's decimal convention, not guess per value.
- [ ] **Currency-coded and percentage amounts rejected.**
      `purchase-orders/po-currency-symbols-mixed.csv`. `"1,234.56 USD"` and
      `"12.5%"` are not recognized by `decimal()` and raise a generic row
      error instead of a clear currency-format message.
- [ ] **Mixed-number fractions rejected.**
      `inventory/inventory-fractional-quantities.csv`. `"3 1/2"` is not
      recognized by `decimal()` and raises a row error.
- [ ] **Excel serial dates rejected.**
      `transactions/sales-messy-dates-mixed.csv`. A serial like `45717` fails
      `Date.parse` and raises "is not a readable date" rather than being
      recognized as a spreadsheet date.
- [ ] **Preamble rows above the header are not skipped.**
      `transactions/toast-with-preamble-rows.csv`. Header detection locks onto
      the first two lines seen, so a report title and date-range row above the
      real header make both the header and the data get misread. The import
      fails.
- [ ] **Duplicate header names defeat header detection.**
      `transactions/sales-duplicate-headers.csv`. `looksLikeHeader()` requires
      every header value to be unique, so two columns named `Total` make the
      header row get read as data.
- [ ] **Toast "Last, first" item names never resolve.**
      `transactions/toast-menu-item-sales.csv`. Toast writes `"Fillet, salmon"`.
      Exact-match resolution never links these to the catalogue, so every row
      lands unresolved instead of importing. Check ING-08's exact-match-only
      contract before widening matching — this may be a product decision, not
      a bug.

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

- [ ] Batch 1 — `transactions/` fixtures 1–5
- [ ] Batch 2 — `transactions/` fixtures 6–10
- [ ] Batch 3 — `transactions/` fixtures 11–15
- [ ] Batch 4 — `purchase-orders/` fixtures 1–5
- [ ] Batch 5 — `purchase-orders/` fixtures 6–9
- [ ] Batch 6 — `inventory/` fixtures 1–7
- [ ] Batch 7 — `labor/` fixtures 1–6
- [ ] Batch 8 — `malformed/` fixtures 1–8
- [ ] Batch 9 — `security/` fixtures 1–5

---

## Downstream of import (Loop C)

Nothing proves imported rows produce correct metrics, scores, or
recommendations.

- [ ] Import `transactions/sales-one-year-daily.csv`, run the precompute
      pipeline, assert Data Sufficiency crosses the four-week gate and the
      dashboard leaves the insufficient-data state.
- [ ] Import under four weeks of history; assert it does **not** cross the gate
      and the insufficient-data state states what is missing.
- [ ] `transactions/sales-with-refunds-negative.csv` — assert refunds reduce
      revenue and never surface as negative-quantity waste.
- [ ] Business-day boundary: build a fixture with a 01:30 sale and assert it
      buckets to the prior business day (tech-stack §3.10).
- [ ] Money never touches a float (§3.9) — assert an imported amount stays
      exact from row through metric to rendered figure.
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

Replace the source-text "contract" tests with behavioral ones. Ranked backlog
lives at `~/.claude/plans/please-audit-my-codebase-buzzing-glade.md` — copy the
items in here before running the loop.

Exceptions that **stay** as text assertions:

- regex over `.sql` migration files in `tests/integration/schema-contract.test.ts`
  and `auth-schema-contract.test.ts` — migrations really are text artifacts;
- the `readdirSync` route inventory in
  `tests/ownership-authorization-contract.test.ts` — a genuine guard.

Do not disturb the `src/server/metrics`, `staffing`, `menu`, and `connectors`
unit tests. They are good. Reuse `tests/fixtures/pantry.ts`.

- [ ] Seed this section from the audit plan.

---

## Mutation testing (Loop F)

Each iteration: pick one `src/server/**` module, mutate one branch or boundary
by hand, run its tests, and if they still pass, write the test that catches it.
Restore the code. Log every surviving mutant found.

- [ ] Seed this section with one item per `src/server/**` module.

---

## Security and isolation (Loop G)

- [ ] Upload a fixture as location A; assert location B's owner cannot read the
      import, preview, mapping, or export.
- [ ] Assert `security/formula-injection.csv` stays inert through the CSV
      **export** path (ING-11), not only on import.
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
