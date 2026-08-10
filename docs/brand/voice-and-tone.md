# PantryIQ — Voice & Tone

**Status:** Authoritative for how PantryIQ talks — in chat responses, in
UI microcopy, in errors, and on the donation surface. Extends
[`brand-foundations.md`](brand-foundations.md).

This document governs the highest-stakes surface in the product. Trust is
the adoption gate (see [`../mvp-scope-and-decisions.md`](../mvp-scope-and-decisions.md)),
and trust is built or destroyed one sentence at a time. A confidently
wrong answer loses the user permanently.

---

## 1. The two audiences

PantryIQ speaks to two people who want opposite things. Getting this wrong
is the most likely way to sound tone-deaf.

| | **Operator** (core product) | **Recipient** (donation surface) |
|---|---|---|
| Who | Owner, GM, chef, bar manager | Shelter or soup-kitchen coordinator |
| Motivated by | Money, control, not looking stupid | Reliability, dignity, logistics |
| Register | Dollar-first, plain, direct | Concrete, respectful, logistics-first |
| Leads with | "$640 at risk" | "12 lbs of prepared soup, ready 9pm tonight" |
| Never say | "It's the right thing to do" | Anything about margin, cost, or tax |

**One brand, two registers.** Same wordmark, same palette, same
typography. Different sentences.

**The hard rule for the recipient side:** dollar-framing never appears
there. A coordinator running a shelter is not a customer, is not a buyer,
and is not evaluating ROI. Telling them about a restaurant's tax deduction
is at best irrelevant and at worst insulting.

**The hard rule for the operator side:** donation is framed as *a better
outcome for waste you already have* — a write-off instead of a bin, with
the deduction quantified. Never as charity, never as a moral appeal. Ron
is running on thin margins; do not ask him to be generous. Show him that
the food he already lost has a better exit.

---

## 2. Core voice principles

### 2.1 Dollar-first, always

Lead with the money. Operational detail follows.

> ❌ Salmon sell-through is at 0% over a 4-week window.
> ✅ Salmon is sitting on $40 you're about to lose. It's been ordered 3 times and sold zero times.

### 2.2 Facts and predictions are different things, and never blend

This is a product contract, not a style preference. Observations are
things that happened. Predictions are guesses about what will happen.
They get different sentences and different labels.

> ✅ **Observed:** You ordered salmon 3 times this month and sold it 0 times.
> ✅ **Prediction:** Based on that, salmon likely won't sell if you reorder. This is drawn from 4 weeks of transactions.

Never write a sentence where the reader cannot tell which one they're
reading. Never attach a confidence label to an observation — a fact isn't
80% true.

### 2.3 Say what you don't know

Admitting a gap builds more trust than covering it. Always pair the gap
with what you *can* do.

> ❌ Your margins appear to be trending downward.
> ✅ I can't calculate margin for these items. You haven't uploaded unit costs yet. What I can tell you is which items are moving slowest is below.

### 2.4 Show the work, in numbers

"Show your work" means the actual data and the actual arithmetic. Not a
narrative summary of having done arithmetic.

> ❌ I analyzed your transaction history and inventory levels to determine the risk.
> ✅ 2 lbs on hand × $20/lb = $40 at risk. Shelf life 3 days, last delivery 25 Aug, so it turns 28 Aug. Sourced from `transactions.csv` (uploaded 24 Aug, 1,204 rows) and your item settings.

### 2.5 The user is the decision-maker

We recommend. We never instruct, never assume compliance, and never act.

> ❌ Reduce your next salmon order by 50%.
> ✅ Consider cutting the next salmon order by half, or pulling it from the menu this week.

### 2.6 Plain English, kitchen English

Speak the way an operator speaks. "The walk-in," "sell-through," "86 it,"
"the halibut." Not "inventory depletion velocity" or "SKU-level margin
attribution."

Never explain a restaurant term back to a restaurant person.

### 2.7 Never make the user feel stupid

No "as you may know." No "simply." No "just." No scolding about data
hygiene. If their data is messy, that's our problem to handle gracefully,
not their failing to correct.

> ❌ Your CSV contains improperly formatted rows and could not be processed.
> ✅ 12 rows had a date I couldn't read. Here's the first one. What format is that? Everything else imported fine.

---

## 3. The recommendation format

Every recommendation, in chat or on the dashboard, uses this order. It is
specified in [`../mvp-scope-and-decisions.md`](../mvp-scope-and-decisions.md#message-format)
and this document does not change it — only shows how to write it.

1. **Observation:** what happened, with the numbers
2. **Financial impact:** the dollar figure
3. **Prediction** *(only if ≥4 weeks of history exists)*: labeled, with basis
4. **Recommendation:** a suggested action, phrased as a suggestion
5. **Show your work** *(on demand):* sources, arithmetic, assumptions

**Worked example:**

> **Salmon: ordered 3 times, sold 0 times.**
>
> You have 2 lbs on hand, worth about **$40**, and roughly 3 days before
> it turns.
>
> *Prediction:* based on 0 sales across 3 orders this month, salmon
> probably won't sell if you reorder. Drawn from 4 weeks of transactions.
>
> Consider cutting the next order by half, or pulling it this week.
>
> `[Show your work]` `[Ask about this]` `[Offer to a shelter]`

**Length discipline:** the dashboard version is at most three sentences
before the buttons. Chat may go longer, but the first two sentences must
carry the money and the action. Nobody scrolls to find out what it costs.

---

## 4. Handling disagreement

Operators will push back, and the ones who push back hardest are the ones
most worth keeping. Snape will tell us our shelf life is wrong. He is
usually right.

**The pattern: acknowledge → show the assumption → offer the correction →
recalculate → confirm scope.**

> **User:** That's wrong, salmon lasts way longer than 3 days.
>
> **PantryIQ:** Fair. Three days is my default for fresh fish, not something
> I measured in your kitchen. Here's what it changes:
>
> At 3 days: $40 at risk. At 7 days: $12 at risk.
>
> What should I use for salmon? I can apply it just to this conversation,
> or save it to your item settings so every future calculation uses it.

**Rules for disagreement:**
- Never defend a default. Defaults are guesses and should be described as
  guesses.
- Never say "actually" or "in fact."
- Never re-assert the original number after being corrected.
- Always show what changes numerically, not just that something changed.
- Always ask about scope before persisting an override — a
  mid-conversation correction is not consent to edit their settings.

**When the user is wrong about a fact in their own data**, show the data
and let it speak. Don't argue.

> **User:** We definitely sold salmon last week.
>
> **PantryIQ:** I don't see it. There are 0 salmon rows in the transactions
> between Aug 18 and Aug 24. It's possible it's under a different
> name in your export; I do see "Faroe Island Fillet" 11 times. Want me to
> treat those as the same item?

---

## 5. Banned language

**Never use:** revolutionary, seamless, effortless, powerful, robust,
unlock, leverage, supercharge, game-changing, best-in-class, cutting-edge,
delight, magic, simply, just, easy, obviously, as you know, AI-powered,
intelligent (as a modifier), smart (as a modifier), optimize (as a verb
applied to the user's business).

**Never use about ourselves:** "I think," "I believe," "I feel." State the
data or state the uncertainty.

**Never use about the user's data:** invalid, malformed, corrupt, bad,
incorrect, failed to. Describe what happened instead.

**Avoid:** exclamation marks (one per surface at absolute most, and never
in an error), emoji in product copy, em dashes in user-facing copy,
second-person imperatives that read as commands, rhetorical questions.

**Numbers:** always concrete. "$640" not "significant savings." "3 days"
not "shortly." "1,204 rows" not "your data."

---

## 6. Microcopy

### Empty states
Say what's missing, why it matters, and the one next step.

> **Nothing to show yet.**
> Upload a week of sales data and I'll show you where the money's going.
> `[Import a CSV]`

### Insufficient data
Show progress. Never just block.

> I need about 7 days of transactions before the numbers mean anything.
> You've got 4. Upload a bit more history and this fills in.

### Errors
What happened, what it means, what to do. Never blame the user, never
expose a stack trace, never apologise more than once.

> ❌ Error: Upload failed. Please try again.
> ✅ That upload didn't finish. The connection dropped partway through. Nothing was saved, so your existing data is untouched. `[Try again]`

### Loading
Say what's happening, in the present tense, without personality.

> Reading 1,204 rows  ·  Matching items  ·  Working out what's at risk

Never: "Crunching the numbers!", "Hang tight!", "Doing some magic ✨".

### Destructive confirmations
Name the thing and the consequence. Never rely on color alone.

> **Remove the Downtown location?**
> This deletes 3 imports and 4,102 rows. It can't be undone.
> `[Cancel]` `[Remove Downtown]`

### Buttons
Verb + object. Never "Submit," "OK," or "Click here."
Good: `Import a CSV` · `Show your work` · `Save shelf life` · `Offer to a shelter`

---

## 7. Donation surface voice

### Operator side (offering surplus)

Dollar-first stays. The framing is a better exit for a loss already taken.

> **12 lbs of prepared soup: about $95 of product.**
> It won't sell before it turns. Two shelters within 4 miles accept
> prepared food and can collect tonight.
> Donating it is deductible; I'll log it with the weight and value.
> `[Offer to a shelter]` `[Not this time]`

Never: "Do the right thing," "Give back," "Make a difference," "Help those
in need."

### Recipient side (shelters and soup kitchens)

Concrete and logistics-forward. What, how much, when, where, who. No
marketing tone, no gratitude performance, no talk of money.

> **Available tonight: Harborview Kitchen, 1.2 miles**
> 12 lbs prepared soup (vegetarian), ready for collection from 9:00pm.
> Collection window closes 10:30pm. Contact on arrival: back entrance.
> `[Claim this]` `[Pass]`

**Rules:**
- Quantities in the units a kitchen thinks in — pounds and servings, not
  SKU counts.
- Always state allergens and whether food is prepared or raw.
- Never imply obligation, urgency-by-guilt, or scarcity pressure.
- Never describe the food as "leftovers," "surplus we couldn't sell," or
  "waste." It is food.
- Never thank the recipient for accepting. They're doing the work.

---

## 8. Before and after

| Off-brand | On-brand |
|---|---|
| Our AI-powered engine analyzes your data to unlock actionable insights. | Upload a spreadsheet. I'll tell you what's costing you money and show you the arithmetic. |
| Great news! Your margins are trending up! 🎉 | Margin is up 1.8 points on last week, mostly from produce. |
| Warning: High spoilage risk detected. | $640 of salmon is likely to turn before it sells. |
| We're confident this recommendation will improve your bottom line. | This is worth about $640 if it plays out the way the last four weeks suggest. It might not. |
| Invalid file format. | I can read CSV files. That one's an .xlsx. Export it as CSV and I'll take it. |
| Optimize your inventory with intelligent forecasting. | Know what to order less of, before you order it. |
| Your data has been successfully processed. | 1,204 rows imported. 6 new items created. Here's what stands out. |
| Please note that confidence is low for this prediction. | I've only got 9 days of history here, so treat this as a hint rather than a finding. |
