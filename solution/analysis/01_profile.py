"""
Phase 0 - Data reality check.
Reads data/raw/social_media_dataset.csv, computes profiling stats used in
solution/outputs/data_profile.md. Prints aggregates only (no raw rows beyond
the 5-row head used for column sanity-check).
"""
import numpy as np
import pandas as pd

np.random.seed(42)

RAW_PATH = "data/raw/social_media_dataset.csv"


def main():
    df = pd.read_csv(RAW_PATH)
    df["post_date"] = pd.to_datetime(df["post_date"], errors="coerce")

    print("Shape:", df.shape)
    print("\nHead (sanity check only, 5 rows max):")
    print(df.head(5))

    print("\nNulls per column:\n", df.isnull().sum())
    print("\nDate range:", df["post_date"].min(), "-", df["post_date"].max())
    print("\nRows per platform:\n", df["platform"].value_counts())

    print("\nDuplicate content_id:", df["content_id"].duplicated().sum())
    print("Full-row duplicates:", df.duplicated().sum())

    print("\nis_sponsored distribution:\n", df["is_sponsored"].value_counts())
    print("\ndisclosure_type distribution:\n", df["disclosure_type"].value_counts())
    print("\nsponsor_category distribution:\n", df["sponsor_category"].value_counts())

    # Recompute engagement rate under the two common formulas and compare
    total_eng = df["likes"] + df["shares"] + df["comments_count"]
    er_views = total_eng / df["views"].replace(0, np.nan)
    er_followers = total_eng / df["follower_count"].replace(0, np.nan)

    print("\nRecomputed ER = (likes+shares+comments)/views, describe:\n", er_views.describe())
    print("\nRecomputed ER = (likes+shares+comments)/followers, describe:\n", er_followers.describe())

    zero_eng_share = (total_eng == 0).mean()
    near_zero_share = (er_views < 0.001).mean()
    print("\nShare of posts with zero total engagement:", zero_eng_share)
    print("Share of posts with ER(views) < 0.1%:", near_zero_share)

    print("\nDistribution shape (min/p1/p50/p99/max/mean/std/skew):")
    for col in ["views", "likes", "shares", "comments_count", "follower_count"]:
        s = df[col]
        print(
            f"{col}: min={s.min()}, p1={s.quantile(.01):.0f}, p50={s.quantile(.5):.0f}, "
            f"p99={s.quantile(.99):.0f}, max={s.max()}, mean={s.mean():.0f}, "
            f"std={s.std():.0f}, skew={s.skew():.3f}"
        )

    df["er"] = er_views
    for group_col in ["platform", "content_type", "content_category", "is_sponsored"]:
        med = df.groupby(group_col)["er"].median().sort_values(ascending=False)
        print(f"\nMedian ER by {group_col}:\n{med}")
        print("Relative spread max/min:", med.max() / med.min())

    df["creator_tier_q"] = pd.qcut(df["follower_count"], 4, labels=["Q1", "Q2", "Q3", "Q4"])
    print("\nMedian ER by follower quartile:\n", df.groupby("creator_tier_q")["er"].median())


if __name__ == "__main__":
    main()
