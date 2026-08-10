# PantryIQ — Cost & Pricing

This document covers two things that don't actually agree with each
other yet: what it costs to run PantryIQ on various LLMs, and what the
market suggests PantryIQ should charge. Both are presented here without
being reconciled — see "The pricing mismatch" at the bottom and
[`open-questions.md`](open-questions.md).

## LLM cost analysis

**Version:** 2.0, dated 2026-03-28. Verified against live pricing pages
for OpenAI, Anthropic, and Google Vertex AI as of that date. Model
pricing changes over time — treat these as a snapshot, not permanent
numbers, and re-verify before final model selection.

### Query size assumptions

| Component | Tokens | Reasoning |
|---|---|---|
| System prompt | ~500 | Restaurant analytics persona and rules |
| Transaction data summary | ~2,000 | Compressed POS + supplier context |
| Conversation history | ~400 | Recent messages in thread |
| User question | ~50 | Typical natural-language query |
| **Total input** | **~3,050** | Rounded up for safety margin |
| AI response (output) | **~500** | Explanation + short table or list |

### Monthly cost by model

Two usage profiles: average user (5 queries/day, 150/month), power user
(20 queries/day, 600/month).

| Model | Avg user (150 q/mo) | Power user (600 q/mo) |
|---|---|---|
| Gemini 2.0 Flash Lite | $0.057 | $0.23 |
| Gemini 2.5 Flash Lite | $0.076 | $0.30 |
| Gemini 2.0 Flash | $0.11 | $0.45 |
| GPT-5.4 nano | $0.19 | $0.74 |
| Claude Haiku 3 (legacy) | $0.21 | $0.83 |
| Gemini 2.5 Flash | $0.32 | $1.30 |
| GPT-5.4 mini | $0.68 | $2.72 |
| Claude Haiku 4.5 | $0.83 | $3.33 |
| Gemini 2.5 Pro | $1.32 | $5.29 |
| GPT-5.4 | $2.27 | $9.08 |
| Claude Sonnet 4.6 | $2.50 | $9.99 |
| Claude Opus 4.6 | $4.16 | $16.65 |
| Claude Opus 4.1 (legacy) | $12.49 | $49.95 |
| GPT-5.4 pro | $27.23 | $108.90 |

### Margin viability at current pricing ($20/location, $10/truck)

Max allowable AI cost at a 60% floor gross margin, power-user constraint:
$20 × 0.40 = **$8.00/user/month** (location tier); $10 × 0.40 =
**$4.00/user/month** (truck tier).

| Model | Power user AI cost/mo | Viable at $20/location? | Viable at $10/truck? |
|---|---|---|---|
| Gemini 2.0 Flash Lite | $0.23 | Yes (98.9% margin) | Yes |
| Gemini 2.5 Flash Lite | $0.30 | Yes (98.5%) | Yes |
| Gemini 2.0 Flash | $0.45 | Yes (97.7%) | Yes |
| GPT-5.4 nano | $0.74 | Yes (96.3%) | Yes |
| Claude Haiku 3 (legacy) | $0.83 | Yes (95.9%) | Yes |
| Gemini 2.5 Flash | $1.30 | Yes (93.5%) | Yes |
| GPT-5.4 mini | $2.72 | Yes (86.4%) | Yes |
| Claude Haiku 4.5 | $3.33 | Yes (83.4%) | Yes (marginal) |
| Gemini 2.5 Pro | $5.29 | Yes, tight (73.6%) | **No** |
| GPT-5.4 | $9.08 | **No — loss at power user** (54.6%) | No |
| Claude Sonnet 4.6 | $9.99 | **No — loss at power user** (50.1%) | No |
| Claude Opus 4.6 | $16.65 | **No** (-16.5%) | No |
| Claude Opus 4.1 (legacy) | $49.95 | **No** (severe loss) | No |
| GPT-5.4 pro | $108.90 | **No** (severe loss) | No |

### Effect of prompt caching

If ~80% of input tokens are cacheable (system prompt + transaction data ≈
2,500 of 3,050 tokens), caching cuts cost roughly 40%:
- **Claude Haiku 3 with caching:** $0.001388 → $0.000838 per query (~$0.50/mo for a power user)
- **Claude Haiku 4.5 with caching:** $0.005550 → $0.003300 per query (~$1.98/mo for a power user)

Both Anthropic and OpenAI, and Google Vertex AI for 2.5+ models, support
prompt caching at roughly 10% of normal input price for cache reads.
Batch processing (50% discount) is available from all three providers for
asynchronous workloads — not usable for real-time chat, but useful for
background tasks like nightly summaries.

### Model recommendation

| Model | Recommended role | Notes |
|---|---|---|
| Gemini 2.0 Flash Lite | Budget default, if a Google Cloud dependency is acceptable | Cheapest current option |
| Gemini 2.0 Flash | Alternative budget default | Excellent cost/quality; same Google dependency caveat |
| Claude Haiku 3 (legacy) | Budget default (Anthropic, no Google) | Still available; lowest-cost non-Google option; may deprecate |
| GPT-5.4 nano | Budget default (OpenAI-only stack) | Good cost; current-gen OpenAI |
| GPT-5.4 mini | Mid-tier selectable | Reasonable cost, strong capability |
| Claude Haiku 4.5 | Mid-tier selectable | Current Anthropic fast model; 4× pricier than legacy Haiku |
| Gemini 2.5 Flash | Mid-tier selectable (Google dep.) | Good capability/cost balance |
| Gemini 2.5 Pro | Premium selectable | Tight margins at $20/location; not viable at $10/truck |
| GPT-5.4 / Claude Sonnet 4.6 | Premium selectable | Loss-making at power-user level — must be clearly labeled "Premium — higher cost" in the UI |
| Claude Opus 4.6 / GPT-5.4 pro / Claude Opus 4.1 | Not recommended for v1 | Deeply to catastrophically loss-making at all usage levels |

**Default:** Claude Haiku 3 (legacy) remains viable as the cheapest
non-Google option, but should be treated as temporary — plan a migration
path to a current-generation model. **Gemini 2.0 Flash** is the cleanest
current-generation default if a Google Cloud dependency is acceptable.
Staying OpenAI-only, **GPT-5.4 nano** is the best current default. Note:
Gemini models require Google Cloud (Vertex AI), an added cloud-provider
dependency the product intentionally wanted to avoid keeping the stack
simple — the cost benefit is real but comes with that architectural
trade-off.

### Caveats

- Assumes a single user per location; multiple power users on one
  $20/month location scale cost linearly.
- Token counts are estimates — actual counts depend on how much
  transaction-data context is injected per query.
- These numbers cover AI inference cost only. Infrastructure (hosting,
  database, weather API) adds additional COGS not reflected here.

## Market pricing research

From the market research synthesis (full detail in
[`personas-and-research.md`](personas-and-research.md), Part 3 — this is
the pricing-relevant excerpt).

Competitor pricing bands identified across 8 mined inventory/cost-tracking
competitors (MarketMan, MarginEdge, BevSpot, Craftable, and others):
- **Entry tier:** $79–199/mo (small ops, bars)
- **Core tier:** $249–350/mo (mid-market single/multi-location) — identified as the "sweet spot"
- **Premium tier:** $400–500+/mo (multi-unit, chains, AP automation / advanced features)

The research's wedge recommendation was to enter at **$249–350/mo**,
targeting full-service restaurants (50–500 seats, 1–3 locations) on
Square POS, differentiated by conversation-driven onboarding and
explainable cost insights. This pricing recommendation has **not** been
validated with real customer interviews — it's derived from competitor
marketing pages and pricing-band analysis only (confidence: high per the
source memo, but explicitly not churn- or willingness-to-pay-validated).

## The pricing mismatch

Two very different numbers are floating around this planning corpus:

- **Cost-analysis anchor:** $20/location/month, $10/truck/month (from
  `cost-analysis.md` and the live landing page / master-branch README —
  this is what's actually being charged today).
- **Market-research anchor:** $249–350/mo entry point (from the
  competitive research synthesis, based on what comparable tools charge).

These were never reconciled. Possibilities, none confirmed:
- The $20/$10 pricing is an early-adopter / beta rate, and the intent was
  always to move toward market-comparable pricing later.
- The $20/$10 pricing reflects a deliberate low-cost-structure wedge
  strategy (CSV-first, no integrations, minimal COGS) that intentionally
  undercuts the $249+ competitors.
- The market research pricing bands assume feature parity with
  full-featured competitors (recipe costing, AP automation, POS
  integrations) that the CSV-first MVP doesn't have yet, making the
  comparison premature.

This is tracked as an open decision in `open-questions.md` — not resolved
here.
