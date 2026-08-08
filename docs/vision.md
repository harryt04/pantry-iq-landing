# PantryIQ: Founding Vision

> **Status note:** This document preserves the founding narrative and
> long-term product vision. It does **not** describe MVP scope. For what is
> actually being built first, see [`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md),
> which supersedes the "Version 1 MVP" and integration claims that used to
> live in this file.

## Founding vision

PantryIQ exists to solve a problem restaurant operators face constantly:
food waste and inventory inefficiency. The founding insight came from
watching restaurants throw away $50,000+ a year in spoiled food, overstock,
and operational inefficiency.

**The dual mission:**
1. **Profitability** — help restaurants reduce waste, optimize inventory,
   and improve margins.
2. **Charitable impact** — donate surplus food to local charities, addressing
   food insecurity in the communities restaurants serve.

The long-term bet is that AI decision-making, layered on top of a
restaurant's existing data (POS, purchasing, inventory), can make both of
those goals achievable at scale, not just for large chains with dedicated
analysts.

## Long-term product scope

The founding vision describes an AI chatbot that eventually answers
restaurant operations questions across four domains. This is the north
star, not the MVP — MVP scope is deliberately much narrower (CSV-first,
single-location, decision-support only; see `mvp-scope-and-decisions.md`).

### 1. Staffing optimization
Questions like "how many line cooks should I schedule Friday dinner?" or
"which shifts are most profitable?" — answered using historical sales,
forecasted weather, and local events to recommend staffing levels and shift
structure.

### 2. Inventory & purchasing
Questions like "what should I order this week?" or "when will I run out of
chicken breast?" — answered using on-hand inventory, seasonal demand,
supplier lead times, and spoilage rates to recommend specific orders and
flag stockouts before they happen.

### 3. Menu management & kitchen operations
Questions like "which dishes should I feature this month?" or "why are food
costs 32% this month?" — answered using ingredient availability, margin,
seasonality, and demand to recommend menu changes or prep adjustments.

### 4. Food donation & waste prevention
Questions like "which local charities accept prepared meals?" or "how much
food waste did I generate today?" — answered by connecting restaurants to
nearby non-profits, identifying safely shareable surplus, and tracking
waste trends and tax-deductible donations.

## Long-term roadmap (post-MVP)

These are aspirational expansion directions from the founding plan, not
committed scope. Whether and when any of them happen is an open question —
see `open-questions.md` for the specific tension around POS integration
priority.

- **POS ecosystem expansion** — Oracle Micros (enterprise/fine dining),
  Ziosk (guest-facing terminals, table-level profitability).
- **MCP server** — deploy PantryIQ as a Claude MCP server so operators can
  use Claude desktop with PantryIQ context directly.
- **Kitchen operations** — tokei.app integration for kitchen display system
  (KDS) analytics and bottleneck detection.
- **Front-of-house** — Dinetap integration for guest feedback/sentiment
  analysis and retention strategies.

## Bootstrap & business model principles

- **Self-funded** — no external VC pressure; build profitably from day one.
- **Customer-first** — solve real problems, charge fairly for value
  delivered.
- **Transparency** — share metrics, growth, and challenges with the team.
- **Cost sharing** — infrastructure and API costs (hosting, model providers,
  POS, weather) split across partners; equity aligned with role
  responsibilities (technical, product, sales, operations).

## Competitive positioning

1. **Dual-mission focus** — one of few AI solutions for restaurants
   combining profitability with charitable impact; appeals to
   socially-conscious operators and CSR-minded ownership.
2. **Multi-source data integration** — POS, weather, inventory, and charity
   data together give the AI more context than single-purpose tools.
3. **Operational breadth** — spans POS ecosystems, supply chain
   relationships, and day-to-day restaurant operations knowledge.
4. **Clear expansion path** — starts from a well-defined use case (food
   waste reduction) with measurable ROI, then expands via more
   integrations and more question domains.

> **Note:** `MASTER-RESEARCH-DECISION-MEMO.md` (folded into
> `personas-and-research.md`) reaches a more specific and partly conflicting
> view on which integrations matter most competitively — see
> `open-questions.md`.

## Founding launch targets

These are the original founder-set targets from the vision-stage plan. They
predate the later cost and market research and have not been reconciled
against it (see `cost-and-pricing.md` and `open-questions.md` for the
pricing tension). Kept here as historical targets, not committed goals.

**MVP success (3 months):** 10 beta restaurant users, 50+ conversations per
user/month, ~$50K MRR potential, NPS > 40.

**Year 1:** 100 paying customers, $500K ARR, 2+ POS integrations, 1,000+
charitable connections.

**Long-term (3-5 years):** 1,000+ restaurant operators, $10M+ ARR, broad POS
integration coverage, millions of pounds of food rescued for charity.
