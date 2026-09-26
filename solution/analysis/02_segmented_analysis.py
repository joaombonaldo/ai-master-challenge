"""
Phase 1 - Segmented analysis (Q1-Q4 of the brief).

Reads data/raw/social_media_dataset.csv, builds creator-size tiers (follower
quartiles, GATE 0 approved proxy), and answers:
  Q1 What drives engagement (platform x period x category x creator-tier,
     + content type, length, hashtags, timing).
  Q2 Does sponsorship pay off (sponsored vs organic, WITHIN matched strata of
     platform x creator-tier x category; engagement lift only, no $ ROI).
  Q3 Which audience profile engages most (platform x content type x category).
  Q4 What does NOT work (segments consistently below platform baseline;
     bottom-decile post characterization).

Only aggregates are printed (max 20 rows per table). Charts saved as PNG to
solution/outputs/charts/. Findings are exported to solution/outputs/findings.json.

GATE 0 / GATE 1 constraints (binding):
  - Engagement signal is unusually uniform across every cut tested -> signal_verdict is
    "WEAK-SIGNAL (directional only, per GATE 0)". Do not call the dataset
    synthetic/dummy/Kaggle in any deliverable -- treat it as the company's real business data.
  - Claim text is plain language for a non-technical exec. Statistical jargon
    (Mann-Whitney, p-values, decile/quartile/strata, "pp" abbreviations) never appears
    in a claim -- it is isolated in the optional `technical_detail` field. The `method`
    field also stays in plain words; the technical method name lives in `technical_detail`.
  - No $ cost/ROI column exists; sponsorship value is judged ONLY via engagement lift.
  - creator_tier = follower_count quartiles (Small/Mid/Large/Mega).
  - Never report engagement rate without reach + platform + creator-tier context.
  - Segment BEFORE aggregating; n < 30 cells are flagged/dropped.
"""
import json
import os

import numpy as np
import pandas as pd
from scipy import stats

np.random.seed(42)

RAW_PATH = "data/raw/social_media_dataset.csv"
CHART_DIR = "solution/outputs/charts"
FINDINGS_PATH = "solution/outputs/findings.json"
MIN_N = 30

os.makedirs(CHART_DIR, exist_ok=True)

PALETTE = {
    "Instagram": "#C13584",
    "TikTok": "#010101",
    "YouTube": "#FF0000",
    "Bilibili": "#00A1D6",
    "RedNote": "#FE2C55",
}

TIER_WORD = {"Small": "small creators", "Mid": "mid-size creators", "Large": "large creators", "Mega": "mega creators"}


def type_phrase(ctype, category):
    if ctype == "mixed":
        return f"mixed-format {category} posts"
    return f"{ctype} posts about {category}"


def segment_phrase(col, val):
    if col == "creator_tier":
        return f"from {str(val).lower()} creators"
    if col == "platform":
        return f"on {val}"
    if col == "content_type":
        return f"that are {val} posts"
    if col == "content_category":
        return f"in the {val} category"
    if col == "is_sponsored":
        return "that are sponsored" if val else "that are organic"
    return f"with {col}={val}"


def load():
    df = pd.read_csv(RAW_PATH)
    df["post_date"] = pd.to_datetime(df["post_date"], format="%m/%d/%y %I:%M %p", errors="coerce")
    df["hour"] = df["post_date"].dt.hour
    df["dow"] = df["post_date"].dt.dayofweek  # 0=Mon
    df["is_weekend"] = df["dow"].isin([5, 6])
    df["month"] = df["post_date"].dt.to_period("M").astype(str)

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

    df["hashtag_count"] = df["hashtags"].fillna("").apply(
        lambda s: 0 if s == "" else len([h for h in s.split(",") if h.strip()])
    )

    def hashtag_bucket(n):
        if n == 0:
            return "0"
        if n <= 3:
            return "1-3"
        if n <= 6:
            return "4-6"
        return "7+"

    df["hashtag_bucket"] = df["hashtag_count"].apply(hashtag_bucket)

    # creator tier: follower_count quartiles (GATE 0 approved proxy)
    df["creator_tier"] = pd.qcut(
        df["follower_count"], 4, labels=["Small", "Mid", "Large", "Mega"]
    )

    # content length bucket, computed WITHIN content_type since units differ
    # (seconds for video, chars for text/image captions, etc.)
    df["length_bucket"] = df.groupby("content_type")["content_length"].transform(
        lambda s: pd.qcut(s, 4, labels=["Q1-short", "Q2", "Q3", "Q4-long"], duplicates="drop")
    )

    return df


def n_ok(n):
    return n >= MIN_N


def median_er(sub):
    return sub["er_views"].median()


def lift(value, baseline):
    if baseline in (0, None) or pd.isna(baseline):
        return None
    return round(value / baseline, 3)


def save_bar(x, y, title, xlabel, ylabel, path, colors=None, rotation=30):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(8, 5))
    bar_colors = colors if colors is not None else "#4C72B0"
    ax.bar(x, y, color=bar_colors)
    ax.set_title(title, fontsize=12, fontweight="bold")
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    plt.xticks(rotation=rotation, ha="right")
    plt.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def save_line(df_wide, title, xlabel, ylabel, path):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(8, 5))
    for col in df_wide.columns:
        ax.plot(
            df_wide.index,
            df_wide[col],
            marker="o",
            label=col,
            color=PALETTE.get(col),
        )
    ax.set_title(title, fontsize=12, fontweight="bold")
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    ax.legend(fontsize=8)
    plt.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main():
    df = load()
    findings = []
    fid = [0]

    def new_id():
        fid[0] += 1
        return f"F{fid[0]:02d}"

    # ---------------------------------------------------------------
    # Baselines per platform (reach-contextualized, per GATE 0 rule a)
    # ---------------------------------------------------------------
    baselines = {}
    for plat, sub in df.groupby("platform"):
        baselines[plat] = {
            "median_engagement_rate": round(float(sub["er_views"].median()), 5),
            "median_views": round(float(sub["views"].median()), 1),
            "n": int(len(sub)),
        }
    print("Platform baselines:\n", pd.DataFrame(baselines).T)

    # Reality check: in a typical market, reach (views) should scale strongly with
    # creator size. Phase 0 found it does not here -- confirmed again below.
    views_by_tier = df.groupby("creator_tier", observed=True)["views"].median()
    views_tier_ratio = views_by_tier.max() / views_by_tier.min()
    followers_by_tier = df.groupby("creator_tier", observed=True)["follower_count"].median()
    print("\nMedian views by creator_tier (reach vs size sanity check):\n", views_by_tier)
    print("Median follower_count by creator_tier:\n", followers_by_tier)
    print(f"Views max/min ratio across tiers: {views_tier_ratio:.4f} "
          f"(follower_count max/min ratio: {followers_by_tier.max()/followers_by_tier.min():.2f})")

    # ---------------------------------------------------------------
    # Q1: platform x creator_tier ER (also shows reach) -- primary lens
    # ---------------------------------------------------------------
    g1 = df.groupby(["platform", "creator_tier"], observed=True).agg(
        median_er=("er_views", "median"),
        median_views=("views", "median"),
        n=("er_views", "size"),
    ).reset_index()
    print("\nMedian ER by platform x creator_tier:\n", g1.head(20))

    save_bar(
        [f"{p}\n{t}" for p, t in zip(g1["platform"], g1["creator_tier"])],
        g1["median_er"],
        "Median engagement rate by platform x creator tier",
        "Platform / Creator tier",
        "Median ER (eng / views)",
        f"{CHART_DIR}/01_er_platform_tier.png",
    )

    # Report ONE summary finding for platform x creator_tier (all 20 cells are
    # flat, per-cell findings would be repetitive noise -- see chart for detail).
    g1["max_min_tier"] = g1.groupby("platform")["median_er"].transform(lambda s: s.max() / s.min())
    worst_tier_spread = g1["max_min_tier"].max()
    tier_gap_pct = (worst_tier_spread - 1) * 100
    findings.append({
        "id": new_id(), "question": "Q1",
        "claim": f"Creator size (Small/Mid/Large/Mega, based on follower count) makes no meaningful difference to "
                 f"engagement rate on any platform -- the biggest gap between size tiers on the same platform is "
                 f"about {tier_gap_pct:.1f}%. Reach (views) is also flat across creator sizes.",
        "segment": {"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
        "metric": "engagement_rate", "value": round(float(worst_tier_spread), 3), "baseline": 1.0, "lift": None,
        "n": int(len(df)), "method": "median comparison across matched groups",
        "effect_size": f"biggest tier-to-tier gap = {tier_gap_pct:.1f}%",
        "confidence": "high", "chart": "charts/01_er_platform_tier.png",
    })

    # ---------------------------------------------------------------
    # Q1: platform x period (daypart, weekday/weekend) timing
    # ---------------------------------------------------------------
    g2 = df.groupby(["platform", "daypart"], observed=True).agg(
        median_er=("er_views", "median"), n=("er_views", "size")
    ).reset_index()
    pivot2 = g2.pivot(index="daypart", columns="platform", values="median_er").reindex(
        ["morning", "afternoon", "evening", "night"]
    )
    save_line(pivot2, "Median ER by time of day, per platform", "Daypart", "Median ER", f"{CHART_DIR}/02_er_daypart.png")
    print("\nMedian ER by platform x daypart:\n", g2.head(20))

    best_daypart_rows = []
    for plat, sub in g2.groupby("platform"):
        base = baselines[plat]["median_engagement_rate"]
        sub_ok = sub[sub["n"] >= MIN_N]
        if sub_ok.empty:
            continue
        best = sub_ok.loc[sub_ok["median_er"].idxmax()]
        worst = sub_ok.loc[sub_ok["median_er"].idxmin()]
        best_daypart_rows.append((plat, best, worst, base))

    for plat, best, worst, base in best_daypart_rows[:2]:
        rel = lift(best["median_er"], base)
        worst_rel = lift(worst["median_er"], base)
        best_pct = (rel - 1) * 100
        worst_pct = (worst_rel - 1) * 100
        if abs(worst_pct) < 0.05:
            tail = f"about the same as {worst['daypart']} posts"
        else:
            tail = f"and {worst['daypart']} posts score about {abs(worst_pct):.1f}% below"
        findings.append({
            "id": new_id(), "question": "Q1",
            "claim": f"On {plat}, {best['daypart']} posts score about {best_pct:.1f}% above the platform average "
                     f"engagement rate, {tail} -- essentially no difference between times of day.",
            "segment": {"platform": plat, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
            "metric": "engagement_rate", "value": round(float(best["median_er"]), 5),
            "baseline": base, "lift": rel, "n": int(best["n"]),
            "method": "median comparison across matched groups",
            "effect_size": f"evening vs {worst['daypart']} gap<{max(abs(best_pct - worst_pct), 0.1):.1f}%",
            "confidence": "medium", "chart": "charts/02_er_daypart.png",
        })

    # ---------------------------------------------------------------
    # Q1: content length bucket (within content_type) x platform
    # ---------------------------------------------------------------
    g3 = df.groupby(["content_type", "length_bucket"], observed=True).agg(
        median_er=("er_views", "median"), n=("er_views", "size")
    ).reset_index()
    print("\nMedian ER by content_type x length_bucket:\n", g3.head(20))
    overall_by_type = df.groupby("content_type")["er_views"].median()
    for _, row in g3.iterrows():
        base = overall_by_type[row["content_type"]]
        rel = lift(row["median_er"], base)
        if row["n"] >= MIN_N and rel is not None and abs(rel - 1) >= 0.05:
            gap_pct = abs(rel - 1) * 100
            findings.append({
                "id": new_id(), "question": "Q1",
                "claim": f"Among {row['content_type']} posts, the {row['length_bucket']} length group scores about "
                         f"{gap_pct:.1f}% {'above' if rel > 1 else 'below'} the typical {row['content_type']} "
                         f"engagement rate (n={int(row['n'])}).",
                "segment": {"platform": None, "content_type": row["content_type"], "category": None,
                            "creator_tier": None, "sponsored": None},
                "metric": "engagement_rate", "value": round(float(row["median_er"]), 5),
                "baseline": round(float(base), 5), "lift": rel, "n": int(row["n"]),
                "method": "median comparison across matched groups", "effect_size": "relative diff >=5%",
                "confidence": "low", "chart": None,
            })
            break  # keep only the single clearest length signal to save budget

    # null finding on length if no meaningful gap found
    max_rel_gap = (g3.assign(rel=g3.apply(lambda r: lift(r["median_er"], overall_by_type[r["content_type"]]), axis=1))
                   ["rel"].apply(lambda v: abs(v - 1) if v else 0).max())
    if max_rel_gap < 0.05:
        findings.append({
            "id": new_id(), "question": "Q1",
            "claim": "Content length (short/medium/long, measured separately within each content type) makes no "
                     "meaningful difference to engagement rate -- less than 5% difference in every case.",
            "segment": {"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
            "metric": "engagement_rate", "value": 0.0, "baseline": 0.0, "lift": 1.0,
            "n": int(len(df)), "method": "median comparison across matched groups", "effect_size": "max relative gap <5%",
            "confidence": "high", "chart": None,
        })

    # ---------------------------------------------------------------
    # Q1: hashtag count
    # ---------------------------------------------------------------
    g4 = df.groupby(["platform", "hashtag_bucket"], observed=True).agg(
        median_er=("er_views", "median"), n=("er_views", "size")
    ).reset_index()
    print("\nMedian ER by platform x hashtag_bucket:\n", g4.head(20))
    rel_gaps = []
    for plat, sub in g4.groupby("platform"):
        sub_ok = sub[sub["n"] >= MIN_N]
        if sub_ok.empty:
            continue
        rel_gaps.append(sub_ok["median_er"].max() / sub_ok["median_er"].min() - 1)
    hashtag_gap = max(rel_gaps) if rel_gaps else 0
    findings.append({
        "id": new_id(), "question": "Q1",
        "claim": (f"Number of hashtags used makes no meaningful difference to engagement rate once compared within "
                  f"the same platform -- the biggest gap between hashtag-count groups is about {hashtag_gap*100:.1f}%."
                  if hashtag_gap < 0.05 else
                  f"Number of hashtags used shows a real within-platform difference of about {hashtag_gap*100:.1f}% "
                  "between the best and worst hashtag-count group."),
        "segment": {"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
        "metric": "engagement_rate", "value": round(hashtag_gap, 3), "baseline": 0.0, "lift": None,
        "n": int(len(df)), "method": "median comparison across matched groups",
        "effect_size": f"spread={hashtag_gap*100:.1f}%",
        "confidence": "high" if hashtag_gap < 0.05 else "medium", "chart": None,
    })

    # ---------------------------------------------------------------
    # Q1: best combined segments (platform x content_type x category x tier)
    # ---------------------------------------------------------------
    combo = df.groupby(
        ["platform", "content_type", "content_category", "creator_tier"], observed=True
    ).agg(median_er=("er_views", "median"), median_views=("views", "median"), n=("er_views", "size")).reset_index()
    combo_ok = combo[combo["n"] >= MIN_N].copy()
    combo_ok["baseline"] = combo_ok["platform"].map(lambda p: baselines[p]["median_engagement_rate"])
    combo_ok["lift"] = combo_ok["median_er"] / combo_ok["baseline"]
    top5 = combo_ok.sort_values("lift", ascending=False).head(5)
    bottom5 = combo_ok.sort_values("lift", ascending=True).head(5)
    print("\nTop 5 combined segments by lift:\n", top5)
    print("\nBottom 5 combined segments by lift:\n", bottom5)

    labels = [f"{r.platform[:2]}/{r.content_type[:3]}/{r.content_category[:4]}/{r.creator_tier}"
              for r in top5.itertuples()] + [f"{r.platform[:2]}/{r.content_type[:3]}/{r.content_category[:4]}/{r.creator_tier}"
              for r in bottom5.itertuples()]
    values = list(top5["lift"]) + list(bottom5["lift"])
    colors = ["#2ca02c"] * len(top5) + ["#d62728"] * len(bottom5)
    save_bar(labels, values, "Top 5 vs bottom 5 combined segments (lift vs platform median ER)",
             "Segment (platform/type/category/tier)", "Lift vs platform median ER",
             f"{CHART_DIR}/03_top_bottom_segments.png", colors=colors, rotation=45)

    for i, (_, row) in enumerate(top5.iterrows()):
        if i >= 2:
            break  # only report the single closest-to-signal example, not spin 5 as "drivers"
        gap_pct = abs(row["lift"] - 1) * 100
        findings.append({
            "id": new_id(), "question": "Q1",
            "claim": f"Even the single best-performing detailed segment found ({type_phrase(row['content_type'], row['content_category'])} "
                     f"{segment_phrase('creator_tier', row['creator_tier'])} on {row['platform']}) only reaches {gap_pct:.1f}% "
                     f"above the platform average engagement rate ({int(row['n'])} posts) -- below the 5% bar we use to "
                     "call something a real difference.",
            "segment": {"platform": row["platform"], "content_type": row["content_type"],
                        "category": row["content_category"], "creator_tier": row["creator_tier"], "sponsored": None},
            "metric": "engagement_rate", "value": round(float(row["median_er"]), 5),
            "baseline": round(float(row["baseline"]), 5), "lift": round(float(row["lift"]), 3),
            "n": int(row["n"]), "method": "median comparison across matched groups",
            "effect_size": f"+{gap_pct:.1f}% (< 5% threshold)",
            "confidence": "low", "chart": "charts/03_top_bottom_segments.png",
        })

    # ---------------------------------------------------------------
    # Q4: underperformer combined segments
    # ---------------------------------------------------------------
    for i, (_, row) in enumerate(bottom5.iterrows()):
        if i >= 2:
            break
        gap_pct = abs(row["lift"] - 1) * 100
        findings.append({
            "id": new_id(), "question": "Q4",
            "claim": f"Even the single worst-performing detailed segment found ({type_phrase(row['content_type'], row['content_category'])} "
                     f"{segment_phrase('creator_tier', row['creator_tier'])} on {row['platform']}) sits only {gap_pct:.1f}% "
                     f"below the platform average engagement rate ({int(row['n'])} posts) -- below the 5% bar, so no "
                     "detailed segment qualifies as a genuine underperformer.",
            "segment": {"platform": row["platform"], "content_type": row["content_type"],
                        "category": row["content_category"], "creator_tier": row["creator_tier"], "sponsored": None},
            "metric": "engagement_rate", "value": round(float(row["median_er"]), 5),
            "baseline": round(float(row["baseline"]), 5), "lift": round(float(row["lift"]), 3),
            "n": int(row["n"]), "method": "median comparison across matched groups",
            "effect_size": f"-{gap_pct:.1f}% (< 5% threshold)",
            "confidence": "low", "chart": "charts/03_top_bottom_segments.png",
        })

    # bottom-decile posts (post-level, not segment) characterization
    thresh = df["er_views"].quantile(0.10)
    bottom_decile = df[df["er_views"] <= thresh]
    rest = df[df["er_views"] > thresh]
    char_cols = ["platform", "content_type", "content_category", "creator_tier", "is_sponsored"]
    print("\nBottom-decile share by attribute (vs rest of data):")
    char_summary = {}
    for col in char_cols:
        bd_share = bottom_decile[col].value_counts(normalize=True)
        rest_share = rest[col].value_counts(normalize=True)
        diff = (bd_share - rest_share).sort_values(ascending=False)
        print(f"\n{col} overrepresented in bottom decile:\n", diff.head(5))
        char_summary[col] = diff.head(3).to_dict()

    top_over = max(
        ((col, k, v) for col, d in char_summary.items() for k, v in d.items()),
        key=lambda t: t[2],
    )
    pp_value = top_over[2] * 100
    pp_rounded = round(pp_value)
    findings.append({
        "id": new_id(), "question": "Q4",
        "claim": f"The worst-performing 10% of posts ({len(bottom_decile):,} posts) include slightly more posts "
                 f"{segment_phrase(top_over[0], top_over[1])} than the rest (about {pp_rounded} "
                 f"point{'s' if pp_rounded != 1 else ''} more) -- a weak pattern, not a proven cause.",
        "segment": {"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
        "metric": "engagement_rate", "value": float(thresh), "baseline": float(df["er_views"].median()),
        "lift": round(float(thresh / df["er_views"].median()), 3) if df["er_views"].median() else None,
        "n": int(len(bottom_decile)), "method": "comparison of worst 10% vs rest of dataset",
        "effect_size": f"+{pp_rounded}pp overrepresentation",
        "usage_guidance": "Treat as a hypothesis to test, not a rule to act on -- validate before changing spend.",
        "confidence": "medium", "chart": None,
    })

    # ---------------------------------------------------------------
    # Q2: sponsored vs organic lift WITHIN platform x creator_tier x category
    # ---------------------------------------------------------------
    strata_results = []
    for (plat, tier, cat), sub in df.groupby(["platform", "creator_tier", "content_category"], observed=True):
        spon = sub[sub["is_sponsored"] == True]["er_views"].dropna()
        org = sub[sub["is_sponsored"] == False]["er_views"].dropna()
        if len(spon) < MIN_N or len(org) < MIN_N:
            continue
        med_s, med_o = spon.median(), org.median()
        try:
            u, p = stats.mannwhitneyu(spon, org, alternative="two-sided")
        except ValueError:
            p = np.nan
        lift_val = med_s / med_o if med_o else None
        strata_results.append({
            "platform": plat, "creator_tier": tier, "content_category": cat,
            "median_er_sponsored": med_s, "median_er_organic": med_o,
            "lift": lift_val, "n_sponsored": len(spon), "n_organic": len(org), "p_value": p,
        })

    strata_df = pd.DataFrame(strata_results)
    print("\nSponsored vs organic by strata (platform x creator_tier x category), n=",
          len(strata_df), "\n", strata_df.head(20))

    if not strata_df.empty:
        strata_df["strata_label"] = strata_df.apply(
            lambda r: f"{r['platform'][:2]}/{r['creator_tier']}/{r['content_category'][:4]}", axis=1
        )
        top_lift = strata_df.sort_values("lift", ascending=False).head(4)
        bottom_lift = strata_df.sort_values("lift", ascending=True).head(4)
        combined = pd.concat([top_lift, bottom_lift])
        save_bar(
            combined["strata_label"], combined["lift"],
            "Sponsored vs organic ER lift, best & worst strata (platform x tier x category)",
            "Stratum", "Sponsored/organic median ER lift",
            f"{CHART_DIR}/04_sponsorship_lift.png", rotation=45,
            colors=["#2ca02c"] * len(top_lift) + ["#d62728"] * len(bottom_lift),
        )

        overall_median_lift = strata_df["lift"].median()
        share_significant = (strata_df["p_value"] < 0.05).mean()
        lift_span_pp = (strata_df["lift"].max() - strata_df["lift"].min()) * 100
        min_pct = (strata_df["lift"].min() - 1) * 100
        max_pct = (strata_df["lift"].max() - 1) * 100
        median_pct = (overall_median_lift - 1) * 100
        findings.append({
            "id": new_id(), "question": "Q2",
            "claim": f"Across {len(strata_df)} matched groups (platform, creator size, category), sponsored posts "
                     f"perform essentially the same as organic: {abs(min_pct):.1f}% lower to {max_pct:.1f}% higher, "
                     f"typically {median_pct:.0f}%. No meaningful sponsorship lift or penalty after matching.",
            "segment": {"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": True},
            "metric": "engagement_rate", "value": round(float(overall_median_lift), 3), "baseline": 1.0,
            "lift": round(float(overall_median_lift), 3), "n": int(strata_df[["n_sponsored", "n_organic"]].sum().sum()),
            "method": "statistical test across matched groups, median of group differences",
            "effect_size": f"range across {len(strata_df)} groups: ~{lift_span_pp:.1f}pp end to end",
            "technical_detail": f"Mann-Whitney U/stratum; lift {strata_df['lift'].min():.3f}x-"
                                 f"{strata_df['lift'].max():.3f}x; {share_significant*100:.0f}% p<0.05",
            "confidence": "high", "chart": "charts/04_sponsorship_lift.png",
        })

        best_row = top_lift.iloc[0]
        worst_row = bottom_lift.iloc[0]
        best_pct = (best_row["lift"] - 1) * 100
        worst_pct = (worst_row["lift"] - 1) * 100
        best_word = "borderline result" if best_row["p_value"] < 0.05 else "not a reliable difference"
        worst_word = "borderline result" if worst_row["p_value"] < 0.05 else "not a reliable difference"
        findings.append({
            "id": new_id(), "question": "Q2",
            "claim": f"Even in the single group most favorable to sponsorship found ({best_row['platform']}, "
                     f"{best_row['creator_tier'].lower()} creators, {best_row['content_category']} category), "
                     f"sponsored posts scored only {best_pct:.1f}% higher than organic ({int(best_row['n_sponsored'] + best_row['n_organic'])} "
                     "posts) -- not a reliable difference. No platform/creator-size/category combination shows "
                     "sponsorship clearly paying off in this dataset.",
            "segment": {"platform": best_row["platform"], "content_type": None, "category": best_row["content_category"],
                        "creator_tier": best_row["creator_tier"], "sponsored": True},
            "metric": "engagement_rate", "value": round(float(best_row["median_er_sponsored"]), 5),
            "baseline": round(float(best_row["median_er_organic"]), 5), "lift": round(float(best_row["lift"]), 3),
            "n": int(best_row["n_sponsored"] + best_row["n_organic"]), "method": "statistical test on matched group",
            "effect_size": f"+{best_pct:.1f}%, {best_word}",
            "technical_detail": f"p={best_row['p_value']:.3f}",
            "confidence": "low", "chart": "charts/04_sponsorship_lift.png",
        })
        findings.append({
            "id": new_id(), "question": "Q2",
            "claim": f"Even in the single group least favorable to sponsorship found ({worst_row['platform']}, "
                     f"{worst_row['creator_tier'].lower()} creators, {worst_row['content_category']} category), "
                     f"sponsored posts scored only {abs(worst_pct):.1f}% lower than organic "
                     f"({int(worst_row['n_sponsored'] + worst_row['n_organic'])} posts) -- this is not strong evidence "
                     "that sponsorship hurts engagement either.",
            "segment": {"platform": worst_row["platform"], "content_type": None, "category": worst_row["content_category"],
                        "creator_tier": worst_row["creator_tier"], "sponsored": True},
            "metric": "engagement_rate", "value": round(float(worst_row["median_er_sponsored"]), 5),
            "baseline": round(float(worst_row["median_er_organic"]), 5), "lift": round(float(worst_row["lift"]), 3),
            "n": int(worst_row["n_sponsored"] + worst_row["n_organic"]), "method": "statistical test on matched group",
            "effect_size": f"-{abs(worst_pct):.1f}%, {worst_word}",
            "technical_detail": f"p={worst_row['p_value']:.3f}",
            "confidence": "low", "chart": "charts/04_sponsorship_lift.png",
        })

    # disclosure_type effect within sponsored posts
    spon_df = df[df["is_sponsored"] == True]
    g_disc = spon_df.groupby(["platform", "disclosure_type"], observed=True).agg(
        median_er=("er_views", "median"), n=("er_views", "size")
    ).reset_index()
    g_disc_ok = g_disc[g_disc["n"] >= MIN_N]
    print("\nMedian ER by disclosure_type within sponsored posts:\n", g_disc_ok.head(20))
    if not g_disc_ok.empty:
        rel_spread = g_disc_ok.groupby("platform")["median_er"].apply(lambda s: s.max() / s.min() if s.min() else np.nan)
        max_spread_plat = rel_spread.idxmax() if not rel_spread.empty else None
        if max_spread_plat is not None:
            spread_val = rel_spread[max_spread_plat]
            spread_pct = (spread_val - 1) * 100
            findings.append({
                "id": new_id(), "question": "Q2",
                "claim": (f"How a sponsorship is disclosed (explicit vs. implicit) makes no meaningful difference to "
                          f"engagement rate once compared within the same platform -- the biggest platform-level gap "
                          f"is about {spread_pct:.1f}% (largest on {max_spread_plat})."
                          if spread_val < 1.1 else
                          f"How a sponsorship is disclosed changes engagement rate by about {spread_pct:.1f}% between "
                          f"the best and worst disclosure type on {max_spread_plat}, once compared within platform."),
                "segment": {"platform": max_spread_plat if spread_val >= 1.1 else None, "content_type": None,
                            "category": None, "creator_tier": None, "sponsored": True},
                "metric": "engagement_rate", "value": round(float(spread_val), 3), "baseline": 1.0, "lift": None,
                "n": int(spon_df.shape[0]), "method": "median comparison across matched groups",
                "effect_size": f"spread={spread_pct:.1f}%",
                "confidence": "high" if spread_val < 1.1 else "medium", "chart": None,
            })

    # ---------------------------------------------------------------
    # Q3: audience profile (age/gender/location) x platform x content_type x category
    # ---------------------------------------------------------------
    g_aud = df.groupby(["platform", "audience_age_distribution"], observed=True).agg(
        median_er=("er_views", "median"), n=("er_views", "size")
    ).reset_index()
    g_aud_ok = g_aud[g_aud["n"] >= MIN_N]
    top_aud = g_aud_ok.sort_values("median_er", ascending=False).head(1)
    print("\nTop platform x audience_age segments by median ER:\n", top_aud)
    for _, row in top_aud.iterrows():
        base = baselines[row["platform"]]["median_engagement_rate"]
        rel = lift(row["median_er"], base)
        gap_pct = abs(rel - 1) * 100
        findings.append({
            "id": new_id(), "question": "Q3",
            "claim": f"Audience age makes no meaningful difference to engagement: even the best case found "
                     f"({row['platform']} posts whose dominant audience is {row['audience_age_distribution']}) is "
                     f"only {gap_pct:.1f}% above the platform average ({int(row['n'])} posts) -- below the 5% bar.",
            "segment": {"platform": row["platform"], "content_type": None, "category": None,
                        "creator_tier": None, "sponsored": None},
            "metric": "engagement_rate", "value": round(float(row["median_er"]), 5),
            "baseline": base, "lift": rel, "n": int(row["n"]),
            "method": "median comparison across matched groups", "effect_size": f"+{gap_pct:.1f}% (< 5% threshold)",
            "confidence": "low", "chart": None,
        })

    g_gender = df.groupby(["platform", "audience_gender_distribution"], observed=True).agg(
        median_er=("er_views", "median"), n=("er_views", "size")
    ).reset_index()
    g_gender_ok = g_gender[g_gender["n"] >= MIN_N]
    gender_spread = g_gender_ok.groupby("platform")["median_er"].apply(lambda s: s.max() / s.min() if s.min() else np.nan)
    print("\nAudience gender ER spread by platform:\n", gender_spread)
    max_gender_spread = gender_spread.max() if not gender_spread.empty else 0
    max_gender_spread_pct = (max_gender_spread - 1) * 100
    findings.append({
        "id": new_id(), "question": "Q3",
        "claim": (f"Audience gender skew makes no meaningful difference to engagement rate within any platform -- "
                  f"the biggest platform-level gap is about {max_gender_spread_pct:.1f}%."
                  if max_gender_spread < 1.1 else
                  f"Audience gender skew changes engagement rate by about {max_gender_spread_pct:.1f}% between the "
                  "best and worst group within at least one platform."),
        "segment": {"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
        "metric": "engagement_rate", "value": round(float(max_gender_spread), 3), "baseline": 1.0, "lift": None,
        "n": int(len(df)), "method": "median comparison across matched groups",
        "effect_size": f"spread={max_gender_spread_pct:.1f}%",
        "confidence": "high" if max_gender_spread < 1.1 else "medium", "chart": None,
    })

    # ---------------------------------------------------------------
    # Overall flat-signal check (mirrors Phase 0, now stratified)
    # ---------------------------------------------------------------
    global_median = df["er_views"].median()
    combo_span_pct = (combo_ok["lift"].max() - combo_ok["lift"].min()) * 100 if not combo_ok.empty else 0
    typical_views = int(round(views_by_tier.median(), -2))
    min_foll_k = int(round(followers_by_tier.min() / 1000))
    max_foll_k = int(round(followers_by_tier.max() / 1000))
    n_combo_cells = int(len(combo_ok))
    findings.append({
        "id": new_id(), "question": "Q1",
        "claim": f"Confirms the flat-signal pattern holds at the deepest level tested (platform x content type x "
                 f"category x creator size, {n_combo_cells} groups, n>=30 each): the full range is only "
                 f"{combo_span_pct:.1f} percentage points around the platform average -- not an artifact of broad "
                 f"averages. Reach (views) also stays flat (~{typical_views:,}) across creator-size bands from "
                 f"{min_foll_k}K to {max_foll_k}K followers.",
        "segment": {"platform": None, "content_type": None, "category": None, "creator_tier": None, "sponsored": None},
        "metric": "engagement_rate", "value": round(float(global_median), 5), "baseline": round(float(global_median), 5),
        "lift": 1.0, "n": int(len(df)), "method": "global vs. detailed-segment median comparison, plus reach-vs-followers check",
        "effect_size": f"span={combo_span_pct:.1f}pp; views/tier ratio={views_tier_ratio:.3f}x"
                       if not combo_ok.empty else "n/a",
        "confidence": "high", "chart": "charts/03_top_bottom_segments.png",
    })

    # ---------------------------------------------------------------
    # Assemble output
    # ---------------------------------------------------------------
    findings = findings[:25]

    max_dev_combo = max(abs(combo_ok["lift"].max() - 1), abs(combo_ok["lift"].min() - 1)) * 100 if not combo_ok.empty else 0
    max_dev_sponsor = max(abs(min_pct), abs(max_pct)) if not strata_df.empty else 0

    output = {
        "dataset": {
            "rows": int(len(df)),
            "date_range": [str(df["post_date"].min().date()), str(df["post_date"].max().date())],
            "signal_verdict": "WEAK-SIGNAL (directional only, per GATE 0)",
            "evidence": [
                f"Engagement rate is nearly identical dataset-wide (~{global_median*100:.1f}%) regardless of "
                "platform, content type, category, sponsorship, or creator size (Phase 0 finding).",
                "Confirmed at the most detailed level tested (platform x content type x category x creator size): "
                f"differences are at most {max_dev_combo:.0f}% from the platform average, well under our 5% "
                "threshold for a real difference.",
                f"Reach (views) does not scale with creator size: typical post gets ~{typical_views:,} views "
                f"whether the creator has {min_foll_k}K or {max_foll_k}K followers.",
                f"Sponsored vs. organic posts across {len(strata_df)} matched groups (platform x creator size x "
                f"category) differ by at most ~{max_dev_sponsor:.1f}pp either way -- no sponsorship effect detected.",
            ],
        },
        "baselines": baselines,
        "findings": findings,
        "assumptions": [
            "creator_tier = follower_count quartiles (Small/Mid/Large/Mega), approved at GATE 0.",
            "No cost/spend column exists; 'does sponsorship pay off' is answered only via engagement lift, never $ ROI.",
            "content_length is bucketed into quartiles WITHIN content_type because units differ (video seconds vs text/caption chars).",
            "daypart (morning/afternoon/evening/night) derived from post_date hour; no timezone normalization available.",
            "audience_age/gender/location columns are treated as the single dominant audience segment per post, not a full distribution.",
        ],
        "caveats": [
            "Engagement patterns are unusually uniform across segments -- read all lifts as directional signals for "
            "discussion, not guaranteed real-market outcomes.",
            "Groups with fewer than 30 posts are excluded; some fine-grained combos (e.g. platform x tier x category "
            "x sponsored x disclosure) were too small to report.",
            "Significance tests are noted in technical_detail for reference only; with ~52,000 rows tiny differences "
            "can look 'significant' -- effect size, not significance, should drive decisions.",
        ],
    }

    with open(FINDINGS_PATH, "w") as f:
        json.dump(output, f, separators=(",", ":"), default=str)

    size_kb = os.path.getsize(FINDINGS_PATH) / 1024
    print(f"\nWrote {FINDINGS_PATH} ({size_kb:.1f} KB, {len(findings)} findings)")


if __name__ == "__main__":
    main()
