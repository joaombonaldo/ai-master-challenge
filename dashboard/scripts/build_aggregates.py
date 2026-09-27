"""
Phase 3a data layer -- precompute a compact, fully-aggregated JSON artifact
for the dashboard from the raw dataset.

Rules (binding, same as solution/analysis/*):
  - Raw rows never ship to the browser. Only pre-aggregated sums/counts per
    (platform x category x creator_tier x sponsored x month x content_type x
    language x audience_location) cell are written to
    dashboard/public/data/aggregates.json. content_type/language/
    audience_location were added per solution/outputs/dashboard_columns_profile.md
    (0% missing, low cardinality: 4/5/8 values, independent of each other).
    Measured: 44,884 non-empty cells (~2.0 MB raw / ~622 KB gzip), up from
    2,969 cells (~140 KB) for the original 5-dimension cube -- bigger than
    the original ballpark, but still well under 1 MB once gzip/brotli
    compression (applied automatically by Next.js/Vercel to public/ JSON) is
    accounted for, and still strictly aggregated sums/counts (no post ids,
    no raw per-post fields), never individual rows.
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
Writes: public/data/aggregates.json (shipped to the browser)
        data/server_aggregates.json (server-only, richer cube -- see
        build_server_aggregates() below; never placed under public/)
"""
import json
import os

import numpy as np
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
RAW_PATH = os.path.join(REPO_ROOT, "data", "raw", "social_media_dataset.csv")
OUT_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "aggregates.json")
# Server-only companion artifact -- see the big comment above
# `build_server_aggregates()` below for why this is a SEPARATE file that is
# never placed under public/.
SERVER_OUT_PATH = os.path.join(SCRIPT_DIR, "..", "data", "server_aggregates.json")


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

    # Same daypart bucketing as solution/analysis/02_segmented_analysis.py
    # (hour of post_date, no timezone normalization available).
    df["hour"] = df["post_date"].dt.hour

    def daypart(h):
        if pd.isna(h):
            return None
        h = int(h)
        if 5 <= h < 12:
            return "morning"
        if 12 <= h < 17:
            return "afternoon"
        if 17 <= h < 21:
            return "evening"
        return "night"

    df["daypart"] = df["hour"].apply(daypart)

    # Same length bucketing as solution/analysis/02_segmented_analysis.py:
    # content_length quartiles WITHIN content_type, because units differ
    # (video seconds vs. text/caption characters vs. image/mixed captions).
    df["length_bucket"] = df.groupby("content_type")["content_length"].transform(
        lambda s: pd.qcut(s, 4, labels=["Q1 (mais curto)", "Q2", "Q3", "Q4 (mais longo)"])
    )

    platforms = sorted(df["platform"].unique().tolist())
    categories = sorted(df["content_category"].unique().tolist())
    tiers = ["Small", "Mid", "Large", "Mega"]
    months = sorted(df["month"].dropna().unique().tolist())
    content_types = sorted(df["content_type"].dropna().unique().tolist())
    languages = sorted(df["language"].dropna().unique().tolist())
    audience_locations = sorted(df["audience_location"].dropna().unique().tolist())

    p_idx = {v: i for i, v in enumerate(platforms)}
    c_idx = {v: i for i, v in enumerate(categories)}
    t_idx = {v: i for i, v in enumerate(tiers)}
    m_idx = {v: i for i, v in enumerate(months)}
    ct_idx = {v: i for i, v in enumerate(content_types)}
    lang_idx = {v: i for i, v in enumerate(languages)}
    loc_idx = {v: i for i, v in enumerate(audience_locations)}

    grouped = (
        df.groupby(
            [
                "platform",
                "content_category",
                "creator_tier",
                "is_sponsored",
                "month",
                "content_type",
                "language",
                "audience_location",
            ],
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
                ct_idx[r.content_type],
                lang_idx[r.language],
                loc_idx[r.audience_location],
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
            "content_type": content_types,
            "language": languages,
            "audience_location": audience_locations,
        },
        "columns": [
            "platform_idx",
            "category_idx",
            "creator_tier_idx",
            "sponsored",
            "month_idx",
            "content_type_idx",
            "language_idx",
            "audience_location_idx",
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
            "sponsored flag x month x content_type x language x audience_location), "
            "never an individual post. creator_tier is based on follower-count "
            "quartiles (Small/Mid/Large/Mega). Engagement rate shown in the "
            "dashboard is a weighted average -- sum(likes+shares+comments)/"
            "sum(views) across whatever cells match the active filters -- not a "
            "prediction. content_type/language/audience_location are exposed as "
            "filters only (no engagement differentiation across them worth "
            "surfacing as a finding -- see dashboard_columns_profile.md)."
        ),
        "data": rows,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB, {len(rows)} cells from {len(df):,} rows)")

    build_server_aggregates(df, p_idx, c_idx, t_idx, m_idx, platforms, categories, tiers, months)


# ---------------------------------------------------------------------
# Phase 3g (leader decision): format/duration/posting-time breakdowns sent
# to the LLM recommendations route must be computed WITHIN the current
# dashboard filter (platform x category x tier x sponsored x month), not
# dataset-wide. Naively extending the CLIENT-side cube above with
# content_type x length_bucket x daypart as three more filter dimensions
# was measured and rejected: it grows the cube from 2,969 non-empty cells
# (~140 KB shipped today) to 40,682 non-empty cells (~1.5+ MB) on this
# dataset -- a >10x payload increase to the BROWSER just to serve three
# breakdowns that only the server-side LLM prompt needs. So instead this
# richer 8-dimension cube is written to a SEPARATE file that lives outside
# public/ (dashboard/data/server_aggregates.json, never fetched by the
# client) and is read only by app/api/recommendations/route.ts (Node
# runtime) via lib/server-aggregates.ts, which re-aggregates it on demand
# for whatever filter the user currently has active. Raw rows still never
# leave this build step or the server process -- only aggregate sums.
#
# language / audience_location were added as 2 more dimensions (10 total)
# so this cube's breakdowns also respect those 2 new dashboard filters (not
# just content_type, already present here). Measured: 51,614 non-empty
# cells (~2 MB) -- server-only, so this size is not a browser-payload
# concern.
# ---------------------------------------------------------------------
def build_server_aggregates(df, p_idx, c_idx, t_idx, m_idx, platforms, categories, tiers, months):
    content_types = sorted(df["content_type"].dropna().unique().tolist())
    length_buckets = ["Q1 (mais curto)", "Q2", "Q3", "Q4 (mais longo)"]
    dayparts = ["morning", "afternoon", "evening", "night"]
    languages = sorted(df["language"].dropna().unique().tolist())
    audience_locations = sorted(df["audience_location"].dropna().unique().tolist())
    ct_idx = {v: i for i, v in enumerate(content_types)}
    lb_idx = {v: i for i, v in enumerate(length_buckets)}
    dp_idx = {v: i for i, v in enumerate(dayparts)}
    lang_idx = {v: i for i, v in enumerate(languages)}
    loc_idx = {v: i for i, v in enumerate(audience_locations)}

    cols = [
        "platform",
        "content_category",
        "creator_tier",
        "is_sponsored",
        "month",
        "content_type",
        "length_bucket",
        "daypart",
        "language",
        "audience_location",
    ]
    grouped = (
        df.groupby(cols, observed=True)
        .agg(
            n=("id", "size"),
            sum_views=("views", "sum"),
            sum_likes=("likes", "sum"),
            sum_shares=("shares", "sum"),
            sum_comments=("comments_count", "sum"),
        )
        .reset_index()
    )

    rows = []
    for r in grouped.itertuples(index=False):
        if pd.isna(r.month) or pd.isna(r.length_bucket) or pd.isna(r.daypart):
            continue
        rows.append(
            [
                p_idx[r.platform],
                c_idx[r.content_category],
                t_idx[r.creator_tier],
                1 if r.is_sponsored else 0,
                m_idx[r.month],
                ct_idx[r.content_type],
                lb_idx[r.length_bucket],
                dp_idx[r.daypart],
                lang_idx[r.language],
                loc_idx[r.audience_location],
                int(r.n),
                int(r.sum_views),
                int(r.sum_likes),
                int(r.sum_shares),
                int(r.sum_comments),
            ]
        )

    out = {
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "note": (
            "SERVER-ONLY artifact. Do not place under public/ or fetch it "
            "from client code -- it exists only to let "
            "app/api/recommendations/route.ts compute format/duration/"
            "posting-time breakdowns WITHIN the dashboard's active filter, "
            "without shipping this much granularity to the browser. See "
            "scripts/build_aggregates.py build_server_aggregates()."
        ),
        "legend": {
            "platform": platforms,
            "category": categories,
            "creator_tier": tiers,
            "sponsored": ["organic", "sponsored"],
            "month": months,
            "content_type": content_types,
            "length_bucket": length_buckets,
            "daypart": dayparts,
            "language": languages,
            "audience_location": audience_locations,
        },
        "columns": [
            "platform_idx",
            "category_idx",
            "creator_tier_idx",
            "sponsored",
            "month_idx",
            "content_type_idx",
            "length_bucket_idx",
            "daypart_idx",
            "language_idx",
            "audience_location_idx",
            "n",
            "sum_views",
            "sum_likes",
            "sum_shares",
            "sum_comments",
        ],
        "data": rows,
    }

    os.makedirs(os.path.dirname(SERVER_OUT_PATH), exist_ok=True)
    with open(SERVER_OUT_PATH, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    size_kb = os.path.getsize(SERVER_OUT_PATH) / 1024
    print(f"Wrote {SERVER_OUT_PATH} ({size_kb:.1f} KB, {len(rows)} cells, server-only)")


if __name__ == "__main__":
    build()
