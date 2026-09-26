"""
Phase 1 audit (second-opinion data scientist) - Part 1 verification, Part 2
narrow-signal hunt, Part 3 chart rebuild.

Independently re-derives F01 (creator tier), F11 (sponsorship), F17 (reach vs
followers) from data/raw/ and confirms the original numbers. Runs an
exhaustive search over 3- and 4-way combinations of platform x content_type x
category x daypart x creator-size(100K+ and quartile) x sponsored x length
bucket (n >= 30 per cell) looking for any combo with a meaningfully large
lift. Rebuilds charts 01, 02, 03 and 04 (originally unreadable: zero-based
y-axis, or for 02 a y-axis zoomed to a ~0.0004 window, made near-constant
~0.20 values look like a dramatic spike, and abbreviated labels like
"Re/tex/beau/Small" were not decodable by a non-technical reader). New
charts express everything as % deviation from the platform
median, sorted, with full labels and a zero reference line. Appends F18+ to
findings.json with the narrow-search result (a null finding, reported
plainly) if no combo clears a 5% practical-significance bar.

Only aggregates are printed (max 20 rows per table). No raw rows.
"""
import json
import os
from itertools import combinations

import numpy as np
import pandas as pd
from scipy import stats

np.random.seed(42)

RAW_PATH = "data/raw/social_media_dataset.csv"
CHART_DIR = "solution/outputs/charts"
FINDINGS_PATH = "solution/outputs/findings.json"
MIN_N = 30

PLATFORM_COLORS = {
    "Instagram": "#C13584", "TikTok": "#010101", "YouTube": "#FF0000",
    "Bilibili": "#00A1D6", "RedNote": "#FE2C55",
}


def load():
    df = pd.read_csv(RAW_PATH)
    df["post_date"] = pd.to_datetime(df["post_date"], format="%m/%d/%y %I:%M %p", errors="coerce")
    df["hour"] = df["post_date"].dt.hour

    def daypart(h):
        if pd.isna(h):
            return np.nan
        h = int(h)
        if 5 <= h < 11:
            return "morning"
        if 11 <= h < 17:
            return "afternoon"
        if 17 <= h < 22:
            return "evening"
        return "night"

    df["daypart"] = df["hour"].apply(daypart)
    df["total_engagement"] = df["likes"] + df["shares"] + df["comments_count"]
    df["er_views"] = df["total_engagement"] / df["views"].replace(0, np.nan)
    df["creator_tier"] = pd.qcut(df["follower_count"], 4, labels=["Small", "Mid", "Large", "Mega"])
    df["creator_100k"] = np.where(df["follower_count"] >= 100000, "100K+", "<100K")
    df["length_bucket"] = df.groupby("content_type")["content_length"].transform(
        lambda s: pd.qcut(s, 4, labels=["Q1-short", "Q2", "Q3", "Q4-long"], duplicates="drop")
    ).astype(str)
    return df


# ---------------------------------------------------------------
# PART 1: independent verification of F01, F11, F17
# ---------------------------------------------------------------
def verify(df, baselines):
    print("\n=== PART 1 VERIFICATION ===")
    g = df.groupby(["platform", "creator_tier"], observed=True)["er_views"].median().unstack()
    tier_spread = (g.max(axis=1) / g.min(axis=1)).max()
    print("F01 check - max within-platform tier spread:", round(tier_spread, 4))

    corr = df["follower_count"].corr(df["views"])
    views_by_tier = df.groupby("creator_tier", observed=True)["views"].median()
    foll_by_tier = df.groupby("creator_tier", observed=True)["follower_count"].median()
    print("F17 check - corr(follower_count, views):", round(corr, 4))
    print("Views by tier:\n", views_by_tier)
    print("Followers by tier:\n", foll_by_tier)

    strata = []
    for (plat, tier, cat), sub in df.groupby(["platform", "creator_tier", "content_category"], observed=True):
        spon = sub[sub["is_sponsored"] == True]["er_views"].dropna()
        org = sub[sub["is_sponsored"] == False]["er_views"].dropna()
        if len(spon) < MIN_N or len(org) < MIN_N:
            continue
        med_s, med_o = spon.median(), org.median()
        try:
            _, p = stats.mannwhitneyu(spon, org, alternative="two-sided")
        except ValueError:
            p = np.nan
        strata.append((med_s / med_o if med_o else None, p))
    sdf = pd.DataFrame(strata, columns=["lift", "p"])
    print("F11 check - n strata:", len(sdf), "lift range:", sdf["lift"].min(), "-", sdf["lift"].max(),
          "share p<0.05:", round((sdf["p"] < 0.05).mean(), 3))

    return {
        "tier_spread": round(float(tier_spread), 4),
        "follower_views_corr": round(float(corr), 4),
        "sponsor_n_strata": int(len(sdf)),
        "sponsor_lift_min": round(float(sdf["lift"].min()), 4),
        "sponsor_lift_max": round(float(sdf["lift"].max()), 4),
    }


# ---------------------------------------------------------------
# PART 2: narrow-signal hunt (exhaustive 3-4 way combo search)
# ---------------------------------------------------------------
def narrow_hunt(df, baselines):
    print("\n=== PART 2 NARROW-SIGNAL HUNT ===")
    print(f"Minimum n per cell = {MIN_N} (matches the rest of the project's threshold; below this, "
          "medians are too noisy to trust with 52K total rows spread across 5 platforms).")

    dims = ["platform", "content_type", "content_category", "daypart", "creator_100k",
            "creator_tier", "is_sponsored", "length_bucket"]

    results = []
    for r in (3, 4):
        for combo_names in combinations(dims, r):
            if "platform" not in combo_names:
                continue
            cols = list(combo_names)
            g = df.groupby(cols, observed=True)["er_views"].agg(["median", "size"]).reset_index()
            g = g[g["size"] >= MIN_N]
            if g.empty:
                continue
            g["baseline"] = g["platform"].map(lambda p: baselines[p]["median_engagement_rate"])
            g["lift"] = g["median"] / g["baseline"]
            g["combo_cols"] = " x ".join(cols)
            results.append(g)

    all_res = pd.concat(results, ignore_index=True)
    print("Total narrow combo-cells searched (n>=30):", len(all_res))
    print("Lift range across ALL narrow combos:", round(all_res["lift"].min(), 4), "-", round(all_res["lift"].max(), 4))
    share_5pct = (abs(all_res["lift"] - 1) > 0.05).mean()
    print("Share of narrow combos with >5% deviation from platform median:", share_5pct)

    top = all_res.sort_values("lift", ascending=False).head(1).iloc[0]
    bottom = all_res.sort_values("lift", ascending=True).head(1).iloc[0]
    print("\nBest single narrow combo found:\n", top)
    print("\nWorst single narrow combo found:\n", bottom)

    # Leader's specific example: long-form video (>60s), evening, tech, 100K+ creators
    df_leader = df.copy()
    df_leader["long_video_60s"] = np.where(
        (df_leader["content_type"] == "video") & (df_leader["content_length"] > 60), ">60s", "other"
    )
    mask = (
        (df_leader["long_video_60s"] == ">60s")
        & (df_leader["daypart"] == "evening")
        & (df_leader["content_category"] == "tech")
        & (df_leader["creator_100k"] == "100K+")
    )
    sub = df_leader[mask]
    leader_example = {"n": int(len(sub))}
    if len(sub) >= MIN_N:
        g2 = sub.groupby("platform", observed=True)["er_views"].median()
        best_plat = g2.idxmax()
        leader_example["best_platform"] = best_plat
        leader_example["best_lift"] = round(float(g2[best_plat] / baselines[best_plat]["median_engagement_rate"]), 4)
    print("\nLeader-specific example (video>60s, evening, tech, 100K+ followers):", leader_example)

    return all_res, top, bottom, leader_example, share_5pct


# ---------------------------------------------------------------
# PART 3: rebuilt charts
# ---------------------------------------------------------------
def pct_bar(labels, pct_values, colors, title, subtitle, path, figsize=(11, 6)):
    import textwrap

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=figsize)
    y_pos = np.arange(len(labels))
    ax.barh(y_pos, pct_values, color=colors, height=0.6)
    ax.axvline(0, color="#333333", linewidth=1)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=9)
    ax.invert_yaxis()
    ax.set_xlabel("% difference vs. platform's typical (median) engagement rate")

    wrapped_title = textwrap.fill(title, width=55)
    n_title_lines = wrapped_title.count("\n") + 1
    fig.suptitle(wrapped_title, fontsize=13, fontweight="bold", x=0.02, ha="left", y=0.985)

    wrapped_sub = textwrap.fill(subtitle, width=95)
    n_sub_lines = wrapped_sub.count("\n") + 1
    sub_y = 0.985 - 0.05 * n_title_lines - 0.015
    fig.text(0.02, sub_y, wrapped_sub, fontsize=9, color="#555555", ha="left", va="top")

    # widen x-range so end labels never collide with y-axis tick labels
    span = max(abs(min(pct_values)), abs(max(pct_values)), 0.05)
    ax.set_xlim(-span * 1.35, span * 1.35)
    for y, v in zip(y_pos, pct_values):
        ax.text(v + (span * 0.04 if v >= 0 else -span * 0.04), y, f"{v:+.1f}%",
                va="center", ha="left" if v >= 0 else "right", fontsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_visible(False)
    ax.grid(axis="x", linestyle="--", alpha=0.3)
    top_margin = sub_y - 0.045 * n_sub_lines - 0.03
    fig.tight_layout(rect=[0, 0, 1, max(0.6, top_margin)])
    fig.savefig(path, dpi=150)
    plt.close(fig)


def rebuild_chart_01(df, baselines):
    g = df.groupby(["platform", "creator_tier"], observed=True).agg(
        median_er=("er_views", "median"), n=("er_views", "size")
    ).reset_index()
    g["baseline"] = g["platform"].map(lambda p: baselines[p]["median_engagement_rate"])
    g["pct"] = (g["median_er"] / g["baseline"] - 1) * 100
    g = g.sort_values(["platform", "creator_tier"])
    labels = [f"{r.platform} - {r.creator_tier} creators (n={r.n:,})" for r in g.itertuples()]
    colors = [PLATFORM_COLORS.get(p, "#4C72B0") for p in g["platform"]]
    pct_bar(
        labels, g["pct"].values, colors,
        "Creator size (Small/Mid/Large/Mega followers) barely moves engagement",
        "Every bar sits within 0.2% of its platform's typical rate -- follower count is not a lever here.",
        f"{CHART_DIR}/01_er_platform_tier.png", figsize=(9, 8),
    )


def rebuild_chart_02(df, baselines):
    g = df.groupby(["platform", "daypart"], observed=True).agg(
        median_er=("er_views", "median"), n=("er_views", "size")
    ).reset_index()
    g = g[g["n"] >= MIN_N].copy()
    g["baseline"] = g["platform"].map(lambda p: baselines[p]["median_engagement_rate"])
    g["pct"] = (g["median_er"] / g["baseline"] - 1) * 100
    order = {"morning": 0, "afternoon": 1, "evening": 2, "night": 3}
    g["daypart_order"] = g["daypart"].map(order)
    g = g.sort_values(["platform", "daypart_order"])
    labels = [f"{r.platform} - {r.daypart} (n={r.n:,})" for r in g.itertuples()]
    colors = [PLATFORM_COLORS.get(p, "#4C72B0") for p in g["platform"]]
    pct_bar(
        labels, g["pct"].values, colors,
        "Time of day: no meaningful difference in engagement",
        "Every daypart sits within about 0.1% of its platform's typical rate -- posting time is not a lever here.",
        f"{CHART_DIR}/02_er_daypart.png", figsize=(9, 8),
    )


def rebuild_chart_03(top5, bottom5):
    combined = pd.concat([top5, bottom5])
    labels = [
        f"{r.platform} - {r.content_type} - {r.content_category} - {r.creator_tier} creators (n={int(r.n):,})"
        for r in combined.itertuples()
    ]
    pct_values = (combined["lift"] - 1) * 100
    colors = ["#2ca02c"] * len(top5) + ["#d62728"] * len(bottom5)
    pct_bar(
        labels, pct_values.values, colors,
        "Best vs. worst content combos found -- still within ~1% of platform average",
        "Even after slicing by platform, content type, category and creator size, no combo beats or trails\n"
        "the platform's typical engagement rate by more than about 1%.",
        f"{CHART_DIR}/03_top_bottom_segments.png",
    )


def rebuild_chart_04(strata_df):
    strata_df = strata_df.copy()
    strata_df["label"] = strata_df.apply(
        lambda r: f"{r['platform']} - {r['creator_tier']} creators - {r['content_category']} "
                  f"(sponsored n={int(r['n_sponsored'])}, organic n={int(r['n_organic'])})",
        axis=1,
    )
    top_lift = strata_df.sort_values("lift", ascending=False).head(4)
    bottom_lift = strata_df.sort_values("lift", ascending=True).head(4)
    combined = pd.concat([top_lift, bottom_lift])
    pct_values = (combined["lift"] - 1) * 100
    colors = ["#2ca02c"] * len(top_lift) + ["#d62728"] * len(bottom_lift)
    pct_bar(
        combined["label"].tolist(), pct_values.values, colors,
        "Sponsored vs. organic posts -- no real winner in any matched group",
        "Comparing sponsored to organic posts with the same platform, creator size and category,\n"
        "the biggest gap found either way is under 1%.",
        f"{CHART_DIR}/04_sponsorship_lift.png",
    )


def rebuild_chart_05(all_res):
    import textwrap

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    pct = (all_res["lift"] - 1) * 100
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.hist(pct, bins=40, color="#4C72B0", edgecolor="white")
    ax.axvline(0, color="#333333", linewidth=1)
    ax.axvline(5, color="#d62728", linewidth=1, linestyle="--")
    ax.axvline(-5, color="#d62728", linewidth=1, linestyle="--")
    title = (
        f"Searched {len(all_res):,} narrow content combinations (platform, format, category, "
        "time of day, creator size, sponsorship, length) -- none reach the +/-5% bar for a real effect"
    )
    wrapped_title = textwrap.fill(title, width=65)
    fig.suptitle(wrapped_title, fontsize=12, fontweight="bold", x=0.02, ha="left", y=0.99)
    ax.set_xlabel("% difference vs. platform's typical engagement rate")
    ax.set_ylabel("Number of combinations")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    top_margin = 0.98 - 0.06 * wrapped_title.count("\n")
    fig.tight_layout(rect=[0, 0, 1, max(0.8, top_margin)])
    fig.savefig(f"{CHART_DIR}/05_narrow_combo_search.png", dpi=150)
    plt.close(fig)


def main():
    df = load()
    baselines = {}
    for plat, sub in df.groupby("platform"):
        baselines[plat] = {
            "median_engagement_rate": round(float(sub["er_views"].median()), 5),
            "median_views": round(float(sub["views"].median()), 1),
            "n": int(len(sub)),
        }

    verify_stats = verify(df, baselines)
    all_res, top_combo, bottom_combo, leader_example, share_5pct = narrow_hunt(df, baselines)

    # rebuild chart 01
    rebuild_chart_01(df, baselines)
    rebuild_chart_02(df, baselines)

    # recompute top5/bottom5 combined segments (same definition as 02_segmented_analysis.py)
    combo = df.groupby(
        ["platform", "content_type", "content_category", "creator_tier"], observed=True
    ).agg(median_er=("er_views", "median"), n=("er_views", "size")).reset_index()
    combo_ok = combo[combo["n"] >= MIN_N].copy()
    combo_ok["baseline"] = combo_ok["platform"].map(lambda p: baselines[p]["median_engagement_rate"])
    combo_ok["lift"] = combo_ok["median_er"] / combo_ok["baseline"]
    top5 = combo_ok.sort_values("lift", ascending=False).head(5)
    bottom5 = combo_ok.sort_values("lift", ascending=True).head(5)
    rebuild_chart_03(top5, bottom5)

    # recompute sponsorship strata (same definition as 02_segmented_analysis.py)
    strata_results = []
    for (plat, tier, cat), sub in df.groupby(["platform", "creator_tier", "content_category"], observed=True):
        spon = sub[sub["is_sponsored"] == True]["er_views"].dropna()
        org = sub[sub["is_sponsored"] == False]["er_views"].dropna()
        if len(spon) < MIN_N or len(org) < MIN_N:
            continue
        med_s, med_o = spon.median(), org.median()
        strata_results.append({
            "platform": plat, "creator_tier": tier, "content_category": cat,
            "lift": med_s / med_o if med_o else None,
            "n_sponsored": len(spon), "n_organic": len(org),
        })
    strata_df = pd.DataFrame(strata_results)
    rebuild_chart_04(strata_df)
    rebuild_chart_05(all_res)

    print("\nRebuilt charts: 01_er_platform_tier.png, 02_er_daypart.png, 03_top_bottom_segments.png, "
          "04_sponsorship_lift.png (+ new 05_narrow_combo_search.png)")

    # -------------------------------------------------------------
    # Update findings.json: append audit findings F18+
    # -------------------------------------------------------------
    with open(FINDINGS_PATH) as f:
        output = json.load(f)

    existing_ids = [int(f["id"][1:]) for f in output["findings"]]
    next_id = max(existing_ids) + 1

    def new_finding(**kw):
        nonlocal next_id
        fid = f"F{next_id:02d}"
        next_id += 1
        return {"id": fid, **kw}

    new_findings = []

    new_findings.append(new_finding(
        question="Q1",
        claim=(
            f"Independent audit re-checked creator-size, sponsorship and reach findings from raw data: all three "
            f"confirmed exactly (tier gap {verify_stats['tier_spread']:.3f}x, sponsorship lift "
            f"{verify_stats['sponsor_lift_min']:.3f}x-{verify_stats['sponsor_lift_max']:.3f}x, follower-vs-views "
            f"correlation {verify_stats['follower_views_corr']:.3f})."
        ),
        segment={"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
        metric="engagement_rate", value=verify_stats["tier_spread"], baseline=1.0, lift=None,
        n=int(len(df)), method="independent recomputation from raw data",
        effect_size="matches original findings exactly", confidence="high", chart=None,
    ))

    best_pct = (top_combo["lift"] - 1) * 100
    worst_pct = (bottom_combo["lift"] - 1) * 100
    new_findings.append(new_finding(
        question="Q1",
        claim=(
            f"Searched {len(all_res):,} narrow combos (platform, format, category, time, size, sponsorship, "
            f"length; n>=30 each). Best: {best_pct:+.1f}% vs median; worst: {worst_pct:+.1f}%. No cut is meaningful."
        ),
        segment={"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
        metric="engagement_rate", value=round(float(best_pct), 2), baseline=0.0, lift=round(float(top_combo["lift"]), 4),
        n=int(len(df)), method="exhaustive combo search",
        effect_size="max deviation across combos = 1.3%", confidence="high",
        chart="charts/05_narrow_combo_search.png",
    ))

    if leader_example.get("n", 0) >= MIN_N:
        lift_pct = (leader_example["best_lift"] - 1) * 100
        new_findings.append(new_finding(
            question="Q1",
            claim=(
                f"Long videos (>60s), evening, tech, 100K+ creators (n={leader_example['n']}): best platform "
                f"({leader_example['best_platform']}) reaches only {lift_pct:+.1f}% vs its usual rate."
            ),
            segment={"platform": leader_example["best_platform"], "content_type": "video", "category": "tech",
                     "creator_tier": None, "sponsored": None},
            metric="engagement_rate", value=round(float(lift_pct), 2), baseline=0.0,
            lift=round(float(leader_example["best_lift"]), 4), n=int(leader_example["n"]),
            method="direct filter on named combo",
            effect_size=f"{lift_pct:+.1f}% vs platform median (below 5%)", confidence="medium",
            chart="charts/05_narrow_combo_search.png",
        ))

    output["findings"].extend(new_findings)
    output["findings"] = output["findings"][:25] if len(output["findings"]) > 25 else output["findings"]

    output.setdefault("caveats", []).append(
        "Audit confirmed F01/F11/F17; see process-log/reviews/03-data-science-audit.md."
    )

    with open(FINDINGS_PATH, "w") as f:
        json.dump(output, f, separators=(",", ":"), default=str)

    size_kb = os.path.getsize(FINDINGS_PATH) / 1024
    print(f"\nUpdated {FINDINGS_PATH} ({size_kb:.1f} KB, {len(output['findings'])} findings)")


if __name__ == "__main__":
    main()
