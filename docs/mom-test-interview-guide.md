# PantryIQ – Mom Test Interview Guide

**Purpose:** Deep discovery conversation with qualified prospects. Validates core product hypotheses, surfaces real pain, and determines willingness to pay — including under MVP constraints.  

---

## Hypotheses Under Test

The CPO's mission across all customer conversations is to prove or disprove these assumptions. Every interview should generate explicit signal on as many of the following as possible.

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

---

## Mom Test Ground Rules

1. **Never pitch.** Describe the problem space only. If they ask what you're building, deflect: "I'll tell you at the end — I want to hear about your experience first."
2. **No hypotheticals.** Never ask "would you use a tool that..." Ask what they have done, not what they would do.
3. **Specificity is signal.** Vague agreement ("yeah, spoilage is a problem") is not validation. A specific story with a dollar amount is.
4. **Silence is a tool.** After a question, wait. Don't fill the silence. The best answers come after a pause.
5. **Follow the energy.** If a prospect lights up on a topic, stay there longer than the guide suggests.

---

## Interview Structure

### Part 1 — Their Current Reality (10 minutes)
### Part 2 — Data, Tools, and the CSV Probe (10 minutes)
### Part 3 — Pain Severity and Willingness to Pay (10 minutes)
### Part 4 — Product Framing and Reaction (5–10 minutes)
### Part 5 — OAuth Provider Tally (5 minutes)
### Close

---

## Part 1 — Their Current Reality

Goal: understand how they actually run their operation today. No leading, no pitching.

---

**1.1** Walk me through how you ordered inventory in the last week or two. What did you order, and how did you decide how much?

> Listen for: gut-based decisions, supplier minimums, spreadsheet references, instinct anchored in experience. Note whether any tool or data informed the decision or whether it was purely intuitive.

---

**1.2** When was the last time you threw away food or product that you paid for? What happened?

> Listen for: a specific item, a specific dollar amount, a specific cause. Vague answers suggest low pain awareness. Specific stories with dollar figures suggest real and felt pain.  
> **H1 signal:** Does the story come easily, or do they have to think hard?

---

**1.3** Have you ever run out of something on a busy night — a key ingredient or a menu item? What did that cost you?

> Listen for: both the financial cost and the operational/emotional cost. Running out of a signature item on a Friday night has a dollar cost and a guest experience cost. Both matter.

---

**1.4** How do you currently know if your margins are healthy? Where does that information come from, and how often do you see it?

> Listen for: monthly P&L from an accountant, weekly POS reports, gut feeling, or "I don't really know." Note the lag — a monthly P&L means they're always acting on stale data.  
> **H3 signal:** When they describe margin health, do they reach for a dollar figure or a percentage?

---

**1.5** Tell me about a time you made a purchasing or ordering decision that turned out to be wrong. What would you have needed to know beforehand to make a better call?

> This question surfaces both the pain and the counterfactual. The counterfactual is the product pitch hiding in their own words.

---

**1.6** How long does it usually take you to realize something is trending — like a menu item slowing down, or spoilage getting worse on a particular ingredient?

> Listen for: "by the time I notice it's already too late," "I just see it at the end of the month," or "I usually catch it fast because I'm in the kitchen every day." Lag = pain.

---

## Part 2 — Data, Tools, and the CSV Probe

Goal: understand their current data literacy, tool usage, and whether CSV-based import is viable for this prospect. Do not use the word "CSV" until they do, or until the direct probe at 2.5.

---

**2.1** What software or tools do you use to track inventory or sales right now?

> Note the POS system specifically — this feeds the OAuth provider tally in Part 5.  
> Listen for: Square, Toast, Clover, Lightspeed, Revel, BevSpot, MarketMan, BlueCart, QuickBooks, spreadsheets, nothing.

---

**2.2** When did you last look at a report from your POS or inventory tool? What did you do with the information?

> Listen for: whether reports are consumed passively or acted on. A prospect who pulls reports and acts on them is a better fit than one who glances and moves on.

---

**2.3** Have you ever tried inventory management or analytics software before — anything beyond your POS? What happened? Did it stick or did you stop using it?

> If they churned from a previous tool: **ask why.** This is extremely high-value signal. Common answers: too much manual data entry, didn't trust the output, too complex to set up, nobody had time to maintain it.  
> Whatever killed the last tool, PantryIQ needs to solve that specific problem for this prospect.

---

**2.4** If I asked you to get me last month's sales data broken down by menu item — how long would that take, and what format would it be in?

> Do not prompt. Let them describe the process.  
> **H2a signal:**
> - "I'd download it from Square as a spreadsheet" → CSV-comfortable → manual upload likely acceptable
> - "I'd ask my accountant / GM" → data exists, access is delegated → possible friction
> - "I'm not sure that's possible" → data literacy gap → significant onboarding burden
> - "I'd just look at the dashboard" → consumes reports but may not know how to export raw data

---

**2.5** *(Direct CSV probe — use once 2.4 has been answered)*

Have you ever exported data from your POS or supplier system as a spreadsheet or CSV file — for accounting, for sharing with someone, for anything?

> This is now a direct question. It's fine to use the term "CSV" here.  
> **H2a signal:** Yes with experience = CSV-comfortable. Never = needs guided onboarding or may require OAuth before they'll engage.

---

**2.6** Some tools connect directly to your POS or accounting software — you authorize them once and they pull your data automatically. Have you ever set up a connection like that? Was it straightforward?

> This probes OAuth familiarity without naming it. Listen for: "yeah I connected Square to QuickBooks," "I use Zapier for something," or "I have no idea what you're talking about."  
> **H2a / H2b signal:** If they've done OAuth linking before, they will likely expect it as the default. A CSV-only MVP may feel dated to them.

---

**2.7** If getting started with a new tool required you to upload a file from your POS every week or two — rather than it pulling data automatically — would that be a dealbreaker, or would you do it to get access to the insights sooner?

> This is the most direct test of H2a. It is a hypothetical, which normally violates Mom Test rules — but it is appropriate here because we are explicitly testing a product constraint, not fishing for false validation.  
> **H2a positive:** "I'd do it, especially if the insights were worth it"  
> **H2a negative:** "I don't have time for that" or "I'd just wait until it connects automatically"  
> **H9 signal:** If they say they'd do it but want a price break for the inconvenience, that is the early-adopter framing. Note this.

---

## Part 3 — Pain Severity and Willingness to Pay

Goal: determine whether the pain is urgent enough to open a wallet.

---

**3.1** If spoilage is a real problem for you — roughly what do you think it's costing you per month? Have you ever tried to calculate it?

> Accept rough estimates. The number itself is less important than whether they've thought about it. Someone who says "I think it's somewhere between $500 and $2,000 a month and it bothers me that I don't know" is a better prospect than someone who says "it's probably not that much."  
> **H1 signal:** Can they estimate at all? Estimation = awareness = felt pain.

---

**3.2** Have you ever made a specific change to your operation — ordering differently, changing a supplier, pulling a menu item — specifically because of spoilage or margin? What happened?

> Past behavior is the strongest predictor of future behavior. If they've acted on this problem before, they will act on it again with better tools.

---

**3.3** If you knew exactly which three items were costing you the most in waste every week — what would you do differently?

> Listen for concrete actions: "I'd push a special," "I'd cut my order," "I'd 86 it." Concrete answers = real pain. Vague answers = intellectual interest without urgency.

---

**3.4** What tools do you currently pay for to run your operation? *(Not "would you pay" — "what do you pay for right now?")*

> List what they mention. Note anything they describe as essential vs. something they'd cut first.  
> **H9 signal:** Operators already paying for multiple SaaS tools are trained buyers. First-time SaaS buyers need more evidence before they commit.

---

**3.5** Have you ever paid for a tool, tried it for a month or two, and then canceled it? What made you walk away?

> Extremely high-value signal. Whatever killed that tool is a direct design constraint.

---

**3.6** If a tool like the one I'm describing existed and you found it genuinely useful in the first two weeks — what would you need to see to feel like it was worth paying for monthly?

> Listen for: a specific dollar amount saved, a specific decision made easier, a specific question answered. Concrete = real.  
> **H5 signal:** Do they expect value within days, or are they willing to give it a few weeks? "I'd need to see it pay for itself" is a positive signal.

---

## Part 4 — Product Framing and Reaction

Goal: describe the product at a high level and observe the reaction. Still no full pitch — frame it as a problem space, not a sales presentation.

---

*Say something like:*

> "Let me tell you a little about what we're building and get your reaction. We're working on a tool for restaurant and bar operators that takes your sales and purchasing data and helps you understand where you're losing money — specifically around spoilage and ordering. It surfaces the top things you should act on today, ranked by financial impact, and lets you ask questions in plain English — like 'why is my halibut margin so bad lately' — and get an answer with the evidence behind it. The idea is that the tool shows its work so you can decide whether to trust it."

Then ask:

---

**4.1** What's your first reaction to that?

> Do not fill the silence. Wait.

---

**4.2** What part of that sounds most useful to you?

> **H3 signal:** Do they reach for "knowing what's costing me money" (dollar framing) or "seeing what's trending" (operational framing)?  
> **H6 signal:** Do they react positively to "you decide whether to trust it"? Or do they want the tool to just tell them what to do?  
> **H7 signal:** Does the conversational chat framing ("ask questions in plain English") resonate, or does it feel unfamiliar?

---

**4.3** What part sounds least useful, or like it wouldn't fit how you work?

> Give them permission to be skeptical. The honest objections here are more valuable than the enthusiasm.

---

**4.4** If this tool existed today, who in your operation would actually use it day-to-day?

> **H8 signal:** If they describe themselves using it, they're the buyer and the user. If they describe handing it to their GM or chef, note the internal champion dynamic — the buyer and the daily user may not be the same person.

---

**4.5** What would make you not trust the output — what would have to be wrong for you to walk away?

> This is the most important question in this section. Listen for: "if it gets the math wrong once I'll never believe it again," "if it can't explain where the number came from," "if it doesn't account for how my kitchen actually works." These are direct design requirements.  
> **H4 signal:** Do they want evidence and reasoning, or do they just want a clean answer?

---

## Part 5 — OAuth Provider Tally

Goal: understand which data integrations would unlock subscription willingness and which are nice-to-have.

---

*Say something like:*

> "Right now, the tool works by having you upload your data as a file — like a CSV export from your POS — every week or two. We'll eventually build direct connections that pull your data automatically. I want to understand which of those connections would matter most to you."

---

**5.1** *(Direct CSV dealbreaker question)*

Knowing that the current version requires a manual file upload every week or two — is that a dealbreaker for you, or would you be willing to do that to get access to the insights now, especially if the price reflected that it's an early version?

> Record the answer verbatim in the OAuth tally log.  
> - **"Dealbreaker"** → prospect is blocked until OAuth exists; note which provider they need
> - **"I'd do it"** → prospect is a potential early adopter; note willingness and any price sensitivity
> - **"Depends on how long it takes / how painful it is"** → conditional; probe what "acceptable" looks like

---

**5.2** *(OAuth provider ranking)*

Of the systems you use today, which ones would be most important for the tool to connect to automatically? Let's go through them:

Ask about each of the following only if relevant to their operation:

| Provider | Ask if... | Record: Need / Want / Not relevant |
|---|---|---|
| Square | They use Square as POS | |
| Toast | They use Toast as POS | |
| Clover | They use Clover as POS | |
| Lightspeed | They use Lightspeed as POS | |
| Revel | They use Revel as POS | |
| QuickBooks | They use QuickBooks for accounting | |
| Xero | They use Xero for accounting | |
| Sysco / US Foods EDI | They order from a broadline distributor | |
| BevSpot / Backbar | They manage a bar program | |
| MarketMan / BlueCart | They use a dedicated inventory tool | |
| Otter / Deliverect | They operate a ghost kitchen or delivery brand | |

**Definitions to share with the prospect if they ask:**
- **"Need"** = I won't subscribe until this integration exists
- **"Want"** = I'd use CSV for now but this integration would make it much easier; I'd stay longer and pay more

> Record these in the OAuth tally log below. Aggregate across all interviews to identify which integrations unlock the most subscriptions.

---

**5.3** If we built the Square *(or their primary POS)* integration first and everything else was still CSV — would that be enough for you to get started?

> This tests whether a single high-value integration removes the CSV barrier for most prospects.

---

## Close

Thank the prospect genuinely. Do not pitch unless they explicitly ask to hear more.

If they ask what you're building, now is the time to describe it briefly. If they express interest:

> "We're onboarding a small group of early operators to help us shape the product. If you'd be interested in getting access early — likely at a discounted rate that you'd keep even after we build out more integrations — I'd love to stay in touch. Can I follow up with you in a few weeks?"

Note their response in your interview log.

---

## Interview Debrief Checklist

After each interview, record the following before moving on:

1. Operator type (use two-to-five word description)
1. POS system used
1. Pain level: **specific story with dollar amount** / vague awareness / no awareness
1. CSV familiarity: exports own data / knows it exists but delegates / unaware
1. CSV dealbreaker: yes / no /  bconditional
1. Early-adopter willingness: yes / no / conditional
1. OAuth providers: need (list) / want (list)
1. Hypotheses confirmed: (list H# values)
1. Hypotheses challenged: (list H# values)
1. Most memorable quote from this interview:
1. Any design insight or product requirement surfaced:

---