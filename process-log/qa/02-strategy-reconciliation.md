# Strategy Reconciliation Report — Round 2

**Date:** 26 September 2026  
**Scope:** solution/STRATEGY.md vs. solution/outputs/findings.json  
**Method:** Manual systematic check of all [Fxx] tags and quantitative claims

---

## Summary

**FAIL** — One numerical discrepancy and one confidence-use concern found.

---

## Finding-by-Finding Verification

| Tag | Strategy Claim | findings.json Value | Status |
|---|---|---|---|
| F01 | max 0,2% gap between creator sizes | 0.2% (effect_size) | ✓ MATCH |
| F02 | evening +0,1%, night -0,1% (Bilibili) | evening +0.1%, night -0.1% | ✓ MATCH |
| F03 | evening +0,1%, same as night (Instagram) | evening +0.1%, same as night | ✓ MATCH |
| F04 | <5% difference in duration | <5% difference | ✓ MATCH |
| F05 | max 0,2% gap in hashtag count | 0.2% (effect_size) | ✓ MATCH |
| F06 | RedNote text beauty Small +0.9% (n=85) | 0.9% (n=85) | ✓ MATCH |
| F07 | YouTube text tech Mega +0.9% (n=47) | 0.9% (n=47) | ✓ MATCH |
| F08 | RedNote mixed beauty Mega -1.0% (n=111) | -1.0% (n=111) | ✓ MATCH |
| F09 | Bilibili text tech Small -0.8% (n=51) | -0.8% (n=51) | ✓ MATCH |
| F10 | Small creators ~1pp in bottom 10% (n=5222) | 1pp overrepresentation (n=5222) | ✓ MATCH |
| F11 | sponsored vs organic: -0.7% to +0.6%, typically 0% | range 0.993x-1.006x (~-0.7% to +0.6%) | ✓ MATCH |
| F12 | Instagram Large tech +0.6% (n=517) | 0.6% (n=517) | ✓ MATCH |
| F13 | TikTok Mega tech -0.7% (n=512) | -0.7% (n=512) | ✓ MATCH |
| F14 | disclosure (explicit/implicit) max 0.1% | 0.1% (effect_size) | ✓ MATCH |
| F15 | age (best Bilibili 50+) +0.1% (n=516) | 0.1% (n=516) | ✓ MATCH |
| F16 | gender max 0.1% gap | 0.1% (effect_size) | ✓ MATCH |
| F17 | 126K–874K follower range, ~10,100 views, ~19.9% ER, 240 groups, 2pp range | All exact matches | ✓ MATCH |
| F18 | audit confirms F01/F11/F17; follower-views r=0.005 | exact match reported | ✓ MATCH |
| F19 | 6,760 combos, "nenhuma passou de 1,3%" | finding says best +1.3%, **worst -1.4%** | ✗ **DISCREPANCY** |
| F20 | >60s evening tech 100K+: Bilibili +0.5% (n=1019) | +0.5% (n=1019) | ✓ MATCH |
| F21 | brief combo (30–60s tech 10K–50K): n=20, shares 1.00x (1.01x mean), ER 0.995x | All exact matches; per-platform 0.96x–1.03x | ✓ MATCH |

---

## Issues Found

### 1. F19 Numerical Discrepancy (DEFECT)

**Location:** solution/STRATEGY.md, line 14 (Part 1) and line 82 (Appendix)

**Strategy claim:**  
> "nenhuma se afastou mais de 1,3% do típico [F19]" (Part 1)  
> "nenhuma de 6.760 combinações passa de 1,3%" (Appendix, line 82)

**findings.json reality:**  
- F19 effect_size field: "max deviation across combos = 1.3%"  
- F19 claim text: "Best: +1.3% vs median; worst: -1.4%"

**Issue:** The strategy states none of 6,760 combos deviated >1.3%, but findings.json explicitly reports worst = -1.4%, which exceeds this threshold by 0.1pp.

**Expected:** Either update strategy to "nenhuma passa de 1,4%" or verify F19 finding is correct.

---

### 2. F15 Low-Confidence Finding Used Without Caveat (MINOR)

**Location:** solution/STRATEGY.md, line 44

**Text:**  
> "Para quem (público): qualquer idade ou gênero; não muda o engajamento (0,1%) [F15][F16]."

**Context:** This statement appears in section 2.3 "Nichos para testar" but reads as firm guidance, not a hypothesis.

**Issue:** F15 has confidence="low" (n=516, Bilibili only) and should not ground firm policy without "testar"/"hipótese" label. F16 (confidence="high", n=52,214) supports the claim adequately, but F15 alone is insufficient.

**Severity:** Low — the effect is trivial (0.1%), and the recommendation (choose audience by product, not engagement) is sensible. The concern is phrasing that treats a low-confidence segment as fully general.

**Note:** This is within QA threshold; not flagged as a hard fail if the recommendation is advisory in intent.

---

## Appendix Glossary Check (Section 7)

All 21 tags (F01–F21) listed in glossary correspond to findings cited in Part 1. Descriptions align with findings.json claims. **✓ PASS**

---

## Quantitative Claims Without Tags

Scanned Part 1 and 2 for standalone numbers: 

- "52.214 posts" (line 14) — dataset metadata, not a finding-derived policy; acceptable without tag.
- All other quantitative claims carry [Fxx] tags or are secondary derivatives (e.g., "1 a 8 posts" per platform in F21's breakdown).

**No significant omissions found.**

---

## Confidence & Sample-Size Rule

Checked all usages of findings with n < 30 or confidence="low":

- **F06, F07, F08, F09** (low confidence, n=47–111): Correctly framed in section 2.3 "Nichos para testar" as tests.
- **F10** (medium confidence, n=5,222): Cited with "Sinal fraco; não cortar verba" caveat; used in test design. ✓
- **F12** (low confidence, n=517): "Não confiável" label; recommended for testing, not scaling. ✓
- **F13** (low confidence, n=512): "Resultado limítrofe"; not prioritized. ✓
- **F15** (low confidence, n=516): Minor concern noted above (section 2 of Issues).
- **F21** (low confidence, n=20): "Não prova que... falha" and "Validar só como teste"; caveated appropriately. ✓

---

## Reconciliation: PASS or FAIL?

**Overall: FAIL** (due to F19 discrepancy)

**Defects:**
1. F19: Strategy claims max 1.3% deviation; findings.json reports worst -1.4%.

**Action Required:**  
Clarify and correct F19 usage in STRATEGY.md (lines 14 and 82) or verify F19 value in findings.json.

---

*Report generated by QA-tester (Haiku) — independent check, round 2*
