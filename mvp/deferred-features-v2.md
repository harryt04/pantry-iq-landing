# PantryIQ Deferred Features – V2+

**Status:** Deferred backlog  
**Date:** Session 3

---

## Purpose

This document captures features and ideas intentionally deferred until after the MVP.

Its purpose is to keep MVP planning documents clean, focused, and honest. If a feature is listed here, it is not part of the MVP commitment.

---

## Explicitly Out Of Scope For MVP

- multi-location aggregated dashboards
- side-by-side location comparison
- email notifications
- push notifications
- webhook notifications
- advanced beverage variance workflows
- advanced pour-cost workflows
- event-specific planning workflows
- event-level cost tracking and forecasting
- ghost-kitchen multi-brand allocation
- advanced mobile-first workflows beyond responsive web minimums
- export and downstream action workflows
- sophisticated onboarding or setup automation

---

## Deferred Feature Ideas

### 1. Multi-location aggregation and comparison

**Why deferred:**
The MVP should stay focused on one location or truck at a time so trust, clarity, and execution stay strong.

**What would validate it:**
Repeated feedback from multi-unit operators that location switching is not enough.

### 2. Email, push, and webhook notifications

**Why deferred:**
In-app alerts are enough for the MVP. External delivery channels add product and infrastructure complexity.

**What would validate it:**
Users consistently ask to be alerted outside the app.

### 3. Advanced beverage variance and pour-cost workflows

**Why deferred:**
The MVP should first prove the core loop around sales, purchasing, waste, and recommendations before expanding into deeper beverage-specific logic.

**What would validate it:**
Repeated demand from bar-heavy operators, gastropubs, or beverage managers who need variance and pour-cost rigor to trust the product.

### 4. Event-specific planning and event-level cost tracking

**Why deferred:**
The MVP is scoped around one operating unit at a time, not around a first-class event model.

**What would validate it:**
Repeated demand from food trucks, catering operators, and mobile concepts for event-based ordering, pricing, and retrospective analysis.

### 5. Ghost-kitchen multi-brand allocation

**Why deferred:**
Shared-inventory allocation across multiple virtual brands adds methodological and data-model complexity.

**What would validate it:**
Ghost-kitchen users need brand-level attribution before they can trust recommendations.

### 6. Advanced mobile-specific workflows

**Why deferred:**
The MVP should support responsive web use, but does not need to optimize every workflow around mobile-first operation.

**What would validate it:**
Users regularly use PantryIQ on the move and hit repeated mobile friction.

### 7. Export and downstream action workflows

**Why deferred:**
The MVP should first prove the value of the insights before building handoff and downstream operational tooling.

**What would validate it:**
Users repeatedly ask to export data, recommendations, or analysis into spreadsheets or other systems.

### 9. Chat-to-dashboard autonomous feedback loop

**What it is:**
During a chat conversation, the AI detects when the user reveals something dashboard-relevant — a cost correction, a shelf life adjustment, an operational pattern — and automatically writes it back to the location's data model, flagging the dashboard for recomputation. The AI presents what it intends to persist before writing ("I noted: salmon unit cost updated to $18/lb — does this look right?") and the user confirms with one tap.

**Why deferred:**
This is the most complex piece in the system. The AI deciding autonomously what is "dashboard-worthy" from freeform conversation is hard to get right. A false positive could silently corrupt dashboard recommendations, which directly contradicts the trust requirement. The right time to build this is after the core import → dashboard → chat loop is proven and user feedback indicates they want this level of integration.

**What would validate it:**
Beta users consistently reveal new facts or corrections in chat that they wish had updated their dashboard automatically, without being prompted.

### 8. More sophisticated onboarding and setup automation

**Why deferred:**
The MVP should focus first on a clean, forgiving import experience and a believable first value moment.

**What would validate it:**
Users struggle to reach first value even when the core insight quality is strong.

---

## Validation Questions For Beta Users

- Is single-location analysis enough for now?
- Do you need side-by-side location comparison?
- Do you need alerts outside the app?
- Do you need beverage-specific variance or pour-cost logic to trust the product?
- Do you need event-based planning rather than standard date-range analysis?
- Do you need export workflows or operational handoff features?
- Is responsive web enough, or are there mobile workflows that still feel broken?

---

## Prioritization Rule

Features should move out of this document only after clear user validation.

They should not enter MVP planning just because they sound strategic or broadly useful.

---
