# PantryIQ MVP Planning Session – Session 1 Summary

**Date:** May 28, 2026  
**Duration:** ~2 hours  
**Outcome:** Designed recommendation engine architecture; identified 15 CPO questions; created planning foundation for PRD

---

## What We Accomplished

### 1. Designed the Recommendation Engine (Core Decision)

**Philosophy:** Facts first, predictions second, let users decide confidence

**Architecture:**
- **Three scoring dimensions:** Impact (40%) + Urgency (40%) + Confidence (20%)
- **Pluggable weights:** Tunable configuration, not hardcoded
- **Extensible:** New dimensions can be added later without breaking existing logic
- **User feedback loop:** Phase 2 adds thumbs up/down to learn what's actually helpful

**Message structure:**
```
1. Observation (facts)
2. Financial impact (quantified)
3. Prediction (if applicable, labeled)
4. Recommendation (suggested action)
5. Show your work (on demand)
```

**Why this matters:** Builds trust by being transparent, extensible by design, and learnable from real user behavior.

---

### 2. Made Critical Scope Decision: CSV-Only MVP

**What we're shipping:** CSV import + manual entry  
**What we're deferring:** Square POS integration (Phase 2)

**Why:** Reduces friction, API complexity, and launch risk. Operators already accept CSV workflows.

**Risk:** May be a dealbreaker for some customers — validate with real feedback.

---

### 3. Locked In Dual-Surface Design

**Dashboard:** Automated daily snapshots + heads-up alerts  
**Chat:** Manual query interface for deeper investigation

Both are equally important first-win paths (different personas, different use cases).

---

### 4. Created CPO Questions Document (15 Questions)

Categories:
- **Q1–Q7:** Recommendation scoring methodology (Impact, Urgency, Confidence formulas)
- **Q8–Q11:** Data model (item categories, shelf life, POs, locations)
- **Q12–Q14:** Chat & interaction design (scope, explainability, overrides)
- **Q15:** Success metrics definition

**Action:** CPO reviews and answers before PRD finalization.

---

## Key Documents Created

| Document | Purpose | Status |
|---|---|---|
| `RECOMMENDATION-ENGINE-ARCHITECTURE.md` | Full spec of scoring system, message format, tuning approach | ✅ Complete |
| `CPO-QUESTIONS.md` | 15 detailed questions needing CPO input | ✅ Complete |
| `GRILLING-SESSION-NOTES.md` | Decisions made, assumptions, next steps | ✅ Complete |

---

## Decisions Matrix

| Decision | Status | Impact |
|---|---|---|
| CSV-first MVP (no Square) | ✅ DECIDED | Reduces launch risk, validates customer need |
| Recommendation philosophy (facts + predictions) | ✅ DECIDED | Builds trust, enables learning |
| Pluggable scoring weights | ✅ DECIDED | Supports future tuning without code changes |
| Defer calculation details to CPO | ✅ DECIDED | Ensures accuracy, product-driven |
| Dual-surface (dashboard + chat) | ✅ DECIDED | Covers both passive and active use cases |
| User feedback loop (thumbs up/down) | ✅ DECIDED | Phase 2: learn what's actually helpful |

---

## Open Questions (For CPO)

**Top 3 Most Critical:**
1. How do we calculate Impact score? (spoilage + overordering + margin loss?)
2. What's the minimum transaction history for high confidence? (4 weeks? 8 weeks?)
3. How do we handle partial data? (transactions only; no prices; no inventory?)

**See:** `CPO-QUESTIONS.md` for all 15 questions.

---

## Assumptions We're Making

✅ = Supported by research  
❓ = Needs validation

| Assumption | Evidence | Confidence |
|---|---|---|
| Users trust CSV workflows | Research memo: H2a | ✅ High |
| Operators want recommendations, not automation | Research memo: H6 | ✅ High |
| "Show your work" is non-negotiable | Research memo: H4 | ✅ High |
| Daily dashboard snapshots will engage users | None yet | ❓ Needs validation |
| Thumbs up/down feedback is sufficient | None yet | ❓ Needs validation |
| Impact + Urgency + Confidence are the right 3 dimensions | None yet | ❓ May discover others |

---

## Architecture Supports

✅ **Transparency:** Users see facts, data, logic — not just scores  
✅ **Learning:** Feedback loop enables continuous improvement  
✅ **Extensibility:** New dimensions can be added without breaking existing  
✅ **Honesty:** System admits uncertainty, doesn't overstate confidence  
✅ **User agency:** Operators make decisions; system informs them  
✅ **Tuning:** Weights are configuration, not code  

---

## What Still Needs Design (Grilling Sessions 2–5)

### Session 2: Data Model
- [ ] CSV import flow (upload → normalization → database)
- [ ] Database schema (transactions, items, POs, inventory, feedback)
- [ ] Derived metrics (spoilage, margin, variance, pour cost)
- [ ] Data validation and error handling

### Session 3: Workflows
- [ ] Import workflow (CSV upload → preview → mapping → confirmation)
- [ ] Dashboard design (what metrics visible, alert ranking, drill-down)
- [ ] Chat architecture (LLM prompting, context, session persistence)
- [ ] Settings UI (shelf life, categories, overrides)

### Session 4: Onboarding & Success
- [ ] Signup → location setup → import → first dashboard → first chat
- [ ] Success metrics (quantitative targets for MVP)
- [ ] MVP boundaries (what we do / don't do)

### Session 5: Operations & Edge Cases
- [ ] Performance expectations (import time, chat latency, dashboard load)
- [ ] Error handling (failed imports, API timeouts, data conflicts)
- [ ] Multi-location UX (location switching, scope, aggregation)
- [ ] Security & data ownership

---

## Next Immediate Steps

1. **Share with CPO:** Send `CPO-QUESTIONS.md` for review
2. **Wait for CPO input:** Need answers to Q1–Q7 before proceeding
3. **Schedule Grilling Session 2:** Data model design (can proceed in parallel with CPO review)
4. **Draft PRD skeleton:** Based on decisions so far, ready to fill in details

---

## Files to Review

- `mvp/RECOMMENDATION-ENGINE-ARCHITECTURE.md` — New (session 1 output)
- `mvp/CPO-QUESTIONS.md` — New (session 1 output)
- `mvp/GRILLING-SESSION-NOTES.md` — New (session 1 output)
- `mvp/expected-ux-v3.md` — Existing (foundation, still valid)
- `mvp/user-personas.md` — Existing (reference for all decisions)
- `mvp/MASTER-RESEARCH-DECISION-MEMO.md` — Existing (market validation)

---

## Key Takeaways

1. **Recommendation engine is pluggable and learnable** — we can tune it based on real user feedback
2. **CSV-first MVP reduces risk** — validate the core problem before adding integrations
3. **Two surfaces (dashboard + chat) serve different user needs** — both are equally important
4. **We're deferring calculation details to CPO** — ensures accuracy before implementation
5. **Next phase is data model design** — need exact schemas before engineering can build

---

## Questions for You

1. Does the recommendation engine architecture feel complete, or do you want to grill deeper on any dimension?
2. Are the 15 CPO questions covering everything you need answered, or should we add more?
3. Should we proceed with Grilling Session 2 (data model) while waiting for CPO input, or wait?
4. Do you want to loop in the CPO now, or would you prefer to review all planning docs first before sharing?

