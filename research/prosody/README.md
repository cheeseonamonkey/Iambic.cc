# Cross-platform prosody research (CPU only)

[Open the CPU notebook](./Prosody_CPU_Study.ipynb). It runs in Colab, Kaggle, or Jupyter.
The notebook downloads a **pinned copy of pipeline.py** from this repository.

## Scope and outcomes

- **Reddit:** 3,000,000 comments, 500,000 from each of six subreddit slices of HuggingFaceGECLM/REDDIT_comments. Outcome: net score (not votes/impressions).
- **X:** 3,000,000 posts from blockmesh/tweets. Outcome: captured likes (not CTR); retweet and reply counts are available in the source schema but not yet outcomes of this pilot.
- **Bluesky:** 1,500,000 each from Roronotalt/bluesky-five-million and alpindale/two-million-bluesky-posts. **No comparable engagement metric in these source schemas.** These are included for phonetic distribution and overlap/network follow-ups. An engagement regression is intentionally skipped.
- **Stanford SHP-2:** up to 12,000 labeled response comparisons per sampled Reddit domain × eight domains, plus a 20% post-grouped independent replication split. This is *not* the complete 4.8M corpus.
- **EPITOME:** all available Reddit examples annotated for emotional reactions, interpretations, and explorations; models are run separately from likes and scores.
- **Cornell Winning Arguments:** all available annotated CMV replies, labeled for persuasion success (not causal intervention).

**Run order:** install dependencies → confirm rights flags → pilot stream → labeled subsets → fit models → export reports. Change MODE to "full", rerun the streaming and analysis cells. Pilot progress resumes into the same output directory. Data streams in 5,000-row checkpoints with thread-limited ingestion.

### Current access restrictions

Datasets are not automatically downloaded merely because they are publicly hosted. Explicit APPROVED flags are **False by default**; check source licenses, terms for underlying content, and intended use independently before setting them. Reddit's researcher program was updated 2026-10-05 with university affiliation and ethics review eligibility requirements. Some archives may have independent permitted uses. This is not legal advice.

### Artifacts

Reports: reports/engagement_reddit.csv, engagement_x.csv (if populated), preference_train.csv, preference_holdout.csv, empathy.csv, persuasion.csv, summary.json and report.md. Reports omit all raw post text. Features are numeric plus hashed ID, author, parent, source, and month.

### Methods

Deterministic bounded-buffer shuffle and streaming filtering; CMUdict phonemes and lexical-stress approximation; content-word initial phoneme repetition, assonance, consonance, rhyme, vowel-stress alternation and rough sentiment controls. Scores are estimated per corpus. Statistically associated features are *not* demonstrated causes of engagement.

- Reddit and X models: asinh(engagement), group-mean centering by source and month, clustered standard errors by hashed author.
- SHP-2: matched reply differences within a common Reddit parent; cluster standard errors by parent; group-partitioned holdout and independent coefficient replication.
- EPITOME: labeled empathy scale (exploratory continuous approximation), clustering by seeker post.
- CMV: binary argument success, clustering by parent.
- False discovery correction: Benjamini-Hochberg within each model.

**Known limitations:** No views/impressions, so no CTR; engagement exposure/ranking confounding; no full semantic-equivalence control; insufficient phonemic modeling of accent, emphatic stress, or punctuation; nonuniform corpus selection; overlapping Bluesky archives; some source shards may be unavailable or vary over time. A planned second study should perform blinded meaning-matched randomized paraphrasing to establish causality. Do not claim 30–50% conversion uplift from this pipeline.

### Reproducibility

Fixed SEED=1729, logged Hugging Face dataset SHA per source in each source's checkpoint.json, versioned pipeline, per-source resume state, and CSV model output. If an upstream revision changes, resume fails closed. The labeled datasets are versioned by their providers but not yet SHA-pinned in the pilot.

To run fast local smoke tests:

    pip install -r research/prosody/requirements.txt
    pytest -q research/prosody/tests

The CI workflow runs only synthetic smoke tests and never downloads social-media corpora.
