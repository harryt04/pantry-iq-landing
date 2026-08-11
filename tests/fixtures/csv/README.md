# CSV test corpus

66 real-shaped CSV files for manual testing of `/import` and for the
table-driven suite in [`corpus.test.ts`](corpus.test.ts). Every file is
described in [`manifest.ts`](manifest.ts), which is the source of truth for
what each file is supposed to prove.

## Manual testing

Start the app (`pnpm dev`), sign in, and open `/import`. Pick the import type
matching the file's directory, then drag the file in and compare the result
against its `description` (and `knownIssue`, if present) in `manifest.ts`.

| Directory | Import type |
| --- | --- |
| `transactions/` | Transactions |
| `purchase-orders/` | Purchase orders |
| `inventory/` | Inventory |
| `labor/` | Labor |
| `malformed/` | Any — these exercise the parser, not a specific type |
| `security/` | Any — these exercise the upload guard |
| `scale/` | Transactions — large-file and upload-cap boundaries |
| `encoding/` | Transactions — supported legacy encodings and mixed-encoding rejection |

## Known issues on purpose

A few files are designed to prove current pipeline behaviour is wrong, not to
pass cleanly. Each one has a `knownIssue` note in `manifest.ts` explaining
what happens and why. `corpus.test.ts` asserts today's (wrong) behaviour for
these — a fix to the pipeline should turn the matching test red, which is the
signal to update the manifest, not evidence the fixture is broken.

## Regenerating

Files are static and committed. To add a new one: drop the `.csv` file in the
right directory, add a matching entry to `csvFixtures` in `manifest.ts`, and
run `pnpm test tests/fixtures/csv/corpus.test.ts` — the "every file has a
manifest entry" test fails until you do.
