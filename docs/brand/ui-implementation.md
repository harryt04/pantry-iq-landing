# PantryIQ — UI Implementation Guide

**Status:** Authoritative for design tokens, shadcn/ui usage, chart
implementation, and the accessibility gates that block merge. Implements
[`brand-foundations.md`](brand-foundations.md) — read that first for the
reasoning behind these values.

**Audience:** whoever (human or agent) is writing UI code in this repo.

---

## 1. Stack position

The MVP has no application code yet — this branch is docs-only (see
[`../../AGENTS.md`](../../AGENTS.md)). These are the standing decisions for
when it does.

- **shadcn/ui on Radix primitives.** Chosen for accessible behavior we
  don't have to build: focus management, keyboard interaction, ARIA
  wiring, portalling, dismissal.
- **We take shadcn's behavior and replace its appearance.** Shipping
  stock shadcn styling is off-brand — see §3.
- **Tailwind CSS v4** with tokens as CSS custom properties.
- Do not fork a Radix primitive to change how it looks. Restyle it.

## 2. Design tokens

Drop-in `globals.css`. Values are authoritative; do not tune them ad hoc
in components.

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  /* ---- radius: split in two, unlike stock shadcn ---- */
  --radius-surface: 3px;   /* cards, panels, tables, inputs, dialogs */
  --radius-control: 999px; /* buttons, badges, chips, toggles, avatars */
  --radius: var(--radius-surface); /* shadcn compatibility alias */

  /* ---- neutrals (warm, deliberately) ---- */
  --background: #F7F6F3;   /* Stone */
  --foreground: #171614;   /* Ink */
  --card: #FFFFFF;
  --card-foreground: #171614;
  --popover: #FFFFFF;
  --popover-foreground: #171614;
  --muted: #EFEDE7;        /* Soft */
  --muted-foreground: #6A675F; /* Graphite */
  --accent: #EAE8E2;
  --accent-foreground: #171614;
  --secondary: #EFEDE7;
  --secondary-foreground: #171614;
  --border: #E3E0D9;       /* Line */
  --input: #E3E0D9;

  /* ---- brand + action ---- */
  --primary: #0B5FA5;            /* Azure — primary buttons */
  --primary-foreground: #FFFFFF;
  --ring: #0B5FA5;
  --destructive: #A83A10;        /* Oxide */
  --destructive-foreground: #FFFFFF;

  /* ---- semantic signals (not in stock shadcn; we add these) ---- */
  --signal-good: #0B5FA5;        /* Azure  · steady / healthy */
  --signal-good-soft: #E5EEF6;
  --signal-watch: #4E4B44;       /* Iron   · watch, not urgent */
  --signal-watch-soft: #EAE8E2;
  --signal-risk: #A83A10;        /* Oxide  · at risk / act now */
  --signal-risk-soft: #F6E9E2;

  /* ---- chart categoricals (always paired with a pattern) ---- */
  --chart-1: #0B5FA5;
  --chart-2: #A83A10;
  --chart-3: #4E4B44;
  --chart-4: #7A4E8C;
  --chart-5: #3E8FBF;

  /* ---- sidebar ---- */
  --sidebar: #FFFFFF;
  --sidebar-foreground: #171614;
  --sidebar-primary: #0B5FA5;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #EFEDE7;
  --sidebar-accent-foreground: #171614;
  --sidebar-border: #E3E0D9;
  --sidebar-ring: #0B5FA5;
}

.dark, :root:has(input.theme-toggle[value='dark']) {
  --background: #131311;
  --foreground: #EDEBE6;
  --card: #1A1A17;
  --card-foreground: #EDEBE6;
  --popover: #1A1A17;
  --popover-foreground: #EDEBE6;
  --muted: #212120;
  --muted-foreground: #94918A;
  --accent: #26261F;
  --accent-foreground: #EDEBE6;
  --secondary: #212120;
  --secondary-foreground: #EDEBE6;
  --border: #2E2E2A;
  --input: #2E2E2A;

  --primary: #6BB0E8;
  --primary-foreground: #0C1B24;
  --ring: #6BB0E8;
  --destructive: #E5804F;
  --destructive-foreground: #1A0F08;

  --signal-good: #6BB0E8;
  --signal-good-soft: #16232E;
  --signal-watch: #A8A399;
  --signal-watch-soft: #26251F;
  --signal-risk: #E5804F;
  --signal-risk-soft: #2A1D16;

  --chart-1: #6BB0E8;
  --chart-2: #E5804F;
  --chart-3: #A8A399;
  --chart-4: #B98AC9;
  --chart-5: #8FC5E5;

  --sidebar: #1A1A17;
  --sidebar-foreground: #EDEBE6;
  --sidebar-primary: #6BB0E8;
  --sidebar-primary-foreground: #0C1B24;
  --sidebar-accent: #212120;
  --sidebar-accent-foreground: #EDEBE6;
  --sidebar-border: #2E2E2A;
  --sidebar-ring: #6BB0E8;
}
```

**Theme resolution:** follow `prefers-color-scheme` by default, with a
persistent manual override stored client-side. Neither theme is secondary;
both ship at equal quality.

### Typography tokens

```css
--font-sans: 'IBM Plex Sans', system-ui, sans-serif;
--font-mono: 'IBM Plex Mono', ui-monospace, monospace;
```

Load weights 400/500/600/700 for Sans and 400/500/600 for Mono. Nothing
else.

Every numeric value gets:

```css
.figure {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
}
```

### Spacing and scale

Spacing: `4 8 12 16 20 24 32 40 56 80` (px). Type scale (rem): `0.6875
0.75 0.8125 0.875 1 1.125 1.375 1.75 2.25 2.75`. Nothing off-scale.

## 3. Making shadcn not look like shadcn

Four rules. They are the brand; see
[`brand-foundations.md`](brand-foundations.md) §7.1.

1. **Round controls, square paper.** `--radius-control: 999px` on Button,
   Badge, Toggle, ToggleGroup, Avatar, and nav chips.
   `--radius-surface: 3px` on Card, Table, Input, Textarea, Select
   trigger, Dialog, Popover, Sheet, Skeleton. Never mix them up.
2. **Figures in Plex Mono, oversized.** Never set a dollar amount in the
   body sans.
3. **Warm neutrals.** Do not swap in Tailwind's `slate`, `zinc`, or
   `neutral` scales — they are cool and will flatten the brand.
4. **State edge.** A `border-left: 3px solid var(--signal-*)` on cards
   carrying state; no edge at all on cards that don't.

**Explicitly rejected — do not reintroduce:**
- A decorative rule, bar, or frame above card headings (a "double ledger
  rule" was proposed and rejected).
- Uppercase mono micro-labels replacing card titles. Card headers keep
  shadcn's hierarchy: `CardTitle` at 15px/600, `CardDescription` in
  Graphite beneath it.

## 4. Component guide

Inventory current as of the shadcn docs at time of writing. If a component
exists there, use it — do not hand-roll.

### Use freely
`Accordion` · `Alert` · `AlertDialog` · `Avatar` · `Badge` · `Breadcrumb`
· `Button` · `ButtonGroup` · `Card` · `Checkbox` · `Collapsible` ·
`Combobox` · `Command` · `DataTable` · `Dialog` · `DropdownMenu` ·
`Empty` · `Field` · `HoverCard` · `Input` · `InputGroup` · `Item` · `Kbd`
· `Label` · `NativeSelect` · `Pagination` · `Popover` · `Progress` ·
`RadioGroup` · `ScrollArea` · `Select` · `Separator` · `Sheet` ·
`Sidebar` · `Skeleton` · `Spinner` · `Switch` · `Table` · `Tabs` ·
`Textarea` · `Toast` · `Toggle` · `ToggleGroup` · `Tooltip` ·
`Typography`

### Assigned jobs

| Job | Component | Notes |
|---|---|---|
| Recommendation card | `Card` + `Badge` + `Collapsible` | Collapsible holds "Show your work" |
| Severity chip | `Badge` | Glyph + word + soft background. Never color alone |
| Chat transcript | `Message` + `MessageScroller` + `Bubble` | Purpose-built; don't hand-roll |
| Chat composer | `InputGroup` + `Textarea` | Enter sends, Shift+Enter newlines |
| CSV column mapping | `Field` + `NativeSelect` + `Table` | One column at a time — see [`../ux-flows.md`](../ux-flows.md) |
| Item resolution | `Combobox` | Search existing, or create new |
| Location switcher | `Select` in the header | Must be visible on every scoped screen |
| Import progress | `Progress` + `Spinner` | Text status alongside, always |
| Settings forms | `Field` + `Input` + `Switch` | Shelf life and unit cost must be editable here |
| Empty / insufficient data | `Empty` | Copy per [`voice-and-tone.md`](voice-and-tone.md) §6 |
| Destructive confirm | `AlertDialog` | Names the object and the consequence |
| Item detail | `Sheet` on mobile, `Dialog` on desktop | |
| Loading | `Skeleton` | Matching the real layout; never a full-page spinner |

### Use with care
- **`Chart`** — see §5. shadcn's defaults are color-only and must not
  ship as-is.
- **`Carousel`** — no current use. Don't introduce one for a dashboard.
- **`Toast`** — confirmations only. Never for errors that need a decision;
  those get an inline `Alert`.
- **`Marker`, `TextRotate`, decorative motion** — off-brand.

### Do not use
- Anything that hides a destructive action behind a hover-only affordance.
- Icon-only buttons without an accessible name.
- `Tooltip` as the sole carrier of information. Tooltips are supplementary.

## 5. Charts — the pattern-first contract

**This section is not negotiable.** It exists because a color-only chart
was built, shown to the product owner, and correctly rejected: he could
not tell whether the bars were one color or three.

### The rules

1. **Color is the third channel.** Position, printed value, and pattern
   come first.
2. **Every categorical series carries a pattern**, in this order:
   `solid → diagonal hatch → cross-hatch → dots → vertical rule`. Five
   series maximum; beyond that, split the chart.
3. **Label the mark, not the legend.** Series name and value sit on or
   beside the mark. A standalone color legend is a redundant convenience
   only.
4. **Print the value.** Every bar, point, and segment shows its number.
5. **Lines get dash patterns** (`solid → dashed → dotted → dot-dash`) plus
   a label at the right-hand end of each line.
6. **Ranked horizontal bars are the preferred shape** — label, figure, and
   state chip all sit on the row, so nothing needs decoding. Reach for
   this before a grouped or stacked chart.
7. **No green. Anywhere.** Not for success, not for positive trend, not as
   a categorical.
8. **No pie or donut charts.** They rely on color matching and angle
   comparison, both of which fail here.

### Pattern implementation

```css
.pat            { background-color: var(--c); }
.pat--solid     { background-image: none; }
.pat--hatch     { background-image: repeating-linear-gradient(45deg,
                    rgb(255 255 255 / .62) 0 3px, transparent 3px 8px); }
.pat--cross     { background-image:
                    repeating-linear-gradient(45deg,  rgb(255 255 255 / .55) 0 2px, transparent 2px 6px),
                    repeating-linear-gradient(-45deg, rgb(255 255 255 / .55) 0 2px, transparent 2px 6px); }
.pat--dots      { background-image: radial-gradient(rgb(255 255 255 / .75) 1.5px, transparent 1.6px);
                  background-size: 7px 7px; }
.pat--vert      { background-image: repeating-linear-gradient(90deg,
                    rgb(255 255 255 / .6) 0 2px, transparent 2px 7px); }
```

For SVG-based charts (Recharts, which shadcn's `Chart` wraps), define
`<pattern>` elements in `<defs>` and reference them as `fill="url(#pat-hatch)"`
over a base `fill` of the series color. The CSS above is the visual
target.

Give every mark a `1px` border at ~18% opacity so adjacent marks separate
even when patterns are similar at small sizes.

### Severity encoding

| State | Color token | Pattern | Glyph | Word |
|---|---|---|---|---|
| Steady / healthy | `--signal-good` | solid | ● | Steady |
| Watch | `--signal-watch` | diagonal hatch | ◆ | Watch |
| At risk | `--signal-risk` | cross-hatch | ▲ | Act now |

Watch is a **neutral**, deliberately. Do not give it a yellow, amber,
gold, ochre, or brown — two warm hues do not separate for the primary
user. This was tried and rejected.

Status chips do **not** need a texture. Glyph plus word is sufficient
there; texture is required on data marks only.

## 6. Accessibility gates

These block merge. They are not review suggestions.

- [ ] **Greyscale test.** Screenshot every chart, desaturate it, read it.
      If meaning is lost, it does not ship.
- [ ] No information conveyed by color alone, anywhere — charts, status,
      validation, diffs.
- [ ] Text meets WCAG AA (4.5:1 body, 3:1 large).
- [ ] Meaningful non-text elements — chart marks, focus rings, icons that
      carry meaning — meet 3:1.
- [ ] Every interactive element is keyboard reachable, in a sensible tab
      order, with a visible 2px Azure focus ring at 2px offset. The ring
      is never removed.
- [ ] Every icon has a text label or an accessible name.
- [ ] Touch targets ≥44×44px.
- [ ] Body text ≥16px on mobile.
- [ ] `prefers-reduced-motion: reduce` disables all transitions and
      animation.
- [ ] Forms use real `<label>` elements; errors are described in text, not
      signalled by an Oxide outline alone.
- [ ] Both themes checked. Neither is an afterthought.

**Quick manual sweep before opening a PR:** load the page, tab through it
end to end, desaturate a screenshot, then set the browser to 200% zoom and
375px wide. Four minutes, catches nearly everything above.

## 7. Layout

- **Mobile-first.** Author at 375px; add complexity with `min-width`
  queries only.
- Breakpoints: `640 / 768 / 1024 / 1280`.
- Content max-width `1120px`; prose max-width `70ch`.
- Wide content — tables, charts, code — scrolls inside its own
  `overflow-x: auto` container. **The page body never scrolls
  horizontally.**
- Nested grid and flex children need `min-width: 0`, or long item names
  and mono figures will force overflow.
- Navigation has a real mobile pattern (sheet or bottom tabs). Never a
  horizontal bar that overflows.

## 8. Motion

- Duration 120–200ms, `ease-out`.
- Permitted: state changes, layer entrance/exit, skeleton→content swaps,
  collapsible expansion.
- Not permitted: scroll-triggered reveals, parallax, decorative loops,
  bounce or overshoot easing, animated number counters (a figure that
  spins up is unreadable and undermines "these are your real numbers").
- Everything inside `prefers-reduced-motion: reduce` is disabled, not
  merely shortened.
