# Setup (5 min)
```bash
# in your fork, on branch submission/joao-miguel-meier
mkdir -p submissions && cp -r joao-miguel-meier submissions/   # this kit
cd submissions/joao-miguel-meier
python -m venv .venv && source .venv/bin/activate
pip install pandas numpy scipy statsmodels matplotlib seaborn pyarrow kaggle
kaggle datasets download -d omenkj/social-media-sponsorship-and-engagement-dataset -p data/raw --unzip
claude          # start Claude Code FROM THIS FOLDER so CLAUDE.md and .claude/ load
```
First prompt: "Start Phase 0: have the data-scientist run the data reality check."
Check the team loaded with `/agents`.
