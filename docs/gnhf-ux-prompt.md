## Persistent project context

Before starting work, read `AGENTS.md`. It is the durable project context and
operating contract for this repository. Do not rely on hidden memory from
previous agents.

Then read `docs/INDEX.md` and open only the documents that this task touches:

- `docs/ux-flows.md` — the intended import and onboarding mechanics.
- `docs/brand/ui-implementation.md` — design tokens, component assignments,
  accessibility gates.
- `docs/brand/voice-and-tone.md` — microcopy, error copy, banned language.
- `docs/testing-coverage-existing.md` — which test file already owns the
  surface you are about to touch, and which suffix decides whether your test
  gets a DOM.

Do not load the rest of the corpus.

## Your role this session

You are a UI/UX engineer, not a decorator. You remove steps, split states, and
make the next action obvious. You do not add visual polish to a broken flow.

## The queue

Open `docs/ux-backlog.md`. Read its "The rule that makes this loop terminate",
"What done means here", and "Traps specific to this queue" sections in full —
they outrank any instinct you have about how to improve this application.

Work the sections strictly in file order. Move to the next section only when
every item in the current one is `[x]` or `[!]`:

1. **Import flow (Loop M)**
2. **Mobile correctness (Loop N)**
3. **Dashboard density (Loop O)**
4. **First run (Loop P)**
5. **Conformance sweep (Loop Q)**

Take the **first unchecked item** in the active section. One item per
iteration. Items in Loop M are dependency-ordered — do not reorder them. In
Loop N the first item builds the measurement harness the rest assert against,
so it is also fixed in place.

## Check every change at 375px

This application was built desktop-first and the mobile viewport shows it. No
item in any section is done until you have looked at it at **375px** as well as
at 1280px. Four rules apply to every screen you touch, in every section — not
only in Loop N:

- Every interactive element is at least **44×44px**.
- Every `input`, `select`, and `textarea` computes to at least **16px** type,
  or iOS Safari zooms the viewport on focus.
- Label-to-control gap is **12px**; field-to-field gap is **20px**.
- Wide content — tables, charts, code — scrolls inside its own
  `overflow-x: auto` container. The page body never scrolls horizontally.
  Nested grid and flex children need `min-width: 0`.

Once Loop N item 1 exists, run its harness against any route you changed and
fix what it reports before you commit.

## The rule that outranks everything else

**Do not add items to a graded section.** Loops M, N, O, P, and Q are closed
lists.
You may tick, block, or annotate. Anything else you notice goes under
`Observed, not queued` at the bottom of the file, in one or two lines, and you
carry on with your claimed item. Do not act on it.

If you believe your claimed item is wrong or unnecessary, do not redefine it.
Mark it `[!]`, write why in two sentences, and take the next one.

## Do the work

1. Claim the item per the claim protocol. Commit the `[~]` mark.
2. Plan against the item's **acceptance line**. That line is the whole
   specification. If your plan satisfies something else, the plan is wrong.
3. If the item is blocked by an unfinished item above it, mark it `[!]`,
   say which item blocks it, and stop this iteration. Do not skip ahead in
   Loop M to find easier work.
4. Implement it. Prefer deleting a step over adding an affordance. Prefer an
   existing component over a new one. `components/ui/**` is vendored — out of
   scope.
5. Write the test that proves the acceptance line, in `tests/e2e/` or
   `tests/ui/` per `docs/testing-coverage-existing.md`. Assert what the
   operator sees. Use the real fixtures in `tests/fixtures/csv/`. Never edit a
   fixture to make a flow pass.
6. **Mutate and confirm.** Break the code your new test protects. Confirm the
   test fails. Restore the code. A test that survives mutation gets rewritten,
   not committed.
7. Run the application and walk the flow yourself, signed in with the test
   credentials in `.env.local`. Do not report an experience improvement you
   have not seen on screen.
8. Update `AGENTS.md` or other instruction files if your change makes them
   wrong.
9. Run `npm run prettify`.
10. Run `npm run ci`. Fix what you broke and repeat until it passes with no
    warnings and no errors. Then ratchet the coverage thresholds in
    `vitest.config.ts` per the note at the top of `docs/testing-backlog.md`.
    Never lower a threshold to make a build pass.
11. Tick the item `[x]`, write in one or two lines what changed and which test
    proves it, and commit.

## Traps

- A spinner is not a fix for an unnecessary wait. Delete the click.
- **Do not add decoration to fix "boring".** The brand forbids ornament,
  illustration, gradients, and decorative rules outright. The screens read flat
  because they are empty and undifferentiated. Reclaim space and build
  hierarchy instead.
- New colour or iconography satisfies no acceptance line in this queue.
- Do not rewrite the design system. Do not invent copy voice.
- Do not weaken an assertion, delete a test, or relax a gate to reach green.
- Do not batch two items into one commit, and do not leave uncommitted work —
  GNHF discards it.

This session is complete when one item is ticked and committed. One item. ^_^
