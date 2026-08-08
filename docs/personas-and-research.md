# PantryIQ — Personas & Customer Research

This document merges three research strands that used to live in separate
files: the 10 user personas, the customer-discovery interview tooling
(screener + Mom Test guide), and the market/competitive research synthesis.

> **Important:** two unrelated hypothesis sets both use `H1`–`H10` numbering
> in the source material. They are kept in clearly separate sections here —
> **Customer Discovery Hypotheses** (Part 2) and **Market Research
> Hypotheses** (Part 3) — and should never be merged or cross-referenced by
> number alone.

---

# Part 1 — User Personas

Deep psychographic profiles of every realistic PantryIQ user type. Use
these to pressure-test UX decisions, write copy that resonates, and make
sure no user's workflow or mental model gets designed around by accident.
Each persona is a composite archetype, not a real person — a tight cluster
of real behaviors, fears, and goals.

## Character key

| Character | One-sentence summary |
|---|---|
| Ron Weasley | The scrappy owner-operator who runs on instinct, works nonstop, and needs plain-English proof before trusting a tool. |
| Minerva McGonagall | The hands-off owner who wants a crisp, trustworthy snapshot of the business without getting dragged back into operations. |
| Percy Weasley | The ambitious GM who wants data to back up decisions and make him look sharp in front of ownership. |
| Severus Snape | The exacting chef who trusts craft over software and only believes data that respects kitchen reality. |
| Kingsley Shacklebolt | The calm, capable beverage lead who wants solid variance and pour-cost proof, not generic restaurant analytics. |
| George Weasley | The scrappy, mobile owner who needs fast event forecasting and quick ROI on every order. |
| Hermione Granger | The highly analytical ghost-kitchen operator who challenges methodology and wants evidence, not fluff. |
| Albus Dumbledore | The big-picture small-chain owner who needs consolidated visibility across managers and locations. |
| Nymphadora Tonks | The flexible, event-driven operator who works in shifting conditions and needs pricing and ordering to stay nimble. |
| Harry Potter | The high-stakes owner-operator at the center of multiple moving parts who needs one trustworthy view of the whole operation. |

Personas are organized by **role** first. Establishment-type context is
woven in where it changes the psychographic profile meaningfully.

> **This list is incomplete as of 2026-08-07.** All ten personas are
> restaurant-side. Food donation became MVP scope on that date, which
> makes shelter and soup-kitchen coordinators a **second user type with no
> persona here and no research behind them** — they are not buyers, are
> not motivated by margin, and nothing in this document describes them.
>
> The discovery tooling in Part 2 has the same gap: no screener question
> and no interview question touches donation, on either side.
>
> Do not write recipient-facing product or copy from the personas below —
> they will mislead you. See `open-questions.md` §3.7.

---

## 1. Ron Weasley — The Scrappy Owner-Operator

**Archetype:** The Restaurant Is My Life

### Demographics / context
- Age: 38–52
- Establishment: Independent casual or fine dining restaurant, 40–120 covers
- Staff: 8–20 people, wears multiple hats
- Revenue: $600K–$2M/yr
- Location: Suburban strip mall or small city downtown
- Tech: Uses Square or Toast for POS, QuickBooks for accounting, Google Sheets for "inventory"

### Psychographic profile
Ron opened his restaurant because he loves food and people — not
spreadsheets. He's first in, last out. He texts suppliers at 7am. He knows
regulars by name and has a gut feeling about when lobster is moving slow —
but he can't prove it.

He operates on instinct and experience, and he's been burned before:
overordered before a slow week, ran out of a signature item on a Friday
night, watched a full case of salmon go gray in the walk-in. Each of those
moments cost him real money and he still thinks about them.

He knows his margins are bad. He suspects his spoilage is worse than he
thinks. He doesn't have time to dig into it, and even if he did, he
wouldn't know where to start.

He's skeptical of software — he's tried three inventory apps over the
years and none stuck. Too complicated, too much upfront data entry, gave
him numbers he didn't trust. He wants a tool that makes him feel like he's
getting smarter, not one that makes him feel stupid.

### A day in his life
6:45am — arrives before prep, checks the walk-in, mentally notes what
needs to move. Texts his fish supplier to push delivery to Thursday
because he still has too much halibut. 9am — reviews last night's sales on
Square, does rough math on whether he's on pace for the week. Noon — puts
out a fire with a line cook calling in sick. 3pm — tries to update his
Google Sheet inventory tracker but gives up after 10 minutes. 11pm —
closes up, makes a note to "figure out the spoilage thing" and promptly
forgets.

### Current pain points
- No reliable view of what spoilage is costing him — it's "somewhere between bad and really bad"
- Ordering is mostly gut-based; he over-orders perishables to avoid stockouts and eats the spoilage
- Can't quickly see which menu items are actually profitable vs. just popular
- Doesn't know when a trend is a trend vs. just a slow week
- Too busy to set up complex software; abandons tools that require 2+ hours of onboarding

### What he wants from a tool like this
- Plain English, with a dollar sign attached
- A clear action for today, not a report to analyze
- Ask questions in his own words without learning a dashboard
- Not feeling dumb for not knowing the data

### Skepticisms and objections
- "I've tried these tools before and they never actually help"
- "My data is a mess, I don't think this will work for me"
- "I don't have time to set this up properly"
- "I don't trust AI — it'll just make stuff up"

### How he'll use PantryIQ
Chat-first: he'll ask a specific question that's been bothering him —
"why is my fish margin so low lately?" — and judge the product entirely on
whether that first answer is useful and believable. If it shows its work,
he trusts it. Dashboard pulls him in once he trusts chat; he'll check it a
few times a week, not daily. Import is his biggest friction point — it
needs to be fast and forgiving.

### UX considerations
- Dashboard must lead with a dollar amount, not a percentage or a chart
- First recommendation on the dashboard needs to be immediately actionable
- Chat needs to feel like texting a smart advisor, not filling out a form
- Error messages and empty states need to be encouraging, not clinical
- Import flow must be forgiving — guide him one step at a time if a column doesn't map

### Marketing angle
**What lands:** "Know exactly what your kitchen is costing you — without
living in a spreadsheet." Dollar-first language. Time-saving framing.
Testimonials from other owner-operators who felt the same skepticism.

**What turns him off:** Technical jargon. Vague "AI-powered" promises.
Enterprise-looking software. Anything implying he needs to change how he
runs his kitchen.

---

## 2. Minerva McGonagall — The Hands-Off Owner

**Archetype:** I Own It, Someone Else Runs It

### Demographics / context
- Age: 45–65
- Establishment: 1–3 locations, established restaurant or bar, higher revenue
- Staff: Has a GM or kitchen manager; not in the kitchen daily
- Revenue: $1.5M–$5M/yr
- Location: Established market, may have opened 10+ years ago
- Tech: Comfortable with email and basic reports; delegates software decisions to GM

### Psychographic profile
McGonagall owns the business but runs it at arm's length. She might have
another job or business. She checks numbers weekly or monthly, not daily.
She trusts her GM to run operations and her accountant to watch the books.

What she cares about: is the business healthy? Are margins trending the
right direction? Is her GM telling her the truth? She often suspects
things are better or worse than she's being told but doesn't have an
independent view into operations.

She doesn't want to become an operator again. She wants better visibility,
not more work — a dashboard that shows her the state of the business in
five minutes is worth more to her than a sophisticated tool that requires
daily engagement. Her biggest fear is a slow bleed — spoilage, theft, or
margin erosion nobody caught until the P&L told the story three months
later.

### A day in her life
Monday morning — opens her email, looks for anything urgent from her GM.
Checks QuickBooks once a week. Has a standing 30-minute call with her GM
on Tuesdays. Once a month, reviews the full P&L with her accountant and
asks questions she doesn't always get clear answers to. She suspects her
bar margins are worse than reported.

### Current pain points
- No independent view into operations — relies entirely on her GM for the story
- P&L arrives too late to act on trends (monthly, not weekly)
- Doesn't know if spoilage numbers in reports are accurate or just what her GM thinks she wants to hear
- Feels out of the loop without wanting to micromanage

### What she wants from a tool like this
- A clean, honest summary of the financial health of her restaurant
- Visibility into trends over time — is this month better or worse than last month, and why?
- Something checkable in 5 minutes that flags a problem worth asking about
- Independence from her GM's framing of the data

### Skepticisms and objections
- "My GM already handles this"
- "I'm not going to be the one entering data into this thing"
- "Will this actually integrate with how we already work?"

### How she'll use PantryIQ
Dashboard-primary — probably on desktop, probably on a Monday morning. May
occasionally use Chat for a high-level question ("How are margins trending
this quarter?") but she's not a power user. She may set up the account and
delegate data imports to her GM, so import needs to work for someone who
isn't the account owner.

### UX considerations
- Dashboard must be readable in one pass — no drilling required for the key insight
- Summary metrics at the top are essential: "this week vs. last week, this month vs. last month"
- Margin trend visualization matters more to her than per-item detail
- Tone should feel like an executive brief, not a kitchen ops tool

### Marketing angle
**What lands:** "Finally, an independent view into your restaurant's
health." "Know what's happening — without being in the kitchen." Financial
accountability framing.

**What turns her off:** Anything implying she needs to use it daily or
manage her own data imports. Heavy operational language (spoilage counts,
par levels) without connecting to dollars.

---

## 3. Percy Weasley — The General Manager

**Archetype:** Accountable Without Equity

### Demographics / context
- Age: 28–45
- Establishment: Mid-sized independent or small chain, 60–150 covers
- Role: GM, reports to owner, manages front and back of house
- Revenue: Works at a $1M–$3M/yr operation
- Tech: Comfortable with SaaS tools; already using scheduling software, maybe 7shifts or similar

### Psychographic profile
Percy is good at his job and knows it. He manages staff, keeps the owner
happy, handles vendor relationships, and has a sixth sense for when things
are about to go sideways. He cares about looking competent in front of his
boss more than almost anything else.

His relationship with data is pragmatic — he'll use tools that help him do
his job better and look smarter in front of ownership. No strong
ideological feelings about AI; he'll use it if it works.

His tension with PantryIQ: he may be slightly threatened by a tool that
gives his owner independent visibility into operations. If McGonagall can
see spoilage data without talking to him, does that mean she's watching
him more closely? This tension is real and must be acknowledged. On the
flip side, if Percy is the one who brings PantryIQ to the owner and it
makes him look sharp, he becomes a champion.

### A day in his life
Opens at 10am, reviews last night's close and any Square reports. Does a
walk-in check with the kitchen manager. Brief check-in with the opening
FOH crew. Fields texts from the owner throughout the day. Spends 20–30 min
on ordering around noon, mostly from gut + supplier minimums. Wraps up at
10pm after close, writes a brief summary for the owner.

### Current pain points
- Ordering decisions are stressful — torn between over-ordering (safe) and under-ordering (margin)
- Spoilage eats into the numbers he reports to ownership and he has limited control over it
- Hard to prove to ownership he's running a tight ship without solid data
- If something goes wrong with inventory, he's the one who has to explain it

### What he wants from a tool like this
- Data that backs up his decisions and gives him cover
- Advance warning of a problem so he can fix it before ownership notices
- Faster ordering decisions with more confidence
- Something that makes him look proactive and data-driven to his boss

### Skepticisms and objections
- "I already know this stuff from experience — will this actually tell me something I don't know?"
- "My owner is going to see things in this dashboard that will cause unnecessary conversations"
- "The kitchen staff won't cooperate with entering data"

### How he'll use PantryIQ
Power user of both Dashboard and Chat. Checks the dashboard before
ownership calls. Uses Chat to prep for hard conversations: "Why is our
salmon margin down this week?" before his owner asks him the same thing.
He'll likely be the one setting up imports and maintaining data hygiene.

### UX considerations
- Needs confidence intervals and evidence — won't trust a number without being able to explain it
- "Show reasoning" is essential — he needs to be able to parrot the logic to his boss
- Dashboard needs enough detail to be operationally useful, not just executive-summary level
- Ability to override AI assumptions (shelf life, par levels) matters — he knows his kitchen's quirks

### Marketing angle
**What lands:** "Walk into every ownership conversation with data, not gut
instinct." "Know what's coming before it becomes a problem." Position it
as a tool that makes GMs look sharp, not surveillance.

**What turns him off:** Anything that feels designed to catch him doing
something wrong. Any feature positioning ownership as the primary
beneficiary over the GM.

---

## 4. Severus Snape — The Chef / Kitchen Manager

**Archetype:** I Run the Kitchen, Not a Spreadsheet

### Demographics / context
- Age: 30–50
- Establishment: Any full-service restaurant or hotel F&B operation
- Role: Executive chef or kitchen manager; controls purchasing decisions, owns the walk-in
- Tech: Minimal — uses POS only when required, phone for texting suppliers
- Revenue: Works at a $800K–$3M/yr operation

### Psychographic profile
Snape's identity is tied to the quality of food coming out of his
kitchen. Waste offends him on a professional level, not just financially —
throwing away good food because of bad planning feels like a failure of
craft.

He's deeply skeptical of anything that feels like it was designed by
someone who's never worked a line. He'll spot bullshit immediately. If
PantryIQ tells him lobster lasts 3 days and he knows his supplier delivers
freshly-caught stock that lasts 5, he'll distrust every other number in
the system.

He doesn't want to be told how to run his kitchen by an algorithm, but
he'll use a tool that gives him better ammunition to push back on
ownership when they try to cut his protein budget. He trusts his own
observations — he'll believe data that confirms what he already suspects,
and challenge data that doesn't. The "show reasoning" feature was
basically designed for Snape.

### A day in his life
Arrives at 9am, does a walk-in inventory by hand and memory. Places
supplier orders based on what he sees + what he's selling + gut. Preps
through service, monitors waste at the end of the night. Has strong
opinions about which menu items aren't worth the spoilage risk. Regularly
argues with the GM about par levels.

### Current pain points
- Has to justify purchasing decisions to ownership without hard data to back himself up
- Knows exactly which items are waste problems but can't quantify the dollar impact to get action
- Tired of ownership cutting his ingredient budget without understanding what it does to spoilage math
- Ordering by memory and gut — wants a smarter way that doesn't require more admin work

### What he wants from a tool like this
- Validation that his instincts are right — "yes, the halibut is a spoilage problem"
- Data he can use to argue for the right purchasing decisions
- Shelf life and spoilage math he can adjust himself, because he knows his product better than any default
- Fast, specific answers, not a dashboard he has to navigate

### Skepticisms and objections
- "This thing doesn't know my kitchen"
- "The shelf life defaults are going to be wrong and I'll never trust the rest of it"
- "I don't have time to enter data — who's going to do that?"
- "The GM will use this to micromanage my ordering"

### How he'll use PantryIQ
Chat-first with a very specific use case — he wants to ask about specific
items. "How much halibut have we been selling lately?" "Am I ordering too
much salmon?" He will not browse a dashboard. The ability to override
shelf life assumptions mid-conversation is critical — he needs to feel in
control of the assumptions, not beholden to defaults.

### UX considerations
- Shelf life must be editable everywhere it appears — settings, chat, and mid-conversation
- Confidence levels matter — he needs to know if the AI is guessing
- "Show reasoning" should show the actual data queries, not just a narrative — he wants numbers, not a summary
- Item-level deep dives (sell-through by item, spoilage per item) are his primary use case
- He doesn't care about margin trends — he cares about waste

### Marketing angle
**What lands:** "Finally, the data to back up what you already know."
"Built for chefs who hate wasting food." Craft-first framing. Position it
as a tool that gives chefs more authority, not less.

**What turns him off:** Anything implying the software knows his kitchen
better than he does. Vague AI promises. Any feature that sounds designed
to monitor him.

---

## 5. Kingsley Shacklebolt — The Bar Manager / Beverage Director

**Archetype:** The Inventory Is Different Here

### Demographics / context
- Age: 28–45
- Establishment: Bar, gastropub, hotel bar, or restaurant with significant bar revenue
- Role: Bar manager or beverage director; owns spirits purchasing, draft lines, wine program
- Tech: Moderate — may use bar-specific inventory tools like BevSpot or Backbar
- Revenue: Manages a $300K–$1.5M/yr beverage program

### Psychographic profile
Kingsley's inventory world is fundamentally different from the kitchen.
Spirits don't spoil (mostly), but draft beer does. Produce garnishes spoil
fast. Wine by-the-glass has spoilage math. Variance between what's poured
and what's sold — theft, overpouring, comps — is a constant problem.

He thinks in **pour cost and variance**, not spoilage in the kitchen
sense. He cares deeply about whether his bar is "running tight" — pour
cost where it should be, no unexplained variance. He's suspicious of tools
that don't understand the beverage world; if PantryIQ treats his spirits
inventory the same way it treats salmon, it'll feel broken immediately. He's
entrepreneurial — better data proving his program is profitable can win
him more budget for the wine list or a seasonal cocktail program.

### A day in his life
Comes in at noon, does a quick visual check of the bottle levels he
tracks on a whiteboard. Checks what was sold last night vs. what's been
depleted by eye. Orders a beer keg or two based on the weekend forecast.
Does a formal pour cost calculation once a week. Deals with a cocktail
that's not selling and decides whether to 86 it.

### Current pain points
- Formal inventory counts are tedious and only happen weekly at best
- Hard to know if variance is from overpouring, theft, spillage, or comps without detailed tracking
- Doesn't know which cocktails are actually profitable after accounting for ingredient cost and spoilage
- Perishable garnishes (citrus, herbs) are a small but real spoilage problem he ignores because it's too manual to track

### What he wants from a tool like this
- Pour cost and variance tracking that doesn't require entering every bottle manually
- Visibility into which cocktails are dragging his program down
- Smarter ordering for draft — knowing what sells on which nights so he doesn't blow a keg on a slow Tuesday
- A way to justify his program's profitability to ownership

### Skepticisms and objections
- "Does this actually understand bar inventory? Or is it just a food tool?"
- "I already use BevSpot for this"
- "The variance calculation needs to account for comps and spillage or it's useless"

### How he'll use PantryIQ
Mixed user — Chat for specific item questions ("how is the Old Fashioned
program trending?") and the dashboard for weekly pour cost summary. More
data-sophisticated than most personas and will push the tool harder.

### UX considerations
- Category handling matters — beverages need to be first-class citizens, not an afterthought of the food inventory model
- "By-the-glass" items need spoilage math that accounts for wine opened but not fully sold
- Pour cost as a derived metric (cost / revenue per item) should be surfaceable in chat
- Import needs to handle spirits in different units (bottles, cases, liters)

### Marketing angle
**What lands:** "Know your pour cost without living in a spreadsheet."
"Find the cocktails that are costing you money." Bar-specific language.
Program profitability framing for beverage directors who want budget
authority.

**What turns him off:** Any demo or screenshot that shows only food.
Generic "restaurant analytics" positioning that ignores the bar.

---

## 6. George Weasley — The Food Truck Owner

**Archetype:** High Volume, No Margin for Error

### Demographics / context
- Age: 25–40
- Establishment: Food truck, 1–2 vehicles, event-based or fixed location rotation
- Revenue: $150K–$500K/yr
- Tech: Uses Square aggressively; very mobile-first
- Staff: 1–4 people; often family or small team

### Psychographic profile
George runs lean. No walk-in to manage — he's working out of a truck,
often prepping at a commissary kitchen. His inventory commitment happens
at the beginning of each week or event, and whatever doesn't sell is
either a loss or goes into next day's prep.

His spoilage problem is acute: he buys for anticipated demand based on the
event or location, and if turnout is lower than expected, he eats the
loss. His ordering math is basically event forecasting. He's scrappy and
resourceful, comfortable figuring out software on his own, deeply mobile
(not sitting at a desk), and price-sensitive — he'll think carefully about
whether a monthly SaaS subscription is worth it for a $250K operation.

### A day in his life
Tuesday morning: checks weekend events, estimates expected covers based
on last year's same event and the weather forecast. Orders from Sysco or
local produce supplier. Thursday: preps at commissary. Friday–Sunday:
service. Monday: counts what's left, calculates what he over-bought,
curses himself. Repeat.

### Current pain points
- Event demand forecasting is pure gut — he often over-buys because the risk of running out is worse than spoilage
- Can't quickly calculate what a given event "cost" in spoilage vs. revenue
- No good way to see which menu items have the best sell-through at different event types
- Feels like he's flying blind every time he orders

### What he wants from a tool like this
- Smarter event-based ordering — "for a 500-person festival, how much of each item have I historically needed?"
- Post-event spoilage calculation — "how much did this weekend cost me in waste?"
- Quick answers in chat — he's not sitting at a laptop reviewing dashboards

### Skepticisms and objections
- "I'm too small for this to matter"
- "I can't justify the subscription cost"
- "The data I have is messy — my Square exports are inconsistent"

### How he'll use PantryIQ
Chat-first, mobile-adjacent. Uses chat to ask event-specific questions
quickly. Dashboard is useful only if it loads fast and tells him something
actionable in 30 seconds. Import is a one-time-ish task — he'll upload his
Square export and not think about it again for a while.

### UX considerations
- Mobile web experience matters (responsive web, not necessarily a native app)
- Chat needs to be fast — he's asking questions between orders or during commissary prep
- Value proposition needs to be demonstrated quickly — he won't give the tool more than 2 weeks
- Pricing sensitivity means the free trial or entry tier experience is critical for conversion

### Marketing angle
**What lands:** "Know before you order." Event-specific forecasting
language. "Stop buying more than you need." Dollar-specific ROI framing.

**What turns him off:** Enterprise-looking software. Long onboarding.
Anything implying he needs an office or a full-time manager to use it.

---

## 7. Hermione Granger — The Ghost Kitchen Operator

**Archetype:** Data-Forward, No Front-of-House Sentimentality

### Demographics / context
- Age: 28–42
- Establishment: Ghost kitchen / dark kitchen, delivery-only, may operate 2–4 virtual brands from one kitchen
- Revenue: $300K–$1.5M/yr across brands
- Tech: High — uses Otter or Deliverect for order aggregation, comfortable with dashboards
- Staff: Small, tight kitchen team; no FOH

### Psychographic profile
Hermione built her business on data because she has to — no dining room
atmosphere or loyal regulars to fall back on. Her reviews are her
marketing. Her unit economics are everything.

She thinks in CAC, contribution margin, and delivery platform fees. She
already has more data than she knows what to do with; she's not looking
for more dashboards, she's looking for actionable signals from the data
she already has. She's the most technically sophisticated persona in this
list — she'll evaluate PantryIQ critically, ask hard questions about data
accuracy and methodology, and challenge assumptions. She operates multiple
virtual brands from one kitchen, so her inventory is shared across brands
and her purchasing decisions affect multiple menus simultaneously.

### A day in her life
Morning: reviews previous day's orders across all brands via Otter, notes
demand patterns. Checks ingredient depletion vs. expected usage. Preps for
the day with a small team. Reviews delivery platform metrics (ratings,
cancellations) to spot operational issues. Ends the day with a margin
calculation: did today's orders cover cost?

### Current pain points
- Hard to allocate shared ingredient costs across multiple virtual brands
- Delivery platform data and kitchen data live in different systems and never reconcile
- Spoilage is a tighter problem than in traditional restaurants — she can't push a special to move product, delivery menus are harder to change
- Needs faster insights — by the time she sees a spoilage trend, it's already cost her a week of margin

### What she wants from a tool like this
- Cross-brand ingredient allocation — which brand is "consuming" which ingredients
- Fast detection of anomalies in ingredient usage vs. orders placed
- Confidence-weighted recommendations with evidence she can verify
- Something that fits into her existing data workflow without requiring her to re-enter data

### Skepticisms and objections
- "My operation is more complex than this tool is built for"
- "I already have analytics from my delivery platforms"
- "How does this handle multiple virtual brands from one location?"
- "What's the methodology behind the spoilage calculation?"

### How she'll use PantryIQ
Dashboard and Chat power user. Sets up her account carefully, imports
clean data, then uses both surfaces heavily. Pushes Chat hard — detailed,
multi-step questions and aggressive follow-ups. Will expect to export or
act on data and may be frustrated by MVP limitations here.

### UX considerations
- Evidence and reasoning transparency are non-negotiable — she'll click "show reasoning" every time
- Confidence scoring methodology needs to be explainable, not just a label
- Multi-brand use within a single location needs to be at least possible (even if not elegantly supported in MVP)
- Benefits most from anomaly detection — "this week's usage of salmon is 30% above what orders would predict"

### Marketing angle
**What lands:** Methodological rigor. "Know your ingredient economics,
not just your revenue." Evidence-first language. Position PantryIQ as the
intelligence layer on top of her existing data.

**What turns her off:** Vague AI promises. "Magic" framing. Anything
implying the tool is making decisions for her rather than informing her
decisions.

---

## 8. Albus Dumbledore — The Small Chain Owner

**Archetype:** Scaling Without Losing Control

### Demographics / context
- Age: 40–58
- Establishment: 2–5 locations of the same concept (or similar), all owned by Dumbledore
- Revenue: $2M–$8M/yr across all locations
- Tech: Moderate — probably using a mix of tools, maybe Toast enterprise, probably not consolidated
- Staff: Multiple GMs, one per location; Dumbledore is the operator above the operators

### Psychographic profile
Dumbledore has been successful enough to open multiple locations, which
means he's now managing managers instead of managing kitchens. This
creates a fundamental visibility problem: he can't be in three places at
once, and each GM has their own way of doing things.

He suspects there's significant inconsistency across locations — different
spoilage rates, different ordering habits, different margin profiles — but
he can't see it clearly, and isn't sure if that inconsistency is a problem
or just the nature of different neighborhoods. He's done with gut
instinct; he wants the business to run on systems. His biggest fear: one
bad location quietly dragging down the whole business while he's focused
on the other two.

### A day in his life
Monday: calls or texts each GM to get the weekend recap. Reviews Square
reports across all locations — manually, in separate tabs. Notes that
Location 2 always seems to have worse margins and he still can't figure
out why. Spends too much time on email. Has a monthly P&L call with his
accountant where he finally sees consolidated numbers that are already 4
weeks old.

### Current pain points
- No consolidated view across locations — each GM runs their own operation opaquely
- Can't compare location performance side-by-side without manually stitching together reports
- Suspects one location has a spoilage or purchasing problem but can't prove it
- GMs have inconsistent data hygiene — some are meticulous, some are not

### What he wants from a tool like this
- Per-location insights he can review without talking to each GM
- A way to spot which location is underperforming and why — before the monthly P&L
- Ideally, some way to compare across locations (knows this is a later phase)
- Confidence that data is clean and trustworthy, not just what his GMs tell him

### Skepticisms and objections
- "My GMs won't use this consistently"
- "Multi-location support needs to work or this is useless to me"
- "I don't want to pay per location if I have 5 locations"

### How he'll use PantryIQ
Dashboard-first, checking each location's dashboard independently (given
MVP single-location scope). Uses Chat occasionally for specific questions
but primarily wants the dashboard to surface what needs his attention.
Needs the location-switching UX to be frictionless.

### UX considerations
- Location picker must be prominent and fast — he's switching contexts frequently
- Dashboard needs to be self-explanatory without requiring him to know each location's backstory
- Recommendation urgency framing ("act today" vs. "watch this") matters because he can't act on everything at once
- Multi-location aggregation being out of MVP scope is a real gap for Dumbledore — the MVP needs to feel like it's building toward that

### Marketing angle
**What lands:** "Run every location like your best location." Consistency
and standardization framing. Scaled operator language.

**What turns him off:** Tools that feel designed for single-location
operators. Per-seat or per-location pricing that gets punitive at scale.
Anything implying he needs to be hands-on daily.

---

## 9. Nymphadora Tonks — The Mobile Bar / Catering Operator

**Archetype:** Event-Driven, Committed Orders, Zero Flexibility

### Demographics / context
- Age: 28–45
- Establishment: Mobile bar, catering operation, or event-focused cocktail company
- Revenue: $100K–$600K/yr; highly seasonal
- Tech: Moderate — uses Square for event payments, Google Sheets or Airtable for event planning
- Staff: 1–5 people; often herself + contractors per event

### Psychographic profile
Tonks's business is unlike any fixed-location restaurant. She commits to
inventory before she knows exactly what will be consumed. Every event is
its own P&L. She can't push a special to move product — she buys for a
specific event and what's left either rolls to the next event or goes to
waste.

Her spoilage profile is unusual: spirits don't spoil, but fresh
ingredients (citrus, herbs, perishable mixers) do, and she commits to
buying them a week out before she knows the final guest count. She's been
burned by clients who promise 200 guests and deliver 120. She's
entrepreneurial and scrappy — she often undercharges early clients because
she's still figuring out her true cost, and knows her pricing needs to be
tighter but doesn't have the data to back it up.

### A day in her life
Gets a new event inquiry — 150-person wedding. Quotes based on gut and
experience. Confirms the booking. One week out, builds her shopping list
based on signature cocktails × estimated consumption per person. Day
before: preps at her commissary or home kitchen. Day of: runs the event.
Day after: counts what's left, calculates what she over-bought, updates
her running mental model of consumption per person per cocktail type.

### Current pain points
- No reliable per-event cost calculation — tracks revenue but not ingredient cost per event
- Consumption per person varies by event type (wedding vs. corporate vs. birthday) and she only knows this intuitively
- Leftover perishables from one event rarely transfer to the next if events are spaced out
- Can't accurately quote clients because she doesn't know her true cost

### What she wants from a tool like this
- Per-event cost tracking — "what did this event actually cost me in ingredients?"
- Historical consumption patterns by event type — "how much citrus does a 150-person wedding actually use?"
- Smarter buying for upcoming events based on historical data
- Help building tighter pricing that reflects true ingredient cost

### Skepticisms and objections
- "My 'inventory' doesn't work the same way as a restaurant's"
- "I don't have recurring transactions — every event is different"
- "This software probably wasn't built for how I work"

### How she'll use PantryIQ
Chat-heavy, event-specific questions. Imports event data after each event
(as a CSV or transaction history) and asks retrospective questions: "How
did my costs compare to my quote for last Saturday?" Also uses Chat for
forward-looking planning: "Based on past weddings, how much should I order
for a 200-person event?"

### UX considerations
- Import flow needs to handle non-standard CSV structures without breaking
- Chat needs to handle event-framed questions — "for last Saturday's event" — not just time ranges
- Benefits from a category structure that lets her tag items as belonging to specific event types
- Per-item cost and consumption data needs to be queryable in chat even if the dashboard doesn't surface it directly

### Marketing angle
**What lands:** "Know your true cost before you quote your next event."
Event operator language. Pricing confidence framing — helping her stop
undercharging.

**What turns her off:** Restaurant-specific language that doesn't map to
her world. Anything assuming she has a walk-in or a fixed menu.

---

## 10. Harry Potter — The Gastropub Owner-Operator

**Archetype:** High Complexity, High Stakes

### Demographics / context
- Age: 35–52
- Establishment: Full-service gastropub with strong bar program and seasonal food menu
- Revenue: $1.2M–$3M/yr
- Tech: Moderate — uses Toast or Square for POS, possibly BevSpot for bar, chaos for the rest
- Staff: 12–25; GM, kitchen manager, bar manager all separate

### Psychographic profile
Harry's operation is uniquely complex: a serious food program and a
serious bar program that share kitchen resources, staff, and operational
attention. His spoilage problems exist in both worlds and are hard to
separate.

He's been in the industry long enough to know the margin is in the
details. He's not satisfied with "roughly right" — he wants to know
exactly where money is going. But he also knows running a gastropub is
constant triage: there's always something more urgent than the data. He's
frustrated that his bar manager and kitchen manager have different mental
models of the business and he can't synthesize them into a single
picture. He'll genuinely use a sophisticated tool if it earns his trust —
but he'll reject it loudly if it embarrasses him in front of his staff.

### A day in his life
Opens at 11am, does a walk-through of kitchen and bar. Catches up with
both his kitchen manager and bar manager on what they need. Reviews last
night's numbers in Toast. Has informal conversations about what's moving
and what isn't. Does purchasing decisions by committee — he'll approve
what Snape and Kingsley are thinking rather than override them. Spends
evenings on the floor, watching service, making mental notes about waste.

### Current pain points
- No unified view of food + beverage together — two separate data streams he mentally reconciles himself
- Spoilage in food and variance in bar are both problems but require different analysis
- Hard to compare his operation's performance to any benchmark — is his pour cost good or bad for a gastropub?
- His team's instincts are good but unvalidated — he's not sure where to trust them and where to push back

### What he wants from a tool like this
- A single place to see food and beverage performance together
- Confidence that the spoilage and pour cost math is methodologically sound
- Something he can share with his kitchen manager and bar manager that gives them each what they need
- The ability to ask cross-cutting questions: "Which items on both menus have the worst margin?"

### Skepticisms and objections
- "I already have Toast analytics — what does this add?"
- "My kitchen and bar managers won't agree on how to use the same tool"
- "I don't trust AI with my margins — it'll get the math wrong and I'll look stupid"

### How he'll use PantryIQ
Balanced user across Dashboard and Chat. Dashboard for his weekly review,
Chat for specific cross-cutting questions. Likely sets up PantryIQ himself
and gives his managers visibility once he trusts it. Most likely persona
to read "show reasoning" carefully and judge the tool on whether the logic
holds up.

### UX considerations
- Cross-category analysis (food + beverage in the same query) is essential
- Dashboard needs to not force a choice between food and bar — both need to be visible
- "Show reasoning" needs to be rigorous enough that he'd feel comfortable forwarding it to his kitchen manager
- Confidence levels need to be well-calibrated — if the AI says "high confidence" and the number is wrong, he'll never trust it again

### Marketing angle
**What lands:** "One view of your whole operation — food, bar, and
everything in between." Complexity-acknowledgment framing. Data rigor
language.

**What turns him off:** Oversimplified dashboards that don't reflect his
operation's complexity. Generic "restaurant analytics" positioning.
Anything feeling built for a fast-casual chain.

---

## Cross-persona patterns

**Shared fears (universal):**
- Embarrassment from acting on bad data
- Wasting time on a tool that doesn't stick
- AI that makes things up without being able to show its work

**Shared desires (universal):**
- Dollar-first insights — financial impact before operational detail
- Plain language explanations without jargon
- The ability to push back and challenge the AI's reasoning

**Where personas diverge most:**

| Dimension | Kitchen-focused | Bar-focused | Owner-level |
|---|---|---|---|
| Primary entry point | Chat | Chat + Dashboard | Dashboard |
| Data trust | Low until proven | Moderate | Moderate |
| Shelf life / par level control | High priority | Moderate | Not relevant |
| Financial framing | Per-item waste | Pour cost / variance | Margin trends |
| Session frequency | A few times/week | Weekly | Weekly |
| Import ownership | Reluctant | Reluctant | Delegates |

**The universal adoption gate:** every persona has the same gate — the
first answer they get from PantryIQ must be believable and grounded. If
the first response feels made-up, generic, or wrong, no persona converts.
The quality of the first interaction, whether via Chat or Dashboard,
determines whether PantryIQ earns a second session.

---

# Part 2 — Customer Discovery Research

Tooling used to run and structure real customer conversations: a short
qualifying screener, and a deeper Mom Test-style discovery interview. Both
are owned by the CPO role and share one hypothesis set.

## Customer Discovery Hypotheses (H1–H10)

The CPO's mission across all customer conversations is to prove or
disprove these assumptions. Every screener and interview should generate
signal on at least one of them.

| # | Hypothesis |
|---|---|
| H1 | Owners know they have a spoilage problem |
| H2a | CSV upload is not a dealbreaker — prospects will use it to get started |
| H2b | When OAuth is eventually available, specific providers will determine subscription willingness |
| H3 | Dollar-first framing resonates more than operational or percentage-based metrics |
| H4 | Owners will trust AI recommendations if they can see the evidence and reasoning |
| H5 | 7 days of transaction data is sufficient for a prospect to feel value on first use |
| H6 | Owners want to remain the decision-maker — AI as thought partner, not autopilot |
| H7 | A conversational chat interface is intuitive for non-technical operators |
| H8 | Non-owner roles (GM, chef, bar manager) can be product champions even when they are not the buyer |
| H9 | An early-adopter grandfathered price is sufficient incentive to commit before OAuth integrations exist |
| H10 | Single-location focus is acceptable for MVP — multi-location aggregation is not a day-one blocker |

## Customer screener (5–10 minutes)

**Purpose:** quickly determine whether a prospect is a target customer
worth a full discovery interview.

Run through the questions conversationally, not as a form to read aloud.
Place the prospect into one of three buckets:

- **Continue** — real pain, data exists, purchasing involvement. Book a full interview.
- **Marginal** — some pain, unclear data situation or purchasing authority. Use judgment.
- **Exit** — no purchasing responsibility, no data, or operation type is out of scope.

If a prospect earns a **Continue**, schedule the full Mom Test interview
within the same week while the conversation is fresh.

### Screener questions

**1. What kind of operation do you run?** Listen for: restaurant, bar,
food truck, ghost kitchen, catering, mobile bar, gastropub, small chain.
Exit signals: purely institutional (hospital, airline, school cafeteria),
no food/beverage purchasing involved, strictly retail with no perishable
exposure.

Operator type shorthand to use when logging: hands-on solo operator,
hands-off owner, general manager (not owner), chef/kitchen manager,
bar/beverage manager, food truck/commissary operator, ghost kitchen /
delivery-only, multi-location chain owner, event caterer / mobile bar.
None of these are automatic disqualifiers — they affect which pain points
matter and who holds the wallet.

**2. Are you involved in purchasing or ordering decisions?** Exit signal:
zero involvement and no influence over the person who does. If they're a
potential internal champion (e.g. a GM who influences an absent owner),
note this and continue (see H8).

**3. When was the last time you threw away food or product you paid
for?** The single most important screener question — don't soften it or
explain why you're asking. A specific story with a rough dollar amount is
a strong Continue signal (H1); "it happens all the time" without
specifics is marginal; "we're pretty tight, not really a problem" is soft
pain, low priority.

**4. How do you currently track inventory or sales data?** Listen for POS
system (Square, Toast, Clover, Lightspeed), spreadsheets, nothing formal,
or third-party inventory tools (BevSpot, MarketMan, BlueCart). Exit
signal: no POS or transaction data of any kind — without importable data
the MVP cannot deliver value. Note their POS system for the OAuth
provider tally below.

**5. If I asked you for last month's sales data broken down by item, how
long would that take — and what format would it be in?** Do not say
"CSV" or "export." "I'd download it as a spreadsheet" → CSV-comfortable
(H2a signal). "I'd have to ask my accountant/GM" → data exists but access
is delegated. "I'm not sure that's possible" → onboarding friction risk.
"I'd just pull it from the dashboard" → consumes reports but may not
export raw data.

**6. Do you currently pay for any software specifically to help run your
operation?** If they pay for multiple SaaS tools already, they're trained
to pay for software (H9 signal). If they've never paid for operational
software, the free trial and entry-tier experience will be critical.

### Screener decision

| Signal | Bucket |
|---|---|
| Specific spoilage story + POS data + purchasing involvement | **Continue** |
| Vague pain + data access unclear + some purchasing influence | **Marginal — probe one more question** |
| No purchasing involvement + no data + out-of-scope operation | **Exit** |

If Marginal, ask one more question: "Have you ever looked at a report and
thought 'I wish I knew this sooner'?" A specific yes moves them to
Continue.

After the screener: log the POS system in the OAuth provider tally, note
operator type, record spoilage awareness level (specific story / vague
awareness / no awareness) and CSV familiarity (exports own data / knows it
exists but delegates / unaware). If Continue, book the full interview.

## Mom Test interview guide (deep discovery, ~40–50 min)

**Purpose:** deep discovery conversation with qualified prospects.
Validates core product hypotheses, surfaces real pain, and determines
willingness to pay, including under MVP constraints (CSV-only import).

### Ground rules
1. **Never pitch.** Describe the problem space only. If asked what you're building: "I'll tell you at the end — I want to hear about your experience first."
2. **No hypotheticals.** Ask what they have done, not what they would do.
3. **Specificity is signal.** Vague agreement isn't validation; a specific story with a dollar amount is.
4. **Silence is a tool.** After a question, wait. The best answers come after a pause.
5. **Follow the energy.** If a prospect lights up on a topic, stay there longer than the guide suggests.

### Structure
Part 1 — Their current reality (10 min) · Part 2 — Data, tools, and the
CSV probe (10 min) · Part 3 — Pain severity and willingness to pay (10
min) · Part 4 — Product framing and reaction (5–10 min) · Part 5 — OAuth
provider tally (5 min) · Close.

### Part 1 — Their current reality
1.1 Walk me through how you ordered inventory in the last week or two.
What did you order, and how did you decide how much? *(Listen for
gut-based decisions vs. any tool/data input.)*

1.2 When was the last time you threw away food or product that you paid
for? What happened? *(H1 signal — does the story come easily?)*

1.3 Have you ever run out of something on a busy night? What did that
cost you? *(Both financial and operational/emotional cost.)*

1.4 How do you currently know if your margins are healthy? Where does
that information come from, and how often do you see it? *(H3 signal —
dollar figure or percentage?)*

1.5 Tell me about a time a purchasing/ordering decision turned out to be
wrong. What would you have needed to know beforehand? *(The counterfactual
is the product pitch hiding in their own words.)*

1.6 How long does it usually take you to realize something is trending —
a menu item slowing down, spoilage getting worse on an ingredient? *(Lag =
pain.)*

### Part 2 — Data, tools, and the CSV probe
Do not say "CSV" until they do, or until the direct probe at 2.5.

2.1 What software or tools do you use to track inventory or sales right
now? *(Note POS system for Part 5.)*

2.2 When did you last look at a report from your POS or inventory tool?
What did you do with the information?

2.3 Have you tried inventory management or analytics software before? Did
it stick or did you stop using it? If they churned: **ask why** — this is
extremely high-value signal (too much manual entry, didn't trust output,
too complex to set up, nobody had time to maintain it). Whatever killed
the last tool, PantryIQ needs to solve that specific problem.

2.4 If I asked you to get last month's sales data broken down by menu
item, how long would that take and what format? *(H2a signal — see
screener question 5 for interpretation.)*

2.5 *(Direct CSV probe, after 2.4)* Have you ever exported data from your
POS or supplier system as a spreadsheet or CSV file for any reason? *(H2a
— yes with experience = CSV-comfortable; never = needs guided onboarding
or may require OAuth before engaging.)*

2.6 Some tools connect directly to your POS or accounting software — you
authorize once and they pull data automatically. Have you set up a
connection like that? *(Probes OAuth familiarity without naming it. H2a/H2b
signal — prior OAuth experience raises the bar for a CSV-only MVP.)*

2.7 If getting started required uploading a file every week or two rather
than automatic sync, would that be a dealbreaker, or would you do it to
get access sooner? *(Direct test of H2a — intentionally hypothetical since
it tests a known product constraint. H9 signal if they want a price break
for the inconvenience.)*

### Part 3 — Pain severity and willingness to pay
3.1 Roughly what do you think spoilage is costing you per month? Have you
ever tried to calculate it? *(H1 signal — can they estimate at all?)*

3.2 Have you ever changed your operation — ordering differently, changing
a supplier, pulling a menu item — specifically because of spoilage or
margin? What happened? *(Past behavior predicts future behavior.)*

3.3 If you knew exactly which three items were costing you the most in
waste every week, what would you do differently? *(Concrete answers =
real pain.)*

3.4 What tools do you currently pay for to run your operation? *(Not
"would you" — "do you." H9 signal — trained buyers vs. first-time SaaS
buyers.)*

3.5 Have you ever paid for a tool, tried it for a month or two, and then
canceled? What made you walk away? *(High-value — a direct design
constraint.)*

3.6 If a tool like this existed and you found it genuinely useful in the
first two weeks, what would you need to see to feel it was worth paying
for monthly? *(H5 signal — value expected within days, or willing to wait
weeks?)*

### Part 4 — Product framing and reaction
Describe the product at a high level (framed as problem space, not a
sales pitch): *"We're working on a tool for restaurant and bar operators
that takes your sales and purchasing data and helps you understand where
you're losing money — specifically around spoilage and ordering. It
surfaces the top things you should act on today, ranked by financial
impact, and lets you ask questions in plain English — like 'why is my
halibut margin so bad lately' — and get an answer with the evidence
behind it. The idea is that the tool shows its work so you can decide
whether to trust it."*

4.1 What's your first reaction to that? *(Don't fill the silence.)*

4.2 What part sounds most useful to you? *(H3 — dollar framing or
operational framing? H6 — positive reaction to "you decide whether to
trust it," or do they want the tool to just decide? H7 — does the
conversational framing resonate?)*

4.3 What part sounds least useful, or like it wouldn't fit how you work?
*(Give permission to be skeptical — the honest objections are more
valuable than enthusiasm.)*

4.4 If this tool existed today, who in your operation would actually use
it day-to-day? *(H8 — buyer/user same person, or an internal champion
dynamic?)*

4.5 What would make you not trust the output — what would have to be
wrong for you to walk away? *(The most important question in this
section. H4 signal — do they want evidence and reasoning, or just a clean
answer?)*

### Part 5 — OAuth provider tally
Framing: *"Right now, the tool works by having you upload your data as a
file every week or two. We'll eventually build direct connections that
pull your data automatically. I want to understand which of those
connections would matter most to you."*

5.1 *(Direct CSV dealbreaker question)* Knowing the current version
requires a manual file upload every week or two — is that a dealbreaker,
or would you be willing to do that to get access now, especially at an
early-version price? Record verbatim: **Dealbreaker** (blocked until
OAuth exists — note provider), **I'd do it** (potential early adopter —
note price sensitivity), or **Depends** (probe what "acceptable" looks
like).

5.2 *(OAuth provider ranking)* Of the systems you use today, which would
be most important to connect to automatically? Ask only if relevant:
Square, Toast, Clover, Lightspeed, Revel (POS); QuickBooks, Xero
(accounting); Sysco/US Foods EDI (broadline distributor); BevSpot/Backbar
(bar program); MarketMan/BlueCart (dedicated inventory tool);
Otter/Deliverect (ghost kitchen/delivery). Record each as **Need** ("I
won't subscribe until this exists") or **Want** ("I'd use CSV for now but
this would make it much easier"). Aggregate across interviews to identify
which integrations unlock the most subscriptions.

5.3 If we built your primary POS integration first and everything else
was still CSV, would that be enough to get started? *(Tests whether a
single high-value integration removes the CSV barrier for most
prospects.)*

### Close
Thank the prospect genuinely; don't pitch unless asked. If interested:
*"We're onboarding a small group of early operators to help us shape the
product. If you'd be interested in getting access early — likely at a
discounted rate you'd keep even after we build out more integrations —
I'd love to stay in touch. Can I follow up in a few weeks?"*

### Interview debrief checklist
Record after each interview: operator type; POS system used; pain level
(specific story with dollar amount / vague awareness / no awareness); CSV
familiarity (exports own data / knows it exists but delegates / unaware);
CSV dealbreaker (yes / no / conditional); early-adopter willingness (yes /
no / conditional); OAuth providers (need / want, listed); hypotheses
confirmed and challenged (H# values); most memorable quote; any design
insight or product requirement surfaced.

---

# Part 3 — Market Research Synthesis

Source: overnight multi-agent market research pass ("Wave 2 Synthesis"),
dated May 17, 2026. Only 3 of 6 research agents completed; 3 were blocked
by web access restrictions (community/review mining). Treat this as
directional competitive intelligence, not validated customer research —
several of its hypotheses are explicitly unvalidated and queued for human
interviews.

## Executive summary

PantryIQ can enter the $199–$500/mo inventory/cost tracking market with
differentiation in conversation-driven onboarding and real-time AI cost
insights. The market is dominated by 7–8 specialists (MarketMan,
MarginEdge, BevSpot, Craftable) with a clear integration hierarchy
(Square/Toast critical; QuickBooks table stakes). Trust validation from 25
Toast/Square community posts confirms operators demand transparency
("show your work"), manual verification workflows, and recommendation-mode
decisions, not automation.

**Wedge recommendation:** target mid-market restaurants ($249–350/mo entry
point) with CSV-first import + explainable AI cost recommendations +
manual approval gates.

**Immediate blockers:** deep segment/churn/integration-priority validation
was not completed; requires human interviews with 3–5 food truck
operators and 2–3 full-service multi-location managers.

> **Note:** This memo's $249–500/mo pricing recommendation conflicts with
> `cost-and-pricing.md`'s cost-driven $10–20/mo analysis, and its "Square
> and Toast are must-have" finding conflicts with `mvp-scope-and-decisions.md`'s
> decision to defer POS integrations past MVP. Both tensions are tracked
> in `open-questions.md` — this document does not resolve them.

## Market Research Hypotheses (H1–H10)

These are a **separate hypothesis set** from the Customer Discovery
Hypotheses in Part 2 above. Same numbering scheme, unrelated content — do
not conflate the two.

**H1 — Food truck and mobile segments value cost tracking differently
than sit-down restaurants.** Status: insufficient evidence (blocked —
Food Truck/Mobile Segment Miner). Cannot assess without direct interviews.

**H2a — Manual CSV workflows for inventory import are acceptable if
insights arrive quickly.** Status: **supported**, high confidence. 25
community posts confirm operators routinely export to CSV/Excel for
payroll and accounting tools and treat it as a normal workflow, not an
emergency. Qualifier: CSV is acceptable only if export is reliable and
operators retain full control — they won't tolerate friction if insights
don't justify the effort.

**H2b — Square and Toast are non-negotiable integrations; QuickBooks is
table stakes.** Status: **supported**, high confidence. Square appears in
7 of 8 competitors' marketing, Toast in 6 of 8; every competitor
emphasizes QuickBooks sync. Quote: "Priority 1 (must-have): Square, Toast
integrations." Differentiation and switching cost are highly dependent on
integration depth; Toast's 100+ native partner ecosystem creates lock-in
risk.

**H3 — Community-driven content mining (Reddit, G2, forums) will uncover
40+ unmet needs.** Status: insufficient evidence (blocked — Community
Miner not executed; the 25 posts that were mined focused only on
manual-workflow/trust friction, not broad unmet-needs mining).

**H4 — Operators demand transparency and "show your work" before trusting
analytics.** Status: **supported**, very high confidence. Operators
explicitly request detailed breakdowns to understand logic; distrust from
past software errors (tax calculations, order firing, categorization, ad
targeting) drives preventive manual verification. One quoted trust breach:
a POS tool "gave away 20% to existing customers... not what we discussed,"
forcing ongoing manual review. Every major complaint in the source data
involves inability to verify logic or trace an error's origin.

**H5 — Food truck operators face unique churn signals (seasonality, cash
constraints, license risk).** Status: insufficient evidence (blocked —
Review + Churn Miner not executed). Cannot validate without direct
interviews and review mining.

**H6 — Operators want a decision partner (recommendations + manual
approval), not automation.** Status: **supported**, high confidence.
Operators explicitly request AI recommendations while retaining decision
rights; when systems auto-decide without sign-off, trust breaks (same
"gave away 20%" incident as H4). Pattern: automation reads as loss of
control; decision support reads as helpful. Manual review is framed as
necessary, not burdensome.

**H7 — Integration priority ranking (Square > Toast > QB > Xero > Supplier
EDI) holds across SMB and enterprise.** Status: **supported**, high
confidence, but based on competitor-marketing frequency and one research
agent's strategic assessment — not validated by user interviews or churn
data.

**H8 — Pricing flexibility (flat $350 vs. per-location tiering)
significantly affects mid-market adoption.** Status: insufficient
evidence (blocked). One competitor's flat $350 pricing "appeals to
cost-conscious ops" per marketing framing, but no evidence of which model
converts better.

**H9 — Price-sensitive ops prefer a $79–199 entry tier; enterprises pay
custom; mid-market seeks a $249–350 sweet spot.** Status: **supported**,
high confidence, from competitor pricing-band analysis. Three tiers
identified: Entry $79–199 (small ops, bars), Core $249–350 (mid-market
single/multi-location), Premium $400–500+ (multi-unit, chains,
AP-automation features). No churn data to validate actual
willingness-to-pay.

**H10 — Competitors underserve waste quantification and real-time cost
forecasting.** Status: **supported**, high confidence. Only two of the
mined competitors (MarketMan, Craftable) explicitly track waste; most rely
on variance math. Most competitors update on invoice cadence
(daily–weekly) and require manual counts, rather than real-time
mid-shift/mid-week forecasting. Positioning whitespace identified, but no
validation that operators actually want real-time forecasting vs.
historical reporting.

## Integration priority ranking

| Priority | Integration | Strategic importance | Rationale | Threat level |
|---|---|---|---|---|
| 1 (Must-have) | Square | Critical | 7 of 8 competitors emphasize; highest POS volume for small/mid restaurants | High |
| 1 (Must-have) | Toast | Critical | 6 of 8 competitors; native modules; enterprise segment; closed ecosystem lock-in | High |
| 2 (Table stakes) | QuickBooks | Critical | 6 of 8 emphasize QB sync; accountant integration point; expected baseline | Medium |
| 3 (Differentiation) | Lightspeed (Upserve) | High | 5 of 8 competitors; strong in QSR/multi-location; lower switching friction than Toast | Medium |
| 3 (Differentiation) | Sysco / US Foods / Gordon Food Service | High | 3 competitors; enables order automation; large distributor networks | Medium |
| 4 (Secondary) | Xero / Sage | Medium | 4–5 competitors; less emphasized than QB; growing in Canada/Europe | Low |
| 4 (Secondary) | EDI (vendor integrations) | High for multi-unit, medium overall | 3 competitors; enables direct invoice flow; most small ops don't use | Medium |
| 5 (Emerging) | 7shifts / labor management | Rising | 1 competitor (MarginEdge); operators want labor + food cost in one view | Medium (differentiation if added) |

## Competitive positioning gaps

1. **Conversation-driven onboarding** — competitors require manual recipe
   library setup, vendor lists, and initial inventory import (2–4 weeks
   for one competitor). Opportunity: AI-extracted recipes from menu
   images, auto-mapped vendors, inferred par levels from sales data.
2. **Real-time cost intelligence** — competitors update on invoice cadence
   and require manual counts. Opportunity: real-time forecasting mid-shift
   or mid-week, alerting on pricing anomalies before the invoice arrives.
3. **Waste quantification via AI conversation** — most competitors rely on
   variance math rather than direct waste tracking. Opportunity: capture
   waste conversationally ("what did you throw away today?") as
   quantified trend data.
4. **POS independence** — every competitor requires POS integration for
   full value. Opportunity: works standalone via CSV upload and
   conversation input, reducing perceived switching cost.
5. **AI-first interaction model** — competitors are UI-driven, assuming
   the operator logs in and enters data. Opportunity: conversation-first
   interaction that reduces training burden.

## Trust requirements & design gates

| Trust gate | Evidence | Implementation requirement |
|---|---|---|
| Calculation transparency | Operators demand "show your work"; distrust from past errors drives preventive manual verification | Every cost/margin/waste recommendation must show data sources, a visible calculation formula, and a line-item breakdown — no black-box output |
| Explainable recommendations | Operators want data + a recommendation, not silent auto-optimization | Recommendation UI must surface reasoning, underlying data, and a manual override |
| Audit trail | Operators manually compare reports to bank statements to verify | All cost/waste/inventory changes need a timestamp, data source, actor, and prior→new value; export-to-Excel for manual verification |
| Manual approval workflow | Operators configure and refine manual processes rather than replace them; automation without sign-off breaks trust | No inventory/menu/pricing decision executes without operator approval — recommendation-mode only |
| CSV export reliability | Operators routinely export to CSV as a workflow fallback | CSV export must be fast, reliable, and complete; cannot be removed or broken by an update |
| Data verification ritual | Manual reconciliation against bank statements is treated as necessary, not a burden | UI should support easy side-by-side comparison: import → system calculation → user verification → approval |

## Segment analysis

**Full-service restaurants** — primary target for the mined competitors.
Recipe costing and multi-location governance are core features; pricing
$249–500+/mo; Square/Toast/QuickBooks integration expected. Recommendation:
full-service, multi-location is a viable beachhead at $249–350/mo entry,
emphasizing conversation-driven setup, explainable cost analytics, and
manual approval gates.

**Food trucks / mobile** — no data available; the relevant research agent
was blocked. Requires 3–5 direct interviews to validate cost-tracking
value vs. cash constraint, seasonality impact on churn, Square payment
integration, and license/permitting friction. Open hypothesis: this
segment may prioritize real-time cash flow over food cost, which would
make PantryIQ's cost focus misaligned for them.

**Primary wedge recommendation (from this research):** full-service
restaurants (50–500 seats, 1–3 locations) using Square POS, entry at
$249–350/mo, differentiated by conversation-driven onboarding + explainable
real-time cost insights + manual approval gates — "your AI cost advisor,
not your autopilot." This has not been reconciled with the MVP's actual
CSV-first, un-integrated, single-location scope; see `open-questions.md`.

## Human validation queue

Items requiring direct interviews or data mining that the research pass
couldn't complete:

| Item | Why blocked | Recommended method | Hypothesis | Priority |
|---|---|---|---|---|
| Food truck segment preferences | Mobile Segment Miner not executed | 3–5 interviews with food truck operators | H1 | P1 |
| Reddit/G2 full mining | Community Miner not executed | Mine r/restaurantowners, r/restaurateur, r/Chefit, r/ToastPOS, r/foodtrucks; G2 reviews for MarketMan, MarginEdge, BevSpot, Craftable; target 40+ data points | H3 | P1 |
| Churn signals and seasonality | Review + Churn Miner not executed | G2 reviews filtered by "Cons"/"Reasons for Switching"; interview 2–3 lapsed users per competitor; look for seasonal patterns | H5 | P1 |
| Integration willingness-to-pay | Integration Priority Researcher not executed | 2–3 interviews with CFOs/restaurant managers on flat vs. per-location pricing and build-vs-buy thresholds | H8 | P2 |
| Real-time forecasting demand | No user validation of the identified whitespace | 2–3 interviews testing willingness-to-use with a mid-week price-spike alert demo | H10b | P2 |
| Waste quantification value | No ROI validation of the identified whitespace | 2–3 interviews on current waste measurement habits and willingness to change behavior; test conversational waste capture with a mock demo | H10a | P2 |

### Research agent status (for reference)

| Agent | Status | Output |
|---|---|---|
| Full-Service Community Miner | Blocked | None — Reddit/G2/forums blocked by bot protection / auth walls |
| Food Truck / Mobile Segment Miner | Blocked | None — no data source accessible |
| Competitor + Pricing Researcher | Complete | 8 competitors, pricing band, integration matrix |
| Review + Churn Miner | Blocked | None — G2/Capterra/GetApp block automated review scraping |
| Integration Priority Researcher | Blocked | Partially addressed by the Competitor + Pricing Researcher |
| Manual Workflow + Trust Friction Researcher | Complete | 25 evidence rows; validated H2a/H4/H6 from Toast/Square community forums |
