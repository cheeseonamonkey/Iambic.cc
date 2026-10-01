# Iambic

A small, mobile-first syllable and lexical-stress tool for poetry.

Iambic keeps the main UI deliberately sparse. Manual notation is source-based: `[strong]` and `<weak>` force stress and adjacent annotations force syllable boundaries without rewriting the user's capitalization.

## Analysis

The product-level analysis is intentionally narrow:

1. syllable boundaries
2. lexical stress for each syllable

The browser uses `js/analysis/` for that work:

- `lexicon.js` reads the compact bundled lexical resource.
- `stress.js` extracts lexical stress from dictionary entries.
- `syllables.js` aligns the dictionary syllable count back onto the user's original spelling.
- words missing from the lexicon continue through the lightweight local syllable fallback.
- explicit source notation always overrides automatic analysis.

The lexical resource happens to be derived from CMUdict pronunciation data, but pronunciation is only an internal implementation detail; Iambic does not expose IPA, phonemes, or pronunciation controls.

Pages generates `assets/pronunciations.bin` deterministically from a pinned CMUdict snapshot with `scripts/build-lexicon.mjs`. The generated binary is deliberately not committed.

## Layout

```text
index.html
css/app.css
js/
  analysis/
    lexicon.js
    stress.js
    syllables.js
  notation.js
  prosody.js
  render.js
  ui.js
data/
  poems.json
  poems.schema.json
scripts/
tests/
```

`data/poems.json` intentionally has exactly four fields per entry: `content`, `title`, `author`, and `url`. The schema rejects additional fields.

## UI

The top bar keeps only the common actions visible: Demo, theme, Share, and the `…` view/formatting menu. Secondary view controls, source editing, stats, notation help, font family, and font size live under `…`.

PNG and PDF exports use the active theme, poem font, and poem size. The font menu is intentionally limited to eight choices and includes Rubik.

See `THIRD_PARTY_NOTICES.md` for CMUdict attribution.

## Run locally

Serve the directory over HTTP, for example:

```sh
python -m http.server 8000
```

The deployed Pages build contains the generated lexical asset. A plain local checkout without that asset still runs using the OOV/local fallback.

Run the test suite with:

```sh
node --test tests/*.test.mjs
```

Live site: **https://iambic.cc**
