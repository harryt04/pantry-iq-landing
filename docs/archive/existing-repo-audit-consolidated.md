# PantryIQ Existing Repository Audit

**Date:** 2026-05-17  
**Repository:** `/Users/harry/Documents/git/pantry-iq`

## Purpose

This document consolidates the four existing repository audit drafts into one repo snapshot. It covers:

- application pages and layouts
- API routes
- implemented feature areas
- database-backed product surface
- testing coverage
- notable risks, inconsistencies, and gaps

## Executive Summary

PantryIQ is a substantial Next.js 16 monolith for restaurant operations, data import, and AI-assisted analysis.

The current MVP clearly includes:

- a public marketing site with waitlist capture
- email/password authentication through Better Auth
- an authenticated app shell
- location management as the core tenancy boundary
- dashboard summaries
- CSV import with preview and field mapping
- Square OAuth and transaction sync scaffolding
- location-scoped AI conversations with streaming responses
- weather and donation-opportunity enrichment APIs
- PostHog analytics instrumentation
- meaningful unit and e2e coverage across core flows

This is more than a prototype, but it is not uniformly polished. The largest concerns are API consistency, uneven auth and ownership enforcement outside the core location/conversation flows, and a few likely correctness issues in import, Square, and weather behavior.

## Stack Snapshot

- Next.js 16 App Router
- React 19
- TypeScript 5 strict
- Tailwind v4 + shadcn/ui
- PostgreSQL 18 + Drizzle ORM
- Better Auth
- Vercel AI SDK with OpenAI, Anthropic, and Google providers
- Square OAuth + transaction sync
- OpenWeatherMap
- Google Places
- PostHog
- Vitest + Playwright

Common scripts used in the repo:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test`
- `npm run test:coverage`

## Application Surface

### Route Groups

- `(marketing)` for public pages
- `(auth)` for login and signup
- `(app)` for authenticated product pages

### Shared Root

- `app/layout.tsx`
  - root layout
  - global styles and metadata
  - wraps the app in `PostHogProvider`

### User-Facing Pages

- `/`
  - landing page
  - delegates to `components/landing-page.tsx`
  - includes product marketing, feature framing, pricing teaser, and waitlist submission via `POST /api/subscribe`

- `/pricing`
  - public pricing page
  - mostly static and informational

- `/login`
  - renders `components/auth/login-form.tsx`
  - email/password login through Better Auth client utilities
  - redirects to `/dashboard` on success

- `/signup`
  - renders `components/auth/signup-form.tsx`
  - email/password signup with client-side validation
  - redirects to `/dashboard` on success

- `/dashboard`
  - overview page that fetches `/api/dashboard`
  - shows total locations, total transactions, recent uploads, location overview, POS/import status, and quick actions

- `/conversations`
  - conversation list and creation surface
  - location-scoped UX through `ConversationListContainer`

- `/conversations/[id]`
  - chat thread page
  - renders `ChatInterfaceContainer`
  - fetches conversation details and history, then streams assistant responses

- `/import`
  - import hub for a selected location
  - combines location selection, Square connection, and CSV upload/mapping flow

- `/settings`
  - account summary plus location management
  - create, edit, and delete location flow

### App Shell and State Files

- `app/(marketing)/layout.tsx`
- `app/(auth)/layout.tsx`
  - auth-specific shell with centered layout and beta notice
- `app/(app)/layout.tsx`
  - authenticated shell with sidebar and header
  - current session protection is primarily client-side via `useSession()` and redirect logic
- `app/(app)/loading.tsx`
- `app/(app)/error.tsx`

### Thin or Missing Route Surface

- no `not-found.tsx` under `app/`
- no dedicated password reset route
- no explicit onboarding flow
- no dedicated billing or team-management pages

## API Route Inventory

### Auth

- `GET|POST /api/auth/[...all]`
  - Better Auth passthrough endpoint

### Locations

- `GET /api/locations`
  - authenticated list of user-owned locations

- `POST /api/locations`
  - authenticated create location endpoint
  - validates required fields such as `name` and `zipCode`

- `GET /api/locations/[id]`
  - authenticated read for a single owned location

- `PUT /api/locations/[id]`
  - authenticated update for a single owned location

- `DELETE /api/locations/[id]`
  - authenticated delete for a single owned location

### Dashboard

- `GET /api/dashboard`
  - authenticated dashboard aggregate endpoint
  - combines locations, transactions, uploads, POS connections, and conversations into one response

### Conversations

- `GET /api/conversations`
  - authenticated conversation listing across user-owned locations

- `POST /api/conversations`
  - authenticated create conversation endpoint
  - validates location ownership and optional model selection

- `GET /api/conversations/[id]`
  - authenticated fetch of one conversation

- `PATCH /api/conversations/[id]`
  - authenticated update of conversation default model

- `DELETE /api/conversations/[id]`
  - authenticated delete of one conversation

- `GET /api/conversations/[id]/history`
  - authenticated message history endpoint

- `POST /api/conversations/[id]/message`
  - authenticated streaming chat endpoint
  - persists the user message
  - builds AI context from available location data
  - streams assistant output over SSE
  - persists assistant message and token usage afterward

### CSV Import

- `POST /api/csv/upload`
  - accepts `.csv` or `.tsv`
  - parses preview rows
  - creates a `csv_uploads` record
  - stores the uploaded file temporarily

- `GET /api/csv/field-mapping`
  - reads stored upload state by `uploadId`

- `POST /api/csv/field-mapping`
  - suggests mappings or confirms/imports rows into `transactions`

### Square

- `POST /api/square/connect`
  - authenticated Square OAuth start
  - validates location ownership
  - sets OAuth state cookie

- `GET /api/square/callback`
  - authenticated Square OAuth callback
  - validates state
  - exchanges code for tokens
  - encrypts tokens
  - stores `pos_connections`
  - kicks off background sync and redirects to `/import`

- `POST /api/square/sync`
  - authenticated manual sync endpoint for an owned POS connection

### Weather, Places, and Subscribe

- `GET /api/weather/[location]`
  - weather data endpoint with cache integration

- `GET /api/places/[location]`
  - places lookup endpoint for donation opportunities

- `POST /api/subscribe`
  - public waitlist / subscription capture endpoint
  - emits analytics and forwards data externally

## Feature Map

### 1. Authentication

Core files:

- `lib/auth.ts`
- `lib/auth-client.ts`
- `app/api/auth/[...all]/route.ts`
- `db/schema/auth.ts`

What exists:

- Better Auth wired with Drizzle-backed tables
- email/password signup and login
- session-aware client hooks
- logout from the app shell
- auth-specific UI forms and error handling

Current notes:

- the `(app)` shell is protected mostly client-side today
- the login form exposes a forgot-password affordance, but there is no complete password reset flow

### 2. Location Management

Core files:

- `app/(app)/settings/page.tsx`
- `components/settings/location-form.tsx`
- `components/settings/location-list.tsx`
- `app/api/locations/route.ts`
- `app/api/locations/[id]/route.ts`
- `db/schema/locations.ts`

What exists:

- create, edit, list, and delete locations
- ownership enforcement in location APIs
- location metadata including name, type, zip code, timezone, and address fields

Role in the app:

- locations are the core tenancy boundary
- import, dashboard, and conversations all depend on locations existing first

### 3. Dashboard

Core files:

- `app/(app)/dashboard/page.tsx`
- `app/api/dashboard/route.ts`
- `components/dashboard/location-overview-card.tsx`
- `components/dashboard/import-status-card.tsx`
- `components/dashboard/quick-actions-card.tsx`

What exists:

- summary dashboard with aggregate counts
- recent CSV upload status
- location overview cards
- quick navigation into import and chat workflows

Current limitations:

- no deeper analytics, trend charts, or forecasting views
- some display behavior appears hardcoded rather than fully data-driven
- conversation selection for the dashboard appears simplistic

### 4. CSV Import Pipeline

Core files:

- `app/(app)/import/page.tsx`
- `components/import/csv-upload.tsx`
- `components/import/field-mapping-ui.tsx`
- `components/import/location-selector.tsx`
- `app/api/csv/upload/route.ts`
- `app/api/csv/field-mapping/route.ts`
- `lib/csv/parser.ts`
- `lib/csv/field-mapper.ts`
- `lib/csv/storage.ts`
- `db/schema/csv-uploads.ts`
- `db/schema/transactions.ts`

What exists:

- upload CSV or TSV files
- preview uploaded data
- suggest field mappings
- allow user confirmation of mappings
- normalize imported rows into `transactions`
- keep upload lifecycle state in `csv_uploads`

How it works:

1. select a location
2. upload a file to `/api/csv/upload`
3. preview headers and rows
4. get mapping suggestions from `/api/csv/field-mapping`
5. confirm mapping
6. import normalized records into `transactions`

Important notes:

- mapping suggestions use heuristics and can use an LLM when configured
- import is synchronous rather than backgrounded
- uploaded files are stored in `/tmp`, which is not durable or multi-instance safe
- audits consistently flagged the CSV routes for weaker auth/ownership enforcement than the rest of the app

### 5. Square Integration

Core files:

- `components/import/square-connect.tsx`
- `app/api/square/connect/route.ts`
- `app/api/square/callback/route.ts`
- `app/api/square/sync/route.ts`
- `lib/square/client.ts`
- `lib/square/sync.ts`
- `lib/square/encryption.ts`
- `db/schema/pos-connections.ts`

What exists:

- OAuth start flow
- OAuth callback handling
- token exchange and encryption
- connection persistence
- manual sync flow
- UI states for connected and sync actions

What appears incomplete or risky:

- disconnect behavior is unfinished in the UI
- recurring or scheduled sync is not obvious from the current app surface
- token refresh is not clearly wired into sync behavior
- one audit flagged the Square orders query as likely incomplete or incorrect without a `location_id` parameter

### 6. AI Conversations

Core files:

- `app/(app)/conversations/page.tsx`
- `app/(app)/conversations/[id]/page.tsx`
- `components/chat/*`
- `app/api/conversations/*`
- `lib/ai/models.ts`
- `lib/ai/providers.ts`
- `lib/ai/context-builder.ts`
- `lib/ai/prompts.ts`
- `lib/ai/stream-handler.ts`
- `db/schema/conversations.ts`
- `db/schema/messages.ts`

What exists:

- location-scoped conversations
- stored message history
- model selection per conversation
- SSE-based streamed assistant responses
- persisted assistant token and model metadata
- markdown rendering in the chat UI

How it works:

1. user creates or opens a conversation
2. client fetches conversation metadata and history
3. user sends a message to `/api/conversations/[id]/message`
4. backend builds context from available location and operational data
5. the selected model streams a response
6. assistant output is stored in `messages`

Important caveats:

- the list UI appears more location-filtered than the broader GET conversations API behavior suggests
- prompt assembly and message ordering deserve targeted review
- context-build failures may silently degrade the quality of answers instead of surfacing a clear user-facing warning
- this is context-grounded chat, not a tool-calling or agentic analytics system

### 7. Weather and Places Enrichment

Core files:

- `app/api/weather/[location]/route.ts`
- `app/api/places/[location]/route.ts`
- `lib/weather/client.ts`
- `lib/places/client.ts`
- `db/schema/weather.ts`
- `db/schema/places-cache.ts`
- `lib/ai/context-builder.ts`

What exists:

- weather lookup and caching
- donation-opportunity lookup and caching
- the ability for enrichment data to influence AI context

Current state:

- these capabilities are more visible at the API and context-builder layer than in first-class user-facing workflows
- the weather route has been flagged for using placeholder or hardcoded coordinates rather than true location-derived coordinates
- the places flow appears light on validation and returns data not always supported by the underlying API tier

### 8. Marketing, Subscribe, and Analytics

Core files:

- `components/landing-page.tsx`
- `app/(marketing)/pricing/page.tsx`
- `app/api/subscribe/route.ts`
- `providers/posthogProvider.tsx`
- `lib/analytics-utils.ts`
- `lib/posthog-server.ts`

What exists:

- marketing landing page
- pricing page
- public waitlist form
- client and server analytics plumbing through PostHog
- product-event capture in auth, import, location creation, and conversation flows

Important note:

- `waitlist_signups` exists in the schema, but the audits consistently describe `POST /api/subscribe` as forwarding externally and emitting analytics rather than clearly persisting to that table directly

## Data Model Overview

Core schema files:

- `db/schema/auth.ts`
- `db/schema/locations.ts`
- `db/schema/conversations.ts`
- `db/schema/messages.ts`
- `db/schema/csv-uploads.ts`
- `db/schema/transactions.ts`
- `db/schema/pos-connections.ts`
- `db/schema/weather.ts`
- `db/schema/places-cache.ts`
- `db/schema/waitlist-signups.ts`

Core product tables:

- Better Auth tables for users, sessions, accounts, and verifications
- `locations`
- `conversations`
- `messages`
- `csv_uploads`
- `transactions`
- `pos_connections`
- `weather`
- `places_cache`
- `waitlist_signups`

Schema shape:

- the product is location-centric and effectively multi-tenant
- user ownership flows through locations
- uploads, transactions, POS connections, and conversations hang off locations
- messages hang off conversations
- weather and places data support context enrichment

Notable schema observations from the audits:

- `locations.userId` may not have a DB-level foreign key constraint to auth users
- `transactions.date` and `weather.date` are stored as text rather than native date types
- `csv_uploads.fieldMapping` is stored as serialized text rather than structured JSONB
- `messages` may be missing an index on `conversationId`
- `places_cache` may allow duplicate cache entries for the same place over time

## Testing Coverage

### Test Infrastructure

- unit tests use Vitest + jsdom + Testing Library
- e2e tests use Playwright against `npm run dev`
- `tests/setup.ts` provides shared test initialization
- `.agents/TESTING.md` documents patterns and commands
- coverage targets focus on `lib/**/*.ts`, `app/api/**/*.ts`, and `components/**/*.tsx`
- page files and layouts are not primary Vitest coverage targets

### Stronger Coverage Areas

- locations routes
- conversations routes
- Square routes and support modules
- CSV parser, storage, field mapping, and import pipeline
- auth route wiring
- AI support modules
- error and analytics utilities
- several important UI components, including auth forms, CSV upload, field mapping UI, and dashboard cards

Representative unit files:

- `tests/unit/locations-route.test.ts`
- `tests/unit/conversations-route.test.ts`
- `tests/unit/square-routes.test.ts`
- `tests/unit/square-modules.test.ts`
- `tests/unit/csv-upload-route.test.ts`
- `tests/unit/csv-field-mapping-route.test.ts`
- `tests/unit/csv-import-pipeline.test.ts`
- `tests/unit/csv-import-integration.test.ts`
- `tests/unit/auth-route.test.ts`
- `tests/unit/ai-modules.test.ts`

### E2E Coverage Areas

Playwright coverage exists for:

- navigation and public pages
- auth flows
- dashboard flow
- settings and location CRUD
- CSV import flow
- Square import UX
- conversations and chat flow
- error handling behavior

Representative e2e files:

- `tests/e2e/navigation.spec.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/dashboard.spec.ts`
- `tests/e2e/locations.spec.ts`
- `tests/e2e/csv-import.spec.ts`
- `tests/e2e/square-import.spec.ts`
- `tests/e2e/chat.spec.ts`
- `tests/e2e/error-handling.spec.ts`

### Coverage Gaps and Weak Spots

- page and layout files are not central Vitest coverage targets
- settings components lack direct component tests
- some chat and import helper components have thinner direct coverage than their underlying APIs
- Square e2e coverage is more UI-state validation than a real full OAuth roundtrip
- weather and places are tested more as technical APIs than as meaningful user-facing flows
- chat e2e coverage has been flagged as somewhat conditional or fragile
- there is no strong signal of coverage for session expiry, concurrent session edge cases, or a real password reset flow

### Overall Testing Readout

The repo has real testing depth, especially for backend logic, import handling, and core route behavior. The main gap is uneven confidence across the stack: stronger on backend units and import logic, weaker on page-level behavior, layout behavior, and some richer client-side flows.

## Cross-Cutting Risks and Inconsistencies

### Security and Ownership Concerns

- CSV endpoints appear weaker on auth and ownership checks than the rest of the app
- weather and places endpoints do not appear to enforce location ownership
- public or lightly validated location-based endpoints may expose internal IDs too easily

### Consistency Concerns

- some APIs use `ApiError` consistently, while others return ad hoc `NextResponse.json` shapes
- Square callback uses redirect-style error handling instead of the JSON patterns used elsewhere
- conversation, dashboard, CSV, places, and history routes do not all follow one uniform error contract

### Correctness Concerns

- conversation message assembly may duplicate the current user message or mishandle ordering
- dashboard conversation selection looks simplistic and may rely on weak ordering assumptions
- weather behavior appears to use hardcoded or placeholder coordinates rather than true location data
- Square sync and token lifecycle behavior deserve review
- CSV upload and mapping state may blur the difference between captured headers and confirmed mapping state

### Infrastructure and Scalability Concerns

- CSV files are stored in `/tmp`, which is not durable and not suitable for multi-instance deployments
- some external integrations rely on in-memory or per-process behavior that will not scale cleanly
- some queries and dedup patterns appear inefficient at scale
- several list surfaces do not appear paginated

### Product Completeness Gaps

- no password reset flow
- no Square disconnect endpoint
- pricing page is mostly static rather than integrated into billing
- account settings are minimal beyond location management
- onboarding is implicit rather than explicit

## Current MVP Understanding

The repository represents a real MVP for restaurant data ingestion and AI-assisted operational analysis.

What has clearly been built:

- a public marketing site with waitlist capture
- an auth system using Better Auth
- an authenticated product shell
- location management as the core tenancy boundary
- transaction ingestion from CSV and Square
- a dashboard for operational summary state
- chat conversations grounded in stored business data
- analytics instrumentation across important flows
- supporting enrichment APIs for weather and donation opportunities

What appears partially built or rough around the edges:

- API security and ownership checks outside the core location, conversation, and Square flows
- Square lifecycle completeness
- weather and places integration into visible end-user experience
- page-level polish such as password reset, onboarding, and richer account settings
- consistency of API error contracts

What this repo most strongly resembles today:

- not just a landing page or prototype
- not yet a fully polished enterprise product
- a substantial restaurant-ops SaaS MVP with real backend, data model, import workflows, AI chat, analytics, and a meaningful automated test base

## Appendix: Route Inventory

### User-Facing Pages

- `/`
- `/pricing`
- `/login`
- `/signup`
- `/dashboard`
- `/conversations`
- `/conversations/[id]`
- `/import`
- `/settings`

### Layout and State Files

- `app/layout.tsx`
- `app/(marketing)/layout.tsx`
- `app/(auth)/layout.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/loading.tsx`
- `app/(app)/error.tsx`

### API Routes

- `/api/auth/[...all]`
- `/api/dashboard`
- `/api/locations`
- `/api/locations/[id]`
- `/api/conversations`
- `/api/conversations/[id]`
- `/api/conversations/[id]/history`
- `/api/conversations/[id]/message`
- `/api/csv/upload`
- `/api/csv/field-mapping`
- `/api/square/connect`
- `/api/square/callback`
- `/api/square/sync`
- `/api/weather/[location]`
- `/api/places/[location]`
- `/api/subscribe`
