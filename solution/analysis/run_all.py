"""
Regenerates all solution/outputs artifacts. Run from repo root:
    python solution/analysis/run_all.py
"""
import runpy

SCRIPTS = [
    "solution/analysis/01_profile.py",
    "solution/analysis/02_segmented_analysis.py",
    # 02_segmented_analysis.py regenerates findings.json in its raw (pre-review) form:
    # signal_verdict="LIKELY-SYNTHETIC", "Kaggle" wording, and some jargon in claim
    # text. The leader rejected that framing at GATE 1 (see process-log/DECISIONS.md,
    # 2026-09-26 correction) and head-of-marketing round 2 approved a plain-language,
    # "WEAK-SIGNAL" version instead. 03_audit_rebuild.py is written to run against
    # that approved wording -- if 02 is ever edited to bake in the approved language
    # directly, this comment (and the two-step run order) can be removed.
    "solution/analysis/03_audit_rebuild.py",
]


def main():
    for script in SCRIPTS:
        print(f"\n=== Running {script} ===")
        runpy.run_path(script, run_name="__main__")


if __name__ == "__main__":
    main()
