"use client";

import type { Recommendation } from "@/lib/recommendations";

/**
 * Renders the rule-based recommendations for the current filter selection.
 * Pure display component -- all the logic (comparisons, confidence gating,
 * wording) lives in lib/recommendations.ts. No LLM calls, no network
 * requests: everything here is derived synchronously from the aggregate
 * cells already loaded into the page.
 */
export default function RecommendationsPanel({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  return (
    <div className="rec-list">
      {recommendations.map((rec) => (
        <div key={rec.id} className={`rec-card rec-${rec.tone}`}>
          <div className="rec-card-head">
            <span className={`rec-dot rec-dot-${rec.tone}`} />
            <h3 className="rec-title">{rec.title}</h3>
          </div>
          <p className="rec-body">{rec.body}</p>
          {rec.tone !== "insufficient" && (
            <p className="rec-action">
              <span className="rec-action-label">Suggested action</span>
              {rec.action}
            </p>
          )}
          {rec.tone === "insufficient" && <p className="rec-action rec-action-muted">{rec.action}</p>}
        </div>
      ))}
    </div>
  );
}
