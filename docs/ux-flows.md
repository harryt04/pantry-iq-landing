# PantryIQ — UX Flows

This document covers the mechanical, step-by-step UX for each MVP page.
For page *purpose*, product intent, and scope rules, see
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md) — that document
is authoritative on what each page is for and why. This document is
authoritative on how each flow actually works, step by step.

Data model referenced throughout (transactions, purchase orders,
inventory items, etc.) is defined in
[`architecture-and-data-model.md`](architecture-and-data-model.md).

## Dashboard: first-load experience

- If insufficient data (fewer than 7 days of transactions): show a data
  sufficiency prompt — "We need at least 7 days of transaction data to
  provide accurate insights," a link to Import, and a progress indicator
  ("you have X days of data, Y more days needed").
- If sufficient data: proceed to the main dashboard.

> The 7-day threshold is a v2-era placeholder, not confirmed. See
> `open-questions.md` for the data-sufficiency-threshold question.

Dashboard content themes (exact widget layout is intentionally left open
pending beta feedback):
- **Wallet impact summary** (top priority) — estimated current spoilage
  (money lost this week), money at risk (forecast if trends continue),
  margin trend (improving/declining vs. last week).
- **Top recommendations** — ranked per the scoring formula in
  `mvp-scope-and-decisions.md`; each includes action, financial impact,
  evidence, confidence/data-sufficiency level, and time horizon. Clicking
  one can expand details or open a chat conversation pre-loaded with that
  context.
- **Item deep dives** (structure TBD) — top-selling items by revenue,
  items at spoilage risk, low-margin items.

Tone: executive financial and operational view, focused on the owner's
wallet and actionable opportunities.

## Chat: interaction model

The chat page is the main AI interaction surface. The user asks questions
about their imported data and gets grounded, reasoned answers, primarily
about inventory analysis, spoilage analysis, and purchasing guidance, but
able to answer any question groundable in imported data.

**Example turn:**
> User: "Why is my lobster sell-through so low?"

AI processing (internal to the response, not shown step-by-step to the
user): queries transaction history, inventory data, and purchase orders
(internal database only — no external APIs in MVP), analyzes trends and
patterns, formulates an answer.

AI response includes: a natural conversational answer with clear
explanation; evidence (e.g. "you sold 2 lbs this week vs. 8 lbs last
week"); potential causes (price change, event, seasonal, competitor
action); a recommendation for action, if applicable.

**Confidence and reasoning:** every answer states a confidence level
(high/medium/low). "Show reasoning" / "explain your work" expands to show
what data was queried, what assumptions were made (shelf life, par
levels, etc.), and the step-by-step logic to the conclusion.

**If the AI cannot answer:** it admits insufficient data or capability,
and suggests a related question it *can* answer — e.g. "I can't determine
if your supplier pricing changed, but I can show you which items have
declining margins."

**Conversational memory:** chat maintains history across multiple
questions within a session; the user can ask follow-ups that reference
previous answers. Context does not persist across sessions in the MVP.

**User challenge / assumption override:**
1. User challenges a recommendation: "I don't think my spoilage is that high."
2. AI retraces its steps and shows its assumptions: "I assumed lobster
   lasts 3 days. If you know it lasts longer, adjust this and I'll
   recalculate."
3. User can temporarily override assumptions (shelf life, par levels,
   costs) mid-conversation.
4. AI recalculates and shows the updated recommendation.
5. Overrides don't persist by default — the user must edit Settings for a
   permanent change, or explicitly choose to save the override (see the
   assumption-override workflow in `mvp-scope-and-decisions.md`).

**Implementation notes:** queries happen silently in the background (no
step-by-step loading indicators shown to the user); the response is
built from structured data internally but presented as natural
conversational text; "show evidence" sections are collapsible so detail
doesn't overwhelm the primary response.

## Import: full flow

Three supported import types: transactions, purchase orders, inventory
snapshots.

### Step 1 — Location selection
User selects which location this data belongs to: "Import data for:
[Downtown Location]."

### Step 2 — File upload
User selects the import type (Transactions / Purchase Orders /
Inventory) and uploads a CSV file.

### Step 3 — Column mapping
The system maps the file's columns to canonical database fields.

**Happy path (confidence ≥ 85%):**
1. System attempts auto-detection based on historical mappings for this
   user/location, and cross-customer patterns (e.g. "other Toast users
   map column X to field Y").
2. If all columns match with high confidence, show: "All columns matched.
   Ready to import?"
3. User clicks Import; process continues to item matching (Step 4).

**Uncertain mapping path (confidence 50–85%):**
1. For each uncertain column, show one at a time: the column name, 3–5
   example values from that column, a dropdown of possible canonical
   fields to map it to, and a "skip this column" option.
2. User resolves columns one at a time.
3. Once all are resolved, system asks "Ready to import?"
4. User clicks Import; process continues to item matching.

Field mapping targets: for transactions —
`transactedAt`, `rawItemName`, `qty`, `totalRevenue`, `totalCost`,
`category`, etc.; for purchase orders — `orderedAt`, `receivedAt`,
`rawItemName`, `qty`, `unitCost`, `supplierName`, etc.; for inventory —
`rawItemName`, `qty`, `category`, `unit`, `shelfLifeDays`, etc. A column
can always be skipped entirely.

**Mapping persistence:** after a successful import, the column→field
mapping is saved to CSV Upload History; future uploads from the same
source/location automatically reuse it, and the user can always manually
adjust it.

### Step 4 — Item name resolution
The system links each `rawItemName` to a canonical inventory item.

**Matching rule: exact string match only, no fuzzy matching.** If
`rawItemName` = "Lobster Mac & Cheese" and a canonical item exists with
that exact name, it links automatically. Known substitutions/customizations
(e.g. "no tomatoes", "extra sauce") are stripped before matching — the
canonical item is the base menu item, not the customization. If no exact
match exists, the item is **unmatched** and must be resolved before
import can proceed.

**Unmatched item resolution (one at a time):**
1. System presents the first unmatched item: the raw name from the file
   (e.g. "Lobster Pasta"), 3–5 example values from that column for
   context, a search box to find an existing canonical item, and an
   option to create a new one.
2. User either selects an existing item ("this matches 'Lobster Mac'") or
   creates a new one ("this is new, call it 'Lobster Pasta'").
3. System moves to the next unmatched item.
4. Once all are resolved, import proceeds.

**Canonical item creation:** when creating a new item during import, the
user provides canonical name (internal, immutable, used for
deduplication), display name (what appears in the UI, editable later),
category (optional), and unit (optional). The system auto-suggests shelf
life based on category (e.g. lobster → 3 days, pasta → 30 days) — the
user can override.

### Step 5 — Import confirmation
1. System shows: "Ready to import X rows from [filename]."
2. Summary: "Y new items will be created. Z items will be linked to
   existing records."
3. User clicks Import.
4. System imports into the appropriate table.
5. On success: "Imported X rows. Y new items created."
6. Return to the appropriate next step — Dashboard if there's now
   sufficient data, or a prompt for more imports if not.

Every import is logged to CSV Upload History for the audit trail
(filename, import type, rows imported, mapping used, unmatched items
resolved, timestamp).

### Appendix: canonical item lifecycle example

1. User imports a transaction CSV from a Square export. Column `Item
   Description` maps to `rawItemName`. File contains "Lobster Mac &
   Cheese", "Crab Bisque", "Caesar Salad."
2. System creates three canonical items, each with an auto-suggested
   category and shelf life (e.g. Lobster Mac & Cheese → Entrée, 3 days;
   Crab Bisque → Soup, 2 days; Caesar Salad → Salad, 1 day).
3. User edits items in Settings: renames "Lobster Mac & Cheese" display
   name to "Lobster Pasta" (their preferred name), adjusts Crab Bisque's
   shelf life to 1 day (knows it spoils faster than the default).
4. User imports a second CSV from a PO supplier, containing "Lobster Mac
   & Cheese", "Crab Bisque", "Caesar Salad", "Pasta Primavera." The first
   three match exactly to existing items; "Pasta Primavera" is unmatched,
   so the user creates a new item for it.
5. Dashboard and Chat use `displayName` — the user sees "Lobster Pasta"
   everywhere in reports, recommendations, and chat, while the system
   still uses `canonicalName` internally for deduplication.
6. User tells Chat "I threw away 5 lbs of Caesar salad today, it was
   brown at the edges." The AI acknowledges and updates the spoilage
   calculation; the shelf life assumption may be challenged or confirmed
   by the user as a result.

## Donation: flow

Added 2026-08-07 when donation entered MVP scope. **This is deliberately
thinner than the flows above.** The import and chat flows describe
decisions that were actually made; this one describes only what the
founder confirmed, plus the steps that follow unavoidably from it. Where a
step below would require inventing a decision, it says so instead.

Page purposes are in
[`mvp-scope-and-decisions.md`](mvp-scope-and-decisions.md); the open
questions are in [`open-questions.md`](open-questions.md) §3 and there are
a lot of them.

### Operator side — creating an offer

1. **Entry point.** Either a dashboard recommendation for at-risk stock
   ("Offer to a shelter"), or the Donate page directly. When entered from
   a recommendation, the item, quantity, and estimated value prefill.
2. **Describe the food.** Description, quantity and unit, prepared vs.
   raw, allergens. Prepared and raw are asked separately because
   recipients register different acceptance for each.
3. **Set a collection window.** Earliest and latest collection time.
4. **See who's nearby.** Recipients within range whose acceptance criteria
   match. *The matching radius rule is undecided.*
5. **Publish.** *Whether this broadcasts to all matching recipients at
   once, or offers in some priority order, is undecided.*
6. **On claim,** the operator sees which organisation claimed it and the
   collection time.
7. **Confirm collection.** Operator marks it collected; the donation is
   logged with weight and value. *Whether a dollar value may be shown at
   all is unresolved — see `open-questions.md` §3.4, as stating a
   deduction is tax advice.*

**If no recipients are in range**, the operator must be told plainly and
early — before they spend time describing food nobody can collect. This is
the cold-start failure mode in `open-questions.md` §3.2 and it is the most
likely way this feature disappoints its first users.

### Recipient side — claiming an offer

1. **Register.** Organisation name, type, address, whether prepared and/or
   raw food can be accepted, and any capacity limits. *Verification
   mechanism undecided.*
2. **See open offers nearby** — food type, quantity, prepared or raw,
   allergens, collection window, distance. **No dollar figures anywhere on
   this surface**, and no restaurant financial data of any kind.
3. **Claim or pass.**
4. **Collect** within the window.

**Discovery is the unsolved problem here.** A coordinator will not have
PantryIQ open when an offer with a two-hour window appears. In-app-only
alerting is a stated non-goal for the operator surface and it does not
work at all for this one. Nothing in this flow functions until that is
resolved.

### Tone

Two different registers, documented in
[`brand/voice-and-tone.md`](brand/voice-and-tone.md) §1 and §7: dollar-first
for the operator, logistics-first and never financial for the recipient.

## Settings: sections

**Account basics** — account name, primary email (linked to
authentication), company name (optional), all editable.

**Location management** — list of all locations, each showing name,
address, created date, and actions (Edit, View Dashboard, View Chat).
"+ Add New Location" creates a location ready for data import. Dashboard
and Chat operate on one location at a time (see the scope rule in
`mvp-scope-and-decisions.md`); the location picker at the top of
Dashboard/Chat switches which location is being viewed.

**Menu item management** — list of all canonical items for the current
location: display name (editable), canonical name (read-only, audit),
category (editable), unit (editable), shelf life in days (editable), cost
per unit (editable), usage count (read-only — how many times the item
appears in transactions/POs), active/inactive status (toggle), and
edit/archive actions. Changes take effect immediately but do not
retroactively recalculate historical spoilage — recalculation is opt-in
via Chat or Dashboard.

**Data management / import history** — list of all past imports for this
location (filename, import type, rows imported, import date, source
system), with drill-down into which column mapping was used and which
items were created/matched. No delete functionality in the MVP — data is
immutable for audit purposes.

## Success criteria for UX

A restaurant owner should be able to:

1. **Import data successfully** — upload transaction, PO, or inventory
   CSVs; resolve column mappings one at a time without feeling
   overwhelmed; resolve item names exactly (no fuzzy-matched data ever
   enters the system); see clear confirmation of what was imported.
2. **See financial insights** — view spoilage estimates or actual counts,
   see margin trends, identify items at risk.
3. **Get actionable recommendations** — see ranked recommendations on the
   dashboard, understand why each exists (evidence + reasoning), see
   confidence/data-sufficiency levels to decide whether to trust it.
4. **Challenge and override** — ask follow-up questions in chat, challenge
   recommendations and see the AI retrace its work, override assumptions
   mid-conversation, ask flexible questions grounded in imported data.
5. **Manage their data** — rename canonical items, adjust shelf life,
   category, and cost per item, see which items are actively used vs.
   dormant, view import history for the audit trail.
6. **Operate single-location focus** — switch between locations easily;
   dashboard and chat stay location-scoped; multiple locations can exist
   without being aggregated.
