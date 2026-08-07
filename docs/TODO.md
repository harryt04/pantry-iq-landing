# PantryIQ MVP – What's Not Built Yet

**Status:** Work remaining for feature completeness and beyond MVP  
**Date:** 2026-08-07  
**Scope:** MVP gaps + Phase 2+ roadmap features

---

## MVP Gaps (Blocking Beta Launch)

These are incomplete features mentioned in the MVP spec or MVP decision ledger that are not yet ready for users.

### 1. Square Disconnect Workflow

**Status:** TODO (code comment exists)  
**Priority:** Medium (for beta users with integration regrets)  
**Description:**
- Users can connect to Square via OAuth
- No way to revoke the connection or disconnect
- Need endpoint to delete `pos_connections` record and invalidate token

**Work Required:**
- [ ] Add `DELETE /api/square/disconnect` endpoint
- [ ] Validate token is revoked before deletion
- [ ] Clear sync state after disconnect
- [ ] UI button in settings to trigger disconnect
- [ ] Confirmation dialog to prevent accidents
- **Location:** `components/import/square-connect.tsx` (line TODO comment)

---

### 2. Recommendation Persistence

**Status:** Scaffolded but not wired  
**Priority:** High (dashboard shows recommendations, but they're not saved)  
**Description:**
- Recommendations are generated in-memory but not persisted to DB
- `recommendations` table exists but has no INSERT logic
- Dashboard may be showing recommendations from a different source or not at all

**Work Required:**
- [ ] After recommendation engine generates scores, persist to `recommendations` table
- [ ] Store: location_id, item_id, recommendation_type, impact, urgency, confidence, action, evidence
- [ ] Track when recommendation was generated and when it was acted upon
- [ ] Query recommendations on dashboard (top 5 by score)
- [ ] Hook up recommendation dismissal (when user acts)
- **Location:** `/lib/recommendations/engine.ts` + `db/schema/recommendations.ts`

---

### 3. Audit Event Logging

**Status:** Scaffolded but not wired  
**Priority:** Low (not MVP-critical, but good for compliance/debugging)  
**Description:**
- `audit_events` table exists but no logic writes to it
- No tracking of user actions (CSV upload, location creation, Square connect, etc.)

**Work Required:**
- [ ] Add audit logging to key actions:
  - CSV imports (upload, field mapping, sync status)
  - Square OAuth (connect, disconnect, sync)
  - Location creation/deletion
  - Conversation creation/deletion
  - Recommendation actions (dismiss, act on)
- [ ] Structured logging: user_id, action, resource_type, resource_id, timestamp, metadata
- [ ] Retention policy (keep 6+ months for compliance)
- [ ] Basic audit log viewer in settings (admin view)
- **Location:** `lib/audit/logger.ts` (create), `db/schema/audit-events.ts`

---

## MVP Features Worth Validating (Not Yet Built)

These are features mentioned in the MVP decision ledger that need user research before implementation.

### 1. Export Workflow

**Status:** Route scaffolding exists; needs implementation  
**Priority:** Medium (users may want CSV export of data)  
**Description:**
- MVP spec says: "CSV export remains an MVP trust fallback for imported and derived data"
- Route may exist but export logic is not yet complete
- Users should be able to export: transactions, recommendations, or full location data

**Work Required:**
- [ ] Implement full CSV export for transactions
- [ ] Implement export for recommendations (date, action, impact, evidence)
- [ ] Streaming response for large exports (don't buffer in memory)
- [ ] Test with realistic data sizes
- [ ] Add export link to settings
- **Location:** `app/api/export/` (check current state)

---

### 2. Waitlist Email Workflow

**Status:** Data captured, workflow incomplete  
**Priority:** Low (pre-launch only)  
**Description:**
- `/api/subscribe` endpoint captures email addresses
- `waitlist_signups` table stores entries
- No email delivery system (SendGrid, Resend, etc.)
- No campaign management

**Work Required:**
- [ ] Choose email provider (Resend recommended for simplicity)
- [ ] Implement email template for "thanks for signing up"
- [ ] Implement batch email workflow for launch notification
- [ ] Unsubscribe handling
- [ ] Analytics: track opens, clicks
- **Scope:** Pre-launch only; not critical for MVP user testing

---

## Phase 2 Features (Explicitly Deferred)

These are features mentioned in VISION.md and MVP-DECISION-LEDGER.md as Phase 2+.

### 1. Zero Real-Time Sync

**Status:** Scaffolding exists; not active  
**Priority:** High for scale (but not MVP)  
**Description:**
- Currently syncing with Square on-demand via POST
- Need real-time push from Square when transactions occur
- Requires Zero.dev integration for webhook management

**Current State:**
- Zero SDK imported and initialized in some files
- No active webhooks or event handlers
- Would enable live dashboard updates without manual sync

**Work Required:**
- [ ] Implement Zero webhook handlers for Square transaction events
- [ ] Payload validation and deduplication
- [ ] Real-time database updates (not batch inserts)
- [ ] Fallback to manual sync if webhooks fail
- [ ] Graceful degradation in dashboard (show "syncing..." state)
- **Location:** `lib/zero/` (review current scaffolding)
- **Timeline:** Phase 2A

---

### 2. POS Integrations Beyond Square

**Status:** Not started  
**Priority:** High for market fit  
**Description:**
- MVP is Square-only (plus CSV)
- Phase 2 roadmap includes: Oracle Micros, Toast, Ziosk

**Phase 2A: Oracle Micros**
- [ ] OAuth flow for Micros cloud
- [ ] Transaction sync (similar to Square)
- [ ] Works with fine-dining POS setups
- **Target Users:** Snape persona (chef at upscale restaurants)

**Phase 2A: Ziosk (Guest-Facing Terminals)**
- [ ] Ziosk API integration
- [ ] Table-level profitability analysis
- [ ] Guest feedback integration
- **Target Users:** Gastrobars, upscale casual

**Phase 2A: Toast**
- [ ] Toast API for transaction and menu data
- [ ] Menu engineering insights
- [ ] More common than Micros in mid-market
- **Target Users:** Percy persona (GMs at chain concepts)

---

### 3. Kitchen Display System (KDS) Integration

**Status:** Not started  
**Priority:** Medium (kitchen operations focus)  
**Description:**
- tokei.app integration for real-time prep analytics
- Bottleneck detection in kitchen workflows
- AI recommendations for kitchen optimization
- Waste tracking at prep level (scrap tracking)

**Work Required:**
- [ ] API integration with tokei.app
- [ ] Real-time order stream consumption
- [ ] Prep time analytics (how long does each dish take?)
- [ ] Bottleneck identification (which stations are slow?)
- [ ] Scrap/waste capture at preparation
- [ ] Dashboard widget showing kitchen efficiency
- **Target Users:** Snape persona (chef who owns waste)
- **Timeline:** Phase 2C

---

### 4. Guest Feedback & Sentiment Analysis

**Status:** Not started  
**Priority:** Low (feature creep territory)  
**Description:**
- Dinetap integration for guest feedback
- Sentiment analysis on reviews (positive vs. negative)
- Menu/service improvement recommendations
- AI-powered retention strategies

**Work Required:**
- [ ] Dinetap API integration
- [ ] Ingest feedback/review data
- [ ] Sentiment classification (support for menu item feedback)
- [ ] Correlation with sales data (do low ratings predict lower sales?)
- [ ] Retention workflow scaffolding
- **Target Users:** Harry Potter persona (multi-manager operations)
- **Timeline:** Phase 2D

---

### 5. MCP (Model Context Protocol) Server

**Status:** Scaffolding may exist; not active  
**Priority:** Medium (research opportunity)  
**Description:**
- Deploy PantryIQ as a Claude MCP server
- Restaurant operators use Claude desktop with PantryIQ context
- Enables multi-modal AI (Claude's full feature set + PantryIQ data)

**Example Use Case:**
- Operator uses Claude desktop
- Asks: "Write me a memo to my GM about this week's spoilage trends"
- Claude fetches context from MCP server, generates memo in Claude interface

**Work Required:**
- [ ] Implement MCP server spec (read/write operations over JSON-RPC)
- [ ] Expose operations: get_location_data, get_recommendations, get_transactions, etc.
- [ ] Publish to MCP registry
- [ ] Documentation for operators to install and configure
- **Timeline:** Phase 2B (exploratory)

---

## Feature Enhancements (Beyond MVP)

### 1. Advanced Dashboard Filtering

**Status:** Not started  
**Priority:** Low (MVP dashboard is functional as-is)  
**Description:**
- Date range filters (last 7 days, last month, custom)
- Item category filters
- Recommendation status filters (acted on, dismissed, pending)
- Sort by impact, urgency, or confidence

**Work Required:**
- [ ] Dashboard API accepts query parameters (date_from, date_to, category, status)
- [ ] Frontend controls for filters
- [ ] URL state persistence (shareable filtered views)
- **Timeline:** Post-MVP

---

### 2. Advanced Recommendation Tuning

**Status:** Not started  
**Priority:** Low (MVP uses fixed weights)  
**Description:**
- MVP uses fixed weights: Impact 40%, Urgency 40%, Data Sufficiency 20%
- Phase 2 could allow users to tune weights per location
- ML-learned weights based on user acceptance patterns (Phase 3+)

**Work Required:**
- [ ] Settings page for weight customization
- [ ] Per-location weight profiles
- [ ] A/B testing framework (test different weights)
- [ ] ML learning (if recommendation was acted on, was it good?)
- **Timeline:** Post-MVP (Phase 2+)

---

### 3. Benchmarking & Competitor Analysis

**Status:** Not started  
**Priority:** Low (validation research needed first)  
**Description:**
- Compare user's performance to industry benchmarks
- Spoilage % compared to "good" restaurants
- Margin % compared to restaurants of similar size/type
- Identify outlier metrics

**Work Required:**
- [ ] Build anonymized benchmark database (aggregate user data)
- [ ] Calculate percentiles (25th, 50th, 75th for spoilage, margin, etc.)
- [ ] Dashboard widget showing "you're in top 25% for margin"
- [ ] Segment benchmarks by restaurant type/size
- **Timeline:** Phase 2+ (needs data from 20+ users first)

---

### 4. Notification System

**Status:** Explicitly deferred in MVP  
**Priority:** High post-MVP (but not MVP)  
**Description:**
- MVP decision ledger: "No email, push, or webhook notifications"
- Post-MVP should support:
  - Email alerts (daily digest of top recommendations)
  - Push notifications (mobile, if app exists)
  - Webhook events (integrate with Slack, Discord, etc.)
  - Daily summary emails for hands-off owners

**Work Required:**
- [ ] Notification preference settings per location
- [ ] Email template system (daily digest, urgent alert, etc.)
- [ ] Webhook event system (recommendation_generated, spoilage_risk, etc.)
- [ ] Rate limiting to prevent notification fatigue
- [ ] Unsubscribe handling
- **Timeline:** Phase 2+ (start post-beta)

---

### 5. Multi-Location Aggregation & Comparison

**Status:** Explicitly deferred in MVP  
**Priority:** High for Dumbledore persona (but not MVP)  
**Description:**
- MVP scope: "one operation at a time"
- Phase 2 should support small-chain operators
- Dashboard showing all locations side-by-side
- Aggregated metrics and recommendations across locations
- Benchmarking locations against each other

**Work Required:**
- [ ] Aggregation queries (sum/avg across locations)
- [ ] Multi-location dashboard page
- [ ] Location performance comparison table
- [ ] Consolidated recommendation queue (all locations)
- [ ] Multi-location alerts ("Location 2 has 3x spoilage vs. Location 1")
- **Timeline:** Phase 2+ (high priority for scaling)
- **Target Users:** Albus Dumbledore persona

---

### 6. Advanced Menu Engineering

**Status:** Not started  
**Priority:** Medium (Phase 2 roadmap)  
**Description:**
- Margin analysis by dish
- Sell-through analysis by dish
- Ingredient utilization (which dishes use overlapping ingredients?)
- Menu optimization recommendations
- Seasonal menu planning

**Work Required:**
- [ ] Parse menu items from POS (Square, Toast, Micros)
- [ ] Link menu items to base ingredients
- [ ] Calculate margin per dish (revenue - COGS)
- [ ] Analyze sell-through by day/time/season
- [ ] Identify low-margin, low-sell-through items ("remove from menu?")
- [ ] Dashboard widgets for menu performance
- **Timeline:** Phase 2C+ (needs POS integrations first)
- **Target Users:** Snape persona (chef), Percy persona (GM)

---

### 7. Subscription & Payment Management

**Status:** Scaffolding exists (Stripe integration planned)  
**Priority:** High (monetization)  
**Description:**
- MVP is unpriced (for beta)
- Need tiered pricing (starter, pro, enterprise)
- Stripe integration for billing
- Invoice generation
- Usage-based pricing option (API calls, model selection)

**Work Required:**
- [ ] Define pricing tiers (TBD with market research)
- [ ] Stripe customer and subscription management
- [ ] Billing portal (manage payment methods, download invoices)
- [ ] Usage tracking (API calls, token counts)
- [ ] Meter-based billing (if applicable)
- [ ] Free trial workflow (14 days?)
- [ ] Dunning (retry failed payments)
- **Timeline:** Phase 2+ (after beta validation)

---

### 8. Data Privacy & Compliance Features

**Status:** Partial (audit logging scaffolded)  
**Priority:** Medium (B2B SaaS requirement)  
**Description:**
- GDPR compliance (data export, deletion)
- SOC 2 controls
- Row-level security policies
- Data retention policies
- IP whitelisting (for enterprise)

**Work Required:**
- [ ] Implement GDPR data export (user requests all their data)
- [ ] GDPR data deletion (right to be forgotten)
- [ ] Audit logging completion (see MVP Gaps above)
- [ ] SOC 2 Type II documentation and controls
- [ ] Encryption at rest (database, backups)
- [ ] Encryption in transit (all HTTPS, verified certificates)
- **Timeline:** Phase 2 (before enterprise sales)

---

## Known Bugs & Rough Edges

### 1. CSV Field Mapping Edge Cases

**Status:** Some edge cases not covered  
**Test File:** `/tests/unit/csv-import-pipeline.test.ts` has TODOs

**Missing Logic:**
- [ ] Hash-based deduplication (prevent same CSV imported twice)
- [ ] Better number parsing (strip commas, currency symbols)
- [ ] European number format detection (1.234,56 instead of 1,234.56)
- [ ] Batch insert optimization (current: one insert per row)

---

### 2. Real-Time Sync Fallback

**Status:** Scaffolding exists but may not be fully integrated  
**Description:**
- If Zero webhooks fail or are slow, should fall back to REST polling
- Current state unknown; needs audit

**Work Required:**
- [ ] Test webhook failure scenario
- [ ] Ensure manual sync still works as fallback
- [ ] Dashboard UX for sync state (syncing vs. synced vs. error)

---

### 3. Error Message Clarity

**Status:** Most errors are clear, but some may need refinement  
**Description:**
- CSV validation errors should tell user exactly what's wrong
- Square OAuth errors should suggest actions (reconnect, check permissions)

**Work Required:**
- [ ] Test and refine error messages for common scenarios
- [ ] Add helpful links to error messages where relevant

---

## Validation Tasks (Not Code)

These are research/validation items from the MVP decision ledger that need to happen before or during beta.

### 1. CSV-Only Onboarding Validation

**Decision:** MVP uses CSV import only (no Square required)  
**Question:** Is CSV-only acceptable for the target segment?
- [ ] Interview 3-5 beta operators
- [ ] Ask: Would you prefer Square integration, or is CSV fine?
- [ ] Measure: Time from signup to first actionable insight
- [ ] Decision: Continue CSV-first or prioritize Square?

---

### 2. Data Quality Research

**Decision:** MVP assumes users have transaction and inventory data  
**Question:** How good is the data quality in the wild?
- [ ] Interview 3-5 operators about their data practices
- [ ] Ask: Do you have reliable transaction history?
- [ ] Ask: Do you count inventory regularly?
- [ ] Ask: Are your item names standardized?
- [ ] Decision: Should we offer data cleanup services? Premium feature?

---

### 3. Pricing Validation

**Decision:** MVP is free (for beta)  
**Questions to research:**
- [ ] What price would make sense? ($99/mo? $199/mo? Per-location pricing?)
- [ ] Is usage-based pricing (per transaction) better than flat fee?
- [ ] Would small operators ($300K revenue) pay for this?
- [ ] Would bigger operators ($2M+ revenue) expect more features before paying?
- [ ] Timing: When should we introduce pricing? After 20 users? 50 users?

---

### 4. Dashboard Recommendation Acceptance

**Decision:** MVP ranks recommendations by impact, urgency, confidence  
**Question:** Do users act on recommendations?
- [ ] Track: % of recommended actions the user acts on
- [ ] Track: % of recommendations dismissed
- [ ] Interview: Why did you act/not act on this recommendation?
- [ ] Decision: Adjust ranking weights? Add different recommendation types?

---

### 5. Chat vs. Dashboard Usage

**Decision:** MVP treats chat and dashboard as equally important  
**Question:** Which surface do users prefer?
- [ ] Measure: Session time on dashboard vs. conversations
- [ ] Measure: % of users who use both vs. just one
- [ ] Interview: What drives you to chat vs. dashboard?
- [ ] Decision: Should one be primary and one secondary?

---

## Timeline Recommendations

### Immediate (Pre-Beta, This Week)
- [ ] Square Disconnect (MVP gap — small, high-value)
- [ ] Recommendation Persistence (MVP gap — larger, but critical for dashboard)
- [ ] Test and validate all workflows end-to-end

### Short-Term (During Beta, Next 2-4 Weeks)
- [ ] Audit Event Logging (good for debugging during beta)
- [ ] Export Workflow (users will ask for this)
- [ ] Run validation tasks above (CSV, data quality, pricing)

### Medium-Term (Post-MVP, Weeks 4-8)
- [ ] Zero Real-Time Sync (nicer UX, but not blocking)
- [ ] Notification System (users will request this)
- [ ] Multi-Location Aggregation (needed for Dumbledore persona)

### Long-Term (Phase 2+)
- [ ] Additional POS Integrations (Oracle Micros, Toast, Ziosk)
- [ ] Kitchen Display System integration
- [ ] Subscription & Payment Management
- [ ] Benchmarking & Competitor Analysis
- [ ] GDPR/SOC 2 Compliance Features

---

## Summary

**MVP Gaps (3 items):**
- Square Disconnect
- Recommendation Persistence
- Audit Event Logging

**Phase 2 Roadmap (7 major features):**
- Zero Real-Time Sync
- Additional POS Integrations (Micros, Toast, Ziosk)
- Kitchen Display System (tokei.app)
- Guest Feedback & Sentiment (Dinetap)
- MCP Server
- Multi-Location Aggregation
- Subscription & Payment System

**Enhancements (5+ items):**
- Advanced filtering, benchmarking, notifications, GDPR compliance, etc.

**Validation Research:**
- CSV-only acceptance, data quality, pricing, recommendation adoption, chat vs. dashboard

Total estimated effort for Phase 2 features: 3-6 months, assuming 1-2 engineers.
