# QA Reconciliation: STRATEGY.md vs findings.json

**Date:** 26 September 2026  
**Scope:** Number reconciliation of quantitative claims and [Fxx] tags

## Check Results

### 1. Finding IDs Validation
✓ **PASS** — All 20 findings referenced in STRATEGY.md exist in findings.json (F01, F02, F03, F04, F05, F06, F07, F08, F09, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20).

### 2. Numerical Value Verification
✓ **PASS** — All quantitative claims verified against findings.json:
- Sample sizes (n): F06=85, F07=47, F08=111, F09=51, F10=5222, F12=517, F13=512, F20=1019 — all match
- Effect sizes: F01 (0.2%), F06-F20 effects (±0.1% to +1.3%) — all match
- Ranges: F11 (-0.7% to +0.6%), F17 (~19.9% engagement, ~10,100 views) — all match
- Combo search: F19 (6,760 combos) — confirmed

PT-BR decimal notation (0,5% = 0.5%; 52.214 = 52,214) handled correctly throughout.

### 3. Untagged Quantitative Claims
✓ **PASS** — No untagged quantitative claims found. All percentages, post counts, and engagement metrics carry [Fxx] tags or are acceptable contextual metadata (dataset size, methodology thresholds).

### 4. Low-Confidence Finding Presentation
✓ **PASS** — Low-confidence findings (F06, F07, F08, F09, F12, F13, F15) are appropriately hedged:
- **F06, F07, F08, F09** (confidence=low): All in section 2.3 explicitly labeled "prioridades de teste, não receita comprovada"
- **F12, F13** (confidence=low): Framed as "Testar, não escalar" and "Onde evitar por enquanto" with caveat "Isso não prova prejuízo"
- **F15** (confidence=low): Used in "O que parar de fazer" based on minimal effect size (0.1%), appropriately contextual

## Summary

**Overall Result: PASS**

**Defect Count: 0**

All numerical claims in STRATEGY.md are reconciled to findings.json. Finding references are complete, values are accurate (tolerance <1%), and low-confidence findings are presented without unwarranted certainty.
