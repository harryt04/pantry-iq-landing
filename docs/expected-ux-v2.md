# PantryIQ MVP Expected UX – v2

**Status:** Post-grilling session refinement  
**Date:** Session 2  
**Previous:** `expected-ux.md` (v1)

---

## Purpose

This document captures the refined expected user experience for the MVP, following an intensive grilling session to resolve open questions and achieve shared understanding between CTO and design/product intent.

The goal is to provide a concrete, page-by-page feature specification that can drive architecture decisions, database schema finalization, and implementation work.

---

## Core Product Intent (Confirmed)

PantryIQ should feel like a **thought partner for restaurant owners**, not an autopilot or black box.

The AI should:
- Help owners understand what is happening in their restaurant data
- Identify patterns they may not have noticed
- Recommend actions with clear reasoning and evidence
- Show confidence levels so the owner can agree, challenge, or push back
- Focus primarily on inventory, spoilage, and purchasing, while remaining flexible enough to answer other grounded questions about imported data

**The owner remains the decision-maker.** If the AI cannot show its work or explain its reasoning, the output is treated as unreliable (potential hallucination) and can be ignored.

---

## Product Wedge

The financial value prop is the ability to:
- Predict inventory needs more accurately
- Reduce spoilage
- Avoid stockouts
- Improve margins and bottom-line performance

Broader operational insights are secondary benefits.

---

## MVP UX Principles

- **Understandable to non-technical owners.** No jargon, clear language.
- **Wallet-first design.** Financial impact is surfaced before operational details.
- **Reasoning always included.** Every recommendation includes the "why."
- **Transparent confidence.** Users can see evidence and decide whether to trust a recommendation.
- **Automatic intelligence, not manual setup.** Optimize for data-driven insights without requiring extensive configuration.
- **Single-location focus.** Dashboard and chat operate on one location at a time. Multi-location aggregation is a V2 feature.
- **Flexible AI grounding.** The AI can answer questions outside inventory/spoilage if those questions can be grounded in imported data.
- **Honest uncertainty.** If the AI lacks sufficient data or capability to answer a question, it admits this and suggests a related question it *can* answer.

---

## Data Model: Canonical Import Schema

Before discussing UX, we need to define what data PantryIQ stores and how it normalizes customer imports.

### Core Entities

#### Transactions (Sales at POS)

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

#### Purchase Orders (Supplier Orders)

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

#### Purchase Order Items (Line Items on POs)

Line-item details for purchase orders.

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

#### Inventory Items (Canonical Item Master)

The canonical menu/inventory item registry. Built dynamically from imports, editable by user.

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

#### Inventory Snapshots (Point-in-Time Counts)

Optional inventory counts that allow spoilage calculation via actual counts rather than inference.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `locationId` | uuid FK | |
| `inventoryItemId` | uuid FK | |
| `countedAt` | timestamp | When this count was taken |
| `qty` | numeric | On-hand quantity at that moment |
| `source` | text | `csv`, `manual`, etc. |
| `createdAt` | timestamp | Row inserted |

#### Locations

Represents a restaurant location under an account.

| Field | Type | Purpose |
|---|---|---|
| `id` | uuid | Primary key |
| `userId` | uuid FK | Owner/account |
| `name` | text | Location name (e.g. "Downtown") |
| `address` | text (nullable) | Physical address |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

#### CSV Upload History (Audit Trail)

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

---

## Item Matching and Normalization (Critical Flow)

### Column Mapping (Import Time)

When a user uploads a CSV, the system must map the file's columns to canonical database fields.

**Happy Path:**
1. User uploads file to the Import page after selecting a location
2. System attempts auto-detection of columns based on:
   - Historical mappings from this user/location (if available)
   - Cross-customer patterns (e.g. "other Toast users map column X to field Y")
3. If all columns are matched with high confidence (≥85%), show confirmation: "All columns matched. Ready to import?"
4. User clicks "Import" and process continues to item matching

**Uncertain Mapping Path:**
1. User uploads file
2. System identifies uncertain column mappings (confidence 50-85%)
3. For each uncertain column, the system shows:
   - The column name and 3-5 example values from that column
   - A dropdown of possible canonical fields to map it to
   - A "Skip this column" option (if appropriate)
4. User resolves columns one-at-a-time
5. Once all are resolved, system asks "Ready to import?" 
6. User clicks "Import" and process continues to item matching

**Field Mapping Choices:**
- For transactions: `transactedAt`, `rawItemName`, `qty`, `totalRevenue`, `totalCost`, `category`, etc.
- For POs: `orderedAt`, `receivedAt`, `rawItemName`, `qty`, `unitCost`, `supplierName`, etc.
- For inventory: `rawItemName`, `qty`, `category`, `unit`, `shelfLifeDays`, etc.
- User can also choose to skip a column entirely

**Mapping Persistence:**
- After successful import, the column→field mapping is saved to `CSV Upload History`
- Future uploads from the same source/location automatically reuse this mapping
- User can always manually adjust the mapping if needed

---

### Item Name Matching (Import Time)

After columns are mapped, the system must match each `rawItemName` value to a canonical `inventoryItem`.

**Matching Rules:**
- **Exact string match required.** No fuzzy matching. If `rawItemName` = "Lobster Mac & Cheese" and a canonical item exists with that exact name, link it.
- **Substitution/customization filtering:** Strip known substitutions (e.g. "no tomatoes", "extra sauce") before matching. The canonical item is the base menu item, not the customization.
- If no exact match exists, the item is **unmatched** and must be resolved by the user before import can proceed.

**Unmatched Item Resolution (One-at-a-Time):**
1. System presents the first unmatched item with:
   - The raw name from the file (e.g. "Lobster Pasta")
   - 3-5 example values from that column to provide context
   - A search box to find existing canonical items
   - An option to create a new canonical item
2. User either:
   - Selects an existing item ("This matches 'Lobster Mac'")
   - Creates a new item ("This is a new item, call it 'Lobster Pasta'")
3. System moves to the next unmatched item
4. Once all unmatched items are resolved, import proceeds

**Canonical Item Creation:**
- When creating a new item during import, user provides:
  - Canonical name (internal name, immutable, used for deduplication)
  - Display name (what appears in the UI, user-friendly, editable later)
  - Category (optional, e.g. "protein", "pasta")
  - Unit (optional, e.g. "lb", "each")
- System auto-suggests shelf life based on category using AI lookup (e.g. lobster → 3 days, pasta → 30 days)
- User can override if needed

---

### Import Confirmation

After all columns and items are resolved:
1. System shows: "Ready to import X transactions from [filename]"
2. Shows a summary: "3 new items will be created. 47 items will be linked to existing records."
3. User clicks "Import"
4. System imports to the appropriate table (`transactions`, `purchase_order_items`, etc.)
5. On success: "Imported 500 rows successfully. 3 new items created." 
6. Return to the appropriate next page (Dashboard if sufficient data; Data Import prompt if more imports needed)

---

## Expected MVP Pages

### 1. Dashboard Page

**Primary Purpose:**
Answer the restaurant owner's core operational questions:
- What am I losing now?
- What is about to hit me?
- What should I act on first?
- Why is this happening?

**First-Load Experience:**
- If insufficient data (< 7 days of transactions): Show a **data sufficiency prompt**
  - "We need at least 7 days of transaction data to provide accurate insights."
  - "Import your transaction data to get started." (Link to Import page)
  - Show a progress bar: "You have X days of data, Y more days needed"
- If sufficient data: Proceed to main dashboard

**Dashboard Structure:**
The exact widgets and layout are **TBD pending beta user feedback**, but the intended content themes are:

- **Wallet Impact Summary** (top priority)
  - Estimated current spoilage (money lost this week)
  - Money at risk (forecast of potential losses if trends continue)
  - Margin trend (are margins improving or declining this week vs. last week)

- **Top Recommendations** (ranked by confidence × impact × urgency)
  - Shows top 5-10 actionable recommendations
  - Each includes: action, financial impact, evidence, confidence level, and time horizon
  - Clicking a recommendation may open more details or trigger a chat conversation

- **Item Deep Dives** (structure TBD)
  - Top-selling items by revenue
  - Items at spoilage risk
  - Low-margin items
  - Exact content pending user feedback

**Dashboard Tone:**
Executive financial and operational view focused on the owner's wallet and actionable opportunities.

---

### 2. Chat Page

**Primary Purpose:**
The main AI interaction surface. The owner asks questions about their imported data and receives grounded, reasoned answers.

**Expected Chat Behavior:**

The chat should accept a wide range of questions grounded in imported data. Primary focus:
- Inventory analysis (sell-through, stock levels, trends)
- Spoilage analysis (estimated losses, risk factors)
- Purchasing guidance (order recommendations, supplier analysis)
- General grounded questions (any question answerable from transaction/PO/inventory data)

**Chat Interaction Model:**

**User asks a question:**
> "Why is my lobster sell-through so low?"

**AI processes:**
1. Queries transaction history, inventory data, and POs (internal database only, no external APIs in MVP)
2. Analyzes trends and patterns
3. Formulates an answer

**AI responds with:**
- A natural conversational answer with clear explanation
- Evidence (e.g. "You sold 2 lbs this week vs. 8 lbs last week")
- Potential causes (price change, event, seasonal, competitor action, etc.)
- Recommendation for action if applicable

**Confidence and Reasoning:**
- Answer includes confidence level (high/medium/low)
- User can click "Show reasoning" or "Explain your work" to expand and see:
  - What data was queried
  - What assumptions were made (shelf life, par levels, etc.)
  - Step-by-step logic leading to the conclusion

**If AI cannot answer:**
- AI admits insufficient data or insufficient capability to answer accurately
- Suggests a related question it *can* answer (e.g. "I can't determine if your supplier pricing changed, but I can show you which items have declining margins")

**Conversational Memory:**
- Chat maintains conversation history across multiple questions
- User can ask follow-up questions (e.g. "Should I order more?") that reference previous answers
- Context persists within a session

**User Challenge / Assumption Override:**
- User can challenge a recommendation: "I don't think my spoilage is that high"
- AI retraces its steps and shows its assumptions: "I assumed lobster lasts 3 days. If you know it lasts longer, adjust this and I'll recalculate"
- User can temporarily override assumptions (shelf life, par levels, costs) mid-conversation
- AI recalculates and shows updated recommendation
- Overrides don't permanently change settings; user must edit in Settings page for persistence

**Implementation Notes:**
- Queries happen silently in the background (no step-by-step loading indicators)
- Response uses structured data internally but presents as natural conversational text
- Collapsible "Show Evidence" sections provide detail without overwhelming the primary response

---

### 3. Import Data Page

**Primary Purpose:**
Normalize customer source data into canonical internal database shapes so the rest of the product can work with consistent, clean data.

**Supported Import Types:**
- Transactions (sales history from POS)
- Purchase Orders (supplier orders)
- Inventory Snapshots (point-in-time counts)

**Import Flow:**

**Step 1: Location Selection**
- User selects which location this data belongs to (dropdown of their locations)
- "Import data for: [Downtown Location]"

**Step 2: File Upload**
- User selects import type: "Transactions", "Purchase Orders", or "Inventory"
- User uploads a CSV file

**Step 3: Column Mapping (If Needed)**
- System attempts auto-detection based on historical mappings or cross-customer patterns
- If all columns are high-confidence matches (≥85%):
  - Show: "All columns detected. Ready to import? [Review Mapping] [Import]"
- If uncertain mappings exist (50-85% confidence):
  - For each uncertain column, show one-at-a-time:
    - Column name and 3-5 example values
    - Dropdown of canonical fields to map to
    - "Skip this column" option
  - After resolving all, show confirmation

**Step 4: Item Name Resolution (If Needed)**
- System attempts exact-match linking of `rawItemName` to existing canonical items
- For each unmatched item, show one-at-a-time:
  - Raw name from file (e.g. "Lobster Pasta")
  - 3-5 example values for context
  - Search box to find existing canonical item
  - Option to create new canonical item
  - If creating new, user enters canonical name, display name, category, unit, and shelf life (auto-suggested)
- After resolving all, show confirmation

**Step 5: Import Confirmation**
- System shows: "Ready to import X rows from [filename]"
- Summary: "Y new items will be created. Z items will be linked to existing records."
- User clicks "Import"
- On success: "Imported X rows. Y new items created." (Return to Dashboard or prompt for more imports)

**Import History:**
- After import, row is saved to `CSV Upload History` for audit trail
- Next time user uploads from the same source, column mapping is reused automatically

---

### 4. Settings Page

**Primary Purpose:**
Manage account, locations, and business configuration required for the app to function.

**Settings Sections:**

#### Account Basics
- Account name (editable)
- Primary email (editable, linked to authentication)
- Company name (editable, optional)

#### Location Management
- List of all locations for this account
- For each location:
  - Location name
  - Address
  - Created date
  - Actions: Edit, View Dashboard, View Chat (context switcher)
- Button: "+ Add New Location"
  - User enters: location name, address
  - Location is created and ready for data import

**Note:** Dashboard and Chat operate on one location at a time. Multi-location aggregation is a V2 feature. The location picker at the top of Dashboard/Chat lets the user switch which location they're viewing.

#### Menu Item Management
- List of all canonical items for the current location
- For each item:
  - Display name (editable)
  - Canonical name (read-only, for audit)
  - Category (editable)
  - Unit (editable)
  - Shelf life (editable, in days)
  - Cost per unit (editable)
  - Usage count (read-only, shows how many times item appears in transactions/POs)
  - Status: Active / Inactive (toggle)
  - Actions: Edit, Delete (or archive)
- User can rename items, adjust shelf life, change cost estimates, archive inactive items
- Changes take effect immediately but don't retroactively recalculate historical spoilage (recalculation is opt-in via Chat or Dashboard)

#### Data Management / Import History
- List of all past imports for this location
  - Filename, import type (Transactions/PO/Inventory), rows imported, import date, source system
  - User can view details: which column mapping was used, which items were created/matched
  - No delete functionality in MVP (data is immutable for audit purposes)

---

## Recommendations Engine

**What is a Recommendation?**

A recommendation consists of:
- **Action:** Clear directive (e.g. "Push lobster specials tonight")
- **Financial Impact:** Expected savings or revenue upside (e.g. "Reduce spoilage by ~$50 this week")
- **Evidence:** Supporting data (e.g. "Sell-through is 40% below average, stock on hand is 8 lbs, shelf life is 3 days")
- **Confidence:** Low/Medium/High (represents certainty of the analysis)
- **Time Horizon:** When to act (today, this week, this month)

**Recommendation Ranking:**

Recommendations are ranked by a composite score:
```
score = confidence × impact × urgency_weight
```

Where:
- `confidence` = 0.0 to 1.0 (high-confidence recommendations score higher)
- `impact` = estimated financial impact (savings or upside, in dollars)
- `urgency_weight` = time-based multiplier (today > this week > this month)

Result: high-confidence, high-impact, urgent actions surface first.

**Where Recommendations Appear:**

1. **Dashboard:** Top 5-10 recommendations ranked by score
   - User sees the most critical actions at a glance
   - Clicking a recommendation can expand details or trigger a chat conversation
2. **Chat:** On-demand generation
   - User asks "What should I do about lobster?" 
   - AI generates recommendations for that specific item, ranked by score
   - User can challenge recommendations or ask follow-ups

---

## AI / Data Query Layer

The MVP AI layer should support:

**Data Access:**
- Query transaction history (by item, date range, location)
- Query inventory levels and snapshots
- Query purchase order history
- Query canonical item metadata (shelf life, category, cost)
- Calculate derived metrics: spoilage, margin, sell-through, par level vs. actual

**Analysis Capabilities:**
- Trend detection (are sales increasing/decreasing for an item)
- Anomaly detection (is this week unusual compared to historical average)
- Spoilage calculation (via PO + transaction math, or via inventory snapshots)
- Margin analysis (revenue vs. cost trends)
- Pattern recognition (e.g. lobster sells better on Fridays)

**Constraint: Honest Uncertainty**
- If the AI cannot answer a question, it admits this
- If asked to show its work and it cannot retrace its reasoning, the output is treated as unreliable (potential hallucination)
- User is always empowered to disregard an analysis that cannot be justified with data

**Implementation:**
- Query language: internal database queries (SQL or ORM-based), no external APIs in MVP
- Response format: structured data that can be presented naturally in chat or as dashboard widgets
- Reasoning trail: every answer should be traceable to specific data queries and transformations

---

## Success Criteria for MVP UX

The MVP UX succeeds if a restaurant owner can:

1. **Import data successfully**
   - Upload transaction, PO, or inventory CSVs
   - Resolve column mappings one-at-a-time (not overwhelming)
   - Resolve item names exactly (no fuzzy-matched data in the system)
   - See confirmation of what was imported

2. **See financial insights**
   - View spoilage estimates or actual counts
   - See margin trends
   - Identify items at risk

3. **Get actionable recommendations**
   - See ranked recommendations on the dashboard
   - Understand why each recommendation exists (evidence + reasoning)
   - See confidence levels so they can decide whether to trust it

4. **Challenge and override**
   - Ask follow-up questions in chat
   - Challenge recommendations and see AI retrace its work
   - Override assumptions (shelf life, costs) mid-conversation
   - Ask flexible questions grounded in imported data

5. **Manage their data**
   - Rename canonical items to match their preferred nomenclature
   - Adjust shelf life, category, costs for each item
   - See which items are actively used vs. dormant
   - View import history for audit trail

6. **Operate single-location focus**
   - Switch between locations easily
   - Dashboard and chat are location-scoped
   - Multiple locations can be set up but aren't aggregated in V1

---

## Non-Goals for MVP

Explicitly deferred to V2 or later:

- Multi-location dashboard aggregation or cross-location insights
- External integrations (Square, Toast, Shopify APIs) — CSV import only
- Webhooks or outbound notifications
- Public REST API or GraphQL API
- External MCP server access for third-party tools
- Sophisticated onboarding or guided setup flows
- Highly customized billing or pricing logic
- Inventory execution (placing actual POs, fulfilling orders)
- Advanced audit/reanalysis workflows for raw uploaded files
- Real-time inventory sync with POS systems
- Mobile-optimized UI (web-first MVP)

---

## Data Model Dependencies

The UX as described depends on the following database schema:

**Required Tables:**
- `locations` (with userId FK)
- `transactions` (with locationId, menuItemId FKs)
- `purchase_orders` (with locationId FK)
- `purchase_order_items` (with purchaseOrderId, inventoryItemId FKs)
- `inventory_items` (with locationId FK, canonicalName, displayName, shelfLifeDays)
- `inventory_snapshots` (with locationId, inventoryItemId FKs)
- `csv_upload_history` (with locationId FK, metadata about mappings and imports)

**Indices:**
- `transactions(locationId, transactedAt)` — for time-range queries
- `transactions(locationId, menuItemId)` — for item-level analysis
- `purchase_order_items(locationId, inventoryItemId)` — for PO analysis
- `inventory_snapshots(locationId, countedAt)` — for spoilage time-series
- `inventory_items(locationId, canonicalName)` — for deduplication

---

## Open Questions / TBD

The following require refinement or user feedback to finalize:

1. **Dashboard widgets (exact content):** Pending beta user feedback. Scope is TBD but should foreground wallet impact.
2. **Recommendation scoring weights:** `urgency_weight` multipliers need tuning based on real user data.
3. **Shelf life defaults by category:** Need to determine sensible defaults (e.g. "seafood" → 3 days) and source (AI lookup, lookup table, or hardcoded).
4. **Data sufficiency threshold:** Is 7 days of transaction data enough, or should it be adjusted?
5. **Confidence scoring methodology:** How to compute confidence (0.0-1.0) for each analysis or recommendation?
6. **Spoilage calculation methods:** Prioritize PO+transaction math vs. inventory snapshots? How to handle discrepancies?
7. **Item category taxonomy:** Should there be a fixed list of categories, or free-form user-defined categories?

---

## Next Steps

1. **Finalize database schema** based on this spec and the entities outlined above
2. **Run beta interviews** to validate dashboard content and recommendation types
3. **Build Import flow** (column mapping, item matching, one-at-a-time UX)
4. **Build Settings page** (location and item master management)
5. **Build Chat page** (query layer, response formatting, reasoning trails)
6. **Build Dashboard** (pending widget refinement from beta feedback)
7. **Document AI/recommendation scoring logic** in a separate technical specification
8. **Plan and implement tests** for column mapping accuracy, item matching, and recommendation ranking

---

## Appendix: Canonical Item Lifecycle

**Example Flow:**

1. **User imports first transaction CSV from Square export**
   - Column: `Item Description` → Maps to `rawItemName`
   - File contains: "Lobster Mac & Cheese", "Crab Bisque", "Caesar Salad"

2. **System creates three canonical items**
   - Item 1: canonicalName="Lobster Mac & Cheese", displayName="Lobster Mac & Cheese", category="Entrée", shelfLifeDays=3
   - Item 2: canonicalName="Crab Bisque", displayName="Crab Bisque", category="Soup", shelfLifeDays=2
   - Item 3: canonicalName="Caesar Salad", displayName="Caesar Salad", category="Salad", shelfLifeDays=1

3. **User edits items in Settings**
   - Renames Item 1 displayName to "Lobster Pasta" (favorite name)
   - Adjusts Item 2 shelf life to 1 day (knows bisque spoils faster than default)

4. **User imports second CSV from PO supplier**
   - PO contains: "Lobster Mac & Cheese", "Crab Bisque", "Caesar Salad", "Pasta Primavera"
   - First three match exactly to existing items
   - "Pasta Primavera" is unmatched
   - User creates new item: canonicalName="Pasta Primavera", displayName="Pasta Primavera"

5. **Dashboard and Chat use displayName**
   - User sees "Lobster Pasta" (their preferred name) in reports, recommendations, chat
   - Internally, system still uses canonicalName for deduplication

6. **User marks Item 3 (Caesar Salad) as spoiled in Chat**
   - "I threw away 5 lbs of Caesar salad today, it was brown at the edges"
   - AI acknowledges and updates spoilage calculation
   - Shelf life assumption may be challenged or confirmed by user

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | Session 1 | Initial handoff document, high-level intent and open questions |
| v2 | Session 2 | Post-grilling refinement, detailed page-by-page UX, canonical data model, import flow details |
