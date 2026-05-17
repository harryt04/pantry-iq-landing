# PantryIQ – User Personas

**Status:** v1  
**Sibling doc:** `expected-ux-v2.md`  
**Purpose:** Deep psychographic profiles of every realistic PantryIQ user type. Use these to pressure-test UX decisions, write copy that resonates, and ensure no user's workflow or mental model is designed around.

## Character Key

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

---

## How to Use This Document

Each persona is a composite archetype — not a real person, but a tight cluster of real behaviors, fears, and goals. When making a product or marketing decision, ask: *"How would Ron react to this? Would McGonagall even notice this feature exists?"*

Personas are organized by **role** first. Establishment-type context is woven in where it changes the psychographic profile meaningfully.

---

## Persona Index

1. [Ron Weasley — The Scrappy Owner-Operator](#1-ron-weasley--the-scrappy-owner-operator)
2. [Minerva McGonagall — The Hands-Off Owner](#2-minerva-mcgonagall--the-hands-off-owner)
3. [Percy Weasley — The General Manager](#3-percy-weasley--the-general-manager)
4. [Severus Snape — The Chef / Kitchen Manager](#4-severus-snape--the-chef--kitchen-manager)
5. [Kingsley Shacklebolt — The Bar Manager / Beverage Director](#5-kingsley-shacklebolt--the-bar-manager--beverage-director)
6. [George Weasley — The Food Truck Owner](#6-george-weasley--the-food-truck-owner)
7. [Hermione Granger — The Ghost Kitchen Operator](#7-hermione-granger--the-ghost-kitchen-operator)
8. [Albus Dumbledore — The Small Chain Owner](#8-albus-dumbledore--the-small-chain-owner)
9. [Nymphadora Tonks — The Mobile Bar / Catering Operator](#9-nymphadora-tonks--the-mobile-bar--catering-operator)
10. [Harry Potter — The Gastropub Owner-Operator](#10-harry-potter--the-gastropub-owner-operator)

---

## 1. Ron Weasley — The Scrappy Owner-Operator

**Archetype:** The Restaurant Is My Life

### Demographics / Context

- Age: 38–52
- Establishment: Independent casual or fine dining restaurant, 40–120 covers
- Staff: 8–20 people, wears multiple hats
- Revenue: $600K–$2M/yr
- Location: Suburban strip mall or small city downtown
- Tech: Uses Square or Toast for POS, QuickBooks for accounting, Google Sheets for "inventory"

### Psychographic Profile

Ron opened his restaurant because he loves food and people — not because he loves spreadsheets. He is the first one in and the last one out. He texts his suppliers at 7am. He knows regulars by name and has a gut feeling about when lobster is moving slow — but he can't prove it.

He operates on instinct and experience. He's been burned before: overordered before a slow week, ran out of a signature item on a Friday night, watched a full case of salmon go gray in the walk-in. Each of those moments cost him real money and he still thinks about them.

He knows his margins are bad. He suspects his spoilage is worse than he thinks. He just doesn't have time to dig into it — and even if he did, he wouldn't know where to start.

He is skeptical of software. He's tried three different inventory apps over the years and none of them stuck. Too complicated. Required too much upfront data entry. Gave him numbers he didn't trust.

He wants a tool that makes him feel like he's getting smarter, not one that makes him feel stupid.

### A Day in His Life

6:45am — arrives before prep, checks the walk-in, mentally notes what needs to move. Texts his fish supplier to push delivery to Thursday because he still has too much halibut. 9am — reviews last night's sales on Square, does rough math in his head on whether he's on pace for the week. Noon — puts out a fire with a line cook calling in sick. 3pm — tries to update his Google Sheet inventory tracker but gives up after 10 minutes because he can't remember what he was counting last week. 11pm — closes up, makes a note to himself to "figure out the spoilage thing" and promptly forgets.

### Current Pain Points

- No reliable view of what spoilage is costing him — it's "somewhere between bad and really bad"
- Ordering is mostly gut-based; he over-orders perishables to avoid stockouts and eats the spoilage
- Can't quickly see which menu items are actually profitable vs. just popular
- Doesn't know when a trend is a trend vs. just a slow week
- Too busy to set up complex software; abandons tools that require 2+ hours of onboarding

### What He Wants From a Tool Like This

- Tell him what's going wrong in plain English, with a dollar sign attached
- Give him a clear action for today, not a report to analyze
- Let him ask questions in his own words without learning a dashboard
- Don't make him feel dumb for not knowing the data

### Skepticisms and Objections

- "I've tried these tools before and they never actually help"
- "My data is a mess, I don't think this will work for me"
- "I don't have time to set this up properly"
- "I don't trust AI — it'll just make stuff up"

### How He'll Use PantryIQ

Ron will log in primarily through the **Chat page**. He'll start by asking a specific question that's been bothering him — "why is my fish margin so low lately?" — and judge the product entirely on whether that first answer is useful and believable. If it shows its work, he trusts it. If it gives him a vague answer, he's gone.

Dashboard will pull him in once he trusts the chat. He'll check it a few times a week, not daily.

Import will be his biggest friction point. He needs it to be fast and forgiving — he won't tolerate a 45-minute onboarding session just to get data in.

### UX Considerations

- The dashboard must lead with a dollar amount, not a percentage or a chart
- First recommendation on the dashboard needs to be immediately actionable — "do this today"
- Chat needs to feel like texting a smart advisor, not filling out a form
- Error messages and empty states need to be encouraging, not clinical
- Import flow must be forgiving — if a column doesn't map perfectly, don't block him; guide him one step at a time

### Marketing Angle

**What lands:** "Know exactly what your kitchen is costing you — without living in a spreadsheet." Dollar-first language. Time-saving framing. "Your data, your insights — explained in plain English." Testimonials from other owner-operators who felt the same skepticism.

**What turns him off:** Technical jargon. Vague "AI-powered" promises. Enterprise-looking software. Anything that implies he needs to change how he runs his kitchen.

---

## 2. Minerva McGonagall — The Hands-Off Owner

**Archetype:** I Own It, Someone Else Runs It

### Demographics / Context

- Age: 45–65
- Establishment: 1–3 locations, established restaurant or bar, higher revenue
- Staff: Has a GM or kitchen manager; McGonagall is not in the kitchen daily
- Revenue: $1.5M–$5M/yr
- Location: Established market, may have opened 10+ years ago
- Tech: Comfortable with email and basic reports; delegates software decisions to GM

### Psychographic Profile

McGonagall owns the business but runs it at arm's length. She might have another job or business. She checks in on numbers weekly or monthly, not daily. She trusts her GM to run operations and her accountant to watch the books.

What she cares about: is the business healthy? Are margins trending the right direction? Is her GM telling her the truth? She often suspects things are better or worse than she's being told — but she doesn't have an independent view into operations.

She doesn't want to become an operator again. She wants better visibility, not more work. A dashboard that shows her the state of the business in five minutes is worth more to her than a sophisticated tool that requires daily engagement.

Her biggest fear is a slow bleed — spoilage, theft, or margin erosion that nobody caught until the P&L told the story three months later.

### A Day in His Life

Monday morning — opens her email, looks for anything urgent from her GM. Checks QuickBooks once a week. Has a standing 30-minute call with her GM on Tuesdays. Once a month, reviews the full P&L with her accountant and asks questions she doesn't always get clear answers to. She suspects her bar margins are worse than reported.

### Current Pain Points

- No independent view into operations — relies entirely on her GM for the story
- P&L arrives too late to act on trends (monthly, not weekly)
- Doesn't know if spoilage numbers in reports are accurate or just what her GM thinks she wants to hear
- Feels out of the loop without wanting to micromanage

### What She Wants From a Tool Like This

- A clean, honest summary of the financial health of her restaurant
- Visibility into trends over time — is this month better or worse than last month, and why?
- Something she can check in 5 minutes that tells her if there's a problem she needs to ask about
- Independence from her GM's framing of the data

### Skepticisms and Objections

- "My GM already handles this"
- "I'm not going to be the one entering data into this thing"
- "Will this actually integrate with how we already work?"

### How She'll Use PantryIQ

McGonagall will primarily use the **Dashboard** — probably on desktop, probably on a Monday morning. She may occasionally use Chat to ask a high-level question ("How are margins trending this quarter?") but she's not a power user.

She may set up the account and then delegate data imports to her GM, which means the import flow needs to work for someone who isn't the account owner.

### UX Considerations

- Dashboard must be readable in one pass — no drilling required for the key insight
- Summary metrics at the top of the dashboard are essential: "This week vs. last week, this month vs. last month"
- Margin trend visualization matters to her more than per-item detail
- The tone of the dashboard should feel like an executive brief, not a kitchen ops tool

### Marketing Angle

**What lands:** "Finally, an independent view into your restaurant's health." "Know what's happening — without being in the kitchen." Financial accountability framing. "Trust but verify" for owners who delegate but worry.

**What turns her off:** Anything that implies she needs to use it daily or manage her own data imports. Heavy operational language (spoilage counts, par levels) without connecting to dollars.

---

## 3. Percy Weasley — The General Manager

**Archetype:** Accountable Without Equity

### Demographics / Context

- Age: 28–45
- Establishment: Mid-sized independent or small chain, 60–150 covers
- Role: GM, reports to owner, manages front and back of house
- Revenue: Works at a $1M–$3M/yr operation
- Tech: Comfortable with SaaS tools; already using scheduling software, maybe 7shifts or similar

### Psychographic Profile

Percy is good at his job and he knows it. He manages staff, keeps the owner happy, handles vendor relationships, and has a sixth sense for when things are about to go sideways. He cares about looking competent in front of his boss more than almost anything else.

His relationship with data is pragmatic: he'll use tools that help him do his job better and look smarter in front of ownership. He doesn't have strong ideological feelings about AI — he'll use it if it works.

His tension with PantryIQ: he may be slightly threatened by a tool that gives his owner independent visibility into operations. If McGonagall can see spoilage data without talking to him, does that mean she's watching him more closely? This tension is real and must be acknowledged.

On the flip side, if Percy is the one who brings PantryIQ to McGonagall and it makes him look sharp, he becomes a champion.

### A Day in His Life

Opens at 10am, reviews last night's close and any Square reports. Does a walk-in check with the kitchen manager. Has a brief check-in with the opening FOH crew. Fields texts from the owner throughout the day. Spends 20-30 min on ordering around noon, mostly from gut + supplier minimums. Wraps up at 10pm after close, writes a brief summary for the owner.

### Current Pain Points

- Ordering decisions are stressful — he's always torn between over-ordering (safe) and under-ordering (margin)
- Spoilage eats into the numbers he reports to ownership and he has limited control over it
- Hard to prove to ownership that he's running a tight ship without solid data
- If something goes wrong with inventory, he's the one who has to explain it

### What He Wants From a Tool Like This

- Data that backs up his decisions and gives him cover
- Advance warning of a problem so he can fix it before ownership notices
- Faster ordering decisions with more confidence
- Something that makes him look proactive and data-driven to his boss

### Skepticisms and Objections

- "I already know this stuff from experience — will this actually tell me something I don't know?"
- "My owner is going to see things in this dashboard that will cause unnecessary conversations"
- "The kitchen staff won't cooperate with entering data"

### How He'll Use PantryIQ

Percy will be a **power user of both Dashboard and Chat**. He'll check the dashboard before his ownership calls. He'll use Chat to prep for hard conversations: "Why is our salmon margin down this week?" before his owner asks him the same question.

He'll likely be the one setting up imports and maintaining data hygiene.

### UX Considerations

- He needs confidence intervals and evidence — he won't trust a number without being able to explain it
- "Show reasoning" is essential for Percy — he needs to be able to parrot the logic to his boss
- Dashboard should have enough detail to be operationally useful, not just executive-summary level
- The ability to override AI assumptions (shelf life, par levels) is important to him — he knows his kitchen's quirks

### Marketing Angle

**What lands:** "Walk into every ownership conversation with data, not gut instinct." "Know what's coming before it becomes a problem." Position it as a tool that makes GMs look sharp, not as surveillance.

**What turns him off:** Anything that feels like it's designed to catch him doing something wrong. Any feature that positions ownership as the primary beneficiary over the GM.

---

## 4. Severus Snape — The Chef / Kitchen Manager

**Archetype:** I Run the Kitchen, Not a Spreadsheet

### Demographics / Context

- Age: 30–50
- Establishment: Any full-service restaurant or hotel F&B operation
- Role: Executive chef or kitchen manager; controls purchasing decisions, owns the walk-in
- Tech: Minimal — uses POS only when required, phone for texting suppliers
- Revenue: Works at a $800K–$3M/yr operation

### Psychographic Profile

Snape's identity is tied to the quality of food coming out of his kitchen. Waste offends him on a professional level — not just financially, but philosophically. Throwing away good food because of bad planning feels like a failure of craft.

She is deeply skeptical of anything that feels like it was designed by someone who has never worked a line. She will spot bullshit immediately. If PantryIQ tells her lobster lasts 3 days and she knows her supplier delivers freshly-caught stock that lasts 5, she'll distrust every other number in the system.

She doesn't want to be told how to run her kitchen by an algorithm. But she will use a tool that gives her better ammunition to push back on ownership when they try to cut her protein budget.

His relationship with data: he trusts his own observations. He'll believe data that confirms what he already suspects, and challenge data that doesn't. The "show reasoning" feature was basically designed for Snape.

### A Day in His Life

Arrives at 9am, does a walk-in inventory by hand and memory. Places supplier orders based on what she sees + what she's selling + gut. Preps through service, monitors waste at the end of the night. Has strong opinions about which menu items aren't worth the spoilage risk. Regularly argues with the GM about par levels.

### Current Pain Points

- Has to justify purchasing decisions to ownership without hard data to back herself up
- Knows exactly which items are waste problems but can't quantify the dollar impact to get action
- Tired of ownership cutting her ingredient budget without understanding what it does to spoilage math
- Ordering by memory and gut — wants a smarter way to do it that doesn't require more admin work

### What She Wants From a Tool Like This

- Validation that her instincts are right — "yes, the halibut is a spoilage problem"
- Data she can use to argue for the right purchasing decisions
- Shelf life and spoilage math that she can adjust herself, because she knows her product better than any default
- Fast, specific answers — not a dashboard she has to navigate

### Skepticisms and Objections

- "This thing doesn't know my kitchen"
- "The shelf life defaults are going to be wrong and I'll never trust the rest of it"
- "I don't have time to enter data — who's going to do that?"
- "The GM will use this to micromanage my ordering"

### How She'll Use PantryIQ

Snape is a **Chat-first user** with a very specific use case: he wants to ask about specific items. "How much halibut have we been selling lately?" "Am I ordering too much salmon?" He will not browse a dashboard.

The ability to override shelf life assumptions mid-conversation is critical for Snape. He needs to feel like he's in control of the assumptions, not beholden to defaults.

### UX Considerations

- Shelf life must be editable everywhere it appears — in settings, in chat, and mid-conversation
- Confidence levels matter to Snape — he needs to know if the AI is guessing
- The "show reasoning" should show the actual data queries, not just a narrative — she wants to see the numbers, not a summary
- Item-level deep dives (sell-through by item, spoilage per item) are her primary use case
- She doesn't care about margin trends — she cares about waste

### Marketing Angle

**What lands:** "Finally, the data to back up what you already know." "Built for chefs who hate wasting food." Craft-first framing. Position it as a tool that gives chefs more authority, not less.

**What turns her off:** Anything that implies the software knows her kitchen better than she does. Vague AI promises. Any feature that sounds like it was designed to monitor her.

---

## 5. Kingsley Shacklebolt — The Bar Manager / Beverage Director

**Archetype:** The Inventory Is Different Here

### Demographics / Context

- Age: 28–45
- Establishment: Bar, gastropub, hotel bar, or restaurant with significant bar revenue
- Role: Bar manager or beverage director; owns spirits purchasing, draft lines, wine program
- Tech: Moderate — may use bar-specific inventory tools like BevSpot or Backbar
- Revenue: Manages a $300K–$1.5M/yr beverage program

### Psychographic Profile

Kingsley's inventory world is fundamentally different from the kitchen. Spirits don't spoil (mostly), but draft beer does. Produce garnishes spoil fast. Wine by-the-glass has spoilage math. Variance between what's poured and what's sold — theft, overpouring, comps — is a constant problem.

Kingsley thinks in terms of **pour cost and variance**, not spoilage in the kitchen sense. He cares deeply about whether his bar is "running tight" — meaning pour cost is where it should be and there's no unexplained variance.

He is suspicious of tools that don't understand the beverage world. If PantryIQ treats his spirits inventory the same way it treats salmon, it'll feel broken immediately.

He is entrepreneurial — if he can use better data to prove his program is profitable, he can get more budget for the wine list or a seasonal cocktail program he wants to run.

### A Day in Her Life

Comes in at noon, does a quick visual check of the bottle levels she tracks on a whiteboard. Checks what was sold last night vs. what's been depleted by eye. Orders a beer keg or two based on the weekend forecast. Does a formal pour cost calculation once a week. Deals with a cocktail that's not selling and decides whether to 86 it.

### Current Pain Points

- Formal inventory counts are tedious and only happen weekly at best
- Hard to know if variance is from overpouring, theft, spillage, or comps without detailed tracking
- Doesn't know which cocktails are actually profitable after accounting for ingredient cost and spoilage
- Perishable garnishes (citrus, herbs) are a small but real spoilage problem she ignores because it's too manual to track

### What She Wants From a Tool Like This

- Pour cost and variance tracking that doesn't require her to enter every bottle manually
- Visibility into which cocktails are dragging her program down
- Smarter ordering for draft — knowing what sells on which nights so she doesn't blow a keg on a slow Tuesday
- A way to justify her program's profitability to ownership

### Skepticisms and Objections

- "Does this actually understand bar inventory? Or is it just a food tool?"
- "I already use BevSpot for this"
- "The variance calculation needs to account for comps and spillage or it's useless"

### How She'll Use PantryIQ

Kingsley is a **mixed user** — he'll use Chat for specific item questions ("how is the Old Fashioned program trending?") and the dashboard for weekly pour cost summary. He's more data-sophisticated than most personas and will push the tool harder.

### UX Considerations

- Category handling matters — he needs beverages to be first-class citizens, not an afterthought of the food inventory model
- "By-the-glass" items need spoilage math that accounts for wine opened but not fully sold
- Pour cost as a derived metric (cost / revenue per item) should be surfaceable in chat
- Import needs to handle spirits in different units (bottles, cases, liters)

### Marketing Angle

**What lands:** "Know your pour cost without living in a spreadsheet." "Find the cocktails that are costing you money." Bar-specific language. Program profitability framing for beverage directors who want budget authority.

**What turns her off:** Any demo or screenshot that shows only food. Generic "restaurant analytics" positioning that ignores the bar.

---

## 6. George Weasley — The Food Truck Owner

**Archetype:** High Volume, No Margin for Error

### Demographics / Context

- Age: 25–40
- Establishment: Food truck, 1–2 vehicles, event-based or fixed location rotation
- Revenue: $150K–$500K/yr
- Tech: Uses Square aggressively; very mobile-first
- Staff: 1–4 people; often family or small team

### Psychographic Profile

George runs lean. There is no walk-in to manage — he's working out of a truck, often prepping at a commissary kitchen. His inventory commitment happens at the beginning of each week or event, and whatever doesn't sell is either a loss or goes into next day's prep.

His spoilage problem is acute: he buys for anticipated demand based on the event or location, and if turnout is lower than expected, he eats the loss. His ordering math is basically event forecasting.

He's scrappy and resourceful. He's comfortable figuring out software on his own. He's also deeply mobile — he's not sitting at a desk, he's in a truck or at a commissary.

He's price-sensitive. He'll think carefully about whether a monthly SaaS subscription is worth it for a $250K operation.

### A Day in His Life

Tuesday morning: checks weekend events, estimates expected covers based on last year's same event and the weather forecast. Orders from Sysco or local produce supplier. Thursday: preps at commissary. Friday–Sunday: service. Monday: counts what's left, calculates what he over-bought, curses himself. Repeat.

### Current Pain Points

- Event demand forecasting is pure gut — he often over-buys because the risk of running out is worse than spoilage
- Can't quickly calculate what a given event "cost" in spoilage vs. revenue
- No good way to see which menu items have the best sell-through at different event types
- Feels like he's flying blind every time he orders

### What He Wants From a Tool Like This

- Smarter event-based ordering — "for a 500-person festival, how much of each item have I historically needed?"
- Post-event spoilage calculation — "how much did this weekend cost me in waste?"
- Quick answers in chat — he's not sitting at a laptop reviewing dashboards

### Skepticisms and Objections

- "I'm too small for this to matter"
- "I can't justify the subscription cost"
- "The data I have is messy — my Square exports are inconsistent"

### How He'll Use PantryIQ

George is a **Chat-first, mobile-adjacent user**. He'll use chat to ask event-specific questions quickly. The dashboard is useful only if it loads fast and tells him something actionable in 30 seconds.

Import is a one-time-ish task — he'll upload his Square export and not think about it again for a while.

### UX Considerations

- Mobile web experience matters for George (not native app, but responsive web)
- Chat needs to be fast — he's asking questions between orders or during commissary prep
- The value proposition needs to be demonstrated quickly — he won't give the tool more than 2 weeks before deciding if it's worth it
- Pricing sensitivity means the free trial or entry tier experience is critical for conversion

### Marketing Angle

**What lands:** "Know before you order." Event-specific forecasting language. "Stop buying more than you need." Dollar-specific ROI framing — "if this saves you $200/week in spoilage, it pays for itself."

**What turns him off:** Enterprise-looking software. Long onboarding. Anything that implies he needs an office or a full-time manager to use it.

---

## 7. Hermione Granger — The Ghost Kitchen Operator

**Archetype:** Data-Forward, No Front-of-House Sentimentality

### Demographics / Context

- Age: 28–42
- Establishment: Ghost kitchen / dark kitchen, delivery-only, may operate 2–4 virtual brands from one kitchen
- Revenue: $300K–$1.5M/yr across brands
- Tech: High — uses Otter or Deliverect for order aggregation, comfortable with dashboards
- Staff: Small, tight kitchen team; no FOH

### Psychographic Profile

Hermione built her business on data because she has to — there's no dining room atmosphere or loyal regulars to fall back on. Her reviews are her marketing. Her unit economics are everything.

She thinks in CAC, contribution margin, and delivery platform fees. She already has more data than she knows what to do with. She's not looking for more dashboards — she's looking for actionable signals from the data she already has.

She's the most technically sophisticated persona in this list. She'll evaluate PantryIQ critically and ask hard questions about data accuracy and methodology. She'll challenge assumptions.

She operates multiple virtual brands from one kitchen, which means her inventory is shared across brands and her purchasing decisions affect multiple menus simultaneously.

### A Day in His Life

Morning: reviews previous day's orders across all brands via Otter, notes demand patterns. Checks ingredient depletion vs. expected usage. Preps for the day with a small team. Reviews delivery platform metrics (ratings, cancellations) to spot operational issues. Ends day with margin calculation: did today's orders cover cost?

### Current Pain Points

- Hard to allocate shared ingredient costs across multiple virtual brands
- Delivery platform data and kitchen data live in different systems and never reconcile
- Spoilage is a tighter problem than in traditional restaurants — she can't push a special to move product, delivery menus are harder to change
- Needs faster insights — by the time she sees a spoilage trend, it's already cost her a week of margin

### What She Wants From a Tool Like This

- Cross-brand ingredient allocation — which brand is "consuming" which ingredients
- Fast detection of anomalies in ingredient usage vs. orders placed
- Confidence-weighted recommendations with evidence she can verify
- Something that fits into her existing data workflow without requiring her to re-enter data

### Skepticisms and Objections

- "My operation is more complex than this tool is built for"
- "I already have analytics from my delivery platforms"
- "How does this handle multiple virtual brands from one location?"
- "What's the methodology behind the spoilage calculation?"

### How She'll Use PantryIQ

Hermione is a **Dashboard and Chat power user**. She'll set up her account carefully, import clean data, and then use both surfaces heavily. She'll push Chat hard — asking detailed, multi-step questions and following up aggressively.

She'll expect to be able to export or act on data — she may be frustrated by MVP limitations here.

### UX Considerations

- Evidence and reasoning transparency are non-negotiable for Hermione — she will click "show reasoning" every time
- The confidence scoring methodology needs to be explainable, not just a label
- Multi-brand use within a single location needs to be at least possible (even if not elegantly supported in MVP)
- She'll benefit most from anomaly detection — "this week's usage of salmon is 30% above what orders would predict"

### Marketing Angle

**What lands:** Methodological rigor. "Know your ingredient economics, not just your revenue." Evidence-first language. Position PantryIQ as the intelligence layer that sits on top of her existing data.

**What turns her off:** Vague AI promises. "Magic" framing. Anything that implies the tool is making decisions for her rather than informing her decisions.

---

## 8. Albus Dumbledore — The Small Chain Owner

**Archetype:** Scaling Without Losing Control

### Demographics / Context

- Age: 40–58
- Establishment: 2–5 locations of the same concept (or similar), all owned by Dumbledore
- Revenue: $2M–$8M/yr across all locations
- Tech: Moderate — probably using a mix of tools, maybe Toast enterprise, probably not consolidated
- Staff: Multiple GMs, one per location; Dumbledore is the operator above the operators

### Psychographic Profile

Dumbledore has been successful enough to open multiple locations, which means he's now managing managers instead of managing kitchens. This creates a fundamental visibility problem: he can't be in three places at once, and each GM has their own way of doing things.

He suspects there's significant inconsistency across locations — different spoilage rates, different ordering habits, different margin profiles — but he can't see it clearly. He's also not sure if that inconsistency is a problem or just the nature of different neighborhoods.

He's done with gut instinct. He wants the business to run on systems. PantryIQ fits into a broader operational standardization effort.

His biggest fear: one bad location quietly dragging down the whole business while he's focused on the other two.

### A Day in His Life

Monday: calls or texts each GM to get the weekend recap. Reviews Square reports across all locations — manually, in separate tabs. Notes that Location 2 always seems to have worse margins and he still can't figure out why. Spends too much time on email. Has a monthly P&L call with his accountant where he finally sees consolidated numbers that are already 4 weeks old.

### Current Pain Points

- No consolidated view across locations — each GM runs their own operation opaquely
- Can't compare location performance side-by-side without manually stitching together reports
- Suspects one location has a spoilage or purchasing problem but can't prove it
- GMs have inconsistent data hygiene — some are meticulous, some are not

### What He Wants From a Tool Like This

- Per-location insights that he can review without talking to each GM
- A way to spot which location is underperforming and why — before the monthly P&L
- Ideally, some way to compare across locations (knows this is V2)
- Confidence that data is clean and trustworthy, not just what his GMs tell him

### Skepticisms and Objections

- "My GMs won't use this consistently"
- "Multi-location support needs to work or this is useless to me"
- "I don't want to pay per location if I have 5 locations"

### How He'll Use PantryIQ

Dumbledore is a **Dashboard-first user** who will check each location's dashboard independently (given MVP single-location scope). He'll use Chat occasionally for specific questions but primarily wants the dashboard to surface what needs his attention.

He'll need the location-switching UX to be frictionless.

### UX Considerations

- Location picker must be prominent and fast — he's switching contexts frequently
- Dashboard needs to be self-explanatory without requiring him to know the backstory of each location's data
- Recommendation urgency framing ("act today" vs. "watch this") matters because he can't act on everything at once
- Multi-location aggregation being V2 is a real gap for Dumbledore — the MVP needs to feel like it's building toward that

### Marketing Angle

**What lands:** "Run every location like your best location." Consistency and standardization framing. "Know which location needs your attention before it becomes a problem." Scaled operator language.

**What turns him off:** Tools that feel designed for single-location operators. Per-seat or per-location pricing that gets punitive at scale. Anything that implies he needs to be hands-on daily.

---

## 9. Nymphadora Tonks — The Mobile Bar / Catering Operator

**Archetype:** Event-Driven, Committed Orders, Zero Flexibility

### Demographics / Context

- Age: 28–45
- Establishment: Mobile bar, catering operation, or event-focused cocktail company
- Revenue: $100K–$600K/yr; highly seasonal
- Tech: Moderate — uses Square for event payments, Google Sheets or Airtable for event planning
- Staff: 1–5 people; often herself + contractors per event

### Psychographic Profile

Tonks's business is unlike any fixed-location restaurant. She commits to inventory before she knows exactly what will be consumed. Every event is its own P&L. She can't just push a special to move product — she buys for a specific event and what's left either rolls to the next event or goes to waste.

Her spoilage profile is unusual: spirits don't spoil, but fresh ingredients (citrus, herbs, perishable mixers) do — and she commits to buying them a week out before she knows the final guest count. She's been burned by clients who promise 200 guests and deliver 120.

She's entrepreneurial and scrappy. She often undercharges early clients because she's still figuring out her true cost. She knows her pricing needs to be tighter but doesn't have the data to back it up.

### A Day in Her Life

Gets a new event inquiry — 150-person wedding. Quotes based on gut and experience. Confirms the booking. One week out, builds her shopping list based on signature cocktails × estimated consumption per person. Day before: preps at her commissary or home kitchen. Day of: runs the event. Day after: counts what's left, calculates what she over-bought, updates her running mental model of consumption per person per cocktail type.

### Current Pain Points

- No reliable per-event cost calculation — she tracks revenue but not ingredient cost per event
- Consumption per person varies by event type (wedding vs. corporate vs. birthday) and she only knows this intuitively
- Leftover perishables from one event rarely transfer to the next if events are spaced out
- Can't accurately quote clients because she doesn't know her true cost

### What She Wants From a Tool Like This

- Per-event cost tracking — "what did this event actually cost me in ingredients?"
- Historical consumption patterns by event type — "how much citrus does a 150-person wedding actually use?"
- Smarter buying for upcoming events based on historical data
- Help building tighter pricing that reflects true ingredient cost

### Skepticisms and Objections

- "My 'inventory' doesn't work the same way as a restaurant's"
- "I don't have recurring transactions — every event is different"
- "This software probably wasn't built for how I work"

### How She'll Use PantryIQ

Tonks is a **Chat-heavy user with event-specific questions**. She'll import event data after each event (as a CSV or transaction history) and then ask retrospective questions: "How did my costs compare to my quote for last Saturday?" She'll also use Chat for forward-looking planning: "Based on past weddings, how much should I order for a 200-person event?"

### UX Considerations

- The import flow needs to handle non-standard CSV structures without breaking
- Chat needs to handle event-framed questions — "for last Saturday's event" — not just time ranges
- She benefits from a category structure that allows her to tag items as belonging to specific event types
- The per-item cost and consumption data needs to be queryable in chat even if the dashboard doesn't surface it directly

### Marketing Angle

**What lands:** "Know your true cost before you quote your next event." Event operator language. Pricing confidence framing — helping her stop undercharging.

**What turns her off:** Restaurant-specific language that doesn't map to her world. Anything that assumes she has a walk-in or a fixed menu.

---

## 10. Harry Potter — The Gastropub Owner-Operator

**Archetype:** High Complexity, High Stakes

### Demographics / Context

- Age: 35–52
- Establishment: Full-service gastropub with strong bar program and seasonal food menu
- Revenue: $1.2M–$3M/yr
- Tech: Moderate — uses Toast or Square for POS, possibly BevSpot for bar, chaos for the rest
- Staff: 12–25; GM, kitchen manager, bar manager all separate

### Psychographic Profile

Harry's operation is uniquely complex: he has a serious food program and a serious bar program, and they share kitchen resources, staff, and operational attention. His spoilage problems exist in both worlds and are hard to separate.

He's been in the industry long enough to know that the margin is in the details. He's not satisfied with "roughly right" — he wants to know exactly where money is going. But he also knows that running a gastropub is an exercise in constant triage: there's always something more urgent than the data.

He's frustrated that his bar manager and kitchen manager have different mental models of the business and he can't synthesize them into a single picture.

He's the type of operator who would genuinely use a sophisticated tool if it earned his trust — but he'll reject it loudly if it embarrasses him in front of his staff.

### A Day in His Life

Opens at 11am, does a walk-through of kitchen and bar. Catches up with both his kitchen manager and bar manager on what they need. Reviews last night's numbers in Toast. Has informal conversations about what's moving and what isn't. Does purchasing decisions by committee — he'll approve what Snape and Kingsley are thinking rather than override them. Spends evenings on the floor, watching service, making mental notes about waste.

### Current Pain Points

- No unified view of food + beverage together — two separate data streams that he mentally reconciles himself
- Spoilage in food and variance in bar are both problems but require different analysis
- Hard to compare his operation's performance to any benchmark — is his pour cost good or bad for a gastropub?
- His team's instincts are good but unvalidated — he's not sure where to trust them and where to push back

### What He Wants From a Tool Like This

- A single place to see food and beverage performance together
- Confidence that the spoilage and pour cost math is methodologically sound
- Something he can share with his kitchen manager and bar manager that gives them each what they need
- The ability to ask cross-cutting questions: "Which items on both menus have the worst margin?"

### Skepticisms and Objections

- "I already have Toast analytics — what does this add?"
- "My kitchen and bar managers won't agree on how to use the same tool"
- "I don't trust AI with my margins — it'll get the math wrong and I'll look stupid"

### How He'll Use PantryIQ

Harry is a **balanced user** across Dashboard and Chat. He'll use the dashboard for his weekly review and Chat to answer specific cross-cutting questions. He'll likely set up PantryIQ himself and then give his managers visibility once he trusts it.

He's the persona most likely to read the "show reasoning" section carefully and judge the tool on whether the logic holds up.

### UX Considerations

- Cross-category analysis (food + beverage in the same query) is essential for Harry
- The dashboard needs to not force him to choose between food and bar — both need to be visible
- "Show reasoning" needs to be rigorous enough that he'd feel comfortable forwarding it to his kitchen manager with a note
- Confidence levels need to be well-calibrated — if the AI says "high confidence" and the number is wrong, Harry will never trust it again

### Marketing Angle

**What lands:** "One view of your whole operation — food, bar, and everything in between." Complexity-acknowledgment framing. "Finally, a tool that understands gastropubs." Data rigor language for an operator who prizes getting the math right.

**What turns him off:** Oversimplified dashboards that don't reflect the complexity of his operation. Generic "restaurant analytics" positioning. Anything that feels like it was built for a fast-casual chain.

---

## Cross-Persona Patterns

### Shared Fears (Universal)
- Embarrassment from acting on bad data
- Wasting time on a tool that doesn't stick
- AI that makes things up without being able to show its work

### Shared Desires (Universal)
- Dollar-first insights — financial impact before operational detail
- Plain language explanations without jargon
- The ability to push back and challenge the AI's reasoning

### Where Personas Diverge Most

| Dimension | Kitchen-focused | Bar-focused | Owner-level |
|---|---|---|---|
| Primary entry point | Chat | Chat + Dashboard | Dashboard |
| Data trust | Low until proven | Moderate | Moderate |
| Shelf life / par level control | High priority | Moderate | Not relevant |
| Financial framing | Per-item waste | Pour cost / variance | Margin trends |
| Session frequency | A few times/week | Weekly | Weekly |
| Import ownership | Reluctant | Reluctant | Delegates |

### The Universal Adoption Gate

Every persona has the same adoption gate: **the first answer they get from PantryIQ must be believable and grounded.** If the first response feels made-up, generic, or wrong, no persona converts. The quality of the first interaction — whether via Chat or Dashboard — determines whether PantryIQ earns a second session.

---

## Document History

| Version | Date | Notes |
|---|---|---|
| v1 | May 2026 | Initial persona set, 10 archetypes across all establishment types |
