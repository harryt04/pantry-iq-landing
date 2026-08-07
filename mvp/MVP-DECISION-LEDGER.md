# PantryIQ MVP Decision Ledger

**Status:** Working implementation contract  
**Updated:** 2026-08-02

This document reconciles the planning documents well enough to build the first
trustworthy product slice. Decisions marked provisional should be validated
with beta operators, but they are not blockers for implementation.

## Product Contract

- PantryIQ is a decision-support tool, not an autopilot.
- The MVP is scoped to one selected location or operating unit at a time.
- The primary target is a full-service restaurant with one to three locations.
- Food trucks and adjacent formats can use the same core data model, but
  event-specific and mobile-specific workflows remain out of scope.
- The first product loop is CSV import -> operational facts -> ranked
  recommendation -> dashboard explanation -> chat investigation.

## Input Scope

- CSV import is the MVP source of truth.
- The MVP supports transactions, purchase orders, and inventory snapshots.
- Manual entry is represented by the same normalized records and is the next
  input workflow after typed CSV import.
- Square remains in the repository as deferred Phase 2 work; it is not part of
  the new MVP acceptance criteria.
- CSV export remains an MVP trust fallback for imported and derived data even
  though downstream automation is deferred.

## Recommendation Contract

- Facts are presented separately from predictions.
- Every recommendation includes its observation, suggested action, time
  horizon, available financial impact, and supporting evidence.
- Predictions are only generated when enough history exists; otherwise the
  system reports the missing data.
- Ranking uses provisional weights of Impact 40%, Urgency 40%, and Data
  Sufficiency 20%. These weights are configuration, not LLM behavior.
- The dashboard shows the top five recommendations for the selected location.
- No recommendation changes inventory, pricing, menu data, or orders without a
  future explicit approval workflow.

## Provisional Calculation Rules

- Impact is the estimated cost of current on-hand inventory at risk, plus the
  cost of unaccounted variance when purchase and sales data are available.
- Urgency is based on estimated shelf-life remaining and supplier lead-time
  data when available; without those inputs, the score is conservative.
- Data sufficiency is based on history length, presence of purchase data, and
  presence of inventory data. It is used for ranking, not shown as a claim of
  model certainty.
- A predictive recommendation requires at least four weeks of transaction
  history. Shorter histories can produce observations but not predictions.
- Missing prices or inventory counts reduce the available financial analysis;
  the system must state what cannot be calculated.

## Explicit Non-Goals

- Square, Toast, or other POS integrations in this implementation slice
- Cross-location aggregation or comparison
- Email, push, or webhook notifications
- Advanced beverage, event, or ghost-kitchen workflows
- Autonomous chat-to-database updates
- Machine-learned weight tuning

## Validation Queue

- Validate whether CSV-only onboarding is acceptable for the target segment.
- Interview three to five operators about purchase and inventory data quality.
- Validate whether daily dashboard recommendations are used without external
  notifications.
- Validate pricing and Square willingness-to-pay before Phase 2.

## Known Document Corrections

- The supplied `CPO-QUESTIONS.md` currently contains Q1 only, despite other
  documents referring to Q1-Q15. The missing questions should be restored in a
  later product-planning pass.
- The older vision document describes Square as MVP scope; this ledger follows
  the later Session 1 CSV-first decision.
- Confidence is treated as data sufficiency for ranking. The UI should show
  evidence and data coverage rather than imply that PantryIQ can certify its
  own certainty.
