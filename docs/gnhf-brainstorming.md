# GNHF overnight loops — testing the CSV corpus

Companion to [`gnhf-cli.md`](gnhf-cli.md) and [`gnhf-prompt.md`](gnhf-prompt.md).
The existing loop drains [`feature-backlog.md`](feature-backlog.md). All 87
tickets are **done**, so that loop has nothing left to pick. This file proposes
the next loops: turn 50 CSV fixtures into real test coverage and real fixes.

## 1. What a good GNHF prompt needs

GNHF replays the **same prompt** every iteration. Design accordingly.

1. **Give it a queue file.** The prompt says "pick the next unclaimed item from
   `<file>`". Without a ledger the agent re-does the same work each night.
2. **End every iteration with a durable state change.** Mark the item done in
   the queue file, in the same commit. This is the only memory that survives.
3. **Give it one `--stop-when`.** Phrase it against the queue file, e.g.
   "docs/testing-backlog.md has no unchecked items".
4. **One item per iteration.** Small commits keep rollback cheap. GNHF discards
   uncommitted work on failure.
5. **State the exit gate.** `pnpm prettify` then `pnpm ci`, repeat until green.
6. **Name the traps.** Testing loops fail in a specific way: the agent edits the
   test or the fixture until it passes. Every prompt below forbids this.

### The rule that matters most for this corpus

`manifest.ts` `knownIssue` entries assert **today's wrong behaviour on purpose**.
An agent that does not know this will "fix" the manifest to match a bug, or
delete a fixture. Put this paragraph verbatim in any prompt touching the corpus:

> `tests/fixtures/csv/manifest.ts` is the source of truth. A `knownIssue` field
> records behaviour we know is wrong. Never change a `.csv` fixture file to make
> a test pass. Never delete a fixture. Never loosen an assertion. If you fix the
> pipeline, update the manifest entry and remove its `knownIssue`; if you cannot
> fix it, leave both untouched and pick a different item.

### Flag notes

- Use `--worktree` to run two loops in one night. Do **not** combine it with
  `--current-branch`.
- `--push` per iteration gives you a readable morning diff.
- Budget with `--max-tokens`, not only `--max-iterations`. Test loops burn
  tokens fast because `pnpm ci` output is large.
- Read `.gnhf/runs/<runId>/gnhf.log` in the morning before reading the diff.

### Prerequisite for every loop below

Fix [`AGENTS.md`](../AGENTS.md) first. It still says the branch is docs-only with
no `package.json`. Every agent reads it first and starts from a false model of
the repo. Do this by hand — it is one edit, not worth a loop.

---

## 2. Loop A — known-issue burndown (run this first)

**Highest value.** Seven fixtures document real defects in the import pipeline:
Toast "Last, first" item names, European decimals read as thousands, preamble
rows above the header, duplicate header columns, Excel serial dates, `"1,234.56
USD"` and `"12.5%"`, mixed-number fractions like `3 1/2`. Each is a customer-
visible import failure with a fixture already proving it.

Queue: [`testing-backlog.md`](testing-backlog.md), section "Known issues" —
already seeded from the `knownIssue` fields in `manifest.ts`.

Prompt sketch:

> Read AGENTS.md and docs/tech-stack.md. Open docs/testing-backlog.md and pick
> the first unchecked item under "Known issues". Fix the underlying defect in
> `src/server/csv/`, not the fixture and not the test. Add a focused unit test
> next to the module you changed that fails before your fix. Update the fixture's
> `manifest.ts` entry to the new correct expectation and delete its `knownIssue`.
> Run `pnpm prettify` then `pnpm ci` until green. Commit, push, tick the item.
>
> [known-issue paragraph from §1]
>
> If the fix would change behaviour outside `src/server/csv/`, stop, write what
> you found under the item, and pick the next one.

Stop-when: `docs/testing-backlog.md has no unchecked items under "Known issues"`

**Expect 7–10 iterations.** Some fixes interact — `decimal()` in
`import-plan.ts` is behind three of the seven items.

## 3. Loop B — fixture-driven end-to-end import

`corpus.test.ts` exercises guard → parse → map → plan. It never touches the
real `/import` route, the upload handler, the mapping UI, or commit. A file can
pass the corpus test and still break the screen.

Queue file: one row per fixture in `docs/testing-backlog.md` section "E2E".

Prompt sketch:

> Pick the next unchecked fixture under "E2E". Write a Playwright test that signs
> in, opens /import, selects the import type from the README table, uploads that
> exact file, and asserts the visible outcome matches the fixture's manifest
> `description` — the preview row count, the mapping bands, and either a
> successful commit or the specific error. Assert on what the operator sees, not
> on internal state. If the UI behaviour is wrong, record the defect under the
> item and mark it `blocked` rather than weakening the test.

Group 5 fixtures per iteration or this runs 50 nights. Say so in the prompt.

**Watch for:** slow test suite growth. Cap it — tell the agent the E2E suite
must stay under a stated wall-clock budget, and to use the API to seed state
rather than clicking through setup.

## 4. Loop C — downstream of import

The corpus stops at the import plan. Nothing proves that imported rows produce
correct metrics, scores, or recommendations. `transactions/sales-one-year-daily.csv`
is the one fixture with enough history to cross the four-week prediction gate.

Ideas for the queue:

- Import `sales-one-year-daily.csv`, run the precompute pipeline, assert the
  Data Sufficiency score crosses the four-week threshold and the dashboard leaves
  the insufficient-data state.
- Import less than four weeks and assert it does **not**.
- `sales-with-refunds-negative.csv` — assert refunds reduce revenue and do not
  appear as negative-quantity waste.
- Business-day boundary: a sale at 01:30 belongs to the prior business day
  (tech-stack §3.10). Build a fixture for it; assert the metric bucket.
- Money never touches a float (§3.9) — assert imported amounts stay exact
  through metrics to the rendered figure.
- `labor/*` through STF-02 labor efficiency; `purchase-orders/*` through
  MNU-03 plate costing.

This is the loop most likely to find genuine bugs, because nothing has run this
path with adversarial data.

## 5. Loop D — corpus gap-filling

The corpus covers format chaos well and covers *semantic* chaos thinly. Have a
loop add fixtures plus manifest entries plus assertions, one family per
iteration:

- **Time**: DST-boundary days, timezone-suffixed timestamps, dates in `DD/MM`
  vs `MM/DD` ambiguity, a business day crossing midnight.
- **Scale**: 100k-row file under the 10 MB cap; a 9.9 MB file; a file that is
  exactly 10 MB.
- **Encoding**: UTF-16LE with BOM, CP1252 smart quotes, mixed encodings.
- **Duplicates**: the same file imported twice (INT-07 dedup), overlapping date
  ranges across two files.
- **Item resolution**: near-miss names — trailing whitespace, plural forms,
  `&` vs `and`, case-only differences.
- **Adversarial security**: zip bomb by another name, deeply nested quotes,
  a CSV whose header row alone exceeds the row limit.

Require every new fixture to carry a manifest entry and a stated reason. Forbid
"more of the same" files.

## 6. Loop E — behavioral-test conversion

Existing decision: replace the 19 source-text "contract" tests with behavioral
tests (`readFileSync` + `toContain` asserts nothing about behaviour). The ranked
backlog already exists at
`~/.claude/plans/please-audit-my-codebase-buzzing-glade.md`. Copy it into the
repo as a queue file so an overnight agent can read it.

Prompt must carry the exceptions: `.sql` migration regex tests stay; the
`readdirSync` route inventory in `tests/ownership-authorization-contract.test.ts`
stays; `components/ui/**` is vendored and out of scope.

**Add the mutation check to the prompt:** after writing each test, break the
code it protects, confirm the test fails, restore the code. A test that survives
mutation gets rewritten, not committed.

## 7. Loop F — mutation testing as its own loop

Broader version of the above, aimed at the good suites rather than the bad ones.
Each iteration: pick one `src/server/**` module, mutate one branch or boundary
by hand, run its tests, and if they still pass, add the test that catches it.
Log every surviving mutant in the queue file.

Cheap, self-limiting, and produces a hard number you can watch improve night
over night. Good candidate for the second worktree on any night.

## 8. Loop G — security and isolation

`security/` has 5 fixtures and QAG-06 covers ownership authorization. Neither is
proven against uploads. Iteration ideas:

- Upload a fixture as location A, assert location B's owner cannot read the
  import, the preview, the mapping, or the export.
- Assert `formula-injection.csv` stays inert through the CSV **export** path
  (ING-11), not only on import — a value that enters safely can leave dangerous.
- Assert the guard rejects `renamed-xlsx.csv` before any bytes reach storage.
- Assert nothing from a rejected upload persists — no row, no file, no history.

## 9. Loop H — a11y and greyscale over real data

QAG-01 and QAG-02 gate the design rules. They likely run against seeded or empty
states. Loop: for each screen reachable after importing a corpus fixture, run the
axe check and the greyscale check with **that** data on screen. Real data means
long item names, negative figures, and empty categories — the states that break
layouts and make colour load-bearing.

Colour is never load-bearing; the greyscale test is a merge gate.

---

## 10. Suggested schedule

| Night | Loop | Agent | Why this order |
| --- | --- | --- | --- |
| 1 | A — known-issue burndown | codex | Fixtures already prove the bugs. Highest value per token. |
| 2 | C — downstream of import | claude | Most likely to find unknown bugs. Wants a strong model. |
| 3 | B — E2E, batched 5 per iteration | codex | Needs Loop A's fixes to be worth running. |
| 4 | E — behavioral conversion + F — mutation | two worktrees | Independent; neither touches the CSV pipeline. |
| 5 | D — corpus gap-filling | claude | Design work. Needs judgement about what is worth a fixture. |
| 6 | G — security + H — a11y | two worktrees | Independent surfaces, low collision risk. |

Run Loop A alone the first night. Read the diff over coffee before you trust the
pattern enough to run two loops in parallel.

## 11. The queue file

All eight loops share one queue: [`testing-backlog.md`](testing-backlog.md).
One file, not one per loop — the `--stop-when` condition reads better and you
can see all of a night's work in one place. It carries a claim protocol and one
section per loop.

Loop A's section is fully seeded and ready to run. Loops B, C, D, G, and H have
their items written. Loops E and F each need one seeding pass first — E from
the audit plan at `~/.claude/plans/please-audit-my-codebase-buzzing-glade.md`,
F from a listing of `src/server/**` modules.
