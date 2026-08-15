# Import UX backlog

Source: hands-on audit of `/import`, signed in as the local dev test account,
uploading four files from `tests/fixtures/csv/` at once (see review artifact,
decision: **Option A — full-screen import overlay**).

Measured baseline: 4 files grew the page from 2,234px to 5,688px (7.9 screens)
with nothing above the fold reacting. The first thing needing user input sat
3 screens down; the 4th file's card sat 6.7 screens down. Mobile (375×812) was
worse: 8.2 screens, first decision 3.3 screens down.

## P0 — correctness

- [ ] **Fix the batch-upload mapping-order bug.** Every file after the first
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
    all reach a dry-run summary with no 404s.

## P1 — full-screen import overlay (Option A)

Replace the inline, ever-growing page with an overlay that owns its own
scroll, so the page never grows regardless of file count.

- [ ] **Move the import flow into a `Dialog` (desktop) / `Sheet` (mobile).**
  Reuse `components/ui/dialog.tsx` and `components/ui/sheet.tsx`, following
  the existing responsive split in
  [components/dashboard/item-deep-dives.tsx:398-441](../components/dashboard/item-deep-dives.tsx#L398)
  (`useIsMobile()` → `Sheet` under 768px, `Dialog` above, both wrapping a
  scrollable inner region). `hooks/use-mobile.ts` already has the breakpoint.
- [ ] **Pinned header inside the overlay**: current step + `Progress` bar
  (`components/ui/progress.tsx`, currently unused anywhere in the app).
- [ ] **File-queue rail**: one compact entry per file (name, status chip,
  active indicator) replacing the current design where every file gets a
  full-height section stacked on the page
  ([csv-upload-form.tsx:1055-1235](../components/import/csv-upload-form.tsx#L1055)).
  Only the active file's detail (preview, mapping, resolution, confirmation)
  renders in the main pane.
- [ ] **Pinned action footer**: Back / Next file / commit actions always
  visible, not scrolled away with the content.
- [ ] **Keep the existing step derivation and API calls unchanged** —
  `currentStepFor` ([csv-upload-form.tsx:203](../components/import/csv-upload-form.tsx#L203))
  and the `/api/uploads/*` routes don't need to change shape, only where
  their results render.
- [ ] **Open/close and resume behavior**: define what happens when the user
  closes the overlay mid-import (confirm before discarding in-progress work),
  and how re-opening `/import` resumes an in-progress batch. The existing
  `localStorage` persistence
  ([csv-upload-form.tsx:146-179, 318-324](../components/import/csv-upload-form.tsx#L146))
  already does most of this for page reloads — carry it over to overlay
  open/close.
- [ ] **Trigger**: replace or supplement the current always-visible upload
  form on `/import` with a clear "Import data" entry point that opens the
  overlay, keeping `/import` itself as a lighter landing page (sample
  downloads, import history, etc. can stay outside the overlay).

## P2 — accessibility and correctness polish

Independent of the overlay rework; worth doing in the same pass or shortly
after.

- [ ] **Don't show "ready" and an error at once.** A job card can render both
  *"This file is ready. Finish the active file first…"*
  ([csv-upload-form.tsx:1091-1101](../components/import/csv-upload-form.tsx#L1091))
  and a `role="alert"` error block
  ([csv-upload-form.tsx:1210-1233](../components/import/csv-upload-form.tsx#L1210))
  simultaneously — contradictory state in the same card.
- [ ] **Reduce live-region noise.** 7 `aria-live="polite"` regions render on
  one page during a batch upload, 4 of them empty at any given time. Consolidate
  into a single status region (or one per active file) so screen readers
  aren't interrupted 7×.
- [ ] **Fix the flat heading outline.** `"A look at the first rows."` repeats
  as an `<h2>` for every file, the same level as the filename `<h2>` — no
  `<h1>`/`<h2>`/`<h3>` hierarchy distinguishes "this file" from "this
  section within the file." (`CsvPreviewTable`, [csv-upload-form.tsx:1240-1298](../components/import/csv-upload-form.tsx#L1240))
- [ ] **Fix the dead drag-over style.** `` `csv-upload-dropzone${isDragging ? 'is-dragging' : ''}` ``
  at [csv-upload-form.tsx:1002](../components/import/csv-upload-form.tsx#L1002)
  is missing a template-literal space, so the class never becomes
  `csv-upload-dropzone is-dragging` and the drag-over style at
  `app/globals.css:2458-2461` never applies.
- [ ] **Remove the unreachable `location` step.** `importSteps` includes a
  `'location'` entry, but `currentStepFor`
  ([csv-upload-form.tsx:203-208](../components/import/csv-upload-form.tsx#L203))
  never returns it — it always renders as "complete" the moment the form is
  on screen. Either make it a real step (e.g. shown only pre-location-select)
  or drop it from the step list.
- [ ] **Wire up the mounted-but-unused toast channel.** `<Toaster />` is
  mounted in `app/layout.tsx:39` and `components/ui/sonner.tsx` is
  configured, but nothing in the app calls `toast()`. Once the overlay ships,
  use it for terminal states (batch commit succeeded/failed) that the user
  might see after the overlay closes.
