---
description: Close the current phase — write the handoff note and update the process log
argument-hint: <phase number and name, e.g. "1 analysis">
---
Close phase: $ARGUMENTS

1. Write process-log/handoffs/<NN>-<slug>.md with at most 10 lines:
   - Delivered (files)
   - Agents used (and models)
   - What AI got wrong / what was corrected
   - Leader decisions taken (also append each one, dated, to process-log/DECISIONS.md if missing)
   - Open questions for the next phase
2. Ask the leader to paste the current `/cost` output; append it to process-log/cost-log.md under this phase.
3. Invoke the documenter subagent to append this phase to process-log/PROCESS_LOG.md.
4. Tell the leader: "Phase closed. Run /compact (or /clear) before the next phase."
