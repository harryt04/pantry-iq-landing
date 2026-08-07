# PantryIQ — AI Cost Analysis

**Version:** 2.0
**Date:** 2026-03-28
**Purpose:** Full market comparison of all relevant LLM models — including the newest and most expensive options — with sourced, verified pricing and margin analysis. Version 1.0 only covered a subset of models and did not include the latest model generations.

---

## Sources (verified March 28, 2026)

- **OpenAI:** https://platform.openai.com/docs/pricing (fetched live)
- **Anthropic:** https://claude.com/pricing (fetched live — API section)
- **Google (Vertex AI):** https://cloud.google.com/vertex-ai/generative-ai/pricing (fetched live)

> All prices are standard (non-batch, non-priority) tier unless noted.

---

## 1. Token Pricing — Full Market Comparison (March 2026)

All prices in USD per 1,000,000 tokens.

### OpenAI Models

| Model        | Input ($/1M) | Cached Input ($/1M) | Output ($/1M) | Notes                                |
| ------------ | ------------ | ------------------- | ------------- | ------------------------------------ |
| GPT-5.4 nano | $0.20        | $0.02               | $1.25         | Cheapest GPT-5.4 class               |
| GPT-5.4 mini | $0.75        | $0.075              | $4.50         | Strong mini for coding/agents        |
| GPT-5.4      | $2.50        | $0.25               | $15.00        | Flagship model                       |
| GPT-5.4 pro  | $30.00       | —                   | $180.00       | Most powerful/expensive OpenAI model |

> Source: https://platform.openai.com/docs/pricing

**Note on GPT-4o and older models:** GPT-4o and GPT-4o mini are no longer listed as flagship models on OpenAI's pricing page as of March 2026. The GPT-5.4 family has replaced them. The v1 cost-analysis.md used GPT-4o at $2.50/$10.00 and GPT-4o mini at $0.15/$0.60 — these prices reflected older models that are no longer the current offerings.

### Anthropic Models

| Model                    | Input ($/1M) | Cached Read ($/1M) | Output ($/1M) | Notes                                        |
| ------------------------ | ------------ | ------------------ | ------------- | -------------------------------------------- |
| Claude Haiku 3 (legacy)  | $0.25        | $0.03              | $1.25         | Previous generation — still available        |
| Claude Haiku 4.5         | $1.00        | $0.10              | $5.00         | Current Haiku — fastest/cheapest current gen |
| Claude Sonnet 4.5        | $3.00        | $0.30              | $15.00        | Current mid-tier                             |
| Claude Sonnet 4.6        | $3.00        | $0.30              | $15.00        | Current mid-tier (latest Sonnet)             |
| Claude Opus 4.5          | $5.00        | $0.50              | $25.00        | Previous Opus generation                     |
| Claude Opus 4.6          | $5.00        | $0.50              | $25.00        | Most powerful current Anthropic model        |
| Claude Opus 4.1 (legacy) | $15.00       | $1.50              | $75.00        | Older Opus — still listed, expensive         |

> Source: https://claude.com/pricing (API section)

**Note:** The v1 cost-analysis.md used "Claude 3 Haiku" at $0.25/$1.25 (still valid — legacy model still available) and "Claude 3.5 Sonnet" at $3.00/$15.00. The current equivalent is Claude Sonnet 4.x at the same price. Haiku 4.5 is now 4× more expensive than Claude Haiku 3 for input. This significantly changes the default model recommendation.

### Google (Vertex AI — Gemini Models)

Standard tier, text input/output, short context (≤200K tokens).

| Model                    | Input ($/1M) | Cached Input ($/1M) | Output ($/1M) | Notes                            |
| ------------------------ | ------------ | ------------------- | ------------- | -------------------------------- |
| Gemini 2.0 Flash Lite    | $0.075       | —                   | $0.30         | Cheapest current Gemini          |
| Gemini 2.0 Flash         | $0.15        | —                   | $0.60         | Previous Flash generation        |
| Gemini 2.5 Flash Lite    | $0.10        | $0.01               | $0.40         | Cheapest 2.5-class               |
| Gemini 2.5 Flash         | $0.30        | $0.03               | $2.50         | Current fast model               |
| Gemini 2.5 Pro           | $1.25        | $0.13               | $10.00        | Current mid/high tier            |
| Gemini 3 Flash (Preview) | $0.50        | $0.05               | $3.00         | Next gen — preview only          |
| Gemini 3.1 Pro (Preview) | $2.00        | $0.20               | $12.00        | Next gen flagship — preview only |

> Source: https://cloud.google.com/vertex-ai/generative-ai/pricing

**Note:** Gemini 1.5 Flash and 1.5 Pro from v1 cost-analysis.md used character-based pricing and are now older-generation models. Current equivalents are the 2.0/2.5 series above.

---

## 2. Query Size Assumptions

Same assumptions as v1.0 — unchanged.

| Component                | Tokens     | Reasoning                              |
| ------------------------ | ---------- | -------------------------------------- |
| System prompt            | ~500       | Restaurant analytics persona and rules |
| Transaction data summary | ~2,000     | Compressed POS + supplier context      |
| Conversation history     | ~400       | Recent messages in thread              |
| User question            | ~50        | Typical natural-language query         |
| **Total input**          | **~3,050** | Rounded up for safety margin           |
| AI response              | ~500       | Explanation + short table or list      |
| **Total output**         | **~500**   |                                        |

---

## 3. Cost Per Query — All Models

```
cost_per_query = (input_tokens / 1,000,000 × input_price)
               + (output_tokens / 1,000,000 × output_price)
```

| Model                    | Input cost/query             | Output cost/query            | Total cost/query |
| ------------------------ | ---------------------------- | ---------------------------- | ---------------- |
| Gemini 2.0 Flash Lite    | 3050/1M × $0.075 = $0.000229 | 500/1M × $0.30 = $0.000150   | **$0.000379**    |
| Gemini 2.5 Flash Lite    | 3050/1M × $0.10 = $0.000305  | 500/1M × $0.40 = $0.000200   | **$0.000505**    |
| Gemini 2.0 Flash         | 3050/1M × $0.15 = $0.000458  | 500/1M × $0.60 = $0.000300   | **$0.000758**    |
| GPT-5.4 nano             | 3050/1M × $0.20 = $0.000610  | 500/1M × $1.25 = $0.000625   | **$0.001235**    |
| Claude Haiku 3 (legacy)  | 3050/1M × $0.25 = $0.000763  | 500/1M × $1.25 = $0.000625   | **$0.001388**    |
| Gemini 2.5 Flash         | 3050/1M × $0.30 = $0.000915  | 500/1M × $2.50 = $0.001250   | **$0.002165**    |
| GPT-5.4 mini             | 3050/1M × $0.75 = $0.002288  | 500/1M × $4.50 = $0.002250   | **$0.004538**    |
| Claude Haiku 4.5         | 3050/1M × $1.00 = $0.003050  | 500/1M × $5.00 = $0.002500   | **$0.005550**    |
| Gemini 2.5 Pro           | 3050/1M × $1.25 = $0.003813  | 500/1M × $10.00 = $0.005000  | **$0.008813**    |
| GPT-5.4                  | 3050/1M × $2.50 = $0.007625  | 500/1M × $15.00 = $0.007500  | **$0.015125**    |
| Claude Sonnet 4.6        | 3050/1M × $3.00 = $0.009150  | 500/1M × $15.00 = $0.007500  | **$0.016650**    |
| Claude Opus 4.6          | 3050/1M × $5.00 = $0.015250  | 500/1M × $25.00 = $0.012500  | **$0.027750**    |
| GPT-5.4 pro              | 3050/1M × $30.00 = $0.091500 | 500/1M × $180.00 = $0.090000 | **$0.181500**    |
| Claude Opus 4.1 (legacy) | 3050/1M × $15.00 = $0.045750 | 500/1M × $75.00 = $0.037500  | **$0.083250**    |

---

## 4. Monthly Cost Projections

| Profile      | Queries/day | Queries/month |
| ------------ | ----------- | ------------- |
| Average user | 5           | 150           |
| Power user   | 20          | 600           |

| Model                    | Avg user (150 q/mo) | Power user (600 q/mo) |
| ------------------------ | ------------------- | --------------------- |
| Gemini 2.0 Flash Lite    | **$0.057**          | **$0.23**             |
| Gemini 2.5 Flash Lite    | **$0.076**          | **$0.30**             |
| Gemini 2.0 Flash         | **$0.11**           | **$0.45**             |
| GPT-5.4 nano             | **$0.19**           | **$0.74**             |
| Claude Haiku 3 (legacy)  | **$0.21**           | **$0.83**             |
| Gemini 2.5 Flash         | **$0.32**           | **$1.30**             |
| GPT-5.4 mini             | **$0.68**           | **$2.72**             |
| Claude Haiku 4.5         | **$0.83**           | **$3.33**             |
| Gemini 2.5 Pro           | **$1.32**           | **$5.29**             |
| GPT-5.4                  | **$2.27**           | **$9.08**             |
| Claude Sonnet 4.6        | **$2.50**           | **$9.99**             |
| Claude Opus 4.6          | **$4.16**           | **$16.65**            |
| Claude Opus 4.1 (legacy) | **$12.49**          | **$49.95**            |
| GPT-5.4 pro              | **$27.23**          | **$108.90**           |

---

## 5. Gross Margin Analysis at $20 / Location / Month

Max allowable AI cost at 60% floor gross margin:

```
max_allowable_AI_cost = $20 × 0.40 = $8.00 / user / month (power user constraint)
```

| Model                       | Power user AI cost/mo | Gross margin %      | Viable at $20 flat?         |
| --------------------------- | --------------------- | ------------------- | --------------------------- |
| Gemini 2.0 Flash Lite       | $0.23                 | 98.9%               | Yes                         |
| Gemini 2.5 Flash Lite       | $0.30                 | 98.5%               | Yes                         |
| Gemini 2.0 Flash            | $0.45                 | 97.7%               | Yes                         |
| GPT-5.4 nano                | $0.74                 | 96.3%               | Yes                         |
| **Claude Haiku 3 (legacy)** | **$0.83**             | **95.9%**           | **Yes**                     |
| Gemini 2.5 Flash            | $1.30                 | 93.5%               | Yes                         |
| GPT-5.4 mini                | $2.72                 | 86.4%               | Yes                         |
| Claude Haiku 4.5            | $3.33                 | 83.4%               | Yes                         |
| Gemini 2.5 Pro              | $5.29                 | 73.6%               | Yes (tight)                 |
| GPT-5.4                     | $9.08                 | 54.6%               | **No — loss at power user** |
| Claude Sonnet 4.6           | $9.99                 | 50.1%               | **No — loss at power user** |
| Claude Opus 4.6             | $16.65                | -16.5% (loss)       | **No**                      |
| Claude Opus 4.1 (legacy)    | $49.95                | -150% (severe loss) | **No**                      |
| GPT-5.4 pro                 | $108.90               | -445% (severe loss) | **No**                      |

At $10 / truck / month (max AI budget = $4.00):

| Model                   | Power user AI cost/mo | Viable at $10 flat? |
| ----------------------- | --------------------- | ------------------- |
| Gemini 2.0 Flash Lite   | $0.23                 | Yes                 |
| Gemini 2.5 Flash Lite   | $0.30                 | Yes                 |
| Gemini 2.0 Flash        | $0.45                 | Yes                 |
| GPT-5.4 nano            | $0.74                 | Yes                 |
| Claude Haiku 3 (legacy) | $0.83                 | Yes                 |
| Gemini 2.5 Flash        | $1.30                 | Yes                 |
| GPT-5.4 mini            | $2.72                 | Yes                 |
| Claude Haiku 4.5        | $3.33                 | Yes (marginal)      |
| Gemini 2.5 Pro          | $5.29                 | **No**              |
| GPT-5.4 and above       | —                     | **No**              |

---

## 6. Effect of Prompt Caching

Both Anthropic and OpenAI (and Google Vertex AI for 2.5+ models) support prompt caching at ~10% of normal input price for cache reads.

If ~80% of input tokens are cacheable (system prompt + transaction data = ~2,500 of 3,050 tokens):

**Claude Haiku 3 with caching:**

```
Cached portion:    2,500 / 1M × ($0.25 × 0.12) = $0.000075  [cache read = $0.03/1M]
Non-cached:          550 / 1M × $0.25           = $0.000138
Total input:                                       $0.000213
Output (unchanged):                                $0.000625
Total per query with caching:                      $0.000838
```

~40% reduction (from $0.001388 to $0.000838). Power user monthly: ~$0.50.

**Claude Haiku 4.5 with caching:**

```
Cached portion:    2,500 / 1M × $0.10           = $0.000250
Non-cached:          550 / 1M × $1.00           = $0.000550
Total input:                                       $0.000800
Output (unchanged):                                $0.002500
Total per query with caching:                      $0.003300
```

~40% reduction (from $0.005550 to $0.003300). Power user monthly: ~$1.98.

---

## 7. Key Finding vs. Version 1.0

The v1.0 analysis recommended **Claude 3 Haiku** as the default, but used the label loosely. The actual current-generation equivalent is **Claude Haiku 4.5**, which costs **4× more on input** ($1.00 vs $0.25/1M). This is a significant change:

- Claude Haiku 3 is still available and listed by Anthropic as a legacy model. It remains the cheapest Anthropic option.
- If we want to use a current-generation Anthropic model as default, **Claude Haiku 4.5** costs ~$3.33/month for a power user — still viable at $20/location but tight at $10/truck.
- **Gemini 2.0 Flash** is the direct current-generation equivalent to the old "cheap default" benchmark: $0.15/$0.60 per 1M tokens, $0.45/month for a power user.
- **GPT-5.4 nano** ($0.20/$1.25) and **GPT-5.4 mini** ($0.75/$4.50) are OpenAI's current equivalents.

---

## 8. Recommendation Summary

| Model                       | Recommended role in PantryIQ                      | Notes                                                         |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| **Gemini 2.0 Flash Lite**   | Budget default if Google dependency is acceptable | Cheapest current option; adds Vertex AI dependency            |
| **Gemini 2.0 Flash**        | Alternative budget default                        | Excellent cost/quality; same Google Cloud dependency caveat   |
| **Claude Haiku 3 (legacy)** | Budget default (Anthropic, no Google)             | Still available; lowest cost non-Google option; may deprecate |
| **GPT-5.4 nano**            | Budget default (OpenAI-only stack)                | Good cost; current-gen OpenAI                                 |
| **GPT-5.4 mini**            | Mid-tier selectable                               | Reasonable cost; strong capability                            |
| **Claude Haiku 4.5**        | Mid-tier selectable                               | Current Anthropic fast model; 4× pricier than legacy Haiku    |
| **Gemini 2.5 Flash**        | Mid-tier selectable (with Google dep.)            | Good capability/cost balance                                  |
| **Gemini 2.5 Pro**          | Premium selectable                                | Tight margins at $20; not viable at $10 tier                  |
| **GPT-5.4**                 | Premium selectable                                | Loss-making at power-user level; UI must warn                 |
| **Claude Sonnet 4.6**       | Premium selectable                                | Loss-making at power-user level; UI must warn                 |
| **Claude Opus 4.6**         | Not recommended for v1                            | Deeply loss-making at all usage levels                        |
| **GPT-5.4 pro**             | Not recommended for v1                            | Catastrophically expensive; no viable pricing model           |
| **Claude Opus 4.1**         | Not recommended for v1                            | Legacy expensive model; no business case                      |

**Revised default recommendation:** The PRD's original choice of "Claude 3 Haiku" remains viable as **Claude Haiku 3 (legacy)** — it is still the cheapest non-Google option. However, product should treat this as temporary and plan the default migration path to a current-generation model. **Gemini 2.0 Flash** is the cleanest current-generation default if adding a Google Cloud dependency is acceptable. If staying OpenAI-only, **GPT-5.4 nano** is the best current default.

**For premium/selectable models:** GPT-5.4 and Claude Sonnet 4.6 are loss-making at the power-user level and must be clearly labeled as "Premium — higher cost" in the UI. Claude Opus 4.6 and GPT-5.4 pro should not be offered in v1.

---

## 9. Notes & Caveats

- These calculations assume a **single user per location**. Multiple power users on one $20/month location scale costs linearly.
- Token counts are **estimates**. Actual counts depend on how much transaction data context is injected per query. Prompt caching mitigates cost growth for stable context (system prompt + static transaction summary).
- Model pricing changes over time. Historically prices trend down as newer models launch. These numbers are a snapshot of March 2026.
- These calculations cover **AI inference cost only**. Infrastructure (hosting, database, weather API) adds additional COGS not reflected here.
- **Gemini models require Google Cloud (Vertex AI)** — this adds a cloud provider dependency the PRD explicitly wanted to avoid in v1 to keep the stack simple. The cost benefit is real but comes with an architectural trade-off.
- **Batch processing** (50% discount) is available from all three providers for asynchronous workloads. Real-time chatbot queries cannot use batch mode, but background data processing tasks (e.g., nightly summaries) could benefit from batch pricing.
