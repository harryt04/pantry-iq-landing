# UX backlog

Queue file for the GNHF UX loops. Same contract as
[`testing-backlog.md`](testing-backlog.md): one section per loop, an agent
claims the **first unchecked item** in the section its prompt names, does it,
and ticks it in the same commit.

[`feature-backlog.md`](feature-backlog.md) owns feature work.
[`testing-backlog.md`](testing-backlog.md) owns coverage and defect burndown.
This file owns **experience defects** — flows that work but cost the operator
time, attention, or confidence.

Seeded 2026-08-12 from a walk of twelve screens at 1280px and 375px against the
seeded owner account, and from six design proposals reviewed and adopted in
full. Section order below is the adopted build order: **import, then mobile,
then dashboard density.**

## The rule that makes this loop terminate

**This queue is fixed. Do not add items to a graded section.**

Every item below was written from a read of the current code and a measured
audit of the running application. Sections M through Q are closed. An agent may
tick items, mark them blocked, or write notes under them. An agent may **not**
append a new item to those sections, split one item into three, or promote a
note into an item.

Anything you notice that is not already queued goes at the bottom under
`Observed, not queued`. The stop condition ignores that section. A human
promotes from it between runs, or does not.

Without this rule a UX loop never ends: the agent's own taste refills the queue
faster than it drains.

## Claim protocol

1. Take the first unchecked `[ ]` item in your assigned section.
2. Change it to `[~]` and put your agent name after it, in the commit that
   starts the work.
3. Finish it, tick `[x]`, and write in one or two lines what changed and which
   test proves it.
4. If you cannot finish it, set it back to `[!]`, write why under the item, and
   pick the next one. Never delete an item.

## What "done" means here

An item is done when its **acceptance line** is true and a test asserts it. Not
when the code looks better. Every item carries its acceptance line — that is
the whole specification, and it is the thing to satisfy.

- The proof is a test in `tests/e2e/` (seeded, real database) or `tests/ui/`
  (mocked), following the split in
  [`testing-coverage-existing.md`](testing-coverage-existing.md).
- Assert what the operator sees. No source-text assertions.
- Break the code the new test protects, confirm the test fails, restore it.
- Fixtures in `tests/fixtures/csv/` are real files with real defects. Use them
  as the input. Never edit one to make a flow pass.

## Traps specific to this queue

These are the ways a UX loop goes wrong. Each is forbidden.

- **Restyling instead of restructuring.** Most items below ask for a step to be
  removed, a state to be split, or space to be reclaimed. A new colour, shadow,
  or icon does not satisfy any acceptance line.
- **Adding a spinner instead of removing a wait.** If an item says the click is
  unnecessary, delete the click.
- **Adding decoration to fix "boring".** The brand forbids it outright —
  [`brand/brand-foundations.md`](brand/brand-foundations.md) §8: no ornament,
  no illustration, no gradients, no decorative rules above card headings. The
  screens read flat because they are **empty and undifferentiated**, not
  because they are under-decorated. Fix density and hierarchy.
- **Scope inflation into a design-system rewrite.** `components/ui/**` is
  vendored and out of scope. Use the tokens and components that exist.
- **Inventing new copy voice.** [`brand/voice-and-tone.md`](brand/voice-and-tone.md)
  owns microcopy. Follow it; do not negotiate with it.
- **Declaring an item done because the code changed.** The acceptance line is
  the gate, and it is written to be checkable in a browser.

Exit gate for every item: `pnpm prettify`, then `pnpm ci` until green.

---

## Import flow (Loop M)

The operator's first real task, and the one they judge the product on. Today
[`components/import/csv-upload-form.tsx`](../components/import/csv-upload-form.tsx)
holds one file's worth of state in five `useState` calls, and
[`app/(app)/import/page.tsx`](<../app/(app)/import/page.tsx>) stacks five
unrelated sections on one scroll.

Items are dependency-ordered. Item 1 unblocks items 2, 4, 5, and 10. Do not
reorder.

- [x] **One job per file, not one job per form.**
      Replace the single
      `uploadId` / `preview` / `summary` / `status` / `error` state with a
      keyed collection of per-file jobs, each holding its own upload id,
      preview, mapping, resolutions, summary, and error.
      **Acceptance:** behaviour with one file is unchanged, every existing
      import test still passes, and a second file's failure leaves the first
      file's state intact.
      Implemented keyed upload jobs and preserved each job's lifecycle state;
      `csv-upload-form.dom.test.tsx` proves a later rejected file leaves the
      earlier file's preview and ready status intact.

- [x] **Select or drop several files at once.** The input at
      `csv-upload-form.tsx:283` takes one file and needs a second click on
      `Upload CSV` to do anything. Add `multiple`, add a real drop target over
      the form region, and start each file as soon as it is chosen. The native
      `Choose File / No file chosen` control does not ship — it is the most
      off-brand element in the product.
      **Acceptance:** dropping three CSVs uploads three files with no further
      click, each appears in a list with its own state, and no native file
      input is visible on the page.
      Implemented multi-file selection and drag/drop with immediate independent
      upload jobs; `tests/ui/import.spec.ts` proves three dropped files render
      separate states without a submit click and the native input is hidden.

- [x] **Detect the import type per file.**
      The `What kind of data is this?`
      select at `csv-upload-form.tsx:268` gates the upload and applies to the
      whole form, so a mixed batch is impossible and a wrong answer wastes the
      whole upload. Detect the type from the header row using the existing
      detection in [`src/server/csv/mapping.ts`](../src/server/csv/mapping.ts),
      show the detection per file as an editable chip, and let the operator
      override it.
      **Acceptance:** a transactions file and a labor file dropped together are
      each detected correctly, the operator sets nothing before dropping, and
      an override on one file does not touch the other.
      Implemented header-based per-file detection, persisted overrides, and
      independent mixed-batch coverage in `tests/ui/import.spec.ts` and
      `csv-upload-form.dom.test.tsx`.

- [x] **Per-file status and per-file failure.** `status` and `error` are single
      strings that clobber each other. One bad file must not stop the batch or
      erase another file's message.
      **Acceptance:** drop `security/renamed-xlsx.csv` alongside two valid
      files — the rejected file shows its own reason on its own row, the two
      valid files finish, and the rejected file offers a way to remove it and
      retry.
      Implemented isolated retry/remove actions for failed jobs; DOM coverage
      proves valid jobs survive rejection, and `tests/ui/import.spec.ts` proves
      the real renamed-XLSX fixture fails independently and retries.

- [ ] **Make the five steps visible.** [`ux-flows.md`](ux-flows.md) §Import
      defines five steps. The page renders them as one long scroll with
      preview, mapping, resolution, and confirmation all mounted at once, plus
      manual entry, history, reconciliation, and export below. Show the
      operator where they are and what remains, and work one file's mapping and
      resolution at a time.
      **Acceptance:** at every point in the flow the current step and the
      remaining steps are on screen, and the sections that belong to other
      tasks are not competing for attention during an import.

- [ ] **Survive a reload.** The upload exists server-side, but a refresh
      mid-mapping loses everything held in component state and the operator
      starts over.
      **Acceptance:** reload the page between preview and commit, and the flow
      resumes at the same step with the same file, mapping, and resolutions.

- [ ] **The blank page at `/import`.** `page.tsx:26` renders nothing at all
      when there is no `locationId` — no heading follow-through, no error, no
      way forward. A new operator arriving without a location cookie sees a
      dead page.
      **Acceptance:** with no location selected, `/import` names what is
      missing and offers the action that fixes it; with one location it
      proceeds without asking.

- [ ] **Say what a good file looks like, before the upload.** The only guidance
      is `CSV files up to 10 MB` at `csv-upload-form.tsx:290`. The operator
      exports from Toast or Square and guesses.
      **Acceptance:** each import type offers a downloadable sample file and
      names its required columns, reachable before choosing a file, and the
      sample imports cleanly end to end.

- [ ] **Finish the batch in one action.** With several files ready, the
      operator confirms each one separately.
      **Acceptance:** a batch where every file is ready commits in one action
      and reports one combined summary — rows imported, new items, files
      skipped and why.

---

## Mobile correctness (Loop N)

Measured at 375px on 2026-08-12 against the seeded owner account. Every number
below is a real measurement, and every item names the commitment it violates in
[`brand/brand-foundations.md`](brand/brand-foundations.md) §9.

**Write the measurement as a test, not as a manual check.** The first item
builds the harness; the rest use it. A `tests/ui/` spec that walks each route at
375px and asserts the measured property is the proof for every item in this
section.

**One finding did not reproduce.** No page scrolls horizontally. Scripted
`window.scrollTo(2000, 0)` at 375px left `scrollX` at 0 on `/settings`,
`/portfolio`, `/import`, and `/dashboard`, and `body.scrollWidth` equalled the
viewport on all four. `documentElement.scrollWidth` reads 1218px on `/settings`
only because the item-master table is 1277px wide inside its own working
`overflow-x: auto` box. **Do not "fix" that table.** If a real page-level
overflow is found later, it goes under `Observed, not queued`.

- [ ] **A mobile measurement harness.** Build the spec the rest of this section
      asserts against: for each route, at 375px, report page-level horizontal
      scrollability, every interactive element under 44px in either dimension,
      every form control whose font-size is under 16px, and every
      label-to-control gap.
      **Acceptance:** one `tests/ui/` spec covers all twelve routes, fails
      loudly on a seeded violation, and prints the offending selector and
      measured value.

- [ ] **Tappable row actions.** Inline text links act as primary actions and
      measure 17–25px tall: `View dashboard` at 93×17, `Open dashboard` at
      126×18, `Back to account` at 335×25. Roughly twenty per page on
      `/account`, `/settings`, and `/portfolio`. Violates §9.7.
      **Acceptance:** every interactive element on every route is at least
      44×44px at 375px, asserted by the harness. Row actions become pills, not
      inline text.

- [ ] **No iOS zoom on focus.** Form controls are set at 12–14px. iOS Safari
      zooms the viewport when a focused input is under 16px, which throws the
      operator out of the layout mid-form. Eight controls on `/settings`, six
      on `/recipes`, five on `/import`. Violates §6.
      **Acceptance:** every `input`, `select`, and `textarea` computes to at
      least 16px at 375px, asserted by the harness.

- [ ] **Room between a label and its control.** The gap is a uniform 8px in
      every form in the application. It is on the 4px scale but cramped under a
      14px label, and it makes dense forms read as a single block.
      **Acceptance:** label-to-control gap is 12px and field-to-field gap is
      20px, both on the spacing scale, across `/import`, `/settings`,
      `/recipes`, and `/account`.

- [ ] **The short controls.** The manual-entry item combobox on `/import` is
      32px tall. Violates §9.7.
      **Acceptance:** it clears 44px, and the harness finds no control under
      44px on `/import`.

---

## Dashboard density (Loop O)

Adopted proposals P1, P2, P3, and P6. The dashboard is not under-decorated — it
is empty and undifferentiated. Every item here reclaims space or creates
hierarchy. None of them add ornament.

Do this section after Loops M and N. **Judge every item against
`?locationId=10000000-0000-4000-8000-000000000002`** — the full-year fixture,
which renders computed figures and four ranked recommendations. The
fourteen-day fixture (`…0001`) is the insufficient-data state and will mislead
you about density. Every item below was re-verified against the populated
dashboard on 2026-08-12.

- [ ] **One dominant figure.** The answer to "what is costing you money" sits in
      a card the same size as everything else, and the figure slot renders
      prose (`Not available`) in the mono figure typeface. Mono is for numbers;
      spending it on prose weakens the one signal that says "this is a figure".
      Per [`brand/brand-foundations.md`](brand/brand-foundations.md) §7.1.2 the
      dollar figure is the largest thing on the card.
      **Acceptance:** the wallet-impact figure renders at the top of the type
      scale, is the largest text on the screen, and supporting figures sit at
      least two steps below it. When the value cannot be computed the slot does
      not render a mono non-number.

- [ ] **Stop spending 450px on "no data".** Three cards reserve full chart
      height to render one sentence each — roughly 1,350px of vertical space
      that says nothing. This is the single largest cause of the empty feeling.
      **Acceptance:** when a metric cannot compute, its card collapses to one
      row naming what is missing and what would fix it (`needs 4 weeks · has
      2`), the group of them occupies under 200px, and nothing that was stated
      before is now hidden — per [`brand/voice-and-tone.md`](brand/voice-and-tone.md)
      §6, say what you cannot calculate and why.

- [ ] **Ranked horizontal bars.** [`brand/ui-implementation.md`](brand/ui-implementation.md)
      §5.6 names ranked horizontal bars the preferred shape — label, figure,
      and state chip on the row, nothing to decode. Nothing on the dashboard
      uses them; `Top selling` is a plain two-item list.
      **Acceptance:** the item lists render as ranked rows with an inline bar,
      a printed value on every row, and a pattern on every series per §5.2. The
      greyscale gate in §6 passes on a desaturated screenshot.

- [ ] **Cut the repeated section triplet.** Every section on every page is mono
      eyebrow, heading, then a grey help paragraph — four times per page. It
      reads as a brochure and pushes real content below the fold.
      **Acceptance:** the first section of a page keeps the full treatment;
      later sections carry a heading plus a short qualifier. Total page height
      on `/dashboard` drops by at least 25% with no loss of stated information.

- [ ] **The signed-in dashboard does not open with a marketing headline.**
      `/dashboard` currently leads with "Start with the data you already have."
      to an operator who has already signed in and imported.
      **Acceptance:** the heading states the location's current position, and
      the first-run framing appears only when there is genuinely nothing
      imported.

---

## First run (Loop P)

There is no first-run path. `components/auth/auth-form.tsx:70` sends a brand
new account to `/account`, the same place sign-in goes. The operator lands on a
location list with no locations, no data, and no stated next step.

Not part of the adopted design proposals — scoped from the code read on
2026-08-12 and kept because it is the gap the import work lands into. Sequenced
after the adopted sections.

- [ ] **A first session that has a next step.** Define and build what happens
      after sign-up, distinct from a returning sign-in.
      **Acceptance:** a newly created account arrives somewhere that states the
      one next action, and that action is reachable in one click.

- [ ] **The first location, in the first session.** Every downstream screen
      needs a `locationId`. Creating one is currently an errand the operator
      has to discover.
      **Acceptance:** a new account can name its first location without
      navigating to find the form, and lands with that location selected.

- [ ] **First location to first import to first insight, with no dead end.**
      Walk the whole path as a new account with a real fixture file.
      **Acceptance:** an end-to-end test signs up, creates a location, imports
      `transactions/sales-one-year-daily.csv`, and reaches a dashboard showing
      real figures — with no step where the screen states nothing to do next.

- [ ] **Empty and insufficient states name the missing thing.** The four-week
      sufficiency gate means an operator can import correctly and still see
      little. That is correct behaviour and a terrible silent experience.
      **Acceptance:** import a short-history fixture; every affected screen
      names what is missing and how much more is needed, rather than showing
      zeros or an empty frame.

- [ ] **The account that signed up and never imported.** A returning operator
      with no data gets the same screens as one with a year of history.
      **Acceptance:** signing back in with no imports leads to the same one
      next action as the first session, without repeating steps already done.

---

## Conformance sweep (Loop Q)

Finite by construction: the surfaces changed by Loops M through P, checked
against the gates that [`brand/ui-implementation.md`](brand/ui-implementation.md)
§6 already owns. Run this last — it grades the output of everything above.

One surface per iteration. For each, with a real fixture imported and on
screen, at both 1280px and 375px: axe passes, the greyscale check passes, focus
is visible at every stop, and copy follows
[`brand/voice-and-tone.md`](brand/voice-and-tone.md).

- [ ] `/import` — file selection and batch list
- [ ] `/import` — preview and column mapping
- [ ] `/import` — item resolution
- [ ] `/import` — confirmation and result
- [ ] `/import` — rejected-file and error states
- [ ] The first-run surface from Loop P
- [ ] First location creation
- [ ] `/dashboard` — sufficient data
- [ ] `/dashboard` — insufficient data

---

## Observed, not queued

Findings that are real but outside the closed sections above. The stop
condition ignores this section. Agents append here; humans promote from here.

- **Retracted 2026-08-12: there is no location-selection or metric-run bug.**
  An earlier note here claimed `/dashboard?locationId=…0001` showed the wrong
  location and uncomputed metrics. That was a fixture mix-up on the reviewer's
  side, not a defect: `…0001` is `partialDataLocationFixture` (fourteen days)
  and `…0002` is `fullYearLocationFixture`. Verified directly — `…0002` shows
  `Full-year data kitchen` in the switcher with computed figures and zero
  `Not computed yet.`; `…0001` shows `Fourteen-day data kitchen`. The shell
  reconciles the query parameter in a `useEffect` in
  [`components/app/app-shell.tsx`](../components/app/app-shell.tsx). **Use
  `…0002` when judging a populated screen.**

- **Fixed 2026-08-12: `/account` no longer paints one Oxide pill per location.**
  Every location card carried a filled Oxide `Remove location` button, so a
  list of N locations rendered N Oxide pills and the colour stopped meaning
  "act now" — [`brand/brand-foundations.md`](brand/brand-foundations.md) §8.
  The row control is now an Ink outline pill; the `AlertDialog` keeps the Oxide
  confirm, which already names the object and the row counts. `Confirm restore`
  also no longer renders Oxide, since restoring destroys nothing.

- **The seeded account accumulates locations without bound.** Repeated e2e runs
  left dozens of `Transaction batch 1786…` locations on `/account`, rendered as
  one unpaginated list. Test-data noise rather than a product defect, but the
  list has no grouping, search, or pagination at any length.
