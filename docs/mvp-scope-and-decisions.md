# PantryIQ — MVP Scope & Decisions

**Status:** Working implementation contract.

This is the authoritative document for what the MVP is and isn't. Where
older planning docs disagree with this one, this document wins — it was
built by reconciling them (see "Provenance & corrections" at the bottom).
Unresolved items that could not be reconciled are in
[`open-questions.md`](open-questions.md), not decided here.

## Product contract

- PantryIQ is a decision-support tool, not an autopilot. The user remains
  the decision-maker.
- The MVP is scoped to **one selected location or operating unit at a
  time** — see "Scope rule" below.
- The primary target is a full-service restaurant with one to three
  locations. Food trucks and adjacent formats can use the same core data
  model, but event-specific and mobile-specific workflows are out of
  scope.
- The first product loop is: **CSV import → operational facts → ranked
  recommendation → dashboard explanation → chat investigation.**
- A second loop is in MVP scope: **surplus identified → offered to a
  local recipient → claimed → collected → logged.** See "Food donation"
  below. PantryIQ serves **two** audiences: the restaurant operator, and
  the shelter or soup kitchen receiving food.

## Core product intent

PantryIQ should feel like a thought partner for operators managing sales,
purchasing, and waste. It should help users:
- understand what is changing in their business
- identify what is costing them money
- decide what action to take this week
- trust the output because it is grounded in real imported data

The MVP should be especially strong at explaining waste, spoilage, and
margin changes; helping users understand what's driving those changes;
recommending practical next actions; and supporting both quick dashboard
review and grounded chat investigation.

**Primary jobs to be done:**
- What am I losing money on right now?
- What is being wasted or at risk of being wasted?
- Why are my margins changing?
- What should I order less of, more of, or watch closely this week?
- What should I act on first?

## Target users for MVP

Full profiles are in [`personas-and-research.md`](personas-and-research.md).

- **Primary:** Ron Weasley (plain-English insight, fast setup, believable
  answers), Percy Weasley (evidence and defensible recommendations),
  Severus Snape (item-level reasoning, waste visibility, assumption
  control).
- **Secondary:** Minerva McGonagall (fast executive snapshot), Harry
  Potter (credible whole-operation view), Albus Dumbledore (strong
  per-location visibility without cross-location comparison).
- **Adjacent fits:** Kingsley Shacklebolt, George Weasley, Nymphadora
  Tonks — these may fit the core workflow if they're asking the same
  sales/purchasing/waste questions, but the MVP does not solve every
  bar-specific, event-specific, or mobile-specific edge case for them.

## Scope rule: one operation at a time

The MVP supports multiple locations or operating units under one account,
but PantryIQ works on **one location, truck, or operating unit at a
time**:
- imports are always tied to one selected location or truck
- the dashboard is scoped to one selected location or truck
- chat answers are scoped to one selected location or truck
- users can switch contexts, but PantryIQ does not aggregate across them
  in the MVP

This should be stated clearly in product copy and UX.

## Food donation

**Status: in MVP scope.** Confirmed by the founder on 2026-08-07, during
the brand-design session. This reverses the position held by every
document written before that date, including earlier revisions of this
one, which listed donation as a long-term vision item only. See
"Provenance & corrections" for what changed.

### What was confirmed

- Restaurants register as **donors**.
- Shelters, soup kitchens, and comparable organizations register as
  **recipients**.
- The two are **connected by locality** — recipients near the donating
  restaurant.
- The purpose is to route food a restaurant could not sell to people who
  need it, rather than to the bin.

That is the whole of what has been decided. Everything below the line is
either a direct consequence of it or an open question — see
[`open-questions.md`](open-questions.md) §3, which is substantial and
should be read before anyone builds this.

### Direct consequences worth stating

- **PantryIQ becomes a two-sided product.** Recipients are users with
  accounts, not records inside a restaurant's data. The account model in
  [`architecture-and-data-model.md`](architecture-and-data-model.md)
  currently assumes one user owning locations, and does not accommodate
  this.
- **PantryIQ stops being purely decision-support on this surface.** The
  core product is read-only and never acts. A donation offer is a real
  commitment to a third party who may drive across town for it. The
  product contract's "we recommend, you decide" holds for the operator's
  decision to offer — but once an offer is claimed, the system is
  coordinating a real-world handoff, which is a different kind of feature
  and carries different failure modes.
- **Donation is framed to operators in dollars, not in charity.** Surplus
  already represents money lost; donation is a better exit for it, with a
  deductible value attached. See
  [`brand/voice-and-tone.md`](brand/voice-and-tone.md) §1 — the recipient
  side never sees dollar framing.

### The notification contradiction

This document lists "email, push, or webhook notifications" as an explicit
non-goal, with in-app alerts deemed sufficient. **That is not sufficient
for the recipient side.** A shelter coordinator cannot be expected to keep
a dashboard open in order to discover that prepared food expires in two
hours. A donation marketplace with in-app-only alerting will fail on the
recipient side by construction.

This is not resolved here. It is a genuine conflict between two decisions
that were made independently, and it is tracked in
[`open-questions.md`](open-questions.md) §3.

## MVP UX principles

- **Dollar-first** — show financial impact before operational detail
- **Plain-English** — understandable to non-technical operators
- **Action-oriented** — recommendations should help a user decide what to do next
- **Grounded** — every important claim tied to imported data
- **Honest** — say what is known and what isn't
- **Explainable** — users can inspect reasoning, evidence, and assumptions
- **Low-friction** — value without long onboarding or heavy setup
- **Flexible surface area** — dashboard and chat are both first-class ways to win

## Trust and honesty requirements

Trust is the central adoption gate. A generic, vague, or confidently
wrong answer loses the user for good.

- PantryIQ must state what data supports an answer and what remains unknown.
- PantryIQ must admit when there isn't enough data for a good recommendation, and explain what's missing.
- PantryIQ must never pretend certainty it doesn't have.
- "Show your work" must be able to surface what data it looked at, what assumptions it used, and what logic led to the answer. If it can't, the output should be treated as unreliable.

## Partial data policy

The MVP should still provide value with only partial data. Example: if
the user has uploaded transactions but not purchase orders or inventory
counts, PantryIQ should still answer some questions, and clearly state
what it can and can't answer confidently yet. This keeps onboarding
lighter while preserving honesty.

## Input scope

- CSV import is the MVP source of truth.
- Supports transactions, purchase orders, and inventory snapshots.
- Manual entry uses the same normalized records and is the next input
  workflow after typed CSV import.
- **Square remains in the repository as deferred Phase 2 work — it is not
  part of the MVP acceptance criteria.** (This overrides `VISION.md`'s
  older framing of Square as MVP scope, and is in tension with the market
  research finding that Square/Toast are competitively "must-have" — see
  `open-questions.md`.)
- CSV export remains an MVP trust fallback for imported and derived data,
  even though downstream automation is deferred.

## First value moments

Two equally important first wins, not a primary/secondary pair:
1. **Dashboard win** — after import, land on a dashboard that quickly
   shows what's costing money, what's trending wrong, and what needs
   attention first.
2. **Chat win** — after import, ask a direct question and get a
   believable, grounded answer with evidence.

## Recommendation contract

- Facts are presented separately from predictions. Observations ("0%
  sell-through") carry no confidence label; predictions are explicitly
  labeled as predictions with their basis, and uncertain predictions are
  admitted openly ("we don't have enough data"). The system doesn't grade
  its own confidence — it shows data and evidence, and the user decides
  whether to believe it.
- Every recommendation includes: observation, suggested action, time
  horizon, available financial impact, and supporting evidence.
- Predictions are only generated when enough history exists (minimum four
  weeks of transaction history); shorter histories can produce
  observations but not predictions.
- No recommendation changes inventory, pricing, menu data, or orders
  without a future explicit approval workflow.

### Scoring formula

Ranking uses three dimensions, weighted and proportionally rebalancing if
a dimension is added later:

```
score = (Impact × 0.40) + (Urgency × 0.40) + (Data Sufficiency × 0.20)
        ──────────────────────────────────────────────────────────────
                            sum of weights
```

> Earlier drafts (`GRILLING-SESSION-NOTES.md`, `RECOMMENDATION-ENGINE-ARCHITECTURE.md`)
> called the third dimension "Confidence." The ledger renamed it **Data
> Sufficiency** to avoid implying the system certifies its own certainty —
> the UI should show evidence and data coverage, not a confidence claim.
> Same formula, same weights, clarified label.

**Provisional calculation rules:**
- **Impact** — estimated cost of current on-hand inventory at risk, plus
  the cost of unaccounted variance when purchase and sales data are
  available.
- **Urgency** — based on estimated shelf-life remaining and supplier
  lead-time data when available; conservative when those inputs are
  missing.
- **Data sufficiency** — based on history length, presence of purchase
  data, and presence of inventory data. Used for ranking, not shown as a
  certainty claim.
- Missing prices or inventory counts reduce the available financial
  analysis; the system must state what cannot be calculated.

The dashboard shows the **top five recommendations** for the selected
location.

### Message format

Every recommendation (dashboard or chat) follows this structure:

1. **Observation:** facts with supporting metrics
2. **Financial Impact:** quantified cost at risk
3. **Prediction** (if applicable): forward-looking statement with basis
4. **Recommendation:** concrete action suggestion
5. **Show Your Work** (on demand): data sources, calculations, assumptions

Example:
```
Salmon: Ordered 3 times, sold 0 times (0% sell-through).
Current on-hand: 2 lbs. Estimated spoilage risk: $40 over 3 days.

Prediction: Based on 0 sales across 3 orders this month,
salmon probably won't sell if reordered.
(4 weeks of transaction data)

Recommendation: Consider reducing next order by 50%, or
removing from menu this week.

[Show your work] [Ask about this]
```

### Feedback loop (phased)

- **Phase 1 (MVP):** system surfaces recommendations based on
  Impact + Urgency + Data Sufficiency. No thumbs up/down yet.
- **Phase 2 (Learning):** users thumbs up/down every recommendation.
- **Phase 3 (Evolution):** system learns which recommendation types are
  helpful and which dimensions matter most. Not doing in MVP: complex ML
  models, automatic weight tuning, per-user personalization.

## Dual surface model

- **Dashboard** — automated daily snapshot + in-app alerts (passive
  monitoring: what the system thinks matters).
- **Chat** — manual query interface for questions grounded in imported
  data, including things the dashboard isn't surfacing (active
  investigation: what the user thinks matters).

Both are equally important first-win paths for different personas: e.g.
Ron/Percy lean on the dashboard to catch things passively, Snape/Kingsley
lean on chat to dig into specific items. Dashboard alerts should be
queryable in chat ("tell me more about salmon"), and overrides made in
chat should cascade to dashboard calculations.

## MVP pages

### Dashboard
**Purpose:** fast view of financial risk, operational risk, and
recommended action for the selected location.
- Wallet impact summary (total cost at risk)
- Top 3–5 alerts ranked by Impact + Urgency + Data Sufficiency
- Trend summaries (margin, spoilage, other signals)
- Item-level problem areas when useful
- Call-to-action per alert (link to chat, `Ask about this`)
- Location selector, if multi-location
- Constraints: in-app only (no email/push/webhook), scoped to one
  selected location, updated daily

### Chat
**Purpose:** fast way to ask grounded questions about the selected
location or truck.
- Natural-language question interface, streaming responses
- Answers using imported data only
- Explains evidence and reasoning on request; shows data coverage and
  assumptions
- Admits when data is insufficient
- Supports user challenge and assumption overrides
- Session-only memory (not persisted across sessions in MVP)
- Constraints: scoped to currently selected location, read-only (no data
  entry or order automation in MVP), no export from chat (Phase 2)

Interaction shape:
```
User: "What am I wasting money on?"
→ PantryIQ: [Facts about spoilage/waste by item]
            [Prediction: which items are at risk]
            [Recommendation: what to investigate first]
            [Link: Show your work / Ask follow-up]
→ User: can ask follow-up, or override an assumption
```

### Import Data (CSV)
**Purpose:** normalize uploaded source data into a canonical internal
model so dashboard and chat work reliably. Detailed mechanics (column
mapping, item matching, thresholds) live in
[`ux-flows.md`](ux-flows.md); this is the page-purpose summary.
- Supported import types: transactions, purchase orders, inventory snapshots
- User selects one location or truck first
- Flow is forgiving, not technical; uncertain mappings resolved one step at a time
- Item matching and item creation guided clearly
- Ends in an obvious next step: dashboard or chat
- Success condition: the system feels like it works with messy data
  instead of rejecting it; upload to first dashboard in <5 minutes

### Settings
**Purpose:** manage business configuration needed for trustworthy
analysis.
- Account basics, location management, item master (categories, shelf
  life, unit cost), import history
- Shelf life and unit cost must be user-editable — trust depends on being
  able to correct the model

### Donate (operator side)
**Purpose:** turn identified surplus into an offer to a nearby recipient.
- Reachable from a dashboard recommendation ("Offer to a shelter") and as
  a standalone page
- Operator states what the food is, quantity, whether it is prepared or
  raw, allergens, and a collection window
- Shows nearby registered recipients and their stated acceptance criteria
- Logs the donation with weight and estimated value for the operator's
  records
- Constraints: the operator always initiates; PantryIQ never offers food
  on their behalf

### Claim (recipient side)
**Purpose:** let a shelter or soup kitchen see and claim what's available
nearby.
- List of open offers within range, showing food type, quantity,
  prepared/raw, allergens, collection window, and distance
- Claim and pass actions
- No dollar figures anywhere on this surface
- Constraints: recipients see offers, not restaurant financials. A
  recipient must never be able to infer a restaurant's margins, costs, or
  waste totals from what they can see.

> Both pages are specified here only at the level the founder confirmed.
> Matching logic, notification mechanics, verification of recipient
> organizations, no-show handling, and food-safety/liability terms are all
> **undecided** — see [`open-questions.md`](open-questions.md) §3. Do not
> infer them from this section.

## Recommendation expectations (examples)

A recommendation includes the action, expected financial impact if known,
supporting evidence, data coverage, and time horizon. Good MVP
examples: "reduce next order of salmon this week," "push this item before
spoilage risk rises further," "review why this item's margin fell
compared to last week."

## Core user workflows

**Signup → location → import → dashboard (critical path):**
1. User signs up (email/password)
2. User creates first location (name, address, type)
3. User uploads CSV (transactions, POs, inventory)
4. User reviews import preview and maps columns
5. System imports and shows dashboard with top alerts
6. User sees an `Ask a question in chat` CTA

Success: user lands on dashboard with 3–5 alerts visible, under 5 minutes
elapsed.

**Chat-driven discovery:**
1. User opens chat, asks "What am I wasting money on?"
2. System shows observations + recommendations
3. User asks a follow-up ("tell me more about salmon")
4. User can challenge an assumption ("actually, salmon shelf life is 7
   days, not 3")
5. System recalculates and shows updated recommendations

Success: grounded, believable answer within 3–5 seconds.

**Donation — operator side:**
1. Dashboard flags surplus that won't sell before it turns
2. Operator chooses "Offer to a shelter"
3. Operator confirms what it is, how much, prepared or raw, allergens,
   and when it can be collected
4. System shows nearby registered recipients; offer is published
5. On claim, operator sees who claimed it and when they'll collect
6. Operator marks it collected; system logs weight and estimated value

**Donation — recipient side:**
1. Recipient organization registers and states what it can accept
2. Recipient sees open offers nearby with quantity, type, allergens, and
   collection window
3. Recipient claims an offer
4. Recipient collects

Success: an operator can move real surplus to a real recipient without
leaving PantryIQ, and neither side sees information belonging to the
other.

**Assumption override:**
1. User questions a recommendation ("that salmon shelf life is wrong —
   it's 14 days frozen")
2. System confirms the change and asks scope: "apply to all salmon, or
   just this conversation?"
3. User chooses a scope
4. System recalculates affected recommendations

Success: user can correct the model mid-conversation without leaving
chat.

## Explicit non-goals (out of MVP scope)

- Square, Toast, or other POS integrations
- Cross-location aggregation or comparison, including side-by-side location comparison
- Email, push, or webhook notifications **for the operator surface**
  (this non-goal is in unresolved conflict with the recipient side of
  donation — see "The notification contradiction" above)
- Advanced beverage variance / pour-cost workflows
- Event-specific planning and event-level cost tracking (food trucks, catering)
- Ghost-kitchen multi-brand allocation
- Advanced mobile-first workflows beyond responsive-web minimums
- Export and downstream action workflows (beyond the CSV export trust fallback)
- Sophisticated onboarding/setup automation
- Autonomous chat-to-database updates (the AI never silently writes back to the data model)
- Machine-learned weight tuning / per-user personalization

### Deferred feature backlog

Each item below is intentionally out of MVP. It graduates into scope only
after clear user validation — not because it sounds strategic.

| Feature | Why deferred | What would validate it |
|---|---|---|
| Multi-location aggregation & comparison | MVP stays focused on one location/truck at a time so trust, clarity, and execution stay strong | Repeated feedback from multi-unit operators that location switching isn't enough |
| Email, push, webhook notifications | In-app alerts are enough for MVP; external channels add product and infra complexity | Users consistently ask to be alerted outside the app |
| Advanced beverage variance / pour-cost workflows | MVP should prove the core sales/purchasing/waste/recommendation loop first | Repeated demand from bar-heavy operators, gastropubs, beverage managers |
| Event-specific planning & event-level cost tracking | MVP is scoped around one operating unit, not a first-class event model | Repeated demand from food trucks, caterers, mobile concepts |
| Ghost-kitchen multi-brand allocation | Shared-inventory allocation across virtual brands adds methodological and data-model complexity | Ghost-kitchen users need brand-level attribution before trusting recommendations |
| Advanced mobile-specific workflows | MVP supports responsive web but doesn't need every workflow mobile-optimized | Users regularly use PantryIQ on the move and hit repeated mobile friction |
| Export and downstream action workflows | MVP should prove insight value before building handoff tooling | Users repeatedly ask to export data/recommendations/analysis elsewhere |
| More sophisticated onboarding/setup automation | MVP should focus on a clean, forgiving import and a believable first value moment | Users struggle to reach first value even when insight quality is strong |
| Chat-to-dashboard autonomous feedback loop (AI detects dashboard-relevant facts in chat and writes them back, with user confirmation) | The most complex piece in the system — a false positive here could silently corrupt dashboard recommendations, directly contradicting the trust requirement | Beta users consistently reveal facts/corrections in chat they wish had updated the dashboard automatically, unprompted |

Validation questions to run past beta users on these: is single-location
analysis enough for now? Do you need side-by-side location comparison? Do
you need alerts outside the app? Do you need beverage-specific variance
or pour-cost logic to trust the product? Do you need event-based planning
rather than standard date-range analysis? Do you need export workflows or
operational handoff features? Is responsive web enough, or are there
mobile workflows that still feel broken?

## Roadmap

- **MVP (now):** CSV import + manual entry, dashboard + chat, per-location
  analysis, recommendations with data-sufficiency-based ranking, and the
  two-sided donation loop.
- **Phase 2:** Square POS integration, export workflows, advanced
  beverage variance, thumbs up/down feedback loop.
- **Phase 3:** multi-location aggregation, email/push notifications,
  ghost-kitchen multi-brand support, event-specific planning, learned
  weight tuning.

(This roadmap sequencing is provisional — it does not resolve the
Square-priority tension flagged in `open-questions.md`.)

## Validation queue

Things to validate with real operators before or during Phase 2 planning:
- Whether CSV-only onboarding is acceptable for the target segment.
- Purchase and inventory data quality, via 3–5 operator interviews.
- Whether daily dashboard recommendations are used without external notifications.
- Pricing and Square willingness-to-pay, before committing to Phase 2 scope.

## Success criteria

The MVP succeeds if a user can:
1. Import data for one selected location or truck without getting stuck
2. Get meaningful value even with only partial data uploaded
3. See useful dashboard findings for the selected operation
4. Ask a question in chat and get a grounded, believable answer
5. Understand data coverage, evidence, and assumptions
6. Challenge PantryIQ and see it explain or revise its reasoning honestly
7. Adjust important assumptions like shelf life and item metadata
8. Offer surplus to a nearby recipient and have it actually get collected

Criterion 8 depends on recipients existing in the operator's area before
the operator ever looks. That is a cold-start problem, not a feature —
see [`open-questions.md`](open-questions.md) §3.

Quantitative targets (beta user count, conversations/week, NPS,
recommendation adoption rate, time to first value) are unset — tracked as
an open question in `open-questions.md`.

## Provenance & corrections

This document reconciles, in order of authority: `MVP-DECISION-LEDGER.md`
(highest — most recent, explicitly reconciling), `expected-ux-v3.md`
(product intent and page purposes), `deferred-features-v2.md` (backlog),
`GRILLING-SESSION-NOTES.md` (decision rationale), and `PRD-SKELETON.md`
(feature checklists, data model pointers, workflows), all now folded in
here.

### 2026-08-07 — execution decisions moved to the feature backlog

Later the same day, a backlog session closed eleven decisions and
recorded them in [`feature-backlog.md`](feature-backlog.md) §3. Three of
them qualify this document and should be read alongside it:

- **Donation is unscheduled.** Its MVP scope, described below, stands.
  It is simply not in the build queue — see `feature-backlog.md` §8.
- **Four deferred non-goals hardened into permanent ones**: an MCP
  server, external notifications, native mobile apps, and export or
  downstream workflows beyond the CSV trust fallback. The "Deferred
  feature backlog" table below still lists three of these as awaiting
  validation. They are no longer awaiting anything.
- **The phase roadmap is superseded as a scheduling device.** Its content
  survives as tickets; the ordering does not. Dependencies are the only
  order.

Also closed there: the Impact score's composition (this document's
provisional rules), the spoilage-authority question, and the AI grounding
architecture — the model narrates precomputed results and never
calculates.

### 2026-08-07 — food donation added to MVP scope

This document previously contained no donation scope of any kind, and
[`vision.md`](vision.md) described food donation as one of four long-term
question domains — explicitly the north star, not the MVP. During the
brand-design session on 2026-08-07 the founder confirmed that a two-sided
donation marketplace **is** MVP scope.

The earlier omission was not a decision that got reversed; donation had
simply never been written down as scope, and the brand work surfaced the
gap. The corpus is now reconciled to the founder's stated intent. What
this does **not** mean:

- It does not mean the donation feature is specified. It isn't — see
  [`open-questions.md`](open-questions.md) §3.
- It does not mean the MVP got proportionally larger in effort terms in a
  way anyone has estimated. A two-sided marketplace with a second user
  type, a second account model, and real-world coordination is a large
  addition to a CSV-and-chat product, and no one has costed it.

Known corrections carried forward from the ledger:
- The older `VISION.md` described Square as MVP scope; this document
  follows the later CSV-first decision instead.
- "Confidence" was renamed "Data Sufficiency" for the third scoring
  dimension, to avoid implying the system certifies its own certainty.
- `CPO-QUESTIONS.md` was referenced everywhere as having 15 questions but
  only ever contained one; the gap is tracked in `open-questions.md`
  rather than silently dropped.
