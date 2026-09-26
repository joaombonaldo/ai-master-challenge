import aggregatesData from "@/public/data/aggregates.json";
import type { AggregatesFile } from "@/lib/types";
import DashboardClient from "./dashboard-client";

// The JSON is imported at build time (server-side / bundled), never fetched
// as a separate raw-CSV network request. It already contains ONLY aggregate
// cells (platform x category x creator_tier x sponsored x month) -- see
// dashboard/scripts/build_aggregates.py. No per-post row ever appears here.
const aggregates = aggregatesData as unknown as AggregatesFile;

export default function Page() {
  return (
    <main>
      <header className="app-header">
        <div>
          <span className="eyebrow">Live filters -- no LLM, no ML</span>
          <h1>Social Media Engagement Dashboard</h1>
          <p className="subtitle">
            Pre-aggregated view over{" "}
            {aggregates.row_count_source.toLocaleString()} posts across five
            platforms. Filter by platform, category, creator tier,
            sponsorship and month -- the numbers below recombine instantly,
            with no raw post data loaded in the browser.
          </p>
        </div>
        <div className="badge-count">
          <div className="n">{aggregates.cell_count.toLocaleString()}</div>
          <div className="label">Aggregate cells</div>
        </div>
      </header>
      <DashboardClient aggregates={aggregates} />
    </main>
  );
}
