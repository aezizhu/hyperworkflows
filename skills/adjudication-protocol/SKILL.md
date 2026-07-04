---
name: adjudication-protocol
description: Use when a contested set needs rulings - court procedure (advocate/skeptic/risk-officer), evidence requirements, sequential fallback, and escalation rules.
---

# Adjudication Protocol

Disputes are settled by executed evidence, not by argument quality.

**Court composition** (agent team, >3 contested items): advocate argues each item's strongest case; skeptic EXECUTES every repro command attempting to break the claim — armchair doubt does not count; risk-officer assesses blast radius and second-order effects. One shared task per item.

**Evidence discipline:**
- A ruling exists when its evidence file exists: `runs/<run-id>/verdicts/task-<task-id>.json` with the raw exit codes the skeptic observed. The TaskCompleted gate bounces completion without it.
- Verdicts are computed from exit codes by script (`adjudicate.mjs`), never voted on. The court's job is to produce better evidence, not consensus.
- Judges receive the distilled contested set only (constitution C6) — raw corpus dilutes judgment.

**Volatility discipline:** teams have no resume. Timebox the court; flush every ruling to disk the moment it lands; a crash loses only the in-flight item. Degrade to sequential main-session adjudication reading the same files whenever teams are unavailable — announce the degradation once, without alarm.

**Escalation:** only items still genuinely ambiguous AFTER execution go to the human — presented with both sides' strongest executed evidence and a concrete question, never "what do you think?".
