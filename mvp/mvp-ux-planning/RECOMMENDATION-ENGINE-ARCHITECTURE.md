# PantryIQ MVP – Recommendation Engine Architecture

**Status:** Design Session Output  
**Date:** May 28, 2026  
**Purpose:** Specification of how recommendations are scored, ranked, and surfaced to users.

---

## Core Philosophy

The recommendation engine should:

1. **State facts plainly** — "You ordered salmon 3 times, sold 0 times" (no interpretation)
2. **Acknowledge predictions** — "Based on this pattern, we predict..." (label as prediction)
3. **Admit uncertainty** — "We don't have enough data to confidently predict..." (be honest)
4. **Show work** — Always surface data points and logic chain, never just a score
5. **Let users decide** — Surface evidence and let the operator interpret it; don't grade confidence for them

---

## Recommendation Message Structure

Every recommendation (dashboard alert or chat response) should follow this structure:

### 1. Observation (Facts)
State what happened in plain language with supporting metrics.

**Example:**
```
Salmon: Ordered 3 times this month, sold 0 times (0% sell-through).
Current on-hand inventory: 2 lbs.
```

### 2. Financial Impact (Quantified Cost)
Translate the observation into dollar terms.

**Example:**
```
At estimated spoilage rate, this is costing you ~$40 in waste risk 
over the next 3 days.
```

### 3. Prediction (If Applicable)
Make a forward-looking statement with explicit basis.

**Example:**
```
Prediction: Based on 0 sales across 3 orders this month, we predict 
salmon will not sell if reordered this week. This prediction is based 
on 4 weeks of transaction data.
```

### 4. Recommendation (Suggested Action)
Propose a concrete next step.

**Example:**
```
Recommendation: Consider reducing next salmon order by 50%, or 
removing it from the menu this week.
```

### 5. Show Your Work (On Demand)
User can click "Show reasoning" to see:
- Which data sources were used (transactions, POs, inventory snapshots)
- How metrics were calculated (order count, sell-through %, spoilage estimate)
- What assumptions were made (shelf life = 3 days, unit cost = $12/lb)

---

## Scoring System (Dashboard Ranking)

### Three Scoring Dimensions

1. **Impact Score (I):** Financial risk at stake
   - Calculated from: spoilage cost, overordering cost, margin loss
   - Scale: 0–100 (higher = more money at risk)
   
2. **Urgency Score (U):** Time sensitivity of action
   - Calculated from: shelf life remaining, trend acceleration, supplier lead time
   - Scale: 0–100 (higher = action needed sooner)

3. **Confidence Score (C):** Data completeness and pattern clarity
   - Calculated from: weeks of transaction data, purchase data completeness, pattern consistency
   - Scale: 0–100 (higher = more trustworthy pattern)

### Composite Scoring Formula

```
recommendation_rank_score = (I × w_impact) + (U × w_urgency) + (C × w_confidence)
                             ──────────────────────────────────────────────────
                                    (w_impact + w_urgency + w_confidence)

Default weights (tunable):
- w_impact = 0.40 (40%)
- w_urgency = 0.40 (40%)
- w_confidence = 0.20 (20%)
```

### Architecture for Future Dimensions

The scoring system is designed to be extensible. To add a new dimension (e.g., seasonality, staff capacity):

1. Define the new score calculation (scale 0–100)
2. Assign a weight (e.g., w_seasonality = 0.15)
3. Normalize all existing weights proportionally:
   - New total = 0.40 + 0.40 + 0.20 + 0.15 = 1.15
   - Adjusted w_impact = 0.40 / 1.15 ≈ 0.35
   - Adjusted w_urgency = 0.40 / 1.15 ≈ 0.35
   - Adjusted w_confidence = 0.20 / 1.15 ≈ 0.17
   - Adjusted w_seasonality = 0.15 / 1.15 ≈ 0.13

This keeps the math clean and allows tuning without breaking existing logic.

---

## Dashboard Alert Ranking

### What Gets Shown

The dashboard surfaces **top 3–5 alerts** ranked by `recommendation_rank_score`, sorted descending.

### Minimum Thresholds

**CPO Question:** Should alerts require minimum thresholds per dimension?
- Option A: Show only top 5, regardless of individual scores
- Option B: Only show if Impact > $X AND Urgency > Y

*Deferred to CPO decision (Q4)*

### Alert Format on Dashboard

Each alert shows:
- **Item name** (e.g., "Salmon")
- **Observation** (e.g., "0% sell-through this month")
- **Impact** (e.g., "$40 waste risk")
- **Call to action** (e.g., "Reduce order this week" or "Discuss with team")
- **Link to chat** (e.g., "Ask more about this")

---

## Chat-Driven Insights

### Chat Capabilities

Users can ask:
1. **Direct questions:** "What am I wasting money on?"
2. **Specific item questions:** "How is salmon doing this month?"
3. **Comparison questions:** "Which items have the worst margin?"
4. **Predictive questions:** "What should I order less of?"

Chat can surface:
- Facts from the data (sell-through rates, spoilage trends)
- Observations not on dashboard (if user asks about them)
- Predictions based on patterns
- Comparisons across items, time periods, or locations

### Chat Doesn't Prescribe

Chat recommends ("consider reducing salmon") but does not:
- Execute menu changes
- Modify orders automatically
- Lock in decisions without user approval

---

## User Feedback Loop

### Phase 1 (MVP)

Dashboard and chat surface recommendations based on Impact + Urgency + Confidence scores.

### Phase 2 (Learning)

Users provide thumbs up/down feedback on each recommendation:
- **Thumbs up:** "This was helpful / I acted on it / you got it right"
- **Thumbs down:** "This was unhelpful / I ignored it / you got it wrong"

### Phase 3 (Evolution)

Model learns:
- Which recommendation types users find helpful
- Which dimensions matter most (may recalibrate weights)
- New dimensions to surface (discovered through negative feedback)

---

## Data Requirements by Recommendation Type

| Recommendation Type | Minimum Data Required | Confidence Impact |
|---|---|---|
| Observed sell-through (e.g., "0% sales") | Transactions only | High (direct observation) |
| Spoilage estimate | Transactions + POs + Inventory | Medium (calculated from variance) |
| Margin analysis | Transactions + POs | Medium (if prices available) |
| Trend analysis | 2+ weeks transactions | Low (early trend detection) |
| Predictive reorder | 4+ weeks transactions | High (pattern has history) |

---

## Edge Cases & Honest Boundaries

### Not Enough Data

**Situation:** User uploads only 1 week of transaction data.

**System behavior:**
- Surface observed facts (what sold, what didn't)
- Do NOT make predictions ("We predict..." language)
- Admit data requirement ("Come back when you have 3+ weeks of history")

### Partial Data (No Prices)

**Situation:** User uploads POs without unit costs.

**System behavior:**
- Can calculate order counts and sell-through
- Cannot calculate dollar impact
- Frame recommendations in units, not dollars ("You ordered 5 salmon, sold 0")

### Conflicting Data

**Situation:** POs say 5 units ordered, inventory says 0 on-hand, transactions say 2 sold. 3 units missing.

**System behavior:**
- Surface the observation plainly ("You have a variance: 3 units unaccounted for")
- Offer possible explanations (waste, theft, data error)
- Don't assume the explanation

### Seasonal Items

**Situation:** User asks about eggnog in May.

**System behavior:**
- Acknowledge seasonality ("This is typically a winter item")
- Still show data if available ("You have 2 cases on-hand from Q4")
- Offer explanation ("This may be old inventory; consider liquidating")

---

## Tuning & Configuration

### Environment-Level Tuning

Weights and thresholds stored as configuration:

```yaml
recommendation_engine:
  weights:
    impact: 0.40
    urgency: 0.40
    confidence: 0.20
  thresholds:
    high_impact: 100  # dollars
    medium_impact: 25
    low_impact: 0
    high_urgency: 7   # days
    medium_urgency: 14
    low_urgency: 0
```

### Per-User Tuning (Future)

Users could eventually configure:
- Focus area ("Show me waste, not margin")
- Risk tolerance ("Only alert me if impact > $50")
- Frequency ("Daily snapshots only, no real-time chat")

*Deferred to Phase 2*

---

## What This Architecture Solves

1. ✅ **Honest communication:** Facts separated from predictions
2. ✅ **Transparency:** Users see the work and data behind every recommendation
3. ✅ **Extensibility:** New dimensions can be added without breaking existing scoring
4. ✅ **Tuning:** Weights can be adjusted based on user feedback
5. ✅ **Fairness:** All three dimensions (impact, urgency, confidence) are considered
6. ✅ **User agency:** Operators make decisions; system informs them

---

## What Still Needs CPO Input

- Exact calculation methods for Impact, Urgency, Confidence (Q1–Q3)
- Minimum thresholds for dashboard alerts (Q4)
- Partial data handling policies (Q5)
- Waste quantification methodology (Q6)
- Recommendation tone and framing (Q7)

See `CPO-QUESTIONS.md` for details.

---

## Next Steps

1. CPO reviews and answers questions in `CPO-QUESTIONS.md`
2. Integrate CPO decisions into this architecture
3. Define exact formulas for Impact, Urgency, Confidence scores
4. Create test cases for edge cases (seasonal items, conflicting data, etc.)
5. Pass to engineering for implementation
