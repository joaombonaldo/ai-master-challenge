"""
Phase 1 - literal brief-benchmark test.

The challenge README (challenges/marketing-004-social/README.md, line 95) uses this
exact example as the bar for a non-generic answer: "Videos de 30-60s na categoria
Tech, com creators de 10K-50K seguidores, geram 3.2x mais shares que a media da
plataforma." That number is illustrative copy in the brief, not a result from this
dataset -- it has not been tested until now. This script tests it literally, per
platform and pooled, and reports the real result honestly (no rounding toward 3.2x).

Segment definition (literal, not our usual quartile tiers):
  - content_type == "video"
  - content_length between 30 and 60 (seconds), inclusive
  - content_category == "tech"
  - follower_count between 10,000 and 50,000, inclusive

Metrics (both reported, not substituted for each other):
  1. shares (the literal metric named in the brief) -- median and mean, vs. platform
     median/mean shares.
  2. engagement_rate (er_views = (likes+shares+comments)/views) -- secondary check,
     vs. platform median engagement rate (same baseline used throughout this project).

Only aggregates are printed (max 20 rows). Appends findings (next available ID) to
solution/outputs/findings.json without touching or renumbering F01-F20.
"""
import json
import os

import numpy as np
import pandas as pd

np.random.seed(42)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "..", ".."))
SUBMISSION_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
RAW_PATH = os.path.join(REPO_ROOT, "data", "raw", "social_media_dataset.csv")
FINDINGS_PATH = os.path.join(SUBMISSION_ROOT, "solution", "outputs", "findings.json")
MIN_N = 30


def load():
    df = pd.read_csv(RAW_PATH)
    df["total_engagement"] = df["likes"] + df["shares"] + df["comments_count"]
    df["er_views"] = df["total_engagement"] / df["views"].replace(0, np.nan)
    return df


def main():
    df = load()

    seg_mask = (
        (df["content_type"] == "video")
        & (df["content_length"] >= 30)
        & (df["content_length"] <= 60)
        & (df["content_category"] == "tech")
        & (df["follower_count"] >= 10000)
        & (df["follower_count"] <= 50000)
    )
    seg = df[seg_mask]

    rows = []
    for plat, sub in df.groupby("platform"):
        plat_seg = seg[seg["platform"] == plat]
        rows.append({
            "platform": plat,
            "platform_median_shares": sub["shares"].median(),
            "platform_mean_shares": sub["shares"].mean(),
            "platform_median_er": sub["er_views"].median(),
            "seg_n": len(plat_seg),
            "seg_median_shares": plat_seg["shares"].median() if len(plat_seg) else np.nan,
            "seg_mean_shares": plat_seg["shares"].mean() if len(plat_seg) else np.nan,
            "seg_median_er": plat_seg["er_views"].median() if len(plat_seg) else np.nan,
        })
    res = pd.DataFrame(rows)
    res["shares_lift_median"] = res["seg_median_shares"] / res["platform_median_shares"]
    res["shares_lift_mean"] = res["seg_mean_shares"] / res["platform_mean_shares"]
    res["er_lift_median"] = res["seg_median_er"] / res["platform_median_er"]
    print("=== Brief literal benchmark: 30-60s Video / Tech / 10K-50K followers, per platform ===")
    print(res.to_string(index=False))

    # Pooled across all platforms (report only if n supports it; note platform mix
    # differs so this is a secondary, less clean cut than the per-platform view)
    pooled_baseline_median_shares = df["shares"].median()
    pooled_baseline_mean_shares = df["shares"].mean()
    pooled_baseline_median_er = df["er_views"].median()
    pooled_n = len(seg)
    pooled_median_shares = seg["shares"].median() if pooled_n else np.nan
    pooled_mean_shares = seg["shares"].mean() if pooled_n else np.nan
    pooled_median_er = seg["er_views"].median() if pooled_n else np.nan
    pooled_shares_lift_median = pooled_median_shares / pooled_baseline_median_shares if pooled_n else None
    pooled_shares_lift_mean = pooled_mean_shares / pooled_baseline_mean_shares if pooled_n else None
    pooled_er_lift = pooled_median_er / pooled_baseline_median_er if pooled_n else None

    print("\n=== Pooled across all platforms ===")
    print(f"n={pooled_n}, median shares={pooled_median_shares}, platform-wide median shares="
          f"{pooled_baseline_median_shares}, shares lift (median)={pooled_shares_lift_median}")
    print(f"mean shares={pooled_mean_shares}, platform-wide mean shares={pooled_baseline_mean_shares}, "
          f"shares lift (mean)={pooled_shares_lift_mean}")
    print(f"median ER={pooled_median_er}, platform-wide median ER={pooled_baseline_median_er}, "
          f"ER lift={pooled_er_lift}")

    # ---------------------------------------------------------------
    # Append findings to findings.json (next available ID; F01-F20 untouched)
    # ---------------------------------------------------------------
    with open(FINDINGS_PATH) as f:
        output = json.load(f)

    existing_ids = [int(fnd["id"][1:]) for fnd in output["findings"]]
    next_id = max(existing_ids) + 1

    def new_finding(**kw):
        nonlocal next_id
        fid = f"F{next_id:02d}"
        next_id += 1
        return {"id": fid, **kw}

    new_findings = []

    res_ok = res[res["seg_n"] >= MIN_N]
    per_platform_list = ", ".join(
        f"{r.platform} {r.shares_lift_median:.2f}x (n={int(r.seg_n)})"
        for r in res.itertuples() if r.seg_n > 0
    ) or "no platform has any matching posts"

    if not res_ok.empty:
        # A platform independently clears n>=30 -- report that as the headline instead
        # of pooling (kept for reproducibility if a future data refresh reaches n>=30).
        best = res_ok.loc[res_ok["shares_lift_median"].idxmax()]
        best_shares_x = round(float(best["shares_lift_median"]), 2)
        best_er_x = round(float(best["er_lift_median"]), 3)
        new_findings.append(new_finding(
            question="Q1",
            claim=(
                "Directly testing the brief's literal example (30-60s videos, Tech, 10K-50K-follower creators): "
                f"shares show no large multiplier anywhere. Best case is {best['platform']} at "
                f"{best_shares_x:.2f}x platform-typical shares (n={int(best['seg_n'])}); matching ER lift is "
                f"flat ({best_er_x:.2f}x). Null result for the specific 3.2x figure named in the brief."
            ),
            segment={"platform": best["platform"], "content_type": "video", "category": "tech",
                     "creator_tier": "10K-50K followers (literal range)", "sponsored": None},
            metric="shares", value=round(float(best["seg_median_shares"]), 1),
            baseline=round(float(best["platform_median_shares"]), 1), lift=best_shares_x,
            n=int(best["seg_n"]), method="direct filter on literal brief combo, median comparison",
            effect_size=f"{best_shares_x:.2f}x platform median shares (brief example claims 3.2x)",
            technical_detail=f"Per-platform shares lift (median): {per_platform_list}. ER lift best platform: "
                             f"{best_er_x:.3f}x.",
            confidence="medium",
            chart=None,
        ))
    elif pooled_n > 0:
        # No single platform clears n>=30 (this is the current dataset's reality).
        # Use the pooled cut across all 5 platforms as the headline number so F21 carries
        # real values instead of 0.0 placeholders, and push the (weaker) per-platform
        # breakdown into technical_detail so the null result is fully auditable.
        new_findings.append(new_finding(
            question="Q1",
            claim=(
                "Brief's literal example (30-60s Tech videos, 10K-50K creators), pooled across all 5 platforms "
                f"(n={pooled_n}): shares are {pooled_shares_lift_median:.2f}x platform median "
                f"(mean {pooled_shares_lift_mean:.2f}x); ER {pooled_er_lift:.3f}x. Not the brief's 3.2x -- "
                "a directional null result."
            ),
            segment={"platform": None, "content_type": "video", "category": "tech",
                     "creator_tier": "10K-50K followers (literal range)", "sponsored": None},
            metric="shares", value=round(float(pooled_median_shares), 1),
            baseline=round(float(pooled_baseline_median_shares), 1),
            lift=round(float(pooled_shares_lift_median), 3),
            n=int(pooled_n), method="direct filter on literal brief combo, pooled across platforms (median)",
            effect_size=(
                f"{pooled_shares_lift_median:.2f}x pooled median shares vs claimed 3.2x -- pooled n={pooled_n} "
                "is below the n>=30 reliability bar, so directional not confirmatory"
            ),
            technical_detail=(
                f"Per platform (none n>=30): {per_platform_list}. Pooled mean lift="
                f"{pooled_shares_lift_mean:.3f}x; pooled ER lift={pooled_er_lift:.3f}x."
            ),
            confidence="low",
            chart=None,
        ))
    else:
        new_findings.append(new_finding(
            question="Q1",
            claim=(
                "Testing the brief's literal example (30-60s videos, Tech, 10K-50K-follower creators): no "
                "matching posts exist on any platform. Cannot evaluate the brief's 3.2x claim at all."
            ),
            segment={"platform": None, "content_type": "video", "category": "tech",
                     "creator_tier": "10K-50K followers (literal range)", "sponsored": None},
            metric="shares", value=0.0, baseline=0.0, lift=None,
            n=0, method="direct filter on literal brief combo",
            effect_size="no matching posts", confidence="low", chart=None,
        ))

    output["findings"].extend(new_findings)
    if len(output["findings"]) > 25:
        raise RuntimeError(
            f"findings.json would exceed the 25-finding cap ({len(output['findings'])}); "
            "trim an older finding before appending."
        )

    with open(FINDINGS_PATH, "w") as f:
        json.dump(output, f, separators=(",", ":"), default=str)

    size_kb = os.path.getsize(FINDINGS_PATH) / 1024
    print(f"\nUpdated {FINDINGS_PATH} ({size_kb:.2f} KB, {len(output['findings'])} findings)")
    if size_kb > 15:
        print("WARNING: findings.json exceeds 15KB cap -- trim wording before handoff.")


if __name__ == "__main__":
    main()
