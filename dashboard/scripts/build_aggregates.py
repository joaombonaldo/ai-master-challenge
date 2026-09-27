"""
Phase 3a data layer -- precompute a compact, fully-aggregated JSON artifact
for the dashboard from the raw dataset.

Rules (binding, same as solution/analysis/*):
  - Raw rows never ship to the browser. Only pre-aggregated sums/counts per
    (platform x category x creator_tier x sponsored x month) cell are written
    to dashboard/public/data/aggregates.json.
  - creator_tier = follower_count quartiles (Small/Mid/Large/Mega), same
    method GATE-0-approved and used in solution/analysis/02_segmented_analysis.py.
  - Cells store SUMS (views/likes/shares/comments/followers) + n, not medians,
    so the client can combine any filter combination exactly (sums are
    additive; medians of medians would not be). Weighted engagement rate is
    then computed client-side as sum(likes+shares+comments)/sum(views) over
    whatever cells match the current filters.
  - Output uses positional arrays + lookup tables (not repeated string keys)
    to keep the artifact small.

Run from the `dashboard/` directory:
    python3 scripts/build_aggregates.py

Reads:  ../data/raw/social_media_dataset.csv (relative to this script's repo)
Writes: public/data/aggregates.json
"""
import json
import os

import numpy as np
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
RAW_PATH = os.path.join(REPO_ROOT, "data", "raw", "social_media_dataset.csv")
OUT_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "aggregates.json")


def build():
    df = pd.read_csv(RAW_PATH)

    df["post_date"] = pd.to_datetime(
        df["post_date"], format="%m/%d/%y %I:%M %p", errors="coerce"
    )
    df["month"] = df["post_date"].dt.to_period("M").astype(str)

    # Same GATE-0-approved proxy as solution/analysis: follower_count quartiles.
    df["creator_tier"] = pd.qcut(
        df["follower_count"], 4, labels=["Small", "Mid", "Large", "Mega"]
    )

    platforms = sorted(df["platform"].unique().tolist())
    categories = sorted(df["content_category"].unique().tolist())
    tiers = ["Small", "Mid", "Large", "Mega"]
    months = sorted(df["month"].dropna().unique().tolist())

    p_idx = {v: i for i, v in enumerate(platforms)}
    c_idx = {v: i for i, v in enumerate(categories)}
    t_idx = {v: i for i, v in enumerate(tiers)}
    m_idx = {v: i for i, v in enumerate(months)}

    grouped = (
        df.groupby(
            ["platform", "content_category", "creator_tier", "is_sponsored", "month"],
            observed=True,
        )
        .agg(
            n=("id", "size"),
            sum_views=("views", "sum"),
            sum_likes=("likes", "sum"),
            sum_shares=("shares", "sum"),
            sum_comments=("comments_count", "sum"),
            sum_followers=("follower_count", "sum"),
        )
        .reset_index()
    )

    rows = []
    for r in grouped.itertuples(index=False):
        if pd.isna(r.month):
            continue
        rows.append(
            [
                p_idx[r.platform],
                c_idx[r.content_category],
                t_idx[r.creator_tier],
                1 if r.is_sponsored else 0,
                m_idx[r.month],
                int(r.n),
                int(r.sum_views),
                int(r.sum_likes),
                int(r.sum_shares),
                int(r.sum_comments),
                int(r.sum_followers),
            ]
        )

    tier_bounds = (
        df.groupby("creator_tier", observed=True)["follower_count"]
        .agg(["min", "max"])
        .reindex(tiers)
    )

    out = {
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "source": "data/raw/social_media_dataset.csv",
        "row_count_source": int(len(df)),
        "cell_count": len(rows),
        "legend": {
            "platform": platforms,
            "category": categories,
            "creator_tier": tiers,
            "sponsored": ["organic", "sponsored"],
            "month": months,
        },
        "columns": [
            "platform_idx",
            "category_idx",
            "creator_tier_idx",
            "sponsored",
            "month_idx",
            "n",
            "sum_views",
            "sum_likes",
            "sum_shares",
            "sum_comments",
            "sum_followers",
        ],
        "creator_tier_follower_bounds": {
            tier: [int(row["min"]), int(row["max"])]
            for tier, row in tier_bounds.iterrows()
        },
        # Internal build note, not rendered in the app UI -- kept here only
        # for engineers regenerating this file, so keep it self-contained
        # (no references to internal project docs or process artifacts).
        "methodology_note": (
            "Each row is one aggregate cell (platform x category x creator tier x "
            "sponsored flag x month), never an individual post. creator_tier is "
            "based on follower-count quartiles (Small/Mid/Large/Mega). Engagement "
            "rate shown in the dashboard is a weighted average -- sum(likes+shares"
            "+comments)/sum(views) across whatever cells match the active filters "
            "-- not a prediction."
        ),
        "data": rows,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB, {len(rows)} cells from {len(df):,} rows)")


if __name__ == "__main__":
    build()
