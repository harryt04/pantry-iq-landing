# PantryIQ – Customer Screener

**Owner:** CPO  
**Purpose:** Quickly determine whether a prospect is a target customer worth a full discovery interview.  
**Time:** 5–10 minutes  
**Companion doc:** `mom-test-interview-guide.md`

---

## Hypotheses Under Test

The CPO's mission across all customer conversations is to prove or disprove these assumptions. Every screener and interview should generate signal on at least one of them.

| # | Hypothesis |
|---|---|
| H1 | Owners know they have a spoilage problem |
| H2a | CSV upload is not a dealbreaker — prospects will use it to get started |
| H2b | When OAuth is eventually available, specific providers will determine subscription willingness |
| H3 | Dollar-first framing resonates more than operational or percentage-based metrics |
| H4 | Owners will trust AI recommendations if they can see the evidence and reasoning |
| H5 | 7 days of transaction data is sufficient for a prospect to feel value on first use |
| H6 | Owners want to remain the decision-maker — AI as thought partner, not autopilot |
| H7 | A conversational chat interface is intuitive for non-technical operators |
| H8 | Non-owner roles (GM, chef, bar manager) can be product champions even when they are not the buyer |
| H9 | An early-adopter grandfathered price is sufficient incentive to commit before OAuth integrations exist |
| H10 | Single-location focus is acceptable for MVP — multi-location aggregation is not a day-one blocker |

---

## How to Use This Screener

Run through the questions conversationally — this is not a form to read aloud. The goal is to place the prospect into one of three buckets:

- **Continue** — real pain, data exists, purchasing involvement. Book a full interview.
- **Marginal** — some pain, unclear data situation or purchasing authority. Use judgment.
- **Exit** — no purchasing responsibility, no data, or operation type is out of scope.

If a prospect earns a **Continue**, schedule the full Mom Test interview within the same week while the conversation is fresh.

---

## Screener Questions

Ask these in roughly this order. Let the conversation breathe — follow interesting threads.

---

### 1. What kind of operation do you run?

Listen for: restaurant, bar, food truck, ghost kitchen, catering, mobile bar, gastropub, small chain.

> **Exit signals:** purely institutional (hospital, airline, school cafeteria), no food/beverage purchasing involved, strictly retail with no perishable exposure.

Useful two-to-five word summaries of the types of operators you are likely to encounter:

- **Hands-on solo operator** — owner in the kitchen daily, wears all hats
- **Hands-off owner** — owns it, delegates operations to a GM
- **General manager, not owner** — accountable but no equity
- **Chef or kitchen manager** — controls purchasing, owns the walk-in
- **Bar or beverage manager** — pour cost focus, spirits and draft
- **Food truck or commissary operator** — event-driven, no walk-in
- **Ghost kitchen / delivery-only** — data-forward, multi-brand complexity
- **Multi-location chain owner** — managing managers, not kitchens
- **Event caterer or mobile bar** — committed inventory per event, no fixed menu

None of these are automatic disqualifiers. They affect which pain points matter and who holds the wallet.

---

### 2. Are you involved in purchasing or ordering decisions?

Listen for: do they place orders, approve orders, set par levels, or negotiate with suppliers?

> **Exit signal:** they have zero involvement in purchasing and no influence over the person who does. If they're a potential internal champion (e.g. a GM who influences an absent owner), note this and continue — see H8.

---

### 3. When was the last time you threw away food or product you paid for?

This is the single most important screener question. Don't soften it or explain why you're asking.

Listen for:
- A specific story with a rough dollar amount → **strong Continue signal**
- "Oh, it happens all the time" without specifics → marginal, probe further
- "We're pretty tight, it's not really a problem" → soft pain, low priority

> **H1 signal:** Can they recall a specific spoilage event without being prompted? Specificity = real pain awareness.

---

### 4. How do you currently track inventory or sales data?

Listen for: POS system (Square, Toast, Clover, Lightspeed), spreadsheets, nothing formal, third-party inventory tools (BevSpot, MarketMan, BlueCart).

> **Exit signal:** no POS or transaction data of any kind. Without importable data, the MVP cannot deliver value.

Note their POS system — this feeds directly into the OAuth provider tally (see `mom-test-interview-guide.md`).

---

### 5. If I asked you for last month's sales data broken down by item, how long would that take — and what format would it be in?

Do not use the words "CSV" or "export." Let them describe the process in their own words.

Listen for:
- "I'd download it from Square / Toast as a spreadsheet" → CSV-comfortable, H2a likely true for this prospect
- "I'd have to ask my accountant / GM" → data exists but access is delegated
- "I'm not sure that's possible" → data exists at POS but prospect has never accessed it → onboarding friction risk
- "I'd just pull it from the dashboard" → they consume reports but may not know how to export raw data

> **H2a signal:** If they've exported their own data before, CSV upload is unlikely to be a dealbreaker for this prospect.

---

### 6. Do you currently pay for any software specifically to help run your operation?

Listen for: what tools they pay for, what they've canceled, and how they talk about the value of software.

> **H9 signal:** If they pay for multiple SaaS tools already, they are trained to pay for software. If they've never paid for operational software, the free trial and entry-tier experience will be critical.

---

## Screener Decision

After these six questions, place the prospect in a bucket:

| Signal | Bucket |
|---|---|
| Specific spoilage story + POS data + purchasing involvement | **Continue** |
| Vague pain + data access unclear + some purchasing influence | **Marginal — probe one more question** |
| No purchasing involvement + no data + out-of-scope operation | **Exit** |

**If Marginal:** ask one more question — "Have you ever looked at a report and thought 'I wish I knew this sooner'?" A specific yes moves them to Continue.

---

## After the Screener

- Log the POS system they use in the OAuth provider tally (see interview guide)
- Note their operator type using the two-to-five word summaries above
- Record their spoilage awareness level: specific story / vague awareness / no awareness
- Record their CSV familiarity: exports own data / knows it exists but delegates / unaware
- If Continue: book the full interview and send the `mom-test-interview-guide.md` conversation to the interviewer

---

## Document History

| Version | Date | Notes |
|---|---|---|
| v1 | May 2026 | Initial screener, companion to mom-test-interview-guide.md |
