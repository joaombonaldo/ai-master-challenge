"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Recommendation } from "@/lib/recommendations";

const DOT_COLOR: Record<Recommendation["tone"], string> = {
  positive: "primary.main",
  negative: "custom.negative",
  neutral: "custom.seriesB",
  insufficient: "text.disabled",
};

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
    <Box sx={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {recommendations.map((rec) => (
        <Box
          key={rec.id}
          sx={{
            border: 1,
            borderRadius: "10px",
            p: "16px 18px",
            borderColor: rec.tone === "positive" ? "custom.goldBorder" : "divider",
            bgcolor: rec.tone === "positive" ? "custom.goldSoft" : "transparent",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <Box
              sx={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, bgcolor: DOT_COLOR[rec.tone] }}
            />
            <Typography
              component="h3"
              sx={{ fontFamily: "var(--font-serif)", fontSize: "0.98rem", fontWeight: 600, m: 0, color: "text.primary" }}
            >
              {rec.title}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", lineHeight: 1.6, mt: "10px" }}>
            {rec.body}
          </Typography>
          {rec.tone !== "insufficient" ? (
            <Box sx={{ fontSize: "0.82rem", color: "text.primary", lineHeight: 1.6, mt: "10px", pt: "10px", borderTop: "1px dashed", borderColor: "divider" }}>
              <Typography
                component="span"
                sx={{ display: "block", fontSize: "0.66rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "custom.goldStrong", mb: "4px" }}
              >
                Suggested action
              </Typography>
              {rec.action}
            </Box>
          ) : (
            <Box sx={{ fontSize: "0.82rem", color: "text.disabled", fontStyle: "italic", lineHeight: 1.6, mt: "10px", pt: "10px", borderTop: "1px dashed", borderColor: "divider" }}>
              {rec.action}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
