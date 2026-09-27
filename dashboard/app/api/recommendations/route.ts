import { NextResponse } from "next/server";
import type { LlmRecommendationsPayload } from "@/lib/llm-recommendations";

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
// ---------------------------------------------------------------------

export const runtime = "nodejs";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const LLM_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------
// Output schema (documented here since it's enforced only at runtime by
// the validator below, not by a shared type -- the LLM returns raw JSON
// text, not a typed object):
//
//   Recommendation[] where Recommendation = {
//     titulo: string;      // short card title, e.g. "Foco de categoria"
//     observacao: string;  // what the numbers show, plain language
//     acao: string;        // concrete action: what, for whom, evidence
//     confianca: "alta" | "média" | "baixa"; // derived from the tier
//                          // ("full" -> alta, "thin" -> média, and the
//                          // model is told to skip/heavily hedge
//                          // "insufficient" rather than label it "baixa")
//   }
//
// 1 to 4 objects. If there's nothing meaningful to say anywhere in the
// current filter, the model returns a single honest object instead.
// ---------------------------------------------------------------------

export interface LlmRecommendation {
  titulo: string;
  observacao: string;
  acao: string;
  confianca: string;
}

function isValidPayload(body: unknown): body is LlmRecommendationsPayload {
  if (!body || typeof body !== "object") return false;
  const p = body as Record<string, unknown>;
  return (
    typeof p.segment === "string" &&
    typeof p.posts === "number" &&
    Array.isArray(p.platformBreakdown) &&
    typeof p.sponsoredComparison === "object" &&
    p.sponsoredComparison !== null &&
    Array.isArray(p.fallbackRecommendations)
  );
}

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
    r.confianca.trim().length > 0
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

function buildPrompt(payload: LlmRecommendationsPayload): string {
  // Only aggregated numbers -- no raw rows, no internal file/artifact
  // names -- go into this object. Confidence tiers are relabeled from
  // the internal "full"/"thin"/"insufficient" vocabulary into the exact
  // words the model must use downstream, so there's no ambiguity.
  const facts = {
    segmento_atual: payload.segment,
    total_posts_no_filtro: payload.posts,
    engajamento_por_plataforma: payload.platformBreakdown.map((p) => ({
      plataforma: p.value,
      posts: p.posts,
      taxa_engajamento_pct: p.weightedEngagementRatePct,
      confiabilidade_dado: p.confidence,
    })),
    comparacao_patrocinado_vs_organico: {
      diferenca_patrocinado_pct: payload.sponsoredComparison.medianGroupLiftPct,
      confiabilidade_dado: payload.sponsoredComparison.confidence,
      posts_organicos: payload.sponsoredComparison.organicPosts,
      posts_patrocinados: payload.sponsoredComparison.sponsoredPosts,
      grupos_comparados: payload.sponsoredComparison.groupsCompared,
      nota: "diferenca_patrocinado_pct positiva = patrocinado performa melhor; negativa = organico performa melhor. Comparacao ja controlada por plataforma x categoria x tier de criador.",
    },
    comparacao_categoria_selecionada: payload.categoryComparison
      ? {
          eixo: "categoria",
          atual: payload.categoryComparison.current,
          melhor_alternativa: payload.categoryComparison.best,
          pior_alternativa: payload.categoryComparison.worst,
        }
      : "nenhuma categoria unica selecionada no filtro -- sem comparacao disponivel neste eixo",
    comparacao_tier_selecionado: payload.tierComparison
      ? {
          eixo: "tier de criador",
          atual: payload.tierComparison.current,
          melhor_alternativa: payload.tierComparison.best,
          pior_alternativa: payload.tierComparison.worst,
        }
      : "nenhum tier de criador unico selecionado no filtro -- sem comparacao disponivel neste eixo",
  };

  return [
    "Você é um analista que prepara recomendações para dentro de um dashboard ao vivo (não um relatório escrito).",
    "Responda INTEIRAMENTE em português do Brasil (PT-BR) -- todas as palavras, nenhuma em inglês.",
    "",
    "PÚBLICO: um gerente de marketing que NÃO é cientista de dados e está olhando este dashboard agora, tomando decisões rápidas.",
    "Tom: direto e escaneável (frases curtas, sem rodeios), NÃO um texto corrido de relatório. Cada recomendação deve poder ser lida em poucos segundos.",
    "",
    "REGRA MAIS IMPORTANTE: você só pode usar os números abaixo. Não invente estatísticas, benchmarks, percentuais ou afirmações que não estejam nos dados fornecidos. Se não houver um número para sustentar uma ideia, não a inclua.",
    "",
    "REGRA DE HONESTIDADE (obrigatória): cada comparação abaixo tem um campo de confiabilidade do dado: 'full' (dado robusto), 'thin' (poucos posts) ou 'insufficient' (dado insuficiente). Isso é INDEPENDENTE do tamanho da diferença -- avalie os dois separadamente.",
    "- PRIMEIRO verifique o TAMANHO da diferença: qualquer percentual (diferença entre plataformas, categorias, tiers, ou patrocinado vs orgânico) MENOR que 3 pontos percentuais em módulo é DESPREZÍVEL, mesmo que a confiabilidade do dado seja 'full'. Nesses casos: diga que o desempenho é parecido/sem diferença real, NÃO recomende migrar orçamento, categoria, plataforma ou aumentar patrocínio com base nisso, e marque confianca como 'baixa'. Isso é uma resposta honesta válida, não uma falha -- prefira dizer 'sem diferença relevante' a inventar uma ação para um número perto de zero.",
    "- Só marque confianca como 'alta' quando a diferença for de pelo menos 3 pontos percentuais em módulo E a confiabilidade do dado for 'full'.",
    "- Se a confiabilidade for 'insufficient', NÃO gere uma recomendação confiante com base nela -- ou pule essa comparação inteiramente, ou, se for a única coisa disponível no filtro, diga explicitamente que não há dados suficientes para recomendar algo ali (isso é uma resposta válida e preferível a inventar confiança).",
    "- Se a confiabilidade for 'thin' (mesmo com diferença grande), você pode usar o número, mas precisa deixar isso claro na própria observação (ex.: 'com poucos dados' ou 'amostra pequena') e marcar confianca como 'baixa'.",
    "- Nunca maquie um resultado plano/nulo como se fosse um driver forte -- se a diferença entre opções for pequena, diga que é parecido e não force uma recomendação de mudança.",
    "",
    "BARRA DE QUALIDADE (obrigatória): cada recomendação precisa ser concreta -- o quê fazer, para qual segmento/público (plataforma, categoria, tier de criador conforme aplicável) e qual evidência (em linguagem simples, citando o número real dos dados) sustenta isso.",
    "PROIBIDO: conselhos genéricos como 'poste mais', 'engaje mais', 'capriche no conteúdo' sem ligação direta a um número dos dados fornecidos.",
    "PROIBIDO: jargão estatístico (nada de 'p-valor', 'intervalo de confiança', 'regressão', 'significância estatística', etc.) -- explique em português simples.",
    "PROIBIDO: mencionar arquivos internos, nomes de artefatos de dados, ou como o pipeline/dashboard foi construído -- fale apenas dos achados e do que fazer.",
    "",
    "FORMATO DE SAÍDA (obrigatório): responda APENAS com um array JSON válido, sem texto antes ou depois, sem markdown, sem comentários. Entre 2 e 4 objetos (ou exatamente 1 objeto no array se não houver nada de útil a dizer em lugar nenhum). Cada objeto deve ter exatamente estes campos:",
    '  "titulo": título curto (3-6 palavras)',
    '  "observacao": o que os dados mostram, em linguagem simples (1-2 frases)',
    '  "acao": ação concreta sugerida -- o quê, para quem/qual segmento, e opcionalmente quando (1-2 frases)',
    '  "confianca": uma destas três palavras exatamente -- "alta", "média" ou "baixa"',
    "",
    "Dados agregados do filtro atualmente selecionado no dashboard (já calculados, controlados por plataforma x categoria x tier de criador onde aplicável):",
    JSON.stringify(facts, null, 2),
    "",
    "Responda agora apenas com o array JSON.",
  ].join("\n");
}

async function callGroq(payload: LlmRecommendationsPayload, apiKey: string): Promise<LlmRecommendation[] | null> {
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
        messages: [{ role: "user", content: buildPrompt(payload) }],
        temperature: 0.4,
        max_tokens: 900,
        reasoning_effort: "low",
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: unknown = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) return null;

    const parsed = extractJsonArray(text);
    if (!parsed || parsed.length === 0) return null;

    const valid = parsed.filter(isValidRecommendation);
    if (valid.length === 0) return null;

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
    const recommendations = await callGroq(body, apiKey);
    if (recommendations) {
      return NextResponse.json({ recommendations, source: "llm" });
    }
  }

  // No key configured, or the live call failed / returned something that
  // didn't validate -- graceful fallback to the rule-based engine's
  // output, never a broken tab.
  return NextResponse.json({
    recommendations: body.fallbackRecommendations.map((r) => ({
      titulo: r.title,
      observacao: r.body,
      acao: r.action,
      confianca: r.tone === "insufficient" ? "baixa" : r.tone === "neutral" ? "média" : "alta",
    })),
    source: "template",
  });
}
