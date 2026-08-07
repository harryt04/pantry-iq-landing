# PantryIQ MVP – Quick Reference: Core Decisions

**Created:** May 28, 2026  
**Purpose:** One-page reference for the 3 core architectural decisions

---

## Decision 1: Recommendation Philosophy

**"Facts first, predictions second, let users decide confidence"**

### What This Means

Every recommendation has this structure:

```
OBSERVATION: "Salmon ordered 3x, sold 0x this month"
IMPACT: "$40 in spoilage risk over 3 days"
PREDICTION: "Based on this pattern, salmon won't sell if reordered"
ACTION: "Consider reducing order by 50% or removing from menu"
SHOW YOUR WORK: [Data sources, calculations, assumptions]
```

### Why

- ✅ Operators see facts plainly
- ✅ Predictions are explicitly labeled (not disguised as facts)
- ✅ System shows work, users decide if they trust it
- ✅ No fake confidence scores

### What It Enables

- Trust (users can verify logic)
- Learning (user feedback tells us what matters)
- Honesty (system admits when data is insufficient)

---

## Decision 2: Recommendation Scoring (Dashboard Alert Ranking)

**"Impact 40% + Urgency 40% + Confidence 20%"**

### Formula

```
score = (Impact × 0.40) + (Urgency × 0.40) + (Confidence × 0.20)
        ────────────────────────────────────────────────────────
                       sum of weights
```

### What This Scores

- **Impact:** Money at risk (spoilage cost, overordering, margin loss)
- **Urgency:** How soon action is needed (shelf life, trend acceleration, supplier timing)
- **Confidence:** How much we trust the pattern (weeks of data, data completeness, pattern clarity)

### Why

- ✅ All three dimensions matter (can't rank by impact alone)
- ✅ Weights are tunable (can rebalance without code)
- ✅ Extensible (new dimensions just need a weight assigned)
- ✅ Testable (formula is deterministic)

### What It's NOT

- ❌ Not machine learning (no training, no black box)
- ❌ Not confidence grading ourselves (users see data and decide)
- ❌ Not weighted randomly (each dimension has clear meaning)

---

## Decision 3: Pluggable Scoring Architecture

**"Tunable config, not hardcoded logic"**

### Default Weights

```yaml
weights:
  impact: 0.40
  urgency: 0.40
  confidence: 0.20
```

### Adding a New Dimension (Example)

**Goal:** Add "Seasonality" at 0.15 weight

```
Before: 0.40 + 0.40 + 0.20 = 1.00
After:  0.40 + 0.40 + 0.20 + 0.15 = 1.15

Normalized:
- impact:      0.40 / 1.15 ≈ 0.35 (was 0.40)
- urgency:     0.40 / 1.15 ≈ 0.35 (was 0.40)
- confidence:  0.20 / 1.15 ≈ 0.17 (was 0.20)
- seasonality: 0.15 / 1.15 ≈ 0.13 (new)
```

### Why

- ✅ Can tune weights without code changes
- ✅ Can add new dimensions in Phase 2 without rewriting Phase 1
- ✅ Can A/B test different weight configurations
- ✅ User feedback can drive rebalancing

### Configuration Location

*TBD after CPO input — likely:*
- Environment variables (for ops)
- Database (for per-customer tuning)
- Code config (for simplicity, if no tuning needed)

---

## Three Bonus Decisions

### 4. CSV-First MVP (No Square)

- ✅ MVP ships with CSV import + manual entry only
- ✅ Square integration deferred to Phase 2
- ✅ Reduces launch risk, validates customer need

### 5. Dual-Surface Design

- ✅ **Dashboard:** Automated daily alerts (passive monitoring)
- ✅ **Chat:** Manual queries (active investigation)
- ✅ Both are equally important first-win paths

### 6. User Feedback Loop

- ✅ **Phase 1 (MVP):** System scores and surfaces recommendations
- ✅ **Phase 2 (Learning):** Users thumbs up/down feedback
- ✅ **Phase 3 (Evolution):** System learns which types are helpful

---

## What Needs CPO Input

See `CPO-QUESTIONS.md` for the full list. **Top 3 critical:**

1. **How do we calculate Impact?** (spoilage + overordering + margin loss? or just spoilage?)
2. **How much history = "high confidence"?** (4 weeks? 8 weeks? 20 transactions?)
3. **How do we handle partial data?** (transactions only; no prices; no inventory?)

---

## Status

- [x] Recommendation philosophy locked in
- [x] Scoring formula defined (pluggable weights)
- [x] Architecture supports future tuning and learning
- [ ] CPO input on calculation methods (next step)
- [ ] Database schema design (parallel work)
- [ ] PRD integration (after CPO input)

---

## Reference Docs

- `RECOMMENDATION-ENGINE-ARCHITECTURE.md` — Full specification
- `CPO-QUESTIONS.md` — Questions needing product input
- `GRILLING-SESSION-NOTES.md` — All decisions and assumptions
