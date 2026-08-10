# PantryIQ — Marketing & Landing Page Copy

**Status:** Authoritative for positioning, the landing page, and
persona-targeted messaging. Extends
[`brand-foundations.md`](brand-foundations.md) and inherits every rule in
[`voice-and-tone.md`](voice-and-tone.md).

The current site at pantry-iq.com and `components/landing-page.tsx` on
`master` are superseded by this document in full. See §8 for what
specifically was wrong with them.

---

## 1. The core message

**Headline:**

> ## See what your kitchen data can tell you.

**Subhead:**

> PantryIQ is for restaurant operators who want a clearer view of sales,
> purchasing, and waste. It keeps you in control and shows the numbers
> behind each decision.

**Primary CTA:** `See how it works`
**Secondary CTA:** `See the problem it solves`
**Reassurance line under the CTAs:** One location at a time. No POS
connection required.

**Why this headline works:** it names the operator's starting point — the
data already in the business — without promising an insight, calculation,
or action the current build cannot yet provide.

**Never use as a headline:** anything containing "AI-powered,"
"intelligent," "revolutionize," "unlock," or "restaurant analytics."

## 2. Positioning statements

**Elevator (one sentence):**
> PantryIQ reads the sales and purchasing data a restaurant already has and
> tells the operator in plain English where their money is going. It shows
> the arithmetic behind every number.

**Against competitors (MarketMan, MarginEdge, BevSpot, Craftable):**
> Every comparable tool needs a POS integration, a recipe library, and
> two to four weeks of setup before it tells you anything. PantryIQ needs
> a spreadsheet export and five minutes.

**Against doing nothing:**
> You already know spoilage is costing you. PantryIQ tells you how much,
> which items, and what to do this week.

**The trust claim (the most important sentence on the site):**
> Every number comes with the rows it came from and the arithmetic that
> produced it. If PantryIQ can't work something out, it says so.

## 3. Landing page structure

Section by section. Each has a job; if a section can't state its job in
one line, cut it.

### 3.1 Nav
Wordmark left. `Pricing` · `Sign in` · `Start free` (Azure pill). Nothing
else. No donation link, mega-menu, or "Solutions" dropdown.

### 3.2 Hero
Headline, subhead, two CTAs, reassurance line. **No hero image, no
dashboard mockup floating at an angle, no gradient, no decorative rule.**
The type and the whitespace do the work.

### 3.3 The proof strip
Three short claims directly under the hero, in mono figures:

| | |
|---|---|
| **One location** | Scoped to one operating unit |
| **Show your work** | Facts stay separate from predictions |
| **You decide** | Recommendations stay suggestions |

These state the product contract without claiming that an import,
recommendation, or chat session is available on the landing page today.

### 3.4 The problem, in their words
Not statistics. A specific, recognizable scene.

> You bought three cases of salmon because you always do. You sold it
> twice. The rest went gray in the walk-in on a Tuesday and you found out
> when you emptied the bin.
>
> You know it's happening. You don't know what it costs. By the time it
> shows up in the P&L, the loss is three months old.

**Do not** open with "$162 billion of food is wasted annually." An
industry statistic is about the industry; an operator cares about their
own walk-in. The old site led with three such statistics and they are
removed.

### 3.5 How it works — three steps
1. **Start with the data you already have.** The MVP is designed around
   sales exports, purchase orders, and inventory counts. CSV is the trust
   fallback.
2. **Separate facts from predictions.** The product contract keeps observed
   numbers distinct from predictions and says what the data cannot support.
3. **You make the call.** PantryIQ recommends and explains. You decide what
   happens next.

### 3.6 The proof section — show, don't claim
The landing page shows the actual recommendation component, plus a visible
real-world example. The reference is a reported restaurant case —
`$55,000` in monthly food purchases, `4.1%` food-cost variance, `$2,255`
unaccounted for, and a `$1,540` recoverable gap. The example also shows five
common restaurant categories at roughly `$6,800`–`$14,000` each over four
weeks, totalling about `$55,200`; the ranked bars below those figures remain
the separate current dollars-at-risk view. That view is deliberately framed
as a bad-month illustration, with roughly 9–11% of each category's monthly
buying volume at risk. The category mix and dollar values are generalized from
reported restaurant cases and linked to the source without claiming they are
one published restaurant's exact five rows or promising that these losses are
typical.

### 3.7 Donation
Omitted from the current landing page. Donation remains outside the
scheduled backlog, and the site must not imply that a restaurant can find a
recipient or log a donation today.

### 3.8 Pricing
State the price plainly. No "contact sales," no fake three-tier anchoring.

> **Baseline MVP tier:** `$50` per location per month. This is the opening
> price for one location as the MVP becomes available. Do not imply a
> multi-location tier structure or a separate truck tier on the landing page.

### 3.9 Final CTA
Repeat the primary CTA. One line above it, no new argument:
> Start with one spreadsheet. See what it tells you.

## 4. Per-persona messaging

Full profiles live in
[`../personas-and-research.md`](../personas-and-research.md). This table
is the copy layer over them.

| Persona | What lands | What loses them |
|---|---|---|
| **Ron** — owner-operator | "Know what your kitchen is costing you, without living in a spreadsheet." Dollar-first, time-saving, plain. | Jargon. Vague AI promises. Enterprise look. Anything implying he must change how he runs his kitchen. |
| **Percy** — GM | "Walk into every ownership conversation with data, not gut instinct." Makes him look sharp. | Anything framed as catching him out, or positioning the owner as the beneficiary. |
| **Snape** — chef | "The data to back up what you already know." Craft-first. Gives him authority. | Any suggestion the software knows his kitchen better than he does. Fixed shelf-life defaults presented as fact. |
| **McGonagall** — hands-off owner | "An independent view of your restaurant's health." Executive brief register. | Implying daily use or that she'll do her own imports. |
| **Harry** — gastropub owner | "One view of the whole operation: food, bar, and everything between." Acknowledges complexity. | Oversimplified dashboards. Generic "restaurant analytics." Anything built for fast-casual. |
| **Kingsley** — bar manager | "Know your pour cost without living in a spreadsheet." | Demos showing only food. *(Note: pour-cost workflows are explicitly out of MVP scope — do not promise them.)* |
| **George** — food truck | "Know before you order." Event forecasting. Mobile-friendly. | Enterprise look. Long onboarding. Anything assuming an office. |
| **Hermione** — ghost kitchen | Methodological rigor. "The intelligence layer on the data you already have." | "Magic" framing. Anything implying the tool decides for her. |
| **Dumbledore** — small chain | "Run every location like your best location." | Single-location-only framing. Punitive per-location pricing. |
| **Tonks** — mobile bar/catering | "Know your true cost before you quote your next event." | Restaurant language assuming a walk-in and a fixed menu. *(Event workflows are out of MVP scope — do not promise them.)* |

**Scope honesty rule:** three personas above (Kingsley, George, Tonks)
want things the MVP explicitly does not do. Marketing may speak their
language about the *problem*. It may not promise the *feature*. See the
non-goals list in
[`../mvp-scope-and-decisions.md`](../mvp-scope-and-decisions.md#explicit-non-goals-out-of-mvp-scope).

## 5. Headline formulas that work

1. **Verb + what it costs.** "Know what you're throwing away."
2. **Before/after time.** "Find it before the P&L does."
3. **Permission to trust your gut.** "The data to back up what you already know."
4. **Plain outcome, three beats.** "Waste less. Feed more. Keep the difference."

**Formulas that don't:** "The AI-powered platform for X." "X, reimagined."
"Meet the future of X." Any question headline. Any headline with a colon
followed by a feature list.

## 6. Words

**Use:** waste, spoilage, walk-in, sell-through, margin, at risk, on hand,
shelf life, order, supplier, cost, this week, show your work, evidence.

**Avoid entirely:** solution, platform, ecosystem, holistic, synergy,
transform, empower, revolutionize, disrupt, cutting-edge, best-in-class,
robust, seamless, effortless, unlock, leverage, supercharge, AI-powered,
intelligent, smart, insights (as a noun on its own).

**Handle with care:** "AI" is permitted once, low on the page, described
as what it does — "ask a question in plain English and get an answer from
your own data." Never as a badge, never in the hero, never with a sparkle
icon.

## 7. Claims discipline

Every claim on the marketing site must be true of the product **today**.
This is not a legal preference; it is the same trust contract that governs
the product. An operator who arrives from a promise the product doesn't
keep is worse than an operator who never arrived.

- No POS integration claims. Square and Toast are out of MVP scope.
- No multi-location comparison claims. Explicitly out of scope.
- No pour-cost or event-planning claims.
- No email, push, or webhook alert claims.
- No customer counts, testimonials, or logos until they are real.
- No unsourced industry statistics.
- If a screenshot shows a feature, that feature ships.

## 8. What was wrong with the old site

Recorded so the mistakes don't return. Reference:
`components/landing-page.tsx` on `master`.

1. **Promised food donation the product could not do.** The subhead said
   "help donate surplus to those in need" with nothing behind it. Donation
   is now real scope — but the lesson stands: the hero promised a feature
   that did not exist.
2. **Led with industry statistics** ($162 billion, 4–10%, 8% of
   emissions). Three cards of numbers about the industry, none about the
   reader.
3. **"AI-Powered Restaurant Intelligence" badge with a sparkle icon** —
   the exact vocabulary and iconography every persona is documented as
   distrusting.
4. **Chef-hat logo and a leaf icon** — the food clip-art now explicitly
   banned in [`brand-foundations.md`](brand-foundations.md) §8.
5. **Teal primary against a purple accent** — two hues in the blue region
   at similar chroma, which converge for a deuteran viewer. The brand
   color and the accent color were, for a large share of users, the same
   color.
6. **Emphasis split across profit, waste, and charity at once**, so no
   single promise landed.
