"use client";

import { dataTier } from "@/lib/aggregate-utils";

// Plain-language message shown INSTEAD OF a number when there isn't enough
// data to compute an honest comparison. Never show a real-looking number
// (even "0.0%") in this case -- that would be misleading, not honest.
export const INSUFFICIENT_DATA_MESSAGE =
  "Not enough posts with this filter to show this comparison.";

const THIN_DATA_TOOLTIP =
  "Based on a small number of posts for this filter -- treat this as a directional signal, not a firm number.";

/**
 * Small inline dot + hover tooltip, shown next to a lift/comparison value
 * when the underlying count is thin (10-29 posts) but not so thin that we
 * hide the number outright. Renders nothing once there's enough data.
 * Deliberately shows no count and no technical label -- just a friendly
 * heads-up, consistent with the rest of the dashboard's tone.
 */
export default function DataConfidenceDot({ n }: { n: number }) {
  if (dataTier(n) !== "thin") return null;
  return (
    <span className="confidence-dot" title={THIN_DATA_TOOLTIP} aria-label={THIN_DATA_TOOLTIP}>
      <span className="confidence-dot-mark" />
    </span>
  );
}
