import { NextResponse } from "next/server";
import type { LlmRecommendationsPayload, SegmentStat } from "@/lib/llm-recommendations";
import {
  computeFilteredDaypartBreakdown,
  computeFilteredDurationBreakdown,
  computeFilteredFormatBreakdown,
} from "@/lib/server-aggregates";
import type { Filters } from "@/lib/types";

// ---------------------------------------------------------------------
// LLM-generated recommendations for the "Recomendações" tab.
//
// Unlike app/api/summary/route.ts (which asks the model to rephrase
// already-written recommendation sentences into a short paragraph), this
// route asks the model to REASON over the raw aggregate numbers itself
// and produce its own structured recommendations -- so the output is not
// just a restatement of lib/recommendations.ts's rule-based copy.
//
// Same provider/model choice and cost profile as app/api/summary/route.ts:
// Groq free tier, model openai/gpt-oss-120b, reasoning_effort "low".
// Estimated cost per call: $0.00 (Groq free tier, rate-limited). See
// README "Known limitation" for the documented upgrade path to a paid
// model for better fluency/reasoning depth.
//
// This route NEVER receives raw post rows -- only the small aggregate
// payload built by lib/llm-recommendations.ts (rates, counts, lifts,
// confidence tiers already computed client-side from the same aggregate
// cells the rest of the dashboard uses). The API key is server-only and
// never sent to the client. If it isn't set, the call fails, times out,
// or the model's response doesn't parse into the expected schema, this
// route falls back to the payload's `fallbackRecommendations` (the
// existing rule-based engine's output) so the tab is never broken.
//
// Phase 3g (leader decision): format/duration/posting-time breakdowns used
// to be dataset-wide (ignoring the active filter) -- fixed here. This
// route now takes `payload.filters` and recomputes those three breakdowns
// itself, WITHIN that exact filter, from a richer server-only cube (see
// lib/server-aggregates.ts, dashboard/data/server_aggregates.json) that is
// never shipped to the browser. Same dataTier() confidence-tier gating
// (full/thin/insufficient) is applied to these newly-filtered breakdowns
// as to every other axis, so a narrow filter naturally produces more
// thin/insufficient rows, and the honesty rules in buildPrompt below apply
// to them exactly the same way.
// ---------------------------------------------------------------------

export const runtime = "nodejs";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const LLM_TIMEOUT_MS = 18000;

// ---------------------------------------------------------------------
// Output schema (documented here since it's enforced only at runtime by
// the validator below, not by a shared type -- the LLM returns raw JSON
// text, not a typed object):
//
//   Recommendation[] where Recommendation = {
//     prioridade: number;   // 1 = most impactful/urgent, ascending
//     tipo: "oportunidade" | "parar" | "testar"; // pursue / stop / test
//     titulo: string;      // short card title, e.g. "Foco de categoria"
//     observacao: string;  // what the numbers show, plain language
//     acao: string;        // concrete action: what, for whom, when, evidence
//     confianca: "alta" | "média" | "baixa"; // derived from the tier
//                          // ("full" -> alta, "thin" -> média, and the
//                          // model is told to skip/heavily hedge
//                          // "insufficient" rather than label it "baixa")
//   }
//
// 1 to 4 objects, ordered by `prioridade`. If there's nothing meaningful
// to say anywhere in the current filter, the model returns a single
// honest object instead (prioridade 1, tipo "oportunidade" or "testar" as
// fits, confianca "baixa").
// ---------------------------------------------------------------------

export interface LlmRecommendation {
  prioridade: number;
  tipo: string;
  titulo: string;
  observacao: string;
  acao: string;
  confianca: string;
}

function isValidFilters(f: unknown): f is Filters {
  if (!f || typeof f !== "object") return false;
  const filters = f as Record<string, unknown>;
  return (
    Array.isArray(filters.platforms) &&
    Array.isArray(filters.categories) &&
    Array.isArray(filters.tiers) &&
    typeof filters.sponsored === "string" &&
    (filters.monthFrom === null || typeof filters.monthFrom === "string") &&
    (filters.monthTo === null || typeof filters.monthTo === "string") &&
    Array.isArray(filters.contentTypes) &&
    Array.isArray(filters.languages) &&
    Array.isArray(filters.audienceLocations)
  );
}

function isValidPayload(body: unknown): body is LlmRecommendationsPayload {
  if (!body || typeof body !== "object") return false;
  const p = body as Record<string, unknown>;
  return (
    typeof p.segment === "string" &&
    typeof p.posts === "number" &&
    isValidFilters(p.filters) &&
    Array.isArray(p.platformBreakdown) &&
    Array.isArray(p.categoryBreakdown) &&
    Array.isArray(p.tierBreakdown) &&
    Array.isArray(p.platformMetricBreakdown) &&
    typeof p.sponsoredComparison === "object" &&
    p.sponsoredComparison !== null &&
    Array.isArray(p.fallbackRecommendations)
  );
}

const VALID_TIPOS = new Set(["oportunidade", "parar", "testar"]);

function isValidRecommendation(x: unknown): x is LlmRecommendation {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.titulo === "string" &&
    r.titulo.trim().length > 0 &&
    typeof r.observacao === "string" &&
    r.observacao.trim().length > 0 &&
    typeof r.acao === "string" &&
    r.acao.trim().length > 0 &&
    typeof r.confianca === "string" &&
    r.confianca.trim().length > 0 &&
    typeof r.tipo === "string" &&
    VALID_TIPOS.has(r.tipo) &&
    typeof r.prioridade === "number" &&
    Number.isFinite(r.prioridade)
  );
}

/**
 * Defensively extract a JSON array from an LLM text response: strips
 * markdown code fences (```json ... ``` or ``` ... ```) if present, then
 * falls back to slicing from the first "[" to the last "]" in case the
 * model added stray prose before/after the JSON -- models on reasoning_
 * effort "low" occasionally do this despite instructions.
 */
function extractJsonArray(text: string): unknown[] | null {
  let cleaned = text.trim();

  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    // Fall through to bracket slicing.
  }

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const MATERIALITY_FLOOR_PP = 3;

/** Sort a SegmentStat[] best-to-worst by engagement rate, nulls last. */
function ranked<T extends { weightedEngagementRatePct: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.weightedEngagementRatePct ?? -Infinity) - (a.weightedEngagementRatePct ?? -Infinity));
}

/**
 * Precompute the best-vs-worst spread (in percentage points) for an axis
 * SERVER-SIDE, in plain arithmetic -- instead of asking the model to
 * subtract two percentages itself. Live testing found the model
 * occasionally misreads two close percentages (e.g. 19.925% vs 19.893%,
 * a 0.032pp gap) as a much bigger difference (it once reported "3.2
 * pontos percentuais" for that exact pair and called it "alta confiança").
 * Handing over an already-computed, already-rounded spread -- plus an
 * explicit `eixo_tem_diferenca_material` boolean gated on the same 3pp
 * floor as the honesty rule -- removes that failure mode: the model only
 * has to read a boolean and a plain-language range, not do the subtraction.
 * Only entries with confidence "full" count toward the spread (a "thin"
 * outlier should not make an axis look artificially material).
 */
function axisSpread(items: Array<{ weightedEngagementRatePct: number | null; confidence: string }>): {
  maiorDiferencaPp: number | null;
  eixoTemDiferencaMaterial: boolean;
} {
  const fullRates = items
    .filter((i) => i.confidence === "full" && i.weightedEngagementRatePct !== null)
    .map((i) => i.weightedEngagementRatePct as number);
  if (fullRates.length < 2) return { maiorDiferencaPp: null, eixoTemDiferencaMaterial: false };
  const spread = Math.round((Math.max(...fullRates) - Math.min(...fullRates)) * 100) / 100;
  return { maiorDiferencaPp: spread, eixoTemDiferencaMaterial: spread >= MATERIALITY_FLOOR_PP };
}

function buildPrompt(
  payload: LlmRecommendationsPayload,
  formatBreakdown: SegmentStat[],
  daypartBreakdown: SegmentStat[],
  durationBreakdown: Array<SegmentStat & { format: string }>
): string {
  // Only aggregated numbers -- no raw rows, no internal file/artifact
  // names -- go into this object. Confidence tiers are relabeled from
  // the internal "full"/"thin"/"insufficient" vocabulary into the exact
  // words the model must use downstream, so there's no ambiguity.
  //
  // Phase 3f fix: platform/category/tier are sent FULLY RANKED (best to
  // worst), regardless of what the user has filtered, so the model can
  // compare across the whole landscape and prioritize instead of only
  // describing whatever narrow slice happened to be selected.
  //
  // Phase 3g fix: formatBreakdown/daypartBreakdown/durationBreakdown are
  // now passed in already computed by the caller WITHIN the active filter
  // (via lib/server-aggregates.ts) -- they are no longer dataset-wide. A
  // narrow filter can legitimately leave one of these axes with very few
  // or zero rows; axisFact/axisSpread handle that the same way as any
  // other axis (fewer "full" rows -> lower/no material spread -> the
  // honesty rules below apply).
  const toFact = (s: { value: string; posts: number; weightedEngagementRatePct: number | null; confidence: string }) => ({
    valor: s.value,
    posts: s.posts,
    taxa_engajamento_pct: s.weightedEngagementRatePct,
    confiabilidade_dado: s.confidence,
  });

  const axisFact = (label: string, items: Array<{ value: string; posts: number; weightedEngagementRatePct: number | null; confidence: string }>) => {
    const { maiorDiferencaPp, eixoTemDiferencaMaterial } = axisSpread(items);
    return {
      eixo: label,
      maior_diferenca_pp_ja_calculada: maiorDiferencaPp,
      eixo_tem_diferenca_material: eixoTemDiferencaMaterial,
      itens: ranked(items).map(toFact),
    };
  };

  const durationSpread = axisSpread(durationBreakdown);

  const facts = {
    segmento_atual_do_filtro: payload.segment,
    total_posts_no_filtro: payload.posts,
    nota_geral:
      "Os eixos abaixo (plataforma, categoria, tier, formato, duracao, horario) estao TODOS calculados DENTRO do filtro atual do dashboard (nao apenas o valor selecionado, mas tambem nao a base inteira do dataset) -- cada eixo mostra todos os valores, do melhor para o pior, restritos ao segmento que o usuario filtrou agora. Se o filtro atual for estreito, alguns desses eixos podem ter poucos posts ou nenhum dado para certos valores -- isso e esperado e reflete o proprio filtro, nao um erro. Para cada eixo, 'maior_diferenca_pp_ja_calculada' e 'eixo_tem_diferenca_material' JA FORAM CALCULADOS EM CODIGO (nao pelo modelo) -- USE ESSES CAMPOS DIRETAMENTE para decidir se o eixo e material, NAO subtraia as taxas de engajamento voce mesmo (comparar percentuais de cabeca gera erro).",
    ranking_por_plataforma: axisFact("plataforma", payload.platformBreakdown),
    metricas_individuais_por_plataforma_informativo_apenas: {
      explicacao:
        "Estas sao as metricas INDIVIDUAIS por tras da taxa de engajamento combinada (que soma curtidas+compartilhamentos+comentarios / visualizacoes): visualizacoes_medias_por_post = alcance; taxa_curtidas_pct = aprovacao casual (curtidas/visualizacoes); taxa_compartilhamentos_pct = viralidade/distribuicao (compartilhamentos/visualizacoes); taxa_comentarios_pct = profundidade de conversa (comentarios/visualizacoes). Uma plataforma pode ter mais alcance ou mais compartilhamentos sem isso aparecer na taxa combinada, que e o que este bloco existe para revelar.",
      aviso_importante:
        "ESTE BLOCO NAO TEM 'eixo_tem_diferenca_material' calculado (ao contrario do ranking_por_plataforma acima) -- e contexto informativo, nao um eixo pronto para virar recomendacao de alta confianca. So mencione algo daqui se a diferenca entre plataformas for GRANDE e OBVIA (ex.: uma plataforma com o dobro da taxa de compartilhamento de outra, ambas com confiabilidade_dado 'full'). Se mencionar, a recomendacao deve ser tipo 'testar' com confianca 'baixa' ou 'media', nunca 'alta' baseada só nisso, e nunca dispare um 'parar' baseado só nisso. Se nada aqui for obviamente grande, ignore este bloco -- não force uma observação.",
      itens: payload.platformMetricBreakdown.map((p) => ({
        plataforma: p.platform,
        posts: p.posts,
        visualizacoes_medias_por_post: p.avgViewsPerPost,
        taxa_curtidas_pct: p.likeRatePct,
        taxa_compartilhamentos_pct: p.shareRatePct,
        taxa_comentarios_pct: p.commentRatePct,
        confiabilidade_dado: p.confidence,
      })),
    },
    ranking_por_categoria: axisFact("categoria", payload.categoryBreakdown),
    ranking_por_tier_de_criador: axisFact("tier de criador", payload.tierBreakdown),
    ranking_por_formato_dentro_do_filtro_atual: axisFact("formato (dentro do filtro atual)", formatBreakdown),
    ranking_por_horario_do_dia_dentro_do_filtro_atual: axisFact("horario do dia (dentro do filtro atual)", daypartBreakdown),
    ranking_por_duracao_dentro_do_formato_e_do_filtro_atual: {
      eixo: "duracao dentro do formato (dentro do filtro atual)",
      maior_diferenca_pp_ja_calculada: durationSpread.maiorDiferencaPp,
      eixo_tem_diferenca_material: durationSpread.eixoTemDiferencaMaterial,
      itens: ranked(durationBreakdown).map((s) => ({
        formato: s.format,
        faixa_de_duracao: s.value,
        posts: s.posts,
        taxa_engajamento_pct: s.weightedEngagementRatePct,
        confiabilidade_dado: s.confidence,
      })),
    },
    comparacao_patrocinado_vs_organico: {
      diferenca_patrocinado_pct_ja_calculada: payload.sponsoredComparison.medianGroupLiftPct,
      eixo_tem_diferenca_material:
        payload.sponsoredComparison.medianGroupLiftPct !== null &&
        payload.sponsoredComparison.confidence === "full" &&
        Math.abs(payload.sponsoredComparison.medianGroupLiftPct) >= MATERIALITY_FLOOR_PP,
      confiabilidade_dado: payload.sponsoredComparison.confidence,
      posts_organicos: payload.sponsoredComparison.organicPosts,
      posts_patrocinados: payload.sponsoredComparison.sponsoredPosts,
      grupos_comparados: payload.sponsoredComparison.groupsCompared,
      nota: "diferenca_patrocinado_pct_ja_calculada positiva = patrocinado performa melhor; negativa = organico performa melhor. Ja e a diferenca em pontos percentuais, ja controlada por plataforma x categoria x tier de criador (grupos equivalentes) -- nao recalcule.",
    },
  };

  return [
    "Você é um analista de marketing sênior preparando o cartão de recomendações de um dashboard ao vivo -- não um relatório escrito.",
    "Sua tarefa NÃO é descrever cada número. É OLHAR TODOS os rankings abaixo (plataforma, categoria, tier de criador, formato, duração, horário, patrocínio) e ESCOLHER as 2 a 4 oportunidades de MAIOR IMPACTO para a equipe agir agora -- priorizando como um consultor faria, não listando fatos soltos.",
    "Responda INTEIRAMENTE em português do Brasil (PT-BR) -- todas as palavras, nenhuma em inglês.",
    "",
    "PÚBLICO: um gerente de marketing que NÃO é cientista de dados, olhando este dashboard agora, tomando decisões rápidas. Ele já decidiu investir tempo lendo isso -- não desperdice com generalidades.",
    "Tom: direto e escaneável (frases curtas, sem rodeios), no espírito de um memorando executivo: sempre O QUÊ fazer, PARA QUEM/QUAL SEGMENTO (plataforma + categoria + tier de criador + formato/horário quando fizer diferença), QUANDO, e qual EVIDÊNCIA (número real, em linguagem simples) sustenta isso. Cada recomendação deve poder ser lida em poucos segundos, mas não pode ser vaga.",
    "",
    "COMO PRIORIZAR (obrigatório): olhe o campo 'eixo_tem_diferenca_material' de CADA eixo (já calculado em código, ver nota_geral) antes de escrever qualquer coisa. Só eixos com 'eixo_tem_diferenca_material': true são candidatos a virar uma recomendação de 'oportunidade' ou 'parar' com confiança alta. Entre os eixos materiais, priorize pelo tamanho de 'maior_diferenca_pp_ja_calculada' (ou 'diferenca_patrocinado_pct_ja_calculada' para patrocínio) -- o maior primeiro. Não se prenda só à plataforma -- categoria, tier, formato, duração e horário competem pelo mesmo espaço de atenção do gerente. Numere as recomendações por prioridade (1 = mais impactante).",
    "",
    "MÉTRICAS INDIVIDUAIS (opcional, ver 'metricas_individuais_por_plataforma_informativo_apenas'): a taxa de engajamento combinada pode estar parecida entre plataformas mesmo quando alcance, curtidas, compartilhamentos e comentários individualmente NÃO estão -- por exemplo, uma plataforma pode gerar bem mais compartilhamentos (viralidade) sem isso aparecer na taxa combinada. Se você notar uma diferença GRANDE e ÓBVIA em uma dessas métricas individuais entre plataformas com dado 'full', pode incluir isso como UMA recomendação extra tipo 'testar', descrevendo a métrica certa (alcance/curtidas/compartilhamentos/comentários) e por que importa para a decisão de marca (alcance/reconhecimento) vs. viralidade. Siga o 'aviso_importante' desse bloco à risca -- é informativo, sem eixo_tem_diferenca_material calculado, então nunca vira 'alta' confiança nem 'parar' sozinho. Se não houver nada óbvio ali, não force -- ignore o bloco.",
    "",
    "REGRA MAIS IMPORTANTE: você só pode usar os números abaixo. Não invente estatísticas, benchmarks, percentuais ou afirmações que não estejam nos dados fornecidos. Se não houver um número para sustentar uma ideia, não a inclua. NÃO subtraia duas taxas de engajamento de cabeça para decidir se a diferença é grande -- use sempre 'maior_diferenca_pp_ja_calculada'/'eixo_tem_diferenca_material', que já vêm calculados.",
    "",
    "REGRA DE HONESTIDADE (obrigatória): cada linha tem um campo de confiabilidade do dado: 'full' (dado robusto), 'thin' (poucos posts) ou 'insufficient' (dado insuficiente). Isso é INDEPENDENTE do tamanho da diferença -- avalie os dois separadamente.",
    "- Se 'eixo_tem_diferenca_material' for false para um eixo, isso já significa que a diferença é DESPREZÍVEL (menor que 3 pontos percentuais, ou dado insuficiente para julgar). Nesses casos: diga que o desempenho é parecido/sem diferença real nesse eixo, NÃO recomende migrar orçamento, categoria, plataforma, formato ou aumentar patrocínio com base nele, e marque confianca como 'baixa'. Isso é uma resposta honesta válida, não uma falha -- prefira dizer 'sem diferença relevante' a inventar uma ação para um número perto de zero.",
    "- Só marque confianca como 'alta' quando 'eixo_tem_diferenca_material' for true PARA aquele eixo específico.",
    "- Se a confiabilidade de uma linha específica dentro do eixo for 'insufficient', NÃO gere uma recomendação confiante em cima só dela -- pule essa linha, ou, se for a única coisa disponível, diga explicitamente que não há dados suficientes para recomendar algo ali (resposta válida e preferível a inventar confiança).",
    "- Se a confiabilidade de uma linha for 'thin' (mesmo dentro de um eixo material), você pode citá-la, mas deixe isso claro na observação (ex.: 'com poucos dados' ou 'amostra pequena') e marque confianca como 'baixa' para essa recomendação específica.",
    "- Se, depois de olhar TODOS os eixos, nenhum tiver 'eixo_tem_diferenca_material': true, isso também é uma resposta honesta e válida: diga isso claramente em vez de forçar uma prioridade artificial, e recomende testar/monitorar em vez de mudar orçamento.",
    "- IMPORTANTE nesse caso (nenhum eixo material): NÃO devolva só um card genérico tipo 'monitorar sem mudança'. Em vez disso, aponte de 2 a 3 candidatos CONCRETOS e NOMEADOS a teste controlado -- o item de melhor desempenho em eixos diferentes (ex.: 'formato mixed com duração curta', 'categoria tech no tier Grande', 'horário da noite no Instagram') --, cada um como uma recomendação separada tipo 'testar', confiança 'baixa', deixando claro que a diferença é pequena mas é o melhor palpite para começar um teste A/B, com o quê testar e por quanto tempo (ex.: 4 a 6 semanas). Isso dá à equipe algo concreto para experimentar mesmo com sinal fraco, em vez de uma frase vaga.",
    "- Nunca maquie um resultado plano/nulo como se fosse um driver forte.",
    "- REGRA EXPLÍCITA DO LÍDER, sem exceção: se um eixo (formato, duração ou horário especialmente, já que agora refletem um recorte do filtro que pode ter poucos posts) não tiver 'eixo_tem_diferenca_material': true, ou tiver confiabilidade 'thin'/'insufficient', você NUNCA pode escrever a recomendação como se fosse um fato comprovado sobre o que funciona nesse segmento. A frase precisa deixar claro, em português simples, que é 'algo a testar' -- não 'o que fazer'. Use explicitamente uma formulação do tipo 'vale testar X' / 'ainda não é conclusivo, mas X é candidato a teste' em vez de 'X funciona melhor' ou 'priorize X' quando a evidência for fraca. Isso vale mesmo se o item parecer o melhor da lista -- 'melhor entre poucos dados' não é o mesmo que 'comprovado'.",
    "",
    "CLASSIFICAÇÃO (obrigatória): cada recomendação recebe um \"tipo\":",
    "  \"oportunidade\" = eixo com 'eixo_tem_diferenca_material': true que vale concentrar esforço/verba agora.",
    "  \"parar\" = algo em que continuar investindo do jeito atual não tem evidência de retorno (ex.: patrocínio ou segmento sem lift, ou prática cara sem diferença real).",
    "  \"testar\" = sinal existe mas é fraco/thin/pouco dado -- vale um teste controlado antes de comprometer orçamento, não uma mudança definitiva.",
    "",
    "BARRA DE QUALIDADE (obrigatória): cada recomendação precisa ser concreta -- o quê fazer, para qual segmento/público (plataforma, categoria, tier de criador, formato/horário conforme aplicável), quando, e qual evidência (em linguagem simples, citando o número real dos dados) sustenta isso.",
    "PROIBIDO: conselhos genéricos como 'poste mais', 'engaje mais', 'capriche no conteúdo' sem ligação direta a um número dos dados fornecidos.",
    "PROIBIDO: jargão estatístico (nada de 'p-valor', 'intervalo de confiança', 'regressão', 'significância estatística', etc.) -- explique em português simples.",
    "PROIBIDO: mencionar arquivos internos, nomes de artefatos de dados, ou como o pipeline/dashboard foi construído -- fale apenas dos achados e do que fazer.",
    "",
    "FORMATO DE SAÍDA (obrigatório): responda APENAS com um array JSON válido, sem texto antes ou depois, sem markdown, sem comentários. Entre 2 e 4 objetos, ordenados por prioridade (ou exatamente 1 objeto se não houver nada de útil a dizer em lugar nenhum). Cada objeto deve ter exatamente estes campos:",
    '  "prioridade": número inteiro, 1 = mais impactante',
    '  "tipo": uma destas três palavras exatamente -- "oportunidade", "parar" ou "testar"',
    '  "titulo": título curto (3-6 palavras)',
    '  "observacao": o que os dados mostram, em linguagem simples (1-2 frases)',
    '  "acao": ação concreta sugerida -- o quê, para quem/qual segmento, e quando (1-2 frases)',
    '  "confianca": uma destas três palavras exatamente -- "alta", "média" ou "baixa"',
    "",
    "Dados agregados do dashboard, já calculados e controlados (nenhum post individual, só somas e taxas por grupo):",
    JSON.stringify(facts, null, 2),
    "",
    "Responda agora apenas com o array JSON.",
  ].join("\n");
}

async function callGroq(
  payload: LlmRecommendationsPayload,
  apiKey: string,
  formatBreakdown: SegmentStat[],
  daypartBreakdown: SegmentStat[],
  durationBreakdown: Array<SegmentStat & { format: string }>
): Promise<LlmRecommendation[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: buildPrompt(payload, formatBreakdown, daypartBreakdown, durationBreakdown) }],
        temperature: 0.4,
        max_tokens: 1500,
        reasoning_effort: "medium",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (process.env.DEBUG_LLM) console.error("[debug] groq !ok", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text: unknown = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      if (process.env.DEBUG_LLM) console.error("[debug] no text", JSON.stringify(data));
      return null;
    }

    const parsed = extractJsonArray(text);
    if (!parsed || parsed.length === 0) {
      if (process.env.DEBUG_LLM) console.error("[debug] no parsed array. raw text:", text);
      return null;
    }

    const valid = parsed.filter(isValidRecommendation);
    if (valid.length === 0) {
      if (process.env.DEBUG_LLM) console.error("[debug] no valid recs. parsed:", JSON.stringify(parsed));
      return null;
    }

    // Defensive re-sort by the model's own `prioridade` field -- some
    // responses on reasoning_effort "medium" list items in a slightly
    // different order than the numbers they assigned.
    valid.sort((a, b) => a.prioridade - b.prioridade);

    return valid.slice(0, 4);
  } catch {
    // Network error, timeout, malformed response, etc. -- caller falls
    // back to the rule-based recommendations. Never log the API key.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Invalid payload shape" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    // Phase 3g: format/duration/daypart breakdowns are computed HERE,
    // server-side, WITHIN the caller's active filter, from the server-only
    // richer cube -- never dataset-wide, never shipped to the browser. If
    // the server-only artifact is missing/unreadable for any reason, fail
    // closed to empty breakdowns (the prompt/axisFact logic already treats
    // an empty axis as "no material difference"), rather than breaking the
    // whole recommendations call.
    let formatBreakdown: SegmentStat[] = [];
    let daypartBreakdown: SegmentStat[] = [];
    let durationBreakdown: Array<SegmentStat & { format: string }> = [];
    try {
      formatBreakdown = computeFilteredFormatBreakdown(body.filters);
      daypartBreakdown = computeFilteredDaypartBreakdown(body.filters);
      durationBreakdown = computeFilteredDurationBreakdown(body.filters);
    } catch (err) {
      if (process.env.DEBUG_LLM) console.error("[debug] server_aggregates read failed", err);
    }

    const recommendations = await callGroq(body, apiKey, formatBreakdown, daypartBreakdown, durationBreakdown);
    if (recommendations) {
      return NextResponse.json({ recommendations, source: "llm" });
    }
  }

  // No key configured, or the live call failed / returned something that
  // didn't validate -- graceful fallback to the rule-based engine's
  // output, never a broken tab.
  return NextResponse.json({
    recommendations: body.fallbackRecommendations.map((r, i) => ({
      prioridade: i + 1,
      tipo: r.tone === "negative" ? "parar" : r.tone === "insufficient" ? "testar" : r.tone === "positive" ? "oportunidade" : "testar",
      titulo: r.title,
      observacao: r.body,
      acao: r.action,
      confianca: r.tone === "insufficient" ? "baixa" : r.tone === "neutral" ? "média" : "alta",
    })),
    source: "template",
  });
}
