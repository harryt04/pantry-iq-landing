# PantryIQ MVP – PRD Skeleton

**Status:** Planning Phase (Awaiting CPO Input)  
**Date:** May 28, 2026  
**Purpose:** PRD outline showing where each planning decision feeds into the product specification

---

## Table of Contents

This is the structure of the final PRD. Each section shows:
- What it is
- Where it comes from (which planning doc)
- What still needs CPO input (if any)

---

## 1. Executive Summary

### 1.1 What is PantryIQ?

*From: `VISION.md`, `expected-ux-v3.md`*

PantryIQ is an AI cost advisor for restaurant operators. It helps users understand what is costing them money, identify waste and margin risks, and decide what to do this week.

**Not:** An autopilot system. Users remain the decision-maker.

### 1.2 MVP Promise

*From: `expected-ux-v3.md`*

The MVP is especially strong at:
- Explaining waste, spoilage, and margin changes
- Helping users understand what is driving those changes
- Recommending practical next actions
- Supporting both quick dashboard review and grounded chat investigation

### 1.3 Target Users (Primary)

*From: `user-personas.md`*

- Ron Weasley (owner-operator: needs plain-English, fast setup, believable answers)
- Percy Weasley (GM: needs evidence, confidence, defensible recommendations)
- Severus Snape (chef: needs item-level reasoning, waste visibility, assumption control)

### 1.4 MVP Success Definition

*From: `expected-ux-v3.md` + CPO input (Q15)*

**Qualitative:**
- Users can import data without getting stuck
- Users get meaningful value even with partial data
- Users see useful dashboard insights
- Users can ask a question in chat and get a grounded, believable answer
- Users can understand confidence, evidence, and assumptions

**Quantitative:** *Awaiting CPO input (Q15)*
- Target: ? beta users
- Target: ? conversations per user per week
- Target: ? NPS score
- Target: ? adoption rate of recommendations

---

## 2. MVP Features by Page

### 2.1 Dashboard

*From: `expected-ux-v3.md` + Recommendation Engine Architecture*

**Primary Purpose:** Give users a fast view of financial risk and recommended actions for the selected location.

**Features:**
- [ ] Wallet impact summary (total cost at risk)
- [ ] Top 3–5 alerts ranked by Impact + Urgency + Confidence score
- [ ] Trend summaries (margin, spoilage, other signals)
- [ ] Item-level problem areas when useful
- [ ] Call-to-action for each alert (link to chat, "discuss with team", "investigate")
- [ ] Location selector (if multi-location user)

**Alert Ranking Logic:**
- See: `RECOMMENDATION-ENGINE-ARCHITECTURE.md` (Scoring section)
- CPO Input Needed: Q4 (minimum thresholds, exact ranking algorithm)

**Content Format:**
- See: `RECOMMENDATION-ENGINE-ARCHITECTURE.md` (Message Structure section)
- Each alert follows: Observation + Impact + Prediction (if applicable) + Recommendation + Show Your Work

**Tone:** Clear, grounded, operational, financially focused

**Constraints:**
- In-app only (no email, push, or webhook for MVP)
- Scoped to one selected location or truck
- Updated daily (cronjob frequency configurable, see CPO Q1–Q3)

### 2.2 Chat

*From: `expected-ux-v3.md` + Recommendation Engine Architecture*

**Primary Purpose:** Let users ask grounded questions and investigate the selected location or truck.

**Features:**
- [ ] Natural-language question interface
- [ ] Streaming responses (for longer answers)
- [ ] Answers using imported data only
- [ ] Explains evidence and reasoning on request
- [ ] Shows confidence level and assumptions (see: RECOMMENDATION-ENGINE-ARCHITECTURE.md)
- [ ] Admits when data is insufficient
- [ ] Supports user challenge and assumption overrides
- [ ] Remembers context within a conversation (not across sessions, MVP)

**Message Format:**
- See: `RECOMMENDATION-ENGINE-ARCHITECTURE.md` (Message Structure section)
- Each response follows: Facts + Prediction + Recommendation + Show Your Work

**Scope:**
- Scoped to currently selected location or truck
- Can answer any question the data supports (no out-of-domain filtering)
- Can surface observations not on dashboard (user-driven discovery)

**Interaction Flow:**
```
User: "What am I wasting money on?"
↓
PantryIQ: [Facts about spoilage, waste by item]
         [Prediction: which items are at risk]
         [Recommendation: what to investigate first]
         [Link: Show your work / Ask follow-up]
↓
User: [Can thumbs up/down (Phase 2)]
      [Can ask follow-up: "Tell me more about salmon"]
      [Can override: "Actually, that salmon is frozen, shelf life = 14 days"]
```

**Constraints:**
- Scoped to one location at a time
- Chat is read-only MVP (no data entry, no order automation)
- No export from chat (Phase 2)
- Session memory only (not persisted across sessions)

### 2.3 Import Data (CSV Upload)

*From: `expected-ux-v3.md` + CPO Input needed (Q10, Q11)*

**Primary Purpose:** Normalize uploaded source data into a canonical internal model.

**Supported Import Types:**
- Transactions (sales data)
- Purchase Orders (ordering data)
- Inventory Snapshots (on-hand counts)

**Flow:**
```
1. User selects location or truck
2. User uploads CSV
3. System previews data
4. User maps columns (date, item, qty, price, etc.)
5. System resolves item names (matching/creation)
6. System validates and confirms
7. Data imported; user directed to dashboard or chat
```

**Features:**
- [ ] Drag-and-drop CSV upload
- [ ] Column mapping UI (user matches CSV columns to fields)
- [ ] Item matching (system suggests existing items, user can create new)
- [ ] Preview before import (show sample rows)
- [ ] Error reporting (which rows failed, why)
- [ ] Re-import workflow (upload new data without losing old data)
- [ ] Import history (what was uploaded when)

**Success Condition:**
- User feels like the system works with their messy data instead of rejecting it
- User can get from upload to first dashboard in <5 minutes

**Data Model Questions:**
- CPO Q10: What is minimum required PO structure?
- CPO Q11: How do we handle partial PO imports?

### 2.4 Settings

*From: `expected-ux-v3.md` + CPO Input needed (Q8, Q9)*

**Primary Purpose:** Manage business configuration for trustworthy analysis.

**Features:**
- [ ] Account basics (name, email, password)
- [ ] Location management (add/edit/delete locations)
- [ ] Item master (list of items, categories, shelf life, unit cost)
- [ ] Import history (log of past uploads)
- [ ] Shelf life overrides (user-editable per item)
- [ ] Category assignment (food, beverage, spirits, garnish, etc.)
- [ ] Unit cost updates (if import-time cost is wrong)

**Why Important:**
- Users can adjust assumptions like shelf life and costs
- Trust depends on being able to correct the model

**Data Model Questions:**
- CPO Q8: What item categories for MVP?
- CPO Q9: How to handle conditional shelf life?

---

## 3. Recommendation Engine Specification

*From: `RECOMMENDATION-ENGINE-ARCHITECTURE.md`*

### 3.1 Scoring Framework

**Three Dimensions:**
- **Impact Score (I):** Financial risk at stake (0–100)
- **Urgency Score (U):** Time sensitivity of action (0–100)
- **Confidence Score (C):** Data completeness and pattern clarity (0–100)

**Formula:**
```
recommendation_score = (I × w_I) + (U × w_U) + (C × w_C)
                       ─────────────────────────────────
                         (w_I + w_U + w_C)

Default weights:
- w_I = 0.40 (Impact)
- w_U = 0.40 (Urgency)
- w_C = 0.20 (Confidence)
```

**CPO Input Needed:**
- Q1: How to calculate Impact score? (which costs to include?)
- Q2: How to calculate Urgency score? (shelf life threshold, trend detection)
- Q3: How to calculate Confidence score? (weeks of history, data completeness)

### 3.2 Message Format

Every recommendation (dashboard or chat) includes:

1. **Observation** — Facts with supporting metrics
2. **Financial Impact** — Quantified cost at risk
3. **Prediction** (if applicable) — Forward-looking statement with basis
4. **Recommendation** — Concrete action suggestion
5. **Show Your Work** (on demand) — Data sources, calculations, assumptions

**Example:**
```
Salmon: Ordered 3 times, sold 0 times (0% sell-through).
Current on-hand: 2 lbs. Estimated spoilage risk: $40 over 3 days.

Prediction: Based on 0 sales across 3 orders this month, 
we predict salmon will not sell if reordered. 
(4 weeks of transaction data)

Recommendation: Consider reducing next order by 50%, or 
removing from menu this week.

[Show your work] [Ask follow-up] [Thumbs up/down]
```

### 3.3 Dashboard Alert Ranking

- **What:** Top 3–5 alerts ranked by composite score
- **When:** Daily (cronjob, configurable frequency)
- **Minimum threshold:** *CPO decision (Q4)*

### 3.4 Future Extensibility

To add a new dimension (e.g., "Seasonality"):
1. Define score calculation (scale 0–100)
2. Assign weight (e.g., 0.15)
3. System proportionally rebalances existing weights
4. No code changes required

---

## 4. Data Model

*From: Planning session + CPO Input needed (Q8–Q11)*

### 4.1 Core Entities

```
User
  ├─ Account (email, auth)
  └─ Locations (multi-location support)
       ├─ Items (item master)
       │  ├─ Category (food, beverage, spirit, garnish)
       │  ├─ Shelf life (editable)
       │  └─ Unit cost (editable)
       │
       ├─ Transactions (sales data)
       │  ├─ Date, Item, Qty, Revenue, Unit Price
       │  └─ Source (CSV import, Square sync, manual entry)
       │
       ├─ PurchaseOrders (purchasing data)
       │  ├─ Date, Item, Qty, Unit Cost, Total Cost
       │  └─ Supplier, Delivery Date
       │
       ├─ InventorySnapshots (on-hand counts)
       │  ├─ Date, Item, Qty on Hand, Location
       │  └─ Snapshot Type (end-of-day, count, adjustment)
       │
       ├─ Recommendations (derived, for dashboard)
       │  ├─ Item, Type, Impact Score, Urgency Score, Confidence Score
       │  ├─ Observation, Prediction, Suggested Action
       │  └─ Created At (regenerated daily)
       │
       └─ RecommendationFeedback (Phase 2: learning)
          ├─ Recommendation ID, User Feedback (👍/👎)
          └─ Timestamp
```

### 4.2 Derived Metrics

*Calculated on-the-fly or cached:*

- **Sell-through rate** = (qty sold / qty ordered) × 100%
- **Spoilage estimate** = ordered - sold - on-hand
- **Spoilage risk** = on-hand × unit cost (assuming full waste)
- **Margin** = revenue - (qty sold × unit cost)
- **Variance** = (ordered - sold - on-hand) / ordered × 100%

**CPO Input Needed:**
- Q5: How to handle partial data? (missing prices, missing inventory)
- Q6: How to calculate waste vs. variance? (which formula is authoritative?)

### 4.3 Item Categorization

*CPO Decision (Q8):*

Likely categories:
- Food: Proteins, Produce, Dry Goods
- Beverages: Spirits, Beer, Wine, Mixers, Coffee, Other
- Garnish: Citrus, Herbs, Other

---

## 5. User Workflows

*From: `expected-ux-v3.md` + Planned in Grilling Session 3*

### 5.1 Signup → Location → Import → Dashboard (Critical Path)

```
1. User signs up (email/password)
2. User creates first location (name, address, type)
3. User uploads CSV (transactions, POs, inventory)
4. User reviews import preview and maps columns
5. System imports and shows dashboard with top alerts
6. User sees "Try asking a question in chat" CTA
```

**Success:** User lands on dashboard with 3–5 alerts visible, <5 minutes elapsed

### 5.2 Chat-Driven Discovery

```
1. User opens chat page
2. User asks "What am I wasting money on?"
3. System shows observations + recommendations
4. User asks follow-up: "Tell me more about salmon"
5. User can challenge: "Actually, salmon shelf life is 7 days, not 3"
6. System recalculates and shows updated recommendations
```

**Success:** User gets grounded, believable answer within 3–5 seconds

### 5.3 Assumption Override

```
1. User questions a recommendation
2. User says "That salmon shelf life is wrong — it's 14 days frozen"
3. System: "OK, updating to 14 days for frozen salmon. Should I apply this to all salmon or just this conversation?"
4. User chooses: "Just this conversation" (or "Save for all future orders")
5. System recalculates affected recommendations
```

**Success:** User can correct the model mid-conversation without leaving chat

---

## 6. Trust Requirements

*From: `MASTER-RESEARCH-DECISION-MEMO.md` (Section 5)*

Every recommendation must satisfy these trust gates:

| Gate | Implementation |
|---|---|
| **Calculation Transparency** | Every recommendation includes: data sources, formula, line-item breakdown |
| **Explainable Recommendations** | UI shows: reasoning (why?), underlying data (which items?), override button |
| **Audit Trail** | All changes logged: timestamp, source, actor, prior → new value |
| **Manual Approval Workflow** | No automated decisions; recommendations only; user always approves |
| **CSV Export Reliability** | All data exportable to Excel; must never break as system updates |
| **Data Verification Ritual** | Easy side-by-side comparison: import → system calculation → user verification |

---

## 7. Constraints & Boundaries (MVP)

*From: `expected-ux-v3.md` + `deferred-features-v2.md`*

### 7.1 What MVP Does

- ✅ CSV import + manual entry
- ✅ Dashboard with top 3–5 alerts
- ✅ Chat for active investigation
- ✅ Item master management (shelf life, categories)
- ✅ Per-location analysis (one at a time)
- ✅ Recommendations with confidence levels
- ✅ "Show your work" on demand
- ✅ User override workflow
- ✅ In-app alerts only

### 7.2 What MVP Does NOT Do

- ❌ Square POS integration (Phase 2)
- ❌ Multi-location aggregation or comparison
- ❌ Email, push, or webhook alerts
- ❌ Advanced beverage/pour-cost workflows
- ❌ Event-specific planning (food trucks, catering)
- ❌ Ghost-kitchen multi-brand allocation
- ❌ Advanced mobile workflows (responsive web only)
- ❌ Export and downstream action (Phase 2)

---

## 8. Success Metrics

*From: `expected-ux-v3.md` (line 293) + CPO input (Q15)*

### 8.1 Qualitative Success

Users can:
1. Import data without getting stuck
2. Get meaningful value even with partial data
3. See useful dashboard insights
4. Ask questions in chat and get grounded answers
5. Understand confidence, evidence, and assumptions
6. Challenge PantryIQ and see it explain honestly
7. Adjust assumptions like shelf life and item metadata

### 8.2 Quantitative Success

*CPO needs to provide targets (Q15):*
- [ ] Beta user count: ?
- [ ] Average questions per user per week: ?
- [ ] Dashboard engagement rate: ?
- [ ] Recommendation adoption rate: ?
- [ ] NPS score: ?
- [ ] Time to first value: ?

---

## 9. Open Questions

### For CPO (Q1–Q15)

See: `CPO-QUESTIONS.md`

**Critical path (must answer before implementation):**
1. Q1–Q3: Impact, Urgency, Confidence calculation methods
2. Q4–Q5: Alert ranking, partial data handling
3. Q8–Q9: Item categories, shelf life model

### For Design/Engineering

- Dashboard mockups (exact layout, card design, drill-down patterns)
- Chat UI (message format, button placement, override UX)
- Import preview UX (column mapping, error messages)
- Error states and edge cases (what to show when import fails)

---

## 10. Dependencies & Critical Path

### Before PRD Finalization

- [ ] CPO answers Q1–Q7 (recommendation scoring)
- [ ] CPO answers Q8–Q11 (data model)
- [ ] Design team creates mockups
- [ ] Engineering team reviews and flags blockers

### Before TRD

- [ ] CPO answers all 15 questions
- [ ] Data model finalized
- [ ] Workflow flows documented
- [ ] Edge cases and error handling specified

### Before Implementation

- [ ] Exact calculation formulas provided
- [ ] Test cases for each score dimension
- [ ] Sample data and expected outputs
- [ ] Performance targets (import time, chat latency, dashboard load)

---

## 11. Roadmap (MVP → Phase 2)

*From: `VISION.md` + `deferred-features-v2.md`*

### MVP (Now)

- CSV import + manual entry
- Dashboard + Chat
- Per-location analysis
- Recommendations with confidence

### Phase 2 (Months 2–3)

- Square POS integration
- Export workflows
- Advanced beverage variance

### Phase 3 (Months 4+)

- Multi-location aggregation
- Email/push notifications
- Ghost-kitchen multi-brand
- Event-specific planning

---

## 12. Document References

| Doc | Purpose | Status |
|---|---|---|
| `VISION.md` | Founding vision & 2+ year roadmap | Reference |
| `expected-ux-v3.md` | MVP UX principles and pages | Foundation |
| `user-personas.md` | 10 detailed personas | Reference |
| `RECOMMENDATION-ENGINE-ARCHITECTURE.md` | Scoring framework, message format | Core |
| `CPO-QUESTIONS.md` | 15 questions needing product input | Blocker |
| `GRILLING-SESSION-NOTES.md` | All decisions and assumptions | Reference |

---

## Status

- [x] Executive summary drafted
- [x] Features by page outlined
- [x] Recommendation engine spec drafted
- [x] Data model sketched
- [x] User workflows outlined
- [x] Trust requirements listed
- [ ] CPO input (Q1–Q15) — **BLOCKER**
- [ ] Finalize all sections
- [ ] Move to TRD
- [ ] Ready for engineering

---

## Next Steps

1. **CPO Review:** Share this skeleton + CPO-QUESTIONS.md
2. **Wait for Answers:** CPO provides input to Q1–Q15
3. **Data Model Session:** Finalize database schema (Grilling Session 2)
4. **Workflow Session:** Design exact UI flows (Grilling Session 3)
5. **Final PRD:** Integrate all inputs into complete PRD

