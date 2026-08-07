# PantryIQ MVP – Grilling Session Notes

**Status:** In Progress  
**Date:** May 28, 2026  
**Purpose:** Capture key decisions from the grilling session before starting detailed PRD.

---

## Session Goals

Design the **recommendation engine scoring framework** before writing the PRD, so we can:
- Build a testable, tunable system
- Ensure transparency and user trust
- Allow for future evolution without breaking existing logic

---

## Decisions Made

### Decision 1: CSV-First MVP (No Square Integration)

**Status:** ✅ **DECIDED**

**What we're doing:**
- MVP launches with CSV import + manual entry only
- Square integration deferred to Phase 2

**Why:**
- Reduces setup friction and API complexity
- Operators already accept CSV workflows (research memo: H2a)
- Avoids Square OAuth, webhook, and transaction sync correctness issues
- Users can get to value faster with less setup

**Impact:**
- May be a dealbreaker for some customers
- Validates with real customer feedback
- Phase 2 becomes a convenience feature, not a launch blocker

**Deferred Questions:**
- How do we price the CSV-only vs. CSV+Square tiers?
- What's the timeline for Square Phase 2?

---

### Decision 2: Combined Confidence Framework

**Status:** ✅ **DECIDED**

**What we're doing:**
- Recommendations show **facts + observations** separately from **predictions**
- Facts are stated plainly without confidence labels
- Predictions are explicitly labeled "prediction" with their basis
- Uncertain predictions are admitted openly ("We don't have enough data")
- Users see data and decide confidence themselves; system doesn't grade its own confidence

**Why:**
- Simpler and more honest than trying to score confidence ourselves
- Operators (especially Snape) can judge whether the pattern is real
- Moves trust gate from "does the system grade itself correctly?" to "do I believe the data it's showing me?"

**Example message:**
```
Salmon: Ordered 3 times, sold 0 times (0% sell-through). 
Current on-hand: 2 lbs. Estimated spoilage risk: $40 over 3 days.
Prediction: Based on this pattern, salmon likely won't sell if reordered. 
(This prediction is based on 4 weeks of transaction data.)
```

**Deferred Questions:**
- How much detail should "show your work" reveal? (Q13)
- What exact confidence thresholds trigger different messaging? (requires CPO input)

---

### Decision 3: Dual Surface Model (Dashboard + Chat)

**Status:** ✅ **DECIDED**

**What we're doing:**
- **Dashboard:** Automated daily snapshots + heads-up notifications (generated on schedule)
- **Chat:** Manual query interface where users ask about anything (even things dashboard isn't surfacing)

**Why:**
- Dashboard is for passive monitoring (what the system thinks matters)
- Chat is for active investigation (what the user thinks matters)
- Both are equally important first-win paths for different personas

**Implication:**
- Ron/Percy use dashboard to catch important things passively
- Snape/Kingsley use chat to dig deep into specific items
- Both paths lead to value

**Deferred Questions:**
- What exact criteria determine what makes the dashboard? (Q4)
- How many alerts should dashboard show? (3? 5? configurable?)

---

### Decision 4: Pluggable Scoring Architecture

**Status:** ✅ **DECIDED**

**What we're doing:**
- Three scoring dimensions: **Impact (40%) + Urgency (40%) + Confidence (20%)**
- Weights are tunable configuration, not hardcoded
- Architecture allows adding new dimensions later without rewriting scoring logic
- When new dimensions are added, weights are proportionally rebalanced

**Formula:**
```
score = (Impact × 0.40) + (Urgency × 0.40) + (Confidence × 0.20) 
        ──────────────────────────────────────────────────────────
                       sum of weights
```

**Why:**
- Lets us tune later based on feedback without code changes
- Supports discovering new dimensions through user feedback (Q: what factors matter?)
- Keeps math clean and testable

**Example: Adding a 4th Dimension**
```
If we add "Seasonality" at 0.15 weight:
- New total = 1.15
- Adjust impact: 0.40 / 1.15 ≈ 0.35
- Adjust urgency: 0.40 / 1.15 ≈ 0.35
- Adjust confidence: 0.20 / 1.15 ≈ 0.17
- New seasonality: 0.15 / 1.15 ≈ 0.13
```

**Deferred Questions:**
- Exact formulas for calculating each dimension (Q1–Q3: CPO input)
- Should there be minimum thresholds? (Q4: CPO decision)

---

### Decision 5: User Feedback Loop for Learning

**Status:** ✅ **DECIDED**

**What we're doing:**
- **Phase 1 (MVP):** System surfaces recommendations based on Impact + Urgency + Confidence
- **Phase 2 (Learning):** Users thumbs up/down every recommendation
- **Phase 3 (Evolution):** System learns which types are helpful, which dimensions matter most, what to surface next

**Why:**
- Don't pre-commit to what matters; let real user behavior teach us
- Avoids over-engineering scoring logic before we know what users actually find helpful
- Creates a natural feedback loop for iterating

**Not doing in MVP:**
- Complex ML models
- Automatic weight tuning
- Personalization per user

**Deferred Questions:**
- How do we track and aggregate feedback? (Q: data model for feedback)
- What's the cadence for rebalancing weights? (Q: product decision)

---

### Decision 6: Defer Detailed Scoring Calculations to CPO

**Status:** ✅ **DECIDED**

**What we're doing:**
- Creating a `CPO-QUESTIONS.md` document with 15 detailed questions
- Not specifying exact formulas for Impact, Urgency, Confidence until CPO weighs in
- Deferring industry-specific decisions (shelf life standards, spoilage rates, margin benchmarks)

**Why:**
- These require precise product/domain knowledge
- Better to get it right once than build wrong and iterate
- CPO is the right person to validate against operator needs

**Questions CPO needs to answer:**
- Q1–Q3: How to calculate Impact, Urgency, Confidence scores
- Q4–Q7: Recommendation ranking, partial data, waste quantification, tone
- Q8–Q11: Data model decisions (item categories, shelf life, PO structure, location model)
- Q12–Q14: Chat scope, explainability, override workflows
- Q15: Success metrics

---

## Architectural Decisions Implied

### 1. Facts vs. Predictions Separation

The system must be able to distinguish:
- **Observations** (what already happened): "0% sell-through" (no confidence label)
- **Predictions** (what will happen): "Salmon will not sell if reordered" (labeled as prediction with basis)

This affects how chat and dashboard messages are constructed.

### 2. Data Model Must Support Tracking

The data model needs:
- Transaction history (date, item, qty, price)
- Purchase history (date, item, qty ordered, unit cost)
- Inventory snapshots (date, item, qty on-hand)
- Shelf life by item (editable)
- Item categorization (food, beverage, spirits, garnish, etc.)
- User feedback (thumbs up/down on recommendations)

### 3. Chat and Dashboard Are Not Siloed

- Chat can query anything; dashboard shows top alerts
- Dashboard alerts should be queryable in chat ("Tell me more about salmon")
- User feedback on dashboard alerts should inform chat answers
- Overrides in chat should cascade to dashboard calculations (needs CPO decision: Q14)

### 4. Extensibility Baked In

- Weights configuration must be accessible (file or DB, not hardcoded)
- New dimensions can be added to scoring formula
- Thresholds must be tunable
- User preferences must be storable (future: "show me waste alerts only")

---

## What We Haven't Designed Yet

These questions remain open for the PRD/TRD:

1. **Data import flow:** Exact steps from CSV upload to normalized database
2. **Dashboard layout:** Which metrics are visible at-a-glance vs. drill-down
3. **Chat architecture:** LLM prompting, context management, session persistence
4. **Settings UI:** Where users configure shelf life, categories, overrides
5. **Onboarding flow:** How new users get to first value (import → dashboard → chat)
6. **Error handling:** What happens when import fails, API calls timeout, etc.
7. **Performance expectations:** Import time, chat latency, dashboard load time
8. **Multi-location UX:** Exactly how location switching works, what scope means
9. **Notification strategy:** When/how to alert users (in-app only for MVP)
10. **Integrations roadmap:** Square Phase 2, other POS, accounting software

---

## Open Questions & Assumptions

### Assumptions We're Making

1. ✅ Users trust CSV workflows (research memo: H2a supports this)
2. ✅ Operators want decision support, not automation (research memo: H6)
3. ✅ "Show your work" is table stakes (research memo: H4)
4. ❓ Operators will engage with daily dashboard snapshots (unvalidated)
5. ❓ Thumbs up/down feedback will be sufficient for learning (needs validation)
6. ❓ Impact + Urgency + Confidence is the right three dimensions (may discover others)
7. ❓ Default weights (0.40 / 0.40 / 0.20) are correct (needs data validation)

### Unknowns That Will Be Answered

By CPO (Q1–Q15):
- Exact formulas for Impact, Urgency, Confidence
- Data thresholds (weeks of history required)
- Shelf life standards by item
- Minimum alert thresholds
- Recommendation tone preferences

By user feedback (Phase 2):
- Which recommendation types are actually helpful
- Which dimensions matter most
- What new dimensions to add
- What the "right" weights should be

---

## Next Steps

### Before PRD

1. ✅ CPO reviews and answers questions in `CPO-QUESTIONS.md`
2. ✅ Integrate CPO decisions into `RECOMMENDATION-ENGINE-ARCHITECTURE.md`
3. ⏳ Design data import flow (CSV → normalized DB)
4. ⏳ Design dashboard layout and alert ranking UI
5. ⏳ Design chat architecture and LLM prompting strategy
6. ⏳ Design onboarding flow (signup → import → first value)

### Grill-Me Sessions Remaining

- [ ] **Grilling Session 2:** Data model validation (schemas, relationships, derived metrics)
- [ ] **Grilling Session 3:** Workflow design (import, dashboard, chat, settings)
- [ ] **Grilling Session 4:** Success metrics and MVP boundaries
- [ ] **Grilling Session 5:** Performance, error handling, and edge cases

### After CPO Input

- [ ] Finalize `RECOMMENDATION-ENGINE-ARCHITECTURE.md` with calculation methods
- [ ] Write the PRD incorporating all decisions
- [ ] Create the TRD with implementation approach

---

## Key Documents

- `expected-ux-v3.md` — MVP UX principles and page specs (foundation)
- `user-personas.md` — 10 detailed personas (reference for all decisions)
- `RECOMMENDATION-ENGINE-ARCHITECTURE.md` — Scoring framework (this session's work)
- `CPO-QUESTIONS.md` — 15 questions needing CPO review (next step)
- `MASTER-RESEARCH-DECISION-MEMO.md` — Market validation (reference)

---

## Status

**Grilling Session 1: COMPLETE** ✅
- Designed recommendation engine scoring framework
- Identified CPO questions
- Created architecture documents

**Grilling Session 2: PENDING**
- Data model validation
- CSV import flow design
- Database schema decisions

