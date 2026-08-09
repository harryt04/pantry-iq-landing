# PantryIQ — Architecture & Data Model

Technical specification: the canonical data model imports normalize into,
and the recommendation engine that reads from it. Product-level scope and
the recommendation *contract* (what must be true, business-wise) live in
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) — this document
is the implementation-level detail underneath that contract.

> **Technology choices live in [`tech-stack.md`](tech-stack.md)**
> (approved 2026-08-07), not here. The schema includes the two location
> settings required by that document: a **timezone** column and a
> **business-day boundary**, because a restaurant's business day is not a
> calendar day (`tech-stack.md` §3.10). Every monetary and quantity column
> is `numeric`, never a float (§3.9). That document also settles the "AI /
> data query layer" section further down: the model narrates precomputed
> results and never calculates.

## Source-independent ingestion

Every source crosses the same boundary in `src/server/ingestion/` before it
writes canonical rows. An adapter implements `IngestionAdapter<TInput>` and
normalizes its payload into one of three records: a transaction, a purchase
order with normalized lines, or an inventory count. The normalized contract
keeps the source, stable external ID, original item name, exact decimal
strings, and canonical item ID together; adapters do not write to the
database directly.

`persistNormalizedRecords` owns the database write path. Transactions and
purchase orders deduplicate by `(location, source, externalId)`; inventory
counts use the existing `(location, source, item, countedAt, qty)` identity
because the canonical snapshot table has no external-ID field. Exact item
resolution is also source-independent: case, whitespace, and the explicitly
listed POS customization clauses are presentation normalization only. No
fuzzy matching is available to connectors.

The existing CSV flow is the first adapter. It retains its preview and
one-at-a-time resolution UX, then converts its resolved plan into normalized
records for shared persistence. Manual entries use the same normalized audit
history helpers, so future API connectors add an adapter and do not duplicate
normalization, deduplication, item-resolution, or history behavior.

## Connector sync scheduling (`INT-06`)

Each connected source is registered with the `pantryiq.connector-sync` pg-boss
queue on a fifteen-minute UTC schedule. Scheduled jobs always call the
adapter's incremental cursor path, so providers receive only records after
the connection's durable `syncCursor`; backfill remains an explicit operation.
The queue carries a singleton key per connection and uses one local worker,
which prevents overlapping runs for a connection while allowing the schedule
to cover every location.

The connector framework records `lastSyncedAt` after each persisted page and
keeps the connection in `connected` only after the final page succeeds. A
completed incremental sync hands its location to the precompute scheduler
through `onComplete` (or the default scheduler when no callback is supplied);
precompute is therefore location-scoped and follows the freshest imported
rows. `GET /api/connectors/status` exposes this timestamp,
provider, and textual status through the same owner authorization boundary as
other location data. A failed sync retains the prior successful timestamp and
records a failure state for the later connection-health surface.

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
| `locationId` | uuid FK | Denormalized ownership scope for item-level queries |
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
| `itemType` | text | `ingredient` (purchased) or `menu_item` (sold) |
| `shelfLifeDays` | integer (nullable) | Assumed spoilage window (e.g. 3 days for lobster) |
| `costPerUnit` | numeric (nullable) | Last known cost |
| `menuPrice` | numeric (nullable) | Current selling price for menu items |
| `parLevel` | numeric (nullable) | Minimum stock threshold |
| `isActive` | boolean | If false, item is archived |
| `usageCount` | integer | Number of times this item appears in transactions/POs |
| `createdAt` | timestamp | Row inserted |
| `updatedAt` | timestamp | Last edit time |

### Recipes and ingredients
Recipes are optional. Existing locations, items, imports, and metrics remain
valid when a location has no recipes. A menu item is an `inventory_items` row
whose `itemType` is `menu_item`; purchased inputs are rows whose `itemType` is
`ingredient`. Existing canonical items keep their IDs and data when the item
type column is added, defaulting to `ingredient` for backwards compatibility.

| Table | Important fields | Purpose |
|---|---|---|
| `recipes` | `locationId`, `menuItemId`, `name`, `outputQuantity`, `outputUnit`, `yieldFactor`, `wasteFactor` | A location-scoped recipe and its yield assumptions |
| `recipeIngredients` | `recipeId`, exactly one of `ingredientItemId` or `subRecipeId`, `quantity`, `unit` | Ingredient quantities or optional sub-recipe references |
| `itemUnitConversions` | `locationId`, `inventoryItemId`, `fromUnit`, `toUnit`, `factor` | Exact item-specific conversions, including case pack sizes |
| `recipeCostHistory` | `locationId`, `recipeId`, `calculatedAt`, exact cost fields, `evidence` | Immutable cost projections and their arithmetic inputs over time |

Standard mass conversions are calculated with exact decimal arithmetic in the
application layer. Item-specific conversion rows handle packaging such as
`1 case = 24 each`; factors are stored as PostgreSQL `numeric`. Recipe and
sub-recipe dependencies are checked for cycles before expansion so a malformed
recipe graph cannot recurse forever. Yield and waste are explicit assumptions,
not facts inferred by the system.

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
| `isActive` | boolean | If false, the location is archived and hidden from active work |
| `timezone` | text | IANA timezone used for business-day interpretation |
| `businessDayBoundary` | time | Local time at which the restaurant's business day rolls over; defaults to 4am |
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
| `storageKey` | text (nullable, unique) | Generated S3-compatible object key for the raw file |
| `status` | text | `uploaded` until parsing and commit finish; `imported` afterward |
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

### Metric runs and stored results

Precomputation is append-only. A `metric_runs` row records the location,
input-data window, timestamps, and terminal status of one deterministic run.
`metric_results` stores the five `MET-01` results for each canonical item;
`metric_rollups` stores the same metric keys at location scope. Both result
tables keep the exact numeric value separately for filtering and the full
JSON evidence returned by the metric function for disclosure later.

The previous successful run is never overwritten while a new run is running
or failing. Readers select the latest successful run, so an interrupted
precompute cannot expose partial results. A failed run retains its error and
can be surfaced by the observability layer.

### Required tables & indices summary

Tables: `locations` (userId FK), `transactions` (locationId, menuItemId
FKs), `purchase_orders` (locationId FK), `purchase_order_items`
(purchaseOrderId, inventoryItemId FKs), `inventory_items` (locationId FK),
`inventory_snapshots` (locationId, inventoryItemId FKs),
`csv_upload_history` (locationId FK), `metric_runs` (locationId FK),
`metric_results` (runId, locationId, inventoryItemId FKs),
`metric_rollups` (runId, locationId FKs), `recipes` (locationId, menuItemId
FKs), `recipe_ingredients` (recipeId, ingredientItemId or subRecipeId FKs),
`item_unit_conversions` (locationId, inventoryItemId FKs),
`recipe_cost_history` (locationId, recipeId FKs).

Indices: `transactions(locationId, transactedAt)` for time-range queries;
`transactions(locationId, menuItemId)` for item-level analysis;
`purchase_order_items(locationId, inventoryItemId)` for PO analysis;
`inventory_snapshots(locationId, countedAt)` for spoilage time-series;
`inventory_items(locationId, canonicalName)` for deduplication;
`recipes(locationId, menuItemId, name)` for recipe lookup;
`recipe_ingredients(recipeId)` for ingredient expansion;
`item_unit_conversions(locationId, inventoryItemId, fromUnit, toUnit)` for
exact conversion lookup; `recipe_cost_history(locationId, recipeId,
calculatedAt)` for cost movement and evidence lookup; `metric_runs(locationId,
startedAt)` for latest-run selection; `metric_results(locationId,
inventoryItemId, metricKey)` and `metric_rollups(locationId, metricKey)` for
scoped reads.

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

#### Theoretical versus actual ingredient usage (MNU-04)

The usage view expands each active recipe through its optional sub-recipe
tree, applies the recipe's effective output (`outputQuantity × yieldFactor ×
(1 − wasteFactor)`), and multiplies that requirement by sold menu-item
quantity. Ingredient lines are converted into the canonical inventory-item
unit with the same exact-decimal conversion rules used by plate costing.
Division that cannot be represented as a terminating decimal is rounded
half-up to six places; no JavaScript floating-point arithmetic is used.

Actual usage is calculated per ingredient only when two physical inventory
snapshots exist in the selected period:

```
actual usage = beginning on-hand + purchases between counts − ending on-hand
variance = actual usage − theoretical usage
```

Snapshots remain authoritative. Missing counts are reported as
“cannot-calculate” rather than treated as zero. A positive variance is shown
as an observation with possible explanations — over-portioning, unrecorded
waste, theft or loss, or a recipe that may be wrong — and none is asserted as
the cause. Sales for menu items without an active recipe are excluded and the
exclusion is stated; their ingredients are never assigned by assumption.

#### Ingredient-level waste attribution (MNU-07)

The usage view keeps the physical total for an ingredient and the
recipe-derived usage for each dish that consumed it. The residual is explicit:

```
attributed usage + unattributed usage = total physical usage
excess usage = max(unattributed usage, 0)
```

When an ingredient is shared across dishes, positive excess usage is allocated
in proportion to each dish's recipe-derived usage for that ingredient in the
selected period. The final dish receives the exact remainder after six-place
display rounding, so the allocations reconcile to the excess total. A dish's
allocation is an observation about where the variance sits, not a claim that
the dish caused waste. Sales without a recipe, missing conversion paths, and
physical usage with no modeled dish remain in the unattributed row.

Missing prices do not affect this quantity-only view. Inventory snapshots are
authoritative for actual usage, and attribution is shown only for periods
where that usage is calculable under D11 in the backlog.

#### Spoilage resolution (MET-03)

Inventory snapshots are authoritative for periods bounded by two physical
counts. For a successive-count interval, spoilage is calculated as
`beginning on-hand + ordered − sold − ending on-hand`; the result records
`method: snapshot` and retains the inputs used. The same interval also
retains the fallback `ordered − sold − ending on-hand` when complete, so a
material disagreement can be surfaced as a variance rather than silently
discarded. Material means more than 20% of the smaller absolute figure.

Gaps before the first count, after the last count, or locations with no
successive counts use the fallback formula and record `method: inferred`.
The default freshness window for the on-hand count used by that fallback is
seven days. A count older than seven days at the end of a fallback period is
stale and cannot supply current on-hand; the metric returns “cannot
calculate” unless another current on-hand value is available. Every stored
spoilage result retains its per-period method, inputs, and any variance
finding in the metric evidence.

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

### Interpretable context bundle (`MET-12`)

The chat grounding layer receives a deterministic JSON context bundle from
`src/server/metrics/context-bundle.ts`. The query adapter requires one
location ID, applies that ID to every normalized-row and metric-run query,
and exposes an ownership-wrapped entry point for authenticated callers. It
does not expose SQL, a query tool, or a write path to the model.

The bundle contains the location's business-day series for each canonical
item (sold, ordered, and on-hand quantities), category groupings and totals,
day-of-week and local-time distributions, and the latest persisted metric
results. Numeric values are strings with an explicit unit and provenance;
cannot-calculate metrics stay explicit. Inputs are ordered by stable IDs and
timestamps, and the serialized bundle contains no current-time value, so
identical normalized data produces byte-identical output for prompt
caching.

The documented context budget is 2,000 estimated tokens, using four JSON
characters per token as a stable sizing estimate. If the full history is
larger, the builder removes the oldest business-day series points first and
records the omitted count. This preserves the newest operational picture
while making compaction visible to the narration layer.

### Narration service (`CHT-02`)

`src/server/chat/narration.ts` is the only boundary between the deterministic
engine and a language model. It accepts a question, optional in-session turns,
persisted `MET-09` recommendation records, and one `MET-12` context bundle. It
does not import the database client, expose tools, or provide a write path.
The trust rules live in the AI SDK `instructions` field; the stable JSON
context is a separate cache-marked message so providers can reuse it without
caching the user's changing question.

The provider is selected by `NARRATION_PROVIDER` (`anthropic` or `openai`) and
the model by `NARRATION_MODEL`. `NARRATION_TIMEOUT_MS` defaults to 5,000 and
`NARRATION_MAX_RETRIES` defaults to one. Anthropic receives an ephemeral cache
breakpoint; other providers receive the same stable context without an
Anthropic-specific option. Each completed or degraded query emits the typed
`llm.query.completed` event with input/output tokens, cache read/write counts,
cache-hit status, first-token milliseconds, and integer USD micro-unit cost.

If the provider cannot produce a stream after the retry budget, the service
returns the latest structured recommendations directly. This keeps the
operator's facts and financial impact visible without inventing model prose.

### Grounding guardrail (`CHT-03`)

`src/server/chat/grounding.ts` checks the complete generated response before
any model text is returned to the client. Every numeric token must normalize
to a numeric value present in the supplied recommendation records or
location-scoped context bundle; commas, currency symbols, percent signs, and
trailing decimal zeroes are presentation differences, not new values. An
unmatched figure is logged as `chat.guardrail.blocked`, marked as blocked in
LLM usage telemetry, and replaced with the structured recommendation
fallback. Buffering is deliberate: a partial stream must never expose text
that later fails the trust check.

The context message is explicitly untrusted data. Imported names and other
strings are never promoted to instructions, and the API authenticates the
selected location before loading both context and recommendations. The chat
service has no database import, tool, or write path. The narration prompt also
requires pattern observations from the interpretable layer to be labelled as
observations rather than calculations or predictions.

### Chat evidence disclosure (`CHT-05`)

The chat page receives the same location-scoped persisted recommendation
records as the dashboard. After the validated five-part answer finishes
streaming, the client renders its sections and matches named recommendation
items to their persisted `evidenceTrace`. It reuses the dashboard's
`RecommendationWork` component, so sources, calculations, assumptions, and
item-settings edit links have one disclosure implementation and remain
collapsed by default. If a response names no recommendation with a complete
trace, chat displays an explicit unverified notice instead of presenting an
unsupported explanation as trustworthy.

### Assumption override and scope (`CHT-06`)

Chat exposes an explicit assumption comparison for the supported item inputs
that the current deterministic engine can recalculate: shelf life and cost
per unit. `src/server/chat/assumption-override.ts` validates the proposed
value, clones the selected item, and runs `buildPrecomputeResults` twice with
the same fixed input timestamp. The response contains the old and new
financial-impact, recommendation-score, and urgency figures, plus the
assumption values used. The model is not involved in this calculation.

The comparison is always followed by a scope choice. "This conversation
only" keeps the normalized override in client session state and sends it with
later chat questions. "Save to item settings" requires an explicit click and
uses the existing owner-scoped `PATCH /api/items/:itemId` path; that path
invalidates the item's precompute through the normal scheduler. The model has
no write path, and no override is persisted merely because an operator
questioned an assumption.

### Chat session memory (`CHT-07`)

Chat history is client-held session state only. The transcript and
conversation-only overrides begin empty, and the chat surface is keyed and
reset whenever the selected location changes, so context cannot cross a
location boundary. Nothing is persisted when the page or session ends.

Before narration, `src/chat/session-memory.ts` estimates four characters per
token and keeps the newest history within the 400-token allowance recorded in
`cost-and-pricing.md`. Complete recent turns are retained first; if the newest
turn alone exceeds the allowance, only its ending is retained. The API caps
the accepted history at 24 messages before this budget pass. Any trim emits
`chat.history.trimmed` with account/query ownership and counts only — never
message content — so the cost and context trade-off remains observable.

### Chat declines and miss report (`CHT-08`)

When the model signals that a question cannot be answered from the supplied
context, `src/server/chat/narration.ts` discards that prose and returns a
deterministic five-part decline. It explains that the question is outside
the location's imported data, does not include a figure, and offers a nearby
question the current analysis can answer. Buffering the model response keeps
an unsupported answer from reaching the browser before the decline boundary
can be checked.

Each miss records the signed-in account, location, question text, query ID,
reason, and timestamp through the structured `chat.miss.recorded` log event
and the in-process `ChatMissRegistry`. `GET /api/chat/misses` provides a
one-off, account-scoped report grouped by repeated question and sorted by
frequency. This is intentionally an operational report rather than a
dashboard; a future persistent telemetry store can replace the registry
without changing the narration contract.

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

`MET-09` assembles a versioned structured recommendation from the ranked
item metrics. It keeps observation facts, financial impact, prediction, and
the suggested action in separate fields; a prediction is absent until the
four-week transaction gate is met, and a missing dollar figure is stored as
`null` with an explanation. The record is stored with its metric run under
`metric_results.metric_key = 'recommendation'`, alongside the source metric
rows for the same item. Its deterministic `evidenceTraceRef` identifies the
item and input window that `MET-10` will expand into the full trace.

`MET-10` expands that reference into the required `evidenceTrace` field on
the same JSON recommendation record. The trace is versioned and contains:

- `sources`: imported filename, source type, imported row count, and upload
  timestamp. Manual entries use the same history record, so they remain
  auditable without pretending they came from a file.
- `calculations`: every metric result, each nested impact/category or
  urgency/component result, and the final ranking score and rank. Each entry
  retains string-valued inputs, units, the operator or calculation rule, and
  the exact result (or the cannot-calculate explanation).
- `assumptions`: configuration and item assumptions with their value, origin
  (`user-set`, `category-default`, or `system-default`), and the settings or
  deployment path where the value can be changed.

Trace assembly is deterministic: source rows are ordered by upload time and
filename, configuration keys are sorted, and no current-time value is added
to the trace. A recommendation is rejected if the trace has no source,
calculation, or assumption, so rendering layers can treat the trace as a
required artifact rather than an optional debug aid. The existing metric
result JSON already stores the exact inputs and evidence, so this does not
need a second persistence table or a floating-point conversion.

`MNU-06` adds recipe-derived candidates for plate-margin erosion, positive
theoretical-versus-actual recipe variance, and ingredient cost increases where
the recorded menu price has not moved. These candidates use the same
`rankRecommendations` function and global five-item limit as inventory
findings. Their persisted metric keys are `recommendation:<type>` so multiple
menu findings for one inventory item do not collide with the existing unique
metric-result index. Every menu record carries `recipeDerived: true`, a
human-readable finding, and a complete trace whose calculation explanation
starts with “Recipe-derived figure.” Missing ingredient prices keep dollar
impact null; the variance remains a quantity observation rather than a made-up
financial result.

`MET-11` adds a deterministic `dataFindings` array to each recommendation.
It is separate from the recommendation's facts and prediction so a missing
input cannot become a silent zero or an unlabelled prediction. The four
finding codes are:

- `insufficient-history`: states the observed history and the transaction
  history required before a prediction is shown.
- `missing-prices`: keeps quantity observations in their recorded unit and
  states that a unit cost or purchase-order cost is needed for a dollar
  impact.
- `conflicting-data`: reports a material physical-count versus order-and-
  sales variance, including both results and possible explanations without
  selecting one.
- `seasonal-pattern`: acknowledges a pattern observed in imported
  transaction months, labels it as an observation rather than a certainty,
  and keeps the historical data visible.

Finding order is fixed, all numeric values remain decimal strings, and the
seasonal comparison uses the precompute run's explicit analysis date. This
makes the record byte-stable for unchanged inputs and keeps the rendering
layers from having to rediscover edge-case rules.

### Scoring dimensions (implementation detail)

Three dimensions feed the ranking formula defined in
`mvp-scope-and-decisions.md` (Impact 40% / Urgency 40% / Data Sufficiency
20%):

- **Impact (0–100):** calculated from current spoilage risk, historical
  spoilage, overordering cost, and margin loss. Higher = more money at
  risk. Each category keeps its own exact dollar contribution so the
  eventual recommendation can trace a wallet figure back to its sources.

  The current implementation uses a configuration seam (to be centralized
  by `MET-08`) with weights of current spoilage 0.40, overordering 0.25,
  margin loss 0.20, and historical spoilage 0.15. A category with missing
  inputs is suppressed and the remaining weights are renormalized; a
  missing category never becomes an unexplained zero.

  Current spoilage risk is `on-hand × unit cost`. Historical spoilage is the
  sum of positive quantities from the `MET-03` spoilage figures multiplied by
  unit cost. Overordering is positive `ordered − sold` multiplied by unit
  cost. Margin loss is positive cost of sales less revenue, using imported
  transaction cost when complete and the weighted purchase cost otherwise.
  Dollar values are normalized against a configurable $100 high-impact
  ceiling to produce the 0–100 category score. When a category has a usable
  quantity signal but no cost, its score falls back to units against a
  configurable ten-unit scale and explicitly reports that dollars cannot be
  calculated. The composite is exact integer arithmetic with active weights
  renormalized.
- **Urgency (0–100):** calculated from shelf life remaining, trend
  acceleration, supplier lead time. Higher = action needed sooner.

  The initial deterministic implementation uses fixed configuration-shaped
  weights of shelf life 0.50, trend acceleration 0.30, and supplier lead
  time 0.20. Shelf-life urgency is 100 at or past the low threshold, 75
  through the high threshold, 50 through the medium threshold, and 0
  beyond it. Trend acceleration compares two successive seven-day windows
  and is suppressed until the minimum two-week history exists; a zero
  prior-week baseline is capped at 50. Supplier lead time is the rounded
  average of completed purchase orders (`receivedAt − orderedAt`) and uses
  the same day thresholds in the opposite direction: longer lead time is
  more urgent. Missing components contribute a conservative zero and retain
  an explicit reason in their evidence. A freshness date comes from the
  latest inventory count, or the latest purchase order when no count exists.
  These are implementation defaults until `MET-08` centralizes tuning.
- **Data Sufficiency (0–100)** *(called "Confidence" in earlier drafts of
  this architecture — see the naming note in `mvp-scope-and-decisions.md`)*:
  calculated from weeks of transaction data, purchase data completeness,
  and pattern consistency. Higher = more trustworthy pattern.

`MET-04` calculates Data Sufficiency with four separately retained
components: history coverage (45%), purchase-week coverage (25%),
inventory-snapshot coverage (15%), and transaction-week continuity (15%).
History reaches its maximum at the configurable four-week prediction gate.
The continuity component is intentionally a conservative weekly-coverage
proxy until a richer seasonal pattern model exists. The score is ranking
input only; it is never labelled or presented as confidence. Observations
remain eligible with any transaction history, trend analysis requires two
weeks, and predictive reorder recommendations require four weeks.

**Extending the formula:** to add a new dimension (e.g. seasonality, staff
capacity), define its 0–100 score calculation, assign it a weight, and
proportionally rebalance all existing weights against the new total. See
the worked example (adding a 0.15-weight "Seasonality" dimension) in
`mvp-scope-and-decisions.md`.

`MET-07` applies this formula with exact decimal-string arithmetic. The
default low-impact floor is `0`, so the dashboard selects the five highest
scoring items whenever at least five items have all three calculated ranking
dimensions; items below a configured floor or missing any required dimension
are suppressed. Ranking compares the unrounded weighted mean, then breaks an
exact score tie by higher Impact and finally by ascending canonical item ID.
The displayed rank score is rounded half-up to two decimal places. This keeps
the selection deterministic without presenting a floating-point calculation
as evidence.

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
the data requirement and the number of transaction weeks needed. `MET-11`
stores this as an `insufficient-history` finding.

**Partial data — no prices** (e.g. POs uploaded without unit costs): can
calculate order counts and sell-through; cannot calculate dollar impact;
frame recommendations in units, not dollars ("you ordered 5 salmon, sold
0"). `MET-11` records the missing unit-cost requirement and where to supply
it.

**Conflicting data** (e.g. POs say 5 units ordered, inventory says 0
on-hand, transactions say 2 sold — 3 units unaccounted for): surface the
observation plainly ("you have a variance: 3 units unaccounted for"),
offer possible explanations (waste, theft, data error), but don't assume
which one is correct. `MET-11` promotes each material snapshot-versus-
inferred variance to its own finding.

**Seasonal items** (e.g. asking about eggnog in May): acknowledge
seasonality ("this is typically a winter item"), still show data if
available ("you have 2 cases on-hand from Q4"), offer an explanation
("this may be old inventory; consider liquidating"). `MET-11` identifies
seasonal month patterns from imported sales and labels the observation as
uncertain.

### Tuning & configuration

Weights and thresholds are stored in the validated server-side metrics
configuration, not scattered through the metric functions. The defaults are
the values below; deployments may override any leaf value with the JSON in
`PANTRYIQ_METRICS_CONFIG`. The process fails at startup if weight totals,
threshold ordering, numeric types, or unknown keys are invalid.

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

The implementation also centralizes impact-category weights and unit/dollar
scales, urgency component weights and history windows, the four Data
Sufficiency component weights and prediction gate, spoilage's seven-day
fallback window and 20% material-variance threshold, and the dashboard's
five-item limit. `METRICS_CONFIG` is the only default source consumed by
`MET-03` through `MET-07`; function-level options remain a deliberate seam
for deterministic tests and future internal tuning.

For example, a deployment can change ranking emphasis without a code change:

```json
{
  "ranking": {
    "weights": { "impact": "0.70", "urgency": "0.20", "dataSufficiency": "0.10" }
  }
}
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
