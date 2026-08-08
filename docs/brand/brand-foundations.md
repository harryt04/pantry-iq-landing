# PantryIQ — Brand Foundations

**Status:** Authoritative for brand identity, colour, typography, and design
language. Where this document and a visual implementation disagree, this
document wins.

This is the root brand document. Three siblings extend it and must not
contradict it:

| Document | Owns |
|---|---|
| [`voice-and-tone.md`](voice-and-tone.md) | How PantryIQ talks — in chat, in the UI, to both audiences |
| [`marketing-copy.md`](marketing-copy.md) | Landing page, positioning, per-persona messaging |
| [`ui-implementation.md`](ui-implementation.md) | shadcn components, design tokens, chart rules, accessibility gates |

---

## 1. What PantryIQ is

PantryIQ is decision support for restaurant operators managing sales,
purchasing, and waste. It reads imported data, tells the operator what is
costing them money, recommends what to do about it, and shows its work.
It never acts on its own.

A second surface connects restaurants with local shelters and soup
kitchens so surplus food gets eaten instead of binned. **It is not a
sub-brand and has no name of its own** — it is PantryIQ, spoken in a
different register. See [`voice-and-tone.md`](voice-and-tone.md) §1.

> **Scope status.** Donation is confirmed MVP scope, and the product
> corpus was reconciled to say so on 2026-08-07 — see "Food donation" in
> [`../mvp-scope-and-decisions.md`](../mvp-scope-and-decisions.md).
>
> It is **in scope but not specified.** Four questions block
> implementation — food safety liability, how recipients get notified,
> how recipient organisations are verified, and the account model, since
> recipients are a second user type. See
> [`../open-questions.md`](../open-questions.md) §3. Brand and voice for
> this surface are settled; the feature underneath them is not.

## 2. Brand positioning

**The one-line positioning:**

> PantryIQ turns the data a restaurant already has into a plain-English
> answer about where its money is going — and proves every number it
> gives you.

**Category:** restaurant cost and waste intelligence. Not "AI-powered
restaurant analytics." Not an inventory management system.

**The wedge:** competitors require POS integration, weeks of recipe-library
setup, and a manual count cadence before delivering anything. PantryIQ
works from a spreadsheet export in under five minutes and explains itself.

**What we are not:**
- Not an autopilot. The operator decides; we inform.
- Not an inventory system of record.
- Not a POS replacement or a bookkeeping tool.

## 3. Brand personality

PantryIQ is **a serious instrument that speaks plain English.**

The design must survive a price move from $20/month to $299/month without
a rebrand — the unresolved pricing question in
[`../open-questions.md`](../open-questions.md) must not be answerable by
looking at the product.

| We are | We are not |
|---|---|
| Precise | Clinical |
| Plain-spoken | Dumbed down |
| Warm | Cute |
| Confident about facts | Confident about guesses |
| Willing to say "I don't know" | Hedging on everything |
| Respectful of craft | Deferential to the point of useless |

**The two people we must never lose:**
- **Ron** (scrappy owner-operator) must never feel stupid. If a screen
  makes him feel like the software is smarter than him, we've failed.
- **Snape** (chef) must never feel the software thinks it knows his
  kitchen better than he does. Every assumption we make is editable.

**The person we must be forwardable to:** **Percy** (GM) needs to paste
our output into an email to his owner without it looking like a toy.

## 4. Naming and the wordmark

- **PantryIQ** — one word, capital P, capital I, capital Q. Matches the
  domain and every existing document. Never "Pantry IQ", "PantryIq",
  "pantryiq", or "PIQ".
- **The donation surface has no product name.** It is PantryIQ. Do not
  coin "PantryIQ Rescue", "PantryIQ Give", or any sibling mark — an
  earlier draft proposed one and it was rejected. Refer to it by what it
  does: "donate surplus", "offer to a shelter".
- The wordmark is set in **IBM Plex Sans SemiBold at −0.035em tracking**.
  There is no logotype file, no custom lettering, and no icon mark.
- **There is no mascot, no chef hat, no leaf, no fork, no produce.** If a
  logo is ever needed as a square avatar, it is the letter **P** in Ink on
  Stone, set in the wordmark's typeface and tracking.

## 5. Colour

### 5.1 The governing rule

> **Colour is never load-bearing.**

This is the single most important rule in this document. The product owner
has red-green colour vision deficiency (deuteran/protan), and roughly 1 in
12 male restaurant operators do too. Beyond that, operators print
dashboards, forward screenshots, and read screens in bad kitchen light.

Meaning must be carried by **text, icon, position, and pattern first**.
Colour is a redundant reinforcement, added last. If removing all colour
from a screen destroys its meaning, that screen is broken.

Two corollaries, both learned the hard way:
1. **Never distinguish two states by two shades of the same hue.** "Same
   blue or different blues?" is unanswerable for a large share of users.
2. **Never distinguish two states by two hues from the same temperature
   family.** Two warms (rust and ochre) fail exactly as badly as two blues.
   State families must differ as **cool → neutral → warm**.

### 5.2 The palette — "Ledger"

Ink is the brand colour. Everything else appears only where it carries
meaning. This scarcity is the point: on a screen where almost nothing is
coloured, the one coloured thing is impossible to miss.

#### Neutrals

| Name | Light | Dark | Role |
|---|---|---|---|
| **Stone** | `#F7F6F3` | `#131311` | Page ground |
| **Card** | `#FFFFFF` | `#1A1A17` | Raised surfaces, cards, popovers |
| **Soft** | `#EFEDE7` | `#212120` | Inset panels, table stripes, code blocks |
| **Line** | `#E3E0D9` | `#2E2E2A` | Borders, dividers, input outlines |
| **Ink** | `#171614` | `#EDEBE6` | Body text **and** primary buttons |
| **Graphite** | `#6A675F` | `#94918A` | Secondary and supporting text |

The neutrals are warm, not cool. This is where the kitchen lives in the
brand — warm stone rather than cold slate — and it is the only place it
lives. Do not "correct" these toward grey.

#### Signal colours

| Name | Light | Dark | Means | Pattern | Glyph |
|---|---|---|---|---|---|
| **Azure** | `#0B5FA5` | `#6BB0E8` | Steady / healthy / links | solid | ● |
| **Iron** | `#4E4B44` | `#A8A399` | Watch — not urgent yet | diagonal hatch | ◆ |
| **Oxide** | `#A83A10` | `#E5804F` | At risk / act now | cross-hatch | ▲ |

Soft backgrounds for chips and banners:

| | Light | Dark |
|---|---|---|
| Azure soft | `#E5EEF6` | `#16232E` |
| Iron soft | `#EAE8E2` | `#26251F` |
| Oxide soft | `#F6E9E2` | `#2A1D16` |

**Why Watch is a neutral.** An earlier draft used an ochre `#8A6300`. It
was rejected: ochre and oxide are two warm hues at near-identical
lightness and are indistinguishable to a deuteran eye. The fix is not a
different warm — it is refusing to spend colour on a non-urgent state.
"Watch" earns a pattern and a glyph, not a hue. **Ochre is deleted from
the palette. Do not reintroduce a yellow, amber, gold, or brown.**

#### Chart categoricals

Maximum five series. Beyond five, split the chart. Every series carries a
pattern; the colour is redundant.

| # | Light | Dark | Pattern |
|---|---|---|---|
| 1 | `#0B5FA5` | `#6BB0E8` | solid |
| 2 | `#A83A10` | `#E5804F` | diagonal hatch |
| 3 | `#4E4B44` | `#A8A399` | cross-hatch |
| 4 | `#7A4E8C` | `#B98AC9` | dots |
| 5 | `#3E8FBF` | `#8FC5E5` | vertical rule |

**No green anywhere in the product.** Not for success, not for positive
trend, not as a categorical. Green against oxide is the single worst pair
for the primary user. Success and healthy states use Azure.

### 5.3 Contrast requirements

- Body text: **WCAG AA, 4.5:1 minimum**, against its actual background.
- Large text (≥24px, or ≥19px bold): 3:1 minimum.
- Interactive borders, focus rings, chart marks, and icons that carry
  meaning: **3:1 minimum** against adjacent colour.
- Focus ring is **Azure, 2px, with a 2px offset**, and is never removed.

## 6. Typography

One family for everything, one mono for figures. This is deliberate — the
restraint is what makes the product read like a financial document rather
than a marketing site.

| Role | Face | Notes |
|---|---|---|
| Display, UI, body | **IBM Plex Sans** | 400 / 500 / 600 / 700 |
| Every numeric figure | **IBM Plex Mono** | 400 / 500 / 600, `tabular-nums` always on |

**Rules:**
- **Every dollar amount, percentage, quantity, and date is set in IBM Plex
  Mono with tabular figures.** Numbers must align vertically in every
  table and stack. This is non-negotiable — it is the typographic
  expression of "dollar-first."
- Headlines use tight tracking (`-0.035em` at display sizes, `-0.025em` at
  heading sizes). Body text uses default tracking.
- Body copy is **16px minimum on mobile** (prevents iOS input zoom) with a
  line height of 1.6.
- Line length stays in the 45–75 character range at every breakpoint.
- No italics for emphasis in UI. Use weight 600.
- No all-caps except for the small mono labels (11px, `0.1em` tracking).

**Type scale** (rem, 16px root): 0.6875 / 0.75 / 0.8125 / 0.875 / 1 /
1.125 / 1.375 / 1.75 / 2.25 / 2.75. Do not invent intermediate sizes.

## 7. Design language

### 7.1 The signature: round controls, square paper

PantryIQ is built on shadcn/ui because Radix gives us accessible
primitives for free. It must not *look* built on shadcn/ui. Stock shadcn —
black button, 8px radius everywhere, sans-serif figures, title-over-
description cards — is the visual default of several thousand products,
and shipping it unchanged reads as unconsidered.

Four moves carry the identity. They are not decoration; they are the
brand, and they must survive any redesign.

1. **Round controls, square paper.** shadcn's single `--radius` token is
   split in two:
   - `--radius-control: 999px` — buttons, badges, chips, toggles,
     segmented controls, avatars. Full pills.
   - `--radius-surface: 3px` — cards, panels, tables, inputs, textareas,
     dialogs, popovers, code blocks. Near-square.

   Soft controls sitting on hard paper is the single most recognisable
   thing about the interface. Never round a surface. Never square a
   control.

2. **Figures are the largest thing on screen.** Every dollar amount is
   IBM Plex Mono, tabular, oversized, tightly tracked. Setting figures in
   the body sans at heading size is the clearest tell of an unmodified
   component library.

3. **Warm paper, not cool grey.** Stone `#F7F6F3` and Ink `#171614` are
   warm; shadcn's stock neutrals are cool and faintly blue. A small shift
   that changes the temperature of every screen, and the only place the
   kitchen lives in this brand.

4. **The state edge.** A 3px left border in the signal colour on any card
   that carries state, and nothing at all on cards that don't. Functional,
   not decorative: it reinforces the status chip without colour doing the
   work alone.

**Card headers keep shadcn's hierarchy** — a sans title at 15px/600 with a
Graphite description beneath. An earlier draft replaced this with an
uppercase mono micro-label and it was rejected for losing the visual
separation between heading and supporting text. Do not reintroduce it.

**Do not add a decorative rule, bar, or frame above card headings.** A
"double ledger rule" was proposed and rejected outright. Differentiation
comes from elements that do a job — radius, type, temperature, state —
not from applied ornament.

- **Borders over shadows.** A 1px Line border defines every surface.
  Shadows are permitted only on genuinely floating layers (dropdown,
  popover, dialog, toast) and stay large-blur and low-opacity.
- **Spacing is a 4px scale**: 4, 8, 12, 16, 20, 24, 32, 40, 56, 80. No
  arbitrary values.
- **Density is medium.** Comfortable enough for Ron on a phone, dense
  enough that Percy can see a week of data without scrolling.
- **Motion is functional only.** 120–200ms, ease-out, on state changes and
  layer entrances. No scroll-triggered reveals, no parallax, no bounce.
  Everything inside `prefers-reduced-motion: reduce` is disabled.
- **Theme follows the operating system** (`prefers-color-scheme`) with a
  persistent manual override. Neither theme is "the real one" — both ship
  at equal quality.
- **Mobile-first.** Build at 375px, add complexity upward with `min-width`
  queries. Touch targets ≥44×44px.

### 7.2 The primary button

The primary button is an **Azure pill**. This is the loudest departure
from stock shadcn, and it deliberately spends the healthy-signal colour on
a control.

That overlap is acceptable *because* of §5.1: colour is never
load-bearing, so "healthy" is never communicated by Azure alone — it is
communicated by the ● glyph, the word, and the solid pattern. Azure on a
button is therefore not competing with Azure on a chart mark.

Secondary buttons are Ink-outline pills on transparent. Destructive
buttons are Oxide pills, and **Oxide is never used for an ordinary
action** — if a screen has an Oxide button, something is being destroyed
or something is at risk.

## 8. Brand do's and don'ts

### Colour

| Do | Don't |
|---|---|
| Encode state with text + icon + pattern, then add colour | Encode state with colour alone |
| Use Azure for healthy and positive | Use green for anything, ever |
| Use Oxide sparingly, so it still means "act now" | Colour multiple things Oxide on one screen |
| Keep neutrals warm | Shift neutrals toward cool grey or pure black |
| Let most of the interface be uncoloured | Add colour for visual interest |
| Delete a colour that doesn't separate | Add a fourth signal colour to fix a separation problem |

### Typography

| Do | Don't |
|---|---|
| Set every figure in Plex Mono with tabular numerals | Set dollar amounts in the body sans |
| Use weight for emphasis | Use italics or colour for emphasis in UI |
| Keep to the ten-step scale | Invent a size to make something fit |

### Imagery and iconography

| Do | Don't |
|---|---|
| Use functional icons: trend, alert, document, dollar | Use chef hats, leaves, produce, forks, or plates |
| Show real screenshots of real data | Use stock photography of smiling chefs |
| Let the interface be the imagery | Add illustration to warm things up |
| Pair every meaningful icon with a text label | Ship an icon-only control |

### Product surface

| Do | Don't |
|---|---|
| Split radius: pills for controls, 3px for surfaces | Use one radius token everywhere |
| Keep shadcn's card title + description hierarchy | Replace card titles with uppercase mono labels |
| Differentiate with things that do a job | Add decorative rules, bars, or frames to look distinctive |
| Ship shadcn's Radix behaviour untouched | Ship shadcn's *appearance* untouched |
| Show the number before the chart | Lead with a visualisation |
| Put the dollar figure in the largest type on the card | Lead with a percentage |
| Make every assumption editable and say where to edit it | Present a default as a fact |
| Say what you can't calculate and why | Silently omit what's missing |
| Keep one location's scope obvious at all times | Imply data spans locations |

### Things that are automatically off-brand

- The words "revolutionary", "seamless", "effortless", "powerful",
  "unlock", "leverage", "supercharge", "game-changing", "AI-powered".
- A hero that promises anything the product cannot currently do.
- A confidence score presented as a fact about reality rather than a
  statement about data coverage.
- Purple-to-blue gradients, glassmorphism, floating 3D shapes, or any
  generic AI-product visual language.
- Any screen where turning off colour changes what it means.
- Anything that could be mistaken for the shadcn or Vercel homepage. If a
  screenshot would look at home in a component-library demo, the signature
  moves in §7.1 haven't been applied.

## 9. Accessibility commitments

These are commitments, not aspirations. They gate merge — see
[`ui-implementation.md`](ui-implementation.md) for the checklist.

1. Colour is never the sole carrier of meaning. Anywhere.
2. Every chart is legible in full greyscale.
3. All text meets WCAG AA contrast.
4. Every interactive element is keyboard reachable with a visible Azure
   focus ring.
5. Every meaningful icon has a text label or an accessible name.
6. Motion respects `prefers-reduced-motion`.
7. Touch targets are ≥44×44px.
8. Forms use real `<label>` elements; errors are described in text, not
   just outlined in Oxide.

**The greyscale test is the acceptance gate for any data visualisation:**
screenshot it, desaturate it, and read it. If you can't, it doesn't ship.
