import { NextResponse } from "next/server";
import { buildTemplatedSummary, type ExecutiveSummaryPayload } from "@/lib/summary";

// ---------------------------------------------------------------------
// Phase 3d: executive summary API route.
//
// Provider choice: Groq's free tier (https://console.groq.com), because it
// is (a) genuinely free for the model used here -- no card required, no
// trial period, just rate-limited -- (b) OpenAI-compatible (one fetch, no
// SDK dependency to add), and (c) fast enough for a synchronous button
// click. Model: openai/gpt-oss-120b, hosted free on Groq -- more than
// enough for rephrasing ~8 numbers into a short paragraph. Estimated
// cost per call: $0.00 (Groq free tier), subject to
// their published rate limits; see README "Known limitation" for the
// documented upgrade path to a paid model (Claude/GPT) for better fluency.
//
// This route NEVER receives raw post rows -- only the small aggregate
// payload the dashboard already renders on screen (see lib/summary.ts).
// The API key is read from a server-only env var and never sent to the
// client; if it isn't set (e.g. local dev with no .env), this route
// falls back to a templated, non-LLM summary instead of erroring.
// ---------------------------------------------------------------------

export const runtime = "nodejs";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const LLM_TIMEOUT_MS = 8000;

function isValidPayload(body: unknown): body is ExecutiveSummaryPayload {
  if (!body || typeof body !== "object") return false;
  const p = body as Record<string, unknown>;
  return (
    typeof p.segment === "string" &&
    typeof p.posts === "number" &&
    Array.isArray(p.recommendations)
  );
}

function buildPrompt(payload: ExecutiveSummaryPayload): string {
  // Compact, structured context only -- no raw data, no internal artifact
  // names or codes ever appear in the client-facing output.
  const facts = {
    segment: payload.segment,
    posts: payload.posts,
    weighted_engagement_rate_pct: payload.weightedEngagementRatePct,
    lift_vs_baseline_pct: payload.liftPct,
    baseline_label: payload.liftBaselineLabel,
    sponsored_vs_organic_pct: payload.sponsoredVsOrganicPct,
    sponsored_data_confidence: payload.sponsoredDataTier,
    recommendations: payload.recommendations.map((r) => ({
      title: r.title,
      verdict: r.body,
      suggested_action: r.action,
    })),
  };

  return [
    "You are writing a short executive summary for a marketing manager who is not a data scientist.",
    "Use plain, everyday language -- no statistics jargon (no 'p-value', 'confidence interval', 'regression', etc.).",
    "Be honest: if the numbers show no meaningful effect, say so plainly instead of inventing a strong story.",
    "Write 100-150 words, 3-5 short sentences, no bullet points, no headers, no markdown.",
    "Do not mention data files, internal codes, or how the numbers were computed -- just state the findings and what to do about them.",
    "",
    "Data for the currently selected filter:",
    JSON.stringify(facts, null, 2),
  ].join("\n");
}

async function callGroq(payload: ExecutiveSummaryPayload, apiKey: string): Promise<string | null> {
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
        max_tokens: 500,
        reasoning_effort: "low",
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: unknown = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) return null;
    return text.trim();
  } catch {
    // Network error, timeout, malformed response, etc. -- caller falls
    // back to the templated summary. Never log the API key.
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
    const llmText = await callGroq(body, apiKey);
    if (llmText) {
      return NextResponse.json({ text: llmText, source: "llm" });
    }
  }

  // No key configured, or the live call failed -- graceful templated
  // fallback, never a broken/error state for the user.
  return NextResponse.json({ text: buildTemplatedSummary(body), source: "template" });
}
