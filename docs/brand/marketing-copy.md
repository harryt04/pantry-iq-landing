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

> ## Waste less. Feed more. Keep the difference.

**Subhead:**

> Upload your sales and purchasing data. PantryIQ tells you what waste is
> costing you this week, what to do about it, and exactly how it got the
> number — then helps you get the surplus to a shelter nearby.

**Primary CTA:** `Import a CSV`
**Secondary CTA:** `See a worked example`
**Reassurance line under the CTAs:** No POS connection required. Works
with a spreadsheet export.

**Why this headline works:** three short clauses covering waste reduction,
donation, and margin, in that order, with no jargon and no AI vocabulary.
"Keep the difference" does the commercial work without saying "increase
profitability." It is the only headline in the set that carries both
halves of the mission honestly, which matters now that donation is real
scope.

**Never use as a headline:** anything containing "AI-powered,"
"intelligent," "revolutionise," "unlock," or "restaurant analytics."

## 2. Positioning statements

**Elevator (one sentence):**
> PantryIQ reads the sales and purchasing data a restaurant already has,
> and tells the operator in plain English where their money is going —
> showing the arithmetic behind every number.

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
Wordmark left. `Donate` · `Pricing` · `Sign in` · `Start free` (Azure
pill). Nothing else. No mega-menu, no "Solutions" dropdown.

### 3.2 Hero
Headline, subhead, two CTAs, reassurance line. **No hero image, no
dashboard mockup floating at an angle, no gradient, no decorative rule.**
The type and the whitespace do the work.

### 3.3 The proof strip
Three short claims directly under the hero, in mono figures:

| | |
|---|---|
| **Under 5 min** | Upload to first insight |
| **Every claim** | Traceable to a row you uploaded |
| **You decide** | Nothing changes without you |

These map to the three universal persona fears in
[`../personas-and-research.md`](../personas-and-research.md): wasted
setup time, made-up numbers, and loss of control.

### 3.4 The problem, in their words
Not statistics. A specific, recognisable scene.

> You bought three cases of salmon because you always do. You sold it
> twice. The rest went grey in the walk-in on a Tuesday and you found out
> when you emptied the bin.
>
> You know it's happening. You don't know what it costs. And by the time
> the P&L tells you, it's three months old.

**Do not** open with "$162 billion of food is wasted annually." An
industry statistic is about the industry; an operator cares about their
own walk-in. The old site led with three such statistics and they are
removed.

### 3.5 How it works — three steps
1. **Upload what you already have.** A sales export, a purchase order, an
   inventory count. CSV from any POS. Messy is fine — PantryIQ asks about
   the columns it can't read rather than rejecting the file.
2. **See what's costing you.** Ranked by money at risk, most urgent first.
   Each one says what it saw, what it costs, and what to consider doing.
3. **Ask it anything.** "Why is my halibut margin so bad lately?" Answers
   come from your data, with the rows attached.

### 3.6 The proof section — show, don't claim
One real recommendation card, rendered exactly as it appears in-product,
with **Show your work** expanded. This is the single highest-converting
element on the page, because it answers the objection every persona has:
*is it making this up?*

### 3.7 Donation
Positioned as a better exit for waste, not as charity.

> **The food that didn't sell doesn't have to go in the bin.**
>
> When PantryIQ spots surplus that won't move, it can find shelters and
> soup kitchens near you that accept it — and log the donation with weight
> and value, so it's deductible.
>
> You already paid for the food. This is a better ending for it.

Never: "give back," "make a difference," "do the right thing," "join our
mission," photographs of people receiving food.

### 3.8 Pricing
State the price plainly. No "contact sales," no fake three-tier anchoring.

> **Note for whoever writes this section:** pricing is genuinely
> unresolved — live pricing is $20/location and $10/truck, and market
> research points at $249–350. See
> [`../open-questions.md`](../open-questions.md) §2. Write the number
> that's true on the day, and don't imply a tier structure that doesn't
> exist.

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
| **Harry** — gastropub owner | "One view of the whole operation — food, bar, and everything between." Acknowledges complexity. | Oversimplified dashboards. Generic "restaurant analytics." Anything built for fast-casual. |
| **Kingsley** — bar manager | "Know your pour cost without living in a spreadsheet." | Demos showing only food. *(Note: pour-cost workflows are explicitly out of MVP scope — do not promise them.)* |
| **George** — food truck | "Know before you order." Event forecasting. Mobile-friendly. | Enterprise look. Long onboarding. Anything assuming an office. |
| **Hermione** — ghost kitchen | Methodological rigour. "The intelligence layer on the data you already have." | "Magic" framing. Anything implying the tool decides for her. |
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
transform, empower, revolutionise, disrupt, cutting-edge, best-in-class,
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
   colour and the accent colour were, for a large share of users, the same
   colour.
6. **Emphasis split across profit, waste, and charity at once**, so no
   single promise landed.
