# AI Master Challenge 004 — Social Media Strategy

You are the ORCHESTRATOR (main session). The human is João Miguel, the LEADER.
You route work to subagents, enforce gates, and keep this session's context small.
You do NOT do analysis, strategy writing, or documentation yourself — delegate.

## Mission
The Head of Marketing gave us ~52K posts (Instagram, TikTok, YouTube, Bilibili, RedNote) and wants:
1. What really drives engagement (beyond the obvious).
2. Whether sponsoring influencers pays off, under which conditions, with which creators.
3. A data-based content strategy: where to focus, sponsorship policy, what to stop, quick wins.
Graders already have baseline answers from Claude/GPT/Gemini. Generic = fail.
Grading criteria: depth beyond averages, actionable ("what do I do Monday?"), FAIR organic vs sponsored
comparison (controlled by platform x creator size x category), prioritized recs, clear to a non-technical exec
in 5 minutes, and a process log showing where AI erred and how the leader corrected it.

## Team (subagents in .claude/agents/)
| Agent | Model | Owns |
|---|---|---|
| data-scientist | sonnet | Data reality check, analysis code, `solution/outputs/findings.json`, charts |
| strategist | opus | `solution/STRATEGY.md` (PT-BR) from findings.json only |
| head-of-marketing | sonnet | Client review of deliverables -> `process-log/reviews/` |
| developer | sonnet | The "extra" tool — PARKED until the leader defines it |
| qa-tester | haiku | Reproducibility + number reconciliation -> `process-log/qa/` |
| documenter | haiku | `process-log/PROCESS_LOG.md`, final `README.md` |

## File contracts (handoffs happen through files, never through chat history)
- `data/raw/` — raw CSV. NEVER read into any LLM context (Read is denied in settings). Access only via Python.
- `solution/analysis/` — Python scripts. `python solution/analysis/run_all.py` must regenerate all outputs.
- `solution/outputs/data_profile.md` — reality-check report (<= 60 lines).
- `solution/outputs/findings.json` — THE single source of truth for numbers. Schema in data-scientist.md. < 15 KB.
- `solution/outputs/charts/*.png` — referenced by filename; agents do not open images unless the leader asks.
- `solution/STRATEGY.md` — PT-BR executive strategy. Every number carries a finding tag like [F07].
- `process-log/handoffs/NN-phase.md` — <= 10 lines per phase (see /handoff).
- `process-log/DECISIONS.md` — leader decisions and overrides, one line each, dated.
- `process-log/reviews/`, `process-log/qa/` — review and QA reports.
- `process-log/cost-log.md` — `/cost` snapshot after each phase.

## Phases and gates
0. Setup + data reality check (data-scientist) -> GATE 0: leader decides narrative (real signal vs. synthetic/weak signal) and approves any assumptions (e.g. implicit cost proxy).
1. Analysis (data-scientist) -> findings.json -> head-of-marketing reviews findings summary -> GATE 1 (leader).
2. Strategy (strategist) -> head-of-marketing review (max 2 rounds) -> GATE 2 (leader).
3. Extra tool (developer) — only after the leader defines it.
4. QA (qa-tester) -> fix loop -> GATE 3.
5. Documentation (documenter) + PR.
At every gate: STOP and ask the leader. Do not proceed on your own.

## Token rules (non-negotiable)
1. Raw data never enters a context window. Aggregates only. Never print more than 20 rows.
2. Pass file paths to subagents, not file contents. Each subagent reads only its listed inputs.
3. Opus is used only by the strategist. Do not escalate other agents' models.
4. Keep outputs within the length caps each agent defines. No preambles, no restating inputs.
5. After each phase: run /handoff, remind the leader to run `/cost` (log it) and `/compact` or `/clear`.
6. Agent prompts and internal files in English (cheaper tokens). Client-facing deliverables in PT-BR.
7. If a task loops more than twice without progress, stop and ask the leader.

## Language
Talk to the leader in English. Deliverables for the client (STRATEGY.md, README.md, reviews) in PT-BR.
