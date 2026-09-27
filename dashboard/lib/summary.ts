import type { AggregatedResult, Filters } from "./types";
import type { LiftResult, ControlledSponsoredResult, DataTier } from "./aggregate-utils";
import type { Recommendation } from "./recommendations";
import { dataTier } from "./aggregate-utils";
import { describeSegment } from "./recommendations";

// ---------------------------------------------------------------------
// Phase 3d: executive summary. This file is imported by BOTH the client
// (to build the compact payload from numbers already on screen) and the
// server API route (app/api/summary/route.ts, for the templated
// fallback) -- it must stay free of secrets and side effects so it is
// safe to bundle into client JS.
//
// The payload is deliberately tiny (a handful of numbers + short strings
// already shown in the UI) -- never raw rows, never the full aggregates
// file. See app/api/summary/route.ts for the LLM call and env var.
// ---------------------------------------------------------------------

export interface ExecutiveSummaryPayload {
  segment: string;
  posts: number;
  weightedEngagementRatePct: number | null;
  liftPct: number | null;
  liftBaselineLabel: string;
  sponsoredVsOrganicPct: number | null;
  sponsoredDataTier: DataTier;
  recommendations: Array<{ title: string; body: string; action: string; tone: string }>;
}

/** Build the compact payload from values the dashboard has already computed. */
export function buildExecutiveSummaryPayload(
  filters: Filters,
  result: AggregatedResult,
  baselineLift: LiftResult,
  sponsoredCompare: ControlledSponsoredResult,
  recommendations: Recommendation[]
): ExecutiveSummaryPayload {
  return {
    segment: describeSegment(filters),
    posts: result.n,
    weightedEngagementRatePct:
      result.weightedEngagementRate !== null ? result.weightedEngagementRate * 100 : null,
    liftPct: baselineLift.lift !== null ? (baselineLift.lift - 1) * 100 : null,
    liftBaselineLabel: baselineLift.baselineLabel,
    sponsoredVsOrganicPct:
      sponsoredCompare.medianGroupLift !== null
        ? (sponsoredCompare.medianGroupLift - 1) * 100
        : null,
    sponsoredDataTier:
      sponsoredCompare.medianGroupLift === null
        ? "insufficient"
        : dataTier(sponsoredCompare.minGroupN),
    recommendations: recommendations.map((r) => ({
      title: r.title,
      body: r.body,
      action: r.action,
      tone: r.tone,
    })),
  };
}

function pct(n: number | null, digits = 1): string {
  if (n === null || Number.isNaN(n)) return "n/d";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/**
 * Plain-language, templated (non-LLM) executive summary built by simple
 * string interpolation over the same payload sent to the LLM. Used
 * whenever no free-tier API key is configured, or whenever the live LLM
 * call fails for any reason -- the button must never show a broken state.
 * Written in Portuguese (PT-BR) per leader request, same as the LLM
 * output -- everything client-facing in this dashboard is PT-BR.
 */
export function buildTemplatedSummary(payload: ExecutiveSummaryPayload): string {
  const lines: string[] = [];

  lines.push(
    `Olhando para ${payload.segment} (${payload.posts.toLocaleString()} posts), a taxa de engajamento ponderada é ${
      payload.weightedEngagementRatePct !== null ? payload.weightedEngagementRatePct.toFixed(2) + "%" : "indisponível para este filtro"
    }.`
  );

  if (payload.liftPct !== null) {
    const cmp = Math.abs(payload.liftPct) < 1 ? "em linha com" : payload.liftPct > 0 ? "acima" : "abaixo";
    lines.push(`Isso está ${cmp} a ${payload.liftBaselineLabel} (${pct(payload.liftPct)}).`);
  }

  if (payload.sponsoredDataTier === "insufficient" || payload.sponsoredVsOrganicPct === null) {
    lines.push("Não há dados pareados de patrocinado/orgânico suficientes aqui para dizer se o patrocínio compensa neste segmento.");
  } else if (Math.abs(payload.sponsoredVsOrganicPct) < 3) {
    lines.push("Posts patrocinados e orgânicos têm desempenho parecido aqui, então o patrocínio não está comprando engajamento extra por si só.");
  } else if (payload.sponsoredVsOrganicPct > 0) {
    lines.push(`Posts patrocinados superam os orgânicos pareados em ${pct(payload.sponsoredVsOrganicPct)} aqui.`);
  } else {
    lines.push(`Posts patrocinados têm desempenho ${pct(Math.abs(payload.sponsoredVsOrganicPct)).replace("+", "")} pior que os orgânicos pareados aqui -- o orgânico performa pelo menos tão bem.`);
  }

  const actionable = payload.recommendations.find((r) => r.tone === "positive" || r.tone === "negative");
  if (actionable) {
    lines.push(actionable.action);
  } else {
    const neutral = payload.recommendations.find((r) => r.tone === "neutral");
    if (neutral) lines.push(neutral.action);
  }

  return lines.join(" ");
}
