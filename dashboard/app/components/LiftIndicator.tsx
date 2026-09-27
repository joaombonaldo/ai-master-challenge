"use client";

import type { LiftResult } from "@/lib/aggregate-utils";
import { dataTier } from "@/lib/aggregate-utils";
import DataConfidenceDot, {
  INSUFFICIENT_DATA_MESSAGE,
} from "./DataConfidenceDot";
import HelpTip from "./HelpTip";

function fmtLift(lift: number | null): string {
  if (lift === null) return "-";
  const pct = (lift - 1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

const LIFT_HELP_TEXT =
  "How much better or worse your current selection's engagement rate is compared to a baseline (the platform overall, or all platforms if none is selected).";

/**
 * Hero-row lift indicator: current filtered selection's weighted
 * engagement rate vs. its own platform baseline (or global baseline if no
 * platform is selected). Pure arithmetic, live from the loaded dataset.
 *
 * Plain-language data-confidence tiering (see dataTier): below 10 posts in
 * the current filter, the number is hidden in favor of an honest message;
 * between 10 and 29, the number is shown with a small "treat as
 * directional" hint; at 30+ it's shown as-is.
 */
export default function LiftIndicator({ result }: { result: LiftResult }) {
  const tier = dataTier(result.n);

  if (tier === "insufficient") {
    return (
      <div className="hero-cell">
        <div className="label">
          Lift vs. baseline
          <HelpTip text={LIFT_HELP_TEXT} />
        </div>
        <div className="value muted-message">{INSUFFICIENT_DATA_MESSAGE}</div>
      </div>
    );
  }

  return (
    <div className="hero-cell">
      <div className="label">
        Lift vs. baseline
        <HelpTip text={LIFT_HELP_TEXT} />
      </div>
      <div className="value">
        {fmtLift(result.lift)}
        <DataConfidenceDot n={result.n} />
      </div>
      <div className="sub">
        weighted ER vs. {result.baselineLabel} ({result.baselineN.toLocaleString()}{" "}
        posts)
      </div>
    </div>
  );
}
