# Import UX backlog

Source: hands-on audit of `/import`, signed in as the local dev test account,
uploading four files from `tests/fixtures/csv/` at once (see review artifact,
decision: **Option A — full-screen import overlay**).

Measured baseline: 4 files grew the page from 2,234px to 5,688px (7.9 screens)
with nothing above the fold reacting. The first thing needing user input sat
3 screens down; the 4th file's card sat 6.7 screens down. Mobile (375×812) was
worse: 8.2 screens, first decision 3.3 screens down.

## P0 — correctness

- [x] **Fix the batch-upload mapping-order bug.** Every file after the first
  fails with *"That upload is not available to this account."* — a 404 that
  reads like an auth error but isn't one.
  - Root cause: `startUploads` ([components/import/csv-upload-form.tsx:586](../components/import/csv-upload-form.tsx#L586))
    passes `prepareAutomatically = index > 0` for every non-first file. That
    path calls `refreshSummary` directly at [csv-upload-form.tsx:460](../components/import/csv-upload-form.tsx#L460),
    skipping the `PATCH …/mapping` call that `saveMapping`
    ([csv-upload-form.tsx:705](../components/import/csv-upload-form.tsx#L705))
    always does first.
  - Server side, `importPlanFor` ([src/server/csv/imports.ts:139](../src/server/csv/imports.ts#L139))
    parses the still-empty `mappingUsed`, gets `null`, and throws
    `CsvImportNotFoundError` → 404.
  - Fix: save the mapping (or otherwise ensure `mappingUsed` is persisted)
    before any auto dry-run commit, for every file, not just the active one.
  - Verify: upload 3+ files with fully auto-mapped columns at once; confirm
    all reach a dry-run summary with no 404s. Implemented by awaiting the
    shared mapping-persistence path in `CsvUploadForm`; covered by the DOM
    regression test `persists every automatic mapping before preparing a
    batch`.

## P1 — full-screen import overlay (Option A)

Replace the inline, ever-growing page with an overlay that owns its own
scroll, so the page never grows regardless of file count.

- [x] **Move the import flow into a `Dialog` (desktop) / `Sheet` (mobile).**
  Reuse `components/ui/dialog.tsx` and `components/ui/sheet.tsx`, following
  the existing responsive split in
  [components/dashboard/item-deep-dives.tsx:398-441](../components/dashboard/item-deep-dives.tsx#L398)
  (`useIsMobile()` → `Sheet` under 768px, `Dialog` above, both wrapping a
  scrollable inner region). `hooks/use-mobile.ts` already has the breakpoint.
  Implemented with a closed-by-default `Import data` trigger, responsive
  surface, and bounded inner scroll; covered by the DOM Dialog/Sheet tests,
  authenticated import UI suite, and 375px measurement harness.
- [x] **Pinned header inside the overlay**: current step + `Progress` bar
  - Implemented above the bounded overlay scroll region with explicit four-step progress semantics; DOM and Playwright tests prove the upload and mapping states.
  (`components/ui/progress.tsx`).
- [x] **File-queue rail**: one compact entry per file (name, status chip,
  active indicator) replacing the current design where every file gets a
  full-height section stacked on the page
  ([csv-upload-form.tsx:1055-1235](../components/import/csv-upload-form.tsx#L1055)).
  Only the active file's detail (preview, mapping, resolution, confirmation)
  renders in the main pane.
  Implemented with an accessible queue rail and active-file detail pane; DOM
  and browser tests prove inactive previews stay unmounted, selection swaps the
  active file, and the 375px/1280px surfaces stay within the viewport.
- [x] **Pinned action footer**: Back / Next file / commit actions always
  visible, not scrolled away with the content.
  Implemented as a non-scrolling responsive footer with queue navigation and
  single/batch commit actions; DOM and browser import tests prove placement,
  navigation, and 375px/1280px visibility.
- [x] **Keep the existing step derivation and API calls unchanged** —
  `currentStepFor` ([csv-upload-form.tsx:203](../components/import/csv-upload-form.tsx#L203))
  and the `/api/uploads/*` routes don't need to change shape, only where
  their results render. The DOM regression test `keeps the existing upload API
  sequence and derives confirmation from the dry-run summary` proves the
  upload → preview → mapping → dry-run sequence and the step-4 confirmation.
- [x] **Open/close and resume behavior**: define what happens when the user
  closes the overlay mid-import (confirm before discarding in-progress work),
  and how re-opening `/import` resumes an in-progress batch. The existing
  `localStorage` persistence
  ([csv-upload-form.tsx:146-179, 318-324](../components/import/csv-upload-form.tsx#L146))
  already does most of this for page reloads — carry it over to overlay
  open/close. Implemented with a close confirmation that keeps saved jobs
  resumable or explicitly discards them; `csv-upload-form.dom.test.tsx` proves
  both paths and the `import.spec.ts` reload test proves resume after remount.
- [x] **Trigger**: replace or supplement the current always-visible upload
  form on `/import` with a clear "Import data" entry point that opens the
  overlay, keeping `/import` itself as a lighter landing page (sample
  downloads, import history, etc. can stay outside the overlay). Implemented
  with the closed-by-default trigger and the existing supporting-tools landing
  area; `tests/ui/import.spec.ts` proves the 375px Sheet and 1280px Dialog stay
  closed until the user opens them.

## P2 — accessibility and correctness polish

Independent of the overlay rework; worth doing in the same pass or shortly
after.

- [x] **Don't show "ready" and an error at once.** A job card no longer renders
  its ready confirmation or mapping review alongside a job-level error; the
  final-commit retry action remains available. `csv-upload-form.dom.test.tsx`
  proves the error state takes precedence.
- [x] **Reduce live-region noise.** 7 `aria-live="polite"` regions render on
  one page during a batch upload, 4 of them empty at any given time. Consolidate
  into a single status region (or one per active file) so screen readers
  aren't interrupted 7×. The active file now owns the only polite status
  region; completion, mapping, and resolution copy remain visible without
  being announced as separate updates. The batch DOM regression covers the
  completed state.
- [x] **Fix the flat heading outline.** `"A look at the first rows."` is now
  an `<h3>` beneath each file's `<h2>`, with DOM and browser assertions proving
  the hierarchy in `csv-upload-form.dom.test.tsx` and `tests/ui/import.spec.ts`.
- [x] **Fix the dead drag-over style.** The drop target now joins its base and active classes with a space, so the existing `is-dragging` CSS state applies. `csv-upload-form.dom.test.tsx` and `tests/ui/import.spec.ts` prove drag-enter/leave behavior at 375px and 1280px.
- [x] **Remove the unreachable `location` step.** `importSteps` included a
  `'location'` entry, but `currentStepFor`
  ([csv-upload-form.tsx:203-208](../components/import/csv-upload-form.tsx#L203))
  never returned it — it rendered as "complete" the moment the form was on
  screen. The dead entry was dropped from the step list so the overlay now
  reports four real steps. `csv-upload-form.dom.test.tsx` and
  `tests/ui/import.spec.ts` prove the four-step outline and progress values at
  375px and 1280px.
- [x] **Wire up the mounted-but-unused toast channel.** `<Toaster />` is
  mounted in `app/layout.tsx:39` and `components/ui/sonner.tsx` is
  configured, but nothing in the app calls `toast()`. The batch commit now
  announces success or failure through `toast.success` / `toast.error`, while
  the inline file error remains available for recovery. Covered by the DOM
  tests `persists every automatic mapping before preparing a batch` and
  `announces a failed batch commit through the toast channel`.
