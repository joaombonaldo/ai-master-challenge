import type { AggregatedResult, AggregatesFile, Filters } from "./types";
import {
  aggregate,
  aggregateSponsoredCompareControlled,
  dataTier,
} from "./aggregate-utils";

// ---------------------------------------------------------------------
// Phase 3c: rule-based recommendations, computed live from the same
// aggregate cells already loaded for the rest of the dashboard. No new
// data pipeline, no model, no LLM -- every recommendation below is a
// direct comparison between aggregate-cell rollups (the same `aggregate`
// and `aggregateSponsoredCompareControlled` helpers the KPI/tabs use),
// gated by the same plain-language confidence tiers (`dataTier`) used
// everywhere else in the app. If a comparison doesn't clear the
// confidence floor, we say so instead of forcing a recommendation --
// same honesty rule as the rest of the dashboard.
//
// All user-facing strings below are in Portuguese (PT-BR) per leader
// request -- only the copy was translated, the comparison logic and
// thresholds are untouched.
// ---------------------------------------------------------------------

export type RecommendationTone = "positive" | "negative" | "neutral" | "insufficient";

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  action: string;
  tone: RecommendationTone;
}

const MEANINGFUL_DIFF_PCT = 5; // relative %, below this we call it "about the same"
const MEANINGFUL_SPONSOR_DIFF_PCT = 3; // relative %, matches the dashboard's flat-signal framing

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "-";
  return `${(n * 100).toFixed(2)}%`;
}

/** Plain-language label for the segment implied by the current filters. */
export function describeSegment(filters: Filters): string {
  const parts: string[] = [];
  parts.push(
    filters.platforms.length === 1
      ? filters.platforms[0]
      : filters.platforms.length > 1
      ? `${filters.platforms.length} plataformas selecionadas`
      : "todas as plataformas"
  );
  parts.push(
    filters.categories.length === 1
      ? filters.categories[0]
      : filters.categories.length > 1
      ? `${filters.categories.length} categorias selecionadas`
      : "todas as categorias"
  );
  parts.push(
    filters.tiers.length === 1
      ? `criadores tier ${filters.tiers[0]}`
      : filters.tiers.length > 1
      ? `${filters.tiers.length} tiers de criador selecionados`
      : "todos os tiers de criador"
  );
  if (filters.sponsored !== "all") {
    parts.push(filters.sponsored === "sponsored" ? "somente posts patrocinados" : "somente posts orgânicos");
  }
  if (filters.contentTypes.length > 0) {
    parts.push(`formato ${filters.contentTypes.join("/")}`);
  }
  if (filters.languages.length > 0) {
    parts.push(`idioma ${filters.languages.join("/")}`);
  }
  if (filters.audienceLocations.length > 0) {
    parts.push(`audiência em ${filters.audienceLocations.join("/")}`);
  }
  return parts.join(", ");
}

/**
 * Sponsorship recommendation for the CURRENT filter selection: reuses the
 * fair, matched-group sponsored-vs-organic comparison (median lift across
 * platform x category x creator-tier groups) that already powers the
 * "Sponsored vs. organic" tab, and turns it into a plain "does this pay
 * off here?" verdict, only when the underlying data clears the same
 * confidence floor already used for that tab.
 */
export function buildSponsorRecommendation(
  file: AggregatesFile,
  filters: Filters
): Recommendation {
  const segment = describeSegment(filters);
  const cmp = aggregateSponsoredCompareControlled(file, filters);

  if (cmp.medianGroupLift === null || dataTier(cmp.minGroupN) === "insufficient") {
    return {
      id: "sponsorship",
      title: "Vale a pena patrocinar este segmento?",
      body: `Não há dados pareados suficientes (posts orgânicos e patrocinados no mesmo grupo de plataforma x categoria x tier de criador) para ${segment} para dizer se patrocinar compensa aqui.`,
      action:
        "Amplie o filtro (remova o filtro de tier de criador ou categoria) ou aguarde mais posts patrocinados se acumularem neste segmento antes de decidir.",
      tone: "insufficient",
    };
  }

  const pct = (cmp.medianGroupLift - 1) * 100;
  const thin = dataTier(cmp.minGroupN) === "thin";
  const thinNote = thin
    ? " (baseado em um número pequeno de posts pareados -- trate como um sinal direcional, não um número definitivo)"
    : "";

  if (pct >= MEANINGFUL_SPONSOR_DIFF_PCT) {
    return {
      id: "sponsorship",
      title: "Vale a pena patrocinar este segmento?",
      body: `Posts patrocinados em ${segment} têm engajamento ${pct.toFixed(1)}% maior que posts orgânicos pareados${thinNote}.`,
      action:
        "Este é um dos segmentos em que o patrocínio mostra uma vantagem real -- é um lugar razoável para priorizar o orçamento de patrocínio em relação a segmentos sem lift mensurável.",
      tone: "positive",
    };
  }
  if (pct <= -MEANINGFUL_SPONSOR_DIFF_PCT) {
    return {
      id: "sponsorship",
      title: "Vale a pena patrocinar este segmento?",
      body: `Posts patrocinados em ${segment} têm engajamento ${Math.abs(pct).toFixed(1)}% menor que posts orgânicos pareados${thinNote}.`,
      action:
        "Não pague um prêmio para patrocinar conteúdo neste segmento apenas por engajamento -- o orgânico performa pelo menos tão bem aqui.",
      tone: "negative",
    };
  }
  return {
    id: "sponsorship",
    title: "Vale a pena patrocinar este segmento?",
    body: `Posts patrocinados e orgânicos em ${segment} têm desempenho parecido (${pct >= 0 ? "+" : ""}${pct.toFixed(
      1
    )}%, dentro da variação normal)${thinNote}.`,
    action:
      "O patrocínio não está comprando engajamento extra neste segmento -- só patrocine aqui por outros motivos além de engajamento (alcance, relacionamento, contrato), não para buscar lift de engajamento.",
    tone: "neutral",
  };
}

type AxisKey = "categories" | "tiers";

const AXIS_CONFIG: Record<
  AxisKey,
  { legendKey: "category" | "creator_tier"; label: string; title: string }
> = {
  categories: { legendKey: "category", label: "categoria", title: "Foco de categoria" },
  tiers: { legendKey: "creator_tier", label: "tier de criador", title: "Foco de tier de criador" },
};

/**
 * Compares the currently selected value on one axis (category or creator
 * tier) against every sibling value on that same axis, holding every other
 * current filter fixed -- e.g. "within TikTok + Mid-tier, is Tech doing
 * better or worse than the other categories?". Only fires when exactly one
 * value is selected on that axis (otherwise there's no single segment to
 * compare), and only reports a gap when both sides clear the same
 * confidence floor used everywhere else in the app.
 */
export function buildAxisRecommendation(file: AggregatesFile, filters: Filters, axis: AxisKey): Recommendation {
  const { legendKey, label, title } = AXIS_CONFIG[axis];
  const selected = filters[axis];

  if (selected.length !== 1) {
    return {
      id: axis,
      title,
      body: `Selecione exatamente uma opção de ${label} (além dos outros filtros) para ver como ela se compara às alternativas.`,
      action: `Restrinja o filtro de ${label} acima para obter uma comparação específica do segmento.`,
      tone: "insufficient",
    };
  }

  const current = selected[0];
  const currentResult = aggregate(file, filters);

  if (dataTier(currentResult.n) === "insufficient" || currentResult.weightedEngagementRate === null) {
    return {
      id: axis,
      title,
      body: `Não há posts suficientes para ${current} com estes filtros para compará-lo de forma justa com outras opções de ${label}.`,
      action: "Amplie os filtros (por exemplo, remova o período ou o filtro de tier de criador) e verifique novamente.",
      tone: "insufficient",
    };
  }

  const alternatives = file.legend[legendKey].filter((v) => v !== current);
  let best: { value: string; result: AggregatedResult } | null = null;
  let worst: { value: string; result: AggregatedResult } | null = null;

  for (const alt of alternatives) {
    const altFilters: Filters = { ...filters, [axis]: [alt] };
    const altResult = aggregate(file, altFilters);
    if (dataTier(altResult.n) === "insufficient" || altResult.weightedEngagementRate === null) continue;
    if (!best || altResult.weightedEngagementRate > (best.result.weightedEngagementRate ?? -Infinity)) {
      best = { value: alt, result: altResult };
    }
    if (!worst || altResult.weightedEngagementRate < (worst.result.weightedEngagementRate ?? Infinity)) {
      worst = { value: alt, result: altResult };
    }
  }

  if (!best || !worst) {
    return {
      id: axis,
      title,
      body: `Nenhuma das outras opções de ${label} tem posts suficientes com estes filtros para comparar com ${current}.`,
      action: "Amplie os filtros e verifique novamente quando houver mais dados disponíveis para as alternativas.",
      tone: "insufficient",
    };
  }

  const currentRate = currentResult.weightedEngagementRate;
  const diffBestPct = ((best.result.weightedEngagementRate! - currentRate) / currentRate) * 100;
  const diffWorstPct = ((worst.result.weightedEngagementRate! - currentRate) / currentRate) * 100;
  const anyThin =
    dataTier(currentResult.n) === "thin" ||
    dataTier(best.result.n) === "thin" ||
    dataTier(worst.result.n) === "thin";
  const thinNote = anyThin ? " (amostra pequena em pelo menos um dos lados -- trate como direcional)" : "";

  const betterFound = best.value !== current && diffBestPct >= MEANINGFUL_DIFF_PCT;
  const worseFound = worst.value !== current && diffWorstPct <= -MEANINGFUL_DIFF_PCT;

  if (!betterFound && !worseFound) {
    return {
      id: axis,
      title,
      body: `Com estes filtros, ${current} tem desempenho parecido com as outras opções de ${label} -- sem diferença relevante em nenhum sentido (melhor alternativa, ${
        best.value
      }, é ${diffBestPct >= 0 ? "+" : ""}${diffBestPct.toFixed(1)}%)${thinNote}.`,
      action: `Não há motivo urgente para tirar o foco de ${current} apenas por engajamento.`,
      tone: "neutral",
    };
  }

  const sentences: string[] = [];
  if (betterFound) {
    sentences.push(
      `${best.value} tem desempenho ${diffBestPct.toFixed(1)}% melhor que ${current} com estes filtros (${fmtPct(
        best.result.weightedEngagementRate
      )} vs. ${fmtPct(currentRate)}).`
    );
  }
  if (worseFound) {
    sentences.push(
      `${worst.value} tem desempenho ${Math.abs(diffWorstPct).toFixed(1)}% pior que ${current} (${fmtPct(
        worst.result.weightedEngagementRate
      )} vs. ${fmtPct(currentRate)}).`
    );
  }

  return {
    id: axis,
    title,
    body: `${sentences.join(" ")}${thinNote}`,
    action: betterFound
      ? `Considere deslocar parte do mix de conteúdo de ${current} para ${best.value} nesta combinação de filtros, e acompanhe se a diferença se mantém nas próximas semanas.`
      : `${current} ainda é a melhor opção entre as duas -- sem motivo para migrar para ${worst.value} com base em engajamento.`,
    tone: betterFound ? "positive" : "neutral",
  };
}

/** All recommendations for the current filter selection, in display order. */
export function buildRecommendations(file: AggregatesFile, filters: Filters): Recommendation[] {
  return [
    buildAxisRecommendation(file, filters, "categories"),
    buildAxisRecommendation(file, filters, "tiers"),
    buildSponsorRecommendation(file, filters),
  ];
}
