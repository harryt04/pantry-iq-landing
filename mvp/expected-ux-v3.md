# PantryIQ MVP Expected UX – v3

**Status:** Refined MVP draft  
**Date:** Session 3  
**Previous:** `expected-ux-v2.md`

---

## Purpose

This document defines the expected user experience for the PantryIQ MVP.

Its purpose is to keep MVP planning focused on the workflows that matter most, avoid scope drift, and provide a clean product specification for design, engineering, and validation.

This draft intentionally avoids post-MVP features. Deferred ideas belong in `deferred-features-v2.md`.

---

## Core Product Intent

PantryIQ should feel like a thought partner for operators managing sales, purchasing, and waste.

It should help users:
- understand what is changing in their business
- identify what is costing them money
- decide what action to take this week
- trust the output because it is grounded in real imported data

PantryIQ is not an autopilot system. The user remains the decision-maker.

---

## MVP Product Promise

PantryIQ is built for operators managing sales, purchasing, and waste, across restaurants and adjacent formats like bars and mobile concepts.

For the MVP, PantryIQ should be especially strong at:
- explaining waste, spoilage, and margin changes
- helping users understand what is driving those changes
- recommending practical next actions
- supporting both quick dashboard review and grounded chat investigation

---

## Primary MVP Jobs To Be Done

The MVP should be great at helping a user answer questions like:
- What am I losing money on right now?
- What is being wasted or is at risk of being wasted?
- Why are my margins changing?
- What should I order less of, more of, or watch closely this week?
- What should I act on first?

---

## Target Users For MVP

The MVP is optimized first for users whose day-to-day job is operating the business directly.

### Primary Users
- `Ron Weasley`: needs plain-English insight, fast setup, and believable answers
- `Percy Weasley`: needs evidence, confidence, and recommendations he can defend
- `Severus Snape`: needs item-level reasoning, waste visibility, and assumption control

### Secondary Users
- `Minerva McGonagall`: needs a fast, trustworthy executive snapshot
- `Harry Potter`: needs a credible whole-operation view, even if some complexity is not yet fully modeled
- `Albus Dumbledore`: needs strong per-location visibility, even without cross-location comparison

### Adjacent Fits In MVP
- `Kingsley Shacklebolt`
- `George Weasley`
- `Nymphadora Tonks`

These users may fit the same core workflow if they are asking the same operational questions around sales, purchasing, and waste. However, the MVP is not expected to fully solve every bar-specific, event-specific, or mobile-specific edge case.

---

## Scope Rule: One Operation At A Time

The MVP supports multiple locations or operating units under one account.

However, PantryIQ works on one location, truck, or operating unit at a time.

That means:
- imports are always tied to one selected location or truck
- the dashboard is scoped to one selected location or truck
- chat answers are scoped to one selected location or truck
- users can switch contexts, but PantryIQ does not aggregate across them in the MVP

This rule should be stated clearly in product copy and UX.

---

## MVP UX Principles

- **Dollar-first:** show financial impact before operational detail
- **Plain-English:** understandable to non-technical operators
- **Action-oriented:** recommendations should help a user decide what to do next
- **Grounded:** every important claim should be tied to imported data
- **Honest:** PantryIQ must say when it knows something and when it does not
- **Explainable:** users can inspect the reasoning, evidence, and assumptions
- **Low-friction:** users should get value without long onboarding or heavy setup
- **Flexible surface area:** dashboard and chat are both first-class ways to win

---

## Trust And Honesty Requirements

Trust is the central adoption gate for the MVP.

If PantryIQ gives a generic, vague, or confidently wrong answer, the user will stop trusting it.

Therefore:
- PantryIQ must explicitly say when an answer is high, medium, or low confidence
- PantryIQ must explain why it has that confidence level
- PantryIQ must admit when there is not enough data to make a good recommendation
- PantryIQ must explain what data is missing when possible
- PantryIQ must never pretend certainty where it does not exist

If the user asks PantryIQ to show its work, it should be able to show:
- what data it looked at
- what assumptions it used
- what logic led to the answer

If it cannot do that, the output should be treated as unreliable.

---

## Partial Data Policy

The MVP should still provide value when the user has only partial data.

Example:
- if the user has uploaded transactions but not purchase orders or inventory counts, PantryIQ should still answer some questions
- it should clearly state what it can answer confidently and what it cannot answer yet

This keeps onboarding lighter while preserving honesty.

---

## First Value Moments

The MVP has two equally important first wins:

### 1. Dashboard Win
After import, the user can land on a dashboard and quickly see:
- what is costing money
- what is trending in the wrong direction
- what needs attention first

### 2. Chat Win
After import, the user can ask a direct question and get a believable, grounded answer with evidence.

Both experiences should be treated as core success paths, not primary and secondary paths.

---

## Expected MVP Pages

### 1. Dashboard

**Primary purpose:**
Give the user a fast view of financial risk, operational risk, and recommended action for the currently selected location or truck.

**The dashboard should help answer:**
- What is costing me money right now?
- What is getting worse?
- What should I act on first?

**Expected MVP content:**
- wallet impact summary
- in-app alerts for important issues in the selected location
- top recommendations ranked by impact, urgency, and confidence
- trend summaries for margin, spoilage, and other relevant operational signals
- item-level problem areas when useful

**Tone:**
Clear, grounded, operational, and financially focused.

**Important constraints:**
- dashboard is scoped to one selected location or truck
- alerts are in-app only for the MVP
- no email, push, or webhook alerts in the MVP

### 2. Chat

**Primary purpose:**
Give the user a fast way to ask grounded questions about the selected location or truck.

**The chat should help answer:**
- Why is my margin down?
- What am I wasting?
- Am I ordering too much of this item?
- What should I do this week?

**Expected chat behavior:**
- accepts natural-language questions
- answers using imported data only
- explains evidence and reasoning on request
- shows confidence level and assumptions
- admits when the data is insufficient
- supports user challenge and assumption overrides

**Important constraint:**
chat is always scoped to the currently selected location or truck.

### 3. Import Data

**Primary purpose:**
Normalize uploaded source data into a canonical internal model so dashboard and chat can work reliably.

**Supported import types:**
- transactions
- purchase orders
- inventory snapshots

**Core import requirements:**
- user selects one location or truck first
- flow should feel forgiving, not technical
- uncertain mappings are resolved one step at a time
- item matching and item creation are guided clearly
- import should end in an obvious next step: dashboard or chat

**Success condition:**
the user feels like the system can work with their messy data instead of rejecting it.

### 4. Settings

**Primary purpose:**
Manage the business configuration needed for trustworthy analysis.

**Expected MVP scope:**
- account basics
- location management
- item master management
- import history

**Important expectation:**
users can adjust assumptions like shelf life and costs, because trust depends on being able to correct the model.

---

## Recommendation Expectations

A recommendation should include:
- the action
- the expected financial impact if known
- the evidence behind it
- the confidence level
- the time horizon

Recommendations should feel practical and near-term.

Good MVP examples:
- reduce next order of salmon this week
- push this item before spoilage risk rises further
- review why this item's margin fell compared to last week

---

## Persona Coverage Notes

### Strong Fit In MVP
- `Ron Weasley`
- `Percy Weasley`
- `Severus Snape`
- `Minerva McGonagall`

### Likely Useful But Partial
- `Harry Potter`
- `Albus Dumbledore`
- `George Weasley`
- `Kingsley Shacklebolt`
- `Nymphadora Tonks`

### Important Guidance

The product can still be described broadly across restaurants and adjacent formats, but the MVP should not imply that every specialized workflow is equally mature.

The core shared abstraction is:
- what sold
- what was bought
- what is at risk
- what should the operator do next

That is broad enough for the MVP positioning without overcommitting to deeper post-MVP logic.

---

## Success Criteria For MVP UX

The MVP succeeds if a user can:

1. Import data for one selected location or truck without getting stuck
2. Get meaningful value even if only partial data has been uploaded
3. See useful dashboard insights for the selected operation
4. Ask a question in chat and get a grounded, believable answer
5. Understand confidence, evidence, and assumptions
6. Challenge PantryIQ and see it explain or revise its reasoning honestly
7. Adjust important assumptions like shelf life and item metadata

---

## Explicit MVP Boundaries

This document does not include post-MVP features.

Deferred features and later-stage ideas belong in `deferred-features-v2.md`.

---

## Next Steps

1. Use this document as the clean MVP UX reference
2. Validate the first dashboard win and first chat win with beta users
3. Keep post-MVP ideas out of MVP planning documents unless they move into active scope

---

## Document History

| Version | Date | Changes |
|---|---|---|
| v1 | Session 1 | Initial MVP handoff |
| v2 | Session 2 | Detailed page-by-page UX and canonical data model |
| v3 | Session 3 | Refocused MVP around core operator jobs, equal dashboard/chat wins, one-operation-at-a-time scope, and explicit trust rules |
