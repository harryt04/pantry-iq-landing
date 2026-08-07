# Session 1 Planning Index

**Created:** May 28, 2026  
**Purpose:** Entry point for all Session 1 planning documents

---

## Quick Navigation

### Start Here

1. **[SESSION-1-SUMMARY.md](./SESSION-1-SUMMARY.md)** — 5-min overview of what we accomplished
2. **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** — One-page cheat sheet of the 3 core decisions

### Deep Dives

3. **[RECOMMENDATION-ENGINE-ARCHITECTURE.md](./RECOMMENDATION-ENGINE-ARCHITECTURE.md)** — Full spec of the scoring system
4. **[CPO-QUESTIONS.md](./CPO-QUESTIONS.md)** — 15 questions for product review (share with CPO)
5. **[GRILLING-SESSION-NOTES.md](./GRILLING-SESSION-NOTES.md)** — All decisions, assumptions, unknowns

### Implementation Prep

6. **[PRD-SKELETON.md](./PRD-SKELETON.md)** — PRD outline ready to be filled in after CPO input

---

## What Happened This Session

We designed the **recommendation engine** by grilling through:
- How recommendations should be phrased (facts + predictions)
- How to score and rank them (Impact + Urgency + Confidence)
- How to architect the system for future tuning and learning
- What questions the CPO needs to answer before we build

**Output:** 6 documents totaling 1,743 lines of specification

---

## Key Decisions

| Decision | File | Status |
|---|---|---|
| CSV-first MVP (no Square) | GRILLING-SESSION-NOTES.md | ✅ Decided |
| Recommendation philosophy | RECOMMENDATION-ENGINE-ARCHITECTURE.md | ✅ Decided |
| Pluggable scoring weights | RECOMMENDATION-ENGINE-ARCHITECTURE.md | ✅ Decided |
| Dual-surface (dashboard + chat) | GRILLING-SESSION-NOTES.md | ✅ Decided |
| User feedback loop for learning | GRILLING-SESSION-NOTES.md | ✅ Decided |
| Defer calculations to CPO | CPO-QUESTIONS.md | ✅ Decided |

---

## What's Next

### Immediate (Next 1–2 Days)

- [ ] Review SESSION-1-SUMMARY.md
- [ ] Decide: Loop in CPO now, or review all planning docs first?
- [ ] If looping CPO: Share CPO-QUESTIONS.md + RECOMMENDATION-ENGINE-ARCHITECTURE.md
- [ ] If reviewing: Schedule Grilling Session 2 (data model design)

### This Week

- [ ] CPO provides input to Q1–Q15 in CPO-QUESTIONS.md
- [ ] Grilling Session 2: Design data model and database schema
- [ ] Grilling Session 3: Design workflows (import, dashboard, chat, settings)

### Next Week

- [ ] Integrate CPO input into RECOMMENDATION-ENGINE-ARCHITECTURE.md
- [ ] Integrate all decisions into final PRD
- [ ] Create TRD (Technical Requirements Document)
- [ ] Ready for engineering implementation

---

## File Descriptions

### SESSION-1-SUMMARY.md (7.1 KB)
**5-minute read.** What we accomplished, key decisions made, assumptions checked, open questions for CPO.

### QUICK-REFERENCE.md (4.5 KB)
**1-minute read.** The 3 core decisions on one page. Bookmark this for quick reference.

### RECOMMENDATION-ENGINE-ARCHITECTURE.md (9.1 KB)
**15-minute read.** Complete spec of how recommendations are scored, ranked, formatted, and surfaced. This is the heart of the session.

**Sections:**
- Core philosophy
- Message structure (observation + impact + prediction + recommendation + show your work)
- Scoring system (3 dimensions: Impact, Urgency, Confidence)
- Dashboard alert ranking
- Chat-driven insights
- User feedback loop
- Edge cases and honest boundaries
- Tuning & configuration

### CPO-QUESTIONS.md (11 KB)
**Reference.** 15 detailed questions for the CPO to answer. Share this with CPO + RECOMMENDATION-ENGINE-ARCHITECTURE.md.

**Topics:**
- Q1–Q7: Recommendation scoring (Impact, Urgency, Confidence calculation methods)
- Q8–Q11: Data model (categories, shelf life, POs, locations)
- Q12–Q14: Chat & interaction design (scope, explainability, overrides)
- Q15: Success metrics

### GRILLING-SESSION-NOTES.md (11 KB)
**Reference.** Everything that happened in the grilling session: decisions made, architectural implications, assumptions, unknowns, next steps.

**Sections:**
- Session goals
- Decisions 1–6 (CSV-first, confidence framework, dual-surface, pluggable scoring, user feedback, CPO defer)
- Architectural implications
- Open questions
- Assumptions matrix
- Next steps (5 grilling sessions planned)

### PRD-SKELETON.md (17 KB)
**Planning reference.** The outline of the final PRD, showing where each planning decision feeds in and what still needs CPO input.

**Sections:**
1. Executive Summary
2. MVP Features by Page (Dashboard, Chat, Import, Settings)
3. Recommendation Engine Spec
4. Data Model
5. User Workflows
6. Trust Requirements
7. Constraints & Boundaries
8. Success Metrics
9. Open Questions
10. Dependencies & Critical Path
11. Roadmap (MVP → Phase 2–3)
12. Document References

**Status:** Ready to be filled in after CPO input

---

## How to Use These Documents

### If you're reviewing alone:
1. Read SESSION-1-SUMMARY.md (5 min)
2. Read QUICK-REFERENCE.md (1 min)
3. Skim GRILLING-SESSION-NOTES.md (decisions made)
4. Deep-dive RECOMMENDATION-ENGINE-ARCHITECTURE.md if you want details

### If you're sharing with CPO:
1. Share SESSION-1-SUMMARY.md (context)
2. Share CPO-QUESTIONS.md (what we need from them)
3. Share RECOMMENDATION-ENGINE-ARCHITECTURE.md (how we're thinking about it)
4. Say: "Review these and answer Q1–Q15 so we can finalize the PRD"

### If you're kicking off engineering:
1. Wait for CPO input on Q1–Q15
2. Integrate into RECOMMENDATION-ENGINE-ARCHITECTURE.md
3. Share PRD-SKELETON.md with engineering team
4. Have them flag any blockers or questions
5. Create TRD (Technical Requirements Document)

---

## Questions?

- "What's the core recommendation engine philosophy?" → QUICK-REFERENCE.md
- "How do we score recommendations?" → RECOMMENDATION-ENGINE-ARCHITECTURE.md (Scoring section)
- "What does the CPO need to decide?" → CPO-QUESTIONS.md
- "What are we deferring?" → GRILLING-SESSION-NOTES.md (Open Questions section)
- "What's the full PRD outline?" → PRD-SKELETON.md

---

## Status Checklist

Session 1 Deliverables:
- [x] Recommendation engine philosophy designed
- [x] Scoring framework architected
- [x] 15 CPO questions identified
- [x] PRD skeleton created
- [x] Planning documents organized

Session 1 Complete: **May 28, 2026**

Next Session: **Data Model Design (Grilling Session 2)**

---

*Last updated: May 28, 2026*
