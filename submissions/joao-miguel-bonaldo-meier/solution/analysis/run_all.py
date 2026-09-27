"""
Regenerates all solution/outputs artifacts. Run from repo root:
    python3 submissions/joao-miguel-bonaldo-meier/solution/analysis/run_all.py
(path resolution below is CWD-independent, so this also works if invoked
from any other directory, e.g. `cd` into this analysis/ folder and running
`python3 run_all.py`.)
"""
import os
import runpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

SCRIPTS = [
    "01_profile.py",
    "02_segmented_analysis.py",
    # 02_segmented_analysis.py regenerates findings.json in its raw (pre-review) form:
    # signal_verdict="LIKELY-SYNTHETIC", "Kaggle" wording, and some jargon in claim
    # text. The leader rejected that framing at GATE 1 (see process-log/DECISIONS.md,
    # 2026-09-26 correction) and head-of-marketing round 2 approved a plain-language,
    # "WEAK-SIGNAL" version instead. 03_audit_rebuild.py is written to run against
    # that approved wording -- if 02 is ever edited to bake in the approved language
    # directly, this comment (and the two-step run order) can be removed.
    "03_audit_rebuild.py",
    # 04_brief_benchmark_test.py directly tests the literal example used in the
    # challenge brief (30-60s Tech videos, 10K-50K-follower creators, shares vs.
    # platform average) and appends the honest result as new findings (does not
    # touch or renumber F01-F20).
    "04_brief_benchmark_test.py",
]


def main():
    for script in SCRIPTS:
        script_path = os.path.join(SCRIPT_DIR, script)
        print(f"\n=== Running {script} ===")
        runpy.run_path(script_path, run_name="__main__")


if __name__ == "__main__":
    main()
