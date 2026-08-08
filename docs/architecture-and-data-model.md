# PantryIQ — Architecture & Data Model

Technical specification: the canonical data model imports normalize into,
and the recommendation engine that reads from it. Product-level scope and
the recommendation *contract* (what must be true, business-wise) live in
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) — this document
is the implementation-level detail underneath that contract.

## Canonical data model

### Transactions (sales at POS)
Represents each item sold at the point of sale.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `locationId` | uuid FK | Which location |
| `transactedAt` | timestamp | Exact sale time |
| `externalId` | text | Source system ID (for deduplication) |
| `source` | text | `square`, `csv`, `toast`, etc. |
| `menuItemId` | uuid FK (nullable) | Link to canonical inventory item |
| `rawItemName` | text | Original name from source (audit trail) |
| `category` | text (nullable) | Item category (e.g. `seafood`, `beverage`) |
| `qty` | numeric | Units sold |
| `unitPrice` | numeric | Price per unit |
| `totalRevenue` | numeric | qty × unitPrice |
| `totalCost` | numeric (nullable) | COGS if known |
| `grossMargin` | numeric (nullable) | revenue - cost |
| `createdAt` | timestamp | Row inserted |

### Purchase orders (supplier orders)
Header table for orders placed with suppliers.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `locationId` | uuid FK | Which location |
| `orderedAt` | timestamp | Order placement time |
| `receivedAt` | timestamp (nullable) | Goods arrival time |
| `externalId` | text (nullable) | Supplier's PO number |
| `source` | text | `csv`, `sysco_edi`, etc. |
| `supplierName` | text (nullable) | Supplier name |
| `createdAt` | timestamp | Row inserted |

### Purchase order items (line items on POs)

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `purchaseOrderId` | uuid FK | Parent PO |
| `inventoryItemId` | uuid FK (nullable) | Link to canonical inventory item |
| `rawItemName` | text | Original name from source (audit trail) |
| `qty` | numeric | Units ordered |
| `unitCost` | numeric | Cost per unit |
| `totalCost` | numeric | qty × unitCost |
| `createdAt` | timestamp | Row inserted |

### Inventory items (canonical item master)
Built dynamically from imports, editable by the user.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `locationId` | uuid FK | Which location |
| `canonicalName` | text | Internal canonical name (audit, deduplication) |
| `displayName` | text | User's preferred name (what appears in UI) |
| `category` | text (nullable) | e.g. `protein`, `produce`, `beverage` |
| `unit` | text | `lb`, `each`, `case`, etc. |
| `shelfLifeDays` | integer (nullable) | Assumed spoilage window (e.g. 3 days for lobster) |
| `costPerUnit` | numeric (nullable) | Last known cost |
| `parLevel` | numeric (nullable) | Minimum stock threshold |
| `isActive` | boolean | If false, item is archived |
| `usageCount` | integer | Number of times this item appears in transactions/POs |
| `createdAt` | timestamp | Row inserted |
| `updatedAt` | timestamp | Last edit time |

### Inventory snapshots (point-in-time counts)
Optional inventory counts that allow spoilage calculation via actual
counts rather than inference.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `locationId` | uuid FK | |
| `inventoryItemId` | uuid FK | |
| `countedAt` | timestamp | When this count was taken |
| `qty` | numeric | On-hand quantity at that moment |
| `source` | text | `csv`, `manual`, etc. |
| `createdAt` | timestamp | Row inserted |

### Locations

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `userId` | uuid FK | Owner/account |
| `name` | text | Location name (e.g. "Downtown") |
| `address` | text (nullable) | Physical address |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### CSV upload history (audit trail)
Tracks all file uploads for audit and replay purposes.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `locationId` | uuid FK | Which location |
| `filename` | text | Original filename |
| `source` | text | `transactions`, `purchase_orders`, `inventory` |
| `rowsImported` | integer | Number of rows processed |
| `mappingUsed` | jsonb | Column mapping applied |
| `unmatchedItems` | jsonb (nullable) | Items that required user resolution |
| `uploadedAt` | timestamp | |
| `createdAt` | timestamp | |

### Food donation (added 2026-08-07 — provisional)

Donation became MVP scope on 2026-08-07. These tables are a **starting
sketch, not a settled schema.** The mechanics they imply — matching,
claiming, verification — are unresolved in `open-questions.md` §3, and
several of those answers will change these shapes. Do not treat this
subsection with the same authority as the tables above.

**The account model is the real problem here.** Every table above hangs
off a `userId` that owns `locations`. A recipient organisation owns no
locations, must never read restaurant financial data, and needs its own
authorisation path. That is a change to the account model, not an
additional table, and it is not designed yet.

#### Recipient organisations

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `userId` | uuid FK | Account that administers this organisation |
| `name` | text | Organisation name |
| `orgType` | text | `shelter`, `soup_kitchen`, `food_bank`, `other` |
| `address` | text | Physical address (used for locality matching) |
| `lat` / `lng` | numeric | Geocoded position |
| `acceptsPrepared` | boolean | Can accept prepared/cooked food |
| `acceptsRaw` | boolean | Can accept raw ingredients |
| `capacityNotes` | text (nullable) | Free-text limits (refrigeration, volume, hours) |
| `verificationStatus` | text | **Mechanism undecided** — see `open-questions.md` §3.1 |
| `isActive` | boolean | |
| `createdAt` / `updatedAt` | timestamp | |

#### Donation offers

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `locationId` | uuid FK | Donating location |
| `inventoryItemId` | uuid FK (nullable) | Linked canonical item, when the offer came from a recommendation |
| `description` | text | What the food is, in the operator's words |
| `qty` | numeric | Amount offered |
| `unit` | text | `lb`, `servings`, `each` |
| `isPrepared` | boolean | Prepared/cooked vs. raw |
| `allergens` | text (nullable) | Declared allergens — **accountability for accuracy undecided** |
| `availableFrom` / `availableUntil` | timestamp | Collection window |
| `estimatedValue` | numeric (nullable) | **Valuation method undecided** — see `open-questions.md` §3.4 |
| `status` | text | `open`, `claimed`, `collected`, `expired`, `cancelled` |
| `createdAt` / `updatedAt` | timestamp | |

#### Donation claims

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `donationOfferId` | uuid FK | Offer claimed |
| `recipientOrgId` | uuid FK | Claiming organisation |
| `claimedAt` | timestamp | |
| `collectedAt` | timestamp (nullable) | Null until the operator confirms handover |
| `status` | text | `claimed`, `collected`, `no_show`, `cancelled` |
| `createdAt` | timestamp | |

Whether an offer can be claimed by more than one recipient (partial
claims), and how `no_show` is recorded without unfairly penalising
under-resourced organisations, are open.

#### Access boundary

A hard requirement, not a preference: **a recipient must never be able to
read restaurant financial data.** Offers are the only restaurant-owned
records a recipient may see, and `estimatedValue` must not be exposed on
that path. Enforce at the query layer, not in the UI.

### Required tables & indices summary

Tables: `locations` (userId FK), `transactions` (locationId, menuItemId
FKs), `purchase_orders` (locationId FK), `purchase_order_items`
(purchaseOrderId, inventoryItemId FKs), `inventory_items` (locationId FK),
`inventory_snapshots` (locationId, inventoryItemId FKs),
`csv_upload_history` (locationId FK).

Indices: `transactions(locationId, transactedAt)` for time-range queries;
`transactions(locationId, menuItemId)` for item-level analysis;
`purchase_order_items(locationId, inventoryItemId)` for PO analysis;
`inventory_snapshots(locationId, countedAt)` for spoilage time-series;
`inventory_items(locationId, canonicalName)` for deduplication.

Donation adds (provisional): `recipient_organisations` (userId FK),
`donation_offers` (locationId, inventoryItemId FKs), `donation_claims`
(donationOfferId, recipientOrgId FKs). Indices:
`donation_offers(status, availableUntil)` for the open-offer feed;
`recipient_organisations(lat, lng)` — or a PostGIS geography column — for
locality matching, whose radius rule is undecided.

### Derived metrics

Calculated on-the-fly or cached:
- **Sell-through rate** = (qty sold / qty ordered) × 100%
- **Spoilage estimate** = ordered − sold − on-hand
- **Spoilage risk** = on-hand × unit cost (assuming full waste)
- **Margin** = revenue − (qty sold × unit cost)
- **Variance** = (ordered − sold − on-hand) / ordered × 100%

How to handle missing prices/inventory when computing these, and which
formula is authoritative for waste vs. variance, are open — see
`open-questions.md`.

### Item categorization

Likely categories (not finalized — see `open-questions.md`):
- Food: proteins, produce, dry goods
- Beverages: spirits, beer, wine, mixers, coffee, other
- Garnish: citrus, herbs, other

## AI / data query layer

- **Data access:** query transaction history (by item, date range,
  location), inventory levels and snapshots, purchase order history,
  canonical item metadata, and calculate the derived metrics above.
- **Analysis capabilities:** trend detection, anomaly detection (is this
  week unusual vs. historical average), spoilage calculation (via PO +
  transaction math, or inventory snapshots), margin analysis, pattern
  recognition (e.g. "lobster sells better on Fridays").
- **Honest uncertainty:** if the AI can't answer, it says so. If asked to
  show its work and it can't retrace its reasoning, the output is treated
  as unreliable (potential hallucination), and the user is always free to
  disregard an analysis that can't be justified with data.
- **Implementation:** internal database queries only (SQL/ORM), no
  external APIs in MVP. Response format is structured data presentable
  naturally in chat or as dashboard widgets. Every answer should be
  traceable to specific data queries and transformations.

## Recommendation engine

### Core philosophy
1. **State facts plainly** — "you ordered salmon 3 times, sold 0 times" (no interpretation)
2. **Acknowledge predictions** — "based on this pattern, we predict..." (labeled)
3. **Admit uncertainty** — "we don't have enough data to confidently predict..."
4. **Show work** — always surface data points and logic chain, never just a score
5. **Let users decide** — surface evidence and let the operator interpret it; the system doesn't grade confidence for them

### Message structure
See the worked salmon example in `mvp-scope-and-decisions.md`'s
"Message format" section — same five-part structure (Observation,
Financial Impact, Prediction, Recommendation, Show Your Work) — this
document adds the implementation-level detail behind each part.

**Show Your Work exposes:** which data sources were used (transactions,
POs, inventory snapshots), how metrics were calculated (order count,
sell-through %, spoilage estimate), and what assumptions were made
(shelf life, unit cost).

### Scoring dimensions (implementation detail)

Three dimensions feed the ranking formula defined in
`mvp-scope-and-decisions.md` (Impact 40% / Urgency 40% / Data Sufficiency
20%):

- **Impact (0–100):** calculated from spoilage cost, overordering cost,
  margin loss. Higher = more money at risk.
- **Urgency (0–100):** calculated from shelf life remaining, trend
  acceleration, supplier lead time. Higher = action needed sooner.
- **Data Sufficiency (0–100)** *(called "Confidence" in earlier drafts of
  this architecture — see the naming note in `mvp-scope-and-decisions.md`)*:
  calculated from weeks of transaction data, purchase data completeness,
  and pattern consistency. Higher = more trustworthy pattern.

**Extending the formula:** to add a new dimension (e.g. seasonality, staff
capacity), define its 0–100 score calculation, assign it a weight, and
proportionally rebalance all existing weights against the new total. See
the worked example (adding a 0.15-weight "Seasonality" dimension) in
`mvp-scope-and-decisions.md`.

### Dashboard alert format
Each alert shows: item name, observation ("0% sell-through this month"),
impact ("$40 waste risk"), a call to action ("reduce order this week" /
"discuss with team"), and a link to chat ("ask more about this").

Whether alerts should also require per-dimension minimum thresholds
(rather than just showing the top 5 regardless of score) is open — see
`open-questions.md`.

### Chat capabilities
Users can ask direct questions ("what am I wasting money on?"),
item-specific questions ("how is salmon doing this month?"), comparison
questions ("which items have the worst margin?"), and predictive
questions ("what should I order less of?"). Chat can surface facts,
observations not on the dashboard, predictions, and comparisons across
items or time periods.

**Chat doesn't prescribe:** it recommends ("consider reducing salmon")
but never executes menu changes, modifies orders automatically, or locks
in decisions without user approval.

### Data requirements by recommendation type

| Recommendation type | Minimum data required | Data-sufficiency impact |
|---|---|---|
| Observed sell-through (e.g. "0% sales") | Transactions only | High (direct observation) |
| Spoilage estimate | Transactions + POs + Inventory | Medium (calculated from variance) |
| Margin analysis | Transactions + POs | Medium (if prices available) |
| Trend analysis | 2+ weeks transactions | Low (early trend detection) |
| Predictive reorder | 4+ weeks transactions | High (pattern has history) |

### Edge cases & honest boundaries

**Not enough data** (e.g. only 1 week of transaction history): surface
observed facts (what sold, what didn't); do not make predictions; admit
the data requirement ("come back when you have 3+ weeks of history").

**Partial data — no prices** (e.g. POs uploaded without unit costs): can
calculate order counts and sell-through; cannot calculate dollar impact;
frame recommendations in units, not dollars ("you ordered 5 salmon, sold
0").

**Conflicting data** (e.g. POs say 5 units ordered, inventory says 0
on-hand, transactions say 2 sold — 3 units unaccounted for): surface the
observation plainly ("you have a variance: 3 units unaccounted for"),
offer possible explanations (waste, theft, data error), but don't assume
which one is correct.

**Seasonal items** (e.g. asking about eggnog in May): acknowledge
seasonality ("this is typically a winter item"), still show data if
available ("you have 2 cases on-hand from Q4"), offer an explanation
("this may be old inventory; consider liquidating").

### Tuning & configuration

Weights and thresholds are stored as configuration, not hardcoded:

```yaml
recommendation_engine:
  weights:
    impact: 0.40
    urgency: 0.40
    data_sufficiency: 0.20
  thresholds:
    high_impact: 100  # dollars
    medium_impact: 25
    low_impact: 0
    high_urgency: 7   # days
    medium_urgency: 14
    low_urgency: 0
```

Per-user tuning (focus area, risk tolerance, notification frequency) is
explicitly deferred to Phase 2 — see `mvp-scope-and-decisions.md`'s
deferred feature backlog.

## Pitfalls from the prior implementation

The `rewrite` branch replaced an earlier working implementation. That
codebase's audit (`docs/archive/existing-repo-audit-consolidated.md`) is
kept for reference but was not otherwise folded into this document — read
it directly before making architecture decisions that touch CSV upload
security, file storage, or schema design, since those were flagged risk
areas in the prior build.
