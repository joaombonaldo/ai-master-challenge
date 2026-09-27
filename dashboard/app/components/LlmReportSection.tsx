"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import type { ExecutiveSummaryPayload } from "@/lib/summary";
import { buildTemplatedSummary } from "@/lib/summary";
import type { LlmRecommendationsPayload } from "@/lib/llm-recommendations";
import type { LlmRecommendation } from "@/app/api/recommendations/route";

// ---------------------------------------------------------------------
// Phase 3d/3c merge: "Gerar LLM Report" -- a single user action that fires
// TWO independent LLM calls in parallel (POST /api/summary, POST
// /api/recommendations) and renders both results as one combined section
// (summary text first, recommendation cards below).
//
// Why this file replaces the old auto-fetch-on-filter-change pattern in
// ExecutiveSummary.tsx / RecommendationsPanel.tsx, and the exact bug it
// fixes:
//
// ROOT CAUSE (investigated, not guessed): the previous RecommendationsPanel
// (and ExecutiveSummary) re-fetched automatically every time the `filters`
// object changed, via `key={JSON.stringify(filters)}` forcing a full
// remount per filter change. That remount pattern is *not* what produced
// the visible bug -- React destroys the old instance's effect (setting its
// local `cancelled` flag) before mounting the new one, so a stale
// response could not overwrite the new instance's own state. The real bug
// is server-side: the summary/recommendations routes call Groq's FREE
// TIER, which is rate-limited (see route.ts comments: "$0.00 Groq free
// tier, rate-limited"). Filtering then quickly clearing fires TWO live LLM
// calls back-to-back (one per remount). The second call frequently lands
// on Groq's per-minute rate limit, gets a non-200/failed response, and the
// route *silently* falls back to the rule-based/templated response --
// which is indistinguishable in the UI from "it worked, this segment just
// has no LLM insight." That reads exactly like the reported symptom:
// "after filter -> clear, recommendations show the fallback again instead
// of a fresh LLM result."
//
// THE FIX: stop auto-fetching on every filter tweak. There is now exactly
// ONE trigger (this button), so casual filter exploration never spends an
// LLM call, and rate-limit collisions from rapid filter churn are gone by
// construction. On top of that, this component still adds the belt-and-
// suspenders guard the leader asked for, for the remaining case where a
// user clicks the button, then changes filters before the response comes
// back: an AbortController cancels the in-flight fetches, and a
// monotonically increasing `requestId` ref is checked before ANY response
// is applied to state -- so a response tied to an old filter/click can
// never render over a newer one. Changing filters also immediately resets
// the report to "idle" (no stale content lingers under a new segment),
// and clicking "Gerar LLM Report" always uses the payloads computed for
// the filters that were active at the moment of the click (props passed
// in from the parent's per-render useMemo, not a stale closure).
// ---------------------------------------------------------------------

type SummaryResult = { text: string; source: "llm" | "template" };
type RecommendationsResult = { items: LlmRecommendation[]; source: "llm" | "template" };

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; summary: SummaryResult; recommendations: RecommendationsResult };

const CONFIDENCE_COLOR: Record<string, string> = {
  alta: "primary.main",
  média: "custom.seriesB",
  media: "custom.seriesB",
  baixa: "text.disabled",
};

const TIPO_LABEL: Record<string, string> = {
  oportunidade: "Oportunidade",
  parar: "Parar",
  testar: "Testar",
};

function toFallbackRecommendations(payload: LlmRecommendationsPayload): LlmRecommendation[] {
  return payload.fallbackRecommendations.map((r, i) => ({
    prioridade: i + 1,
    tipo: r.tone === "negative" ? "parar" : r.tone === "insufficient" ? "testar" : r.tone === "positive" ? "oportunidade" : "testar",
    titulo: r.title,
    observacao: r.body,
    acao: r.action,
    confianca: r.tone === "insufficient" ? "baixa" : r.tone === "neutral" ? "média" : "alta",
  }));
}

async function fetchSummary(
  payload: ExecutiveSummaryPayload,
  signal: AbortSignal
): Promise<SummaryResult> {
  try {
    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (typeof data.text !== "string") throw new Error("malformed response");
    return { text: data.text, source: data.source === "llm" ? "llm" : "template" };
  } catch {
    return { text: buildTemplatedSummary(payload), source: "template" };
  }
}

async function fetchRecommendations(
  payload: LlmRecommendationsPayload,
  signal: AbortSignal
): Promise<RecommendationsResult> {
  try {
    const res = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.recommendations)) throw new Error("malformed response");
    return { items: data.recommendations, source: data.source === "llm" ? "llm" : "template" };
  } catch {
    return { items: toFallbackRecommendations(payload), source: "template" };
  }
}

export default function LlmReportSection({
  summaryPayload,
  recommendationsPayload,
  resetKey,
}: {
  summaryPayload: ExecutiveSummaryPayload;
  recommendationsPayload: LlmRecommendationsPayload;
  resetKey: string;
}) {
  const [state, setState] = useState<State>({ status: "idle" });
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Filters changed underneath the report: cancel whatever is in flight
  // and clear any previously rendered report. The user must click the
  // button again to get a report for the new segment -- no auto-fetch,
  // which is what removes the race in the first place.
  useEffect(() => {
    abortRef.current?.abort();
    requestIdRef.current += 1;
    setState({ status: "idle" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  async function handleGenerate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const myRequestId = ++requestIdRef.current;

    setState({ status: "loading" });

    const [summary, recommendations] = await Promise.all([
      fetchSummary(summaryPayload, controller.signal),
      fetchRecommendations(recommendationsPayload, controller.signal),
    ]);

    // Discard this response if a newer click happened, or the filters
    // changed (which also bumps requestIdRef via the effect above) while
    // these calls were in flight -- only the response matching the CURRENT
    // trigger is ever applied to the UI.
    if (myRequestId !== requestIdRef.current) return;

    setState({ status: "done", summary, recommendations });
  }

  const showAiDisclaimer =
    state.status === "done" &&
    (state.summary.source === "llm" || state.recommendations.source === "llm");

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <Box>
          <Typography component="h3" sx={{ fontFamily: "var(--font-serif)", fontSize: "0.98rem", fontWeight: 600, m: 0, color: "text.primary" }}>
            Relatório de IA
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mt: "2px" }}>
            Resumo executivo e recomendações para a seleção de filtros atual.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={handleGenerate}
          disabled={state.status === "loading"}
          sx={{ flexShrink: 0 }}
        >
          {state.status === "loading" ? "Gerando..." : "Gerar LLM Report"}
        </Button>
      </Box>

      {state.status === "loading" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", py: "24px" }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>Gerando relatório...</Typography>
        </Box>
      )}

      {state.status === "done" && (
        <Box sx={{ mt: "14px", pt: "14px", borderTop: "1px dashed", borderColor: "divider" }}>
          <Typography sx={{ fontSize: "0.9rem", lineHeight: 1.65, color: "text.primary", m: 0 }}>
            {state.summary.text}
          </Typography>

          <Divider sx={{ my: "18px" }} />

          <Box sx={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {state.recommendations.items.map((rec, i) => (
              <Box
                key={i}
                sx={{
                  border: 1,
                  borderRadius: "10px",
                  p: "16px 18px",
                  borderColor: rec.confianca === "alta" ? "custom.goldBorder" : "divider",
                  bgcolor: rec.confianca === "alta" ? "custom.goldSoft" : "transparent",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      flexShrink: 0,
                      bgcolor: CONFIDENCE_COLOR[rec.confianca] ?? "custom.seriesB",
                    }}
                  />
                  <Typography
                    component="h4"
                    sx={{ fontFamily: "var(--font-serif)", fontSize: "0.98rem", fontWeight: 600, m: 0, color: "text.primary" }}
                  >
                    {rec.titulo}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "text.secondary",
                      border: 1,
                      borderColor: "divider",
                      borderRadius: "999px",
                      px: "8px",
                      py: "1px",
                    }}
                  >
                    {i + 1}. {TIPO_LABEL[rec.tipo] ?? rec.tipo}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", lineHeight: 1.5, mt: "8px" }}>
                  {rec.observacao}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                    mt: "8px",
                    pt: "8px",
                    borderTop: "1px dashed",
                    borderColor: "divider",
                    color: "text.primary",
                  }}
                >
                  {rec.acao}
                </Typography>
              </Box>
            ))}
          </Box>

          {showAiDisclaimer && (
            <Typography sx={{ mt: "14px", fontSize: "0.72rem", color: "text.disabled", fontStyle: "italic" }}>
              Conteúdo gerado por IA -- sempre verifique antes de agir.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
