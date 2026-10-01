# Iambic

A small, mobile-first prosody/scansion tool for poetry.

Iambic keeps the main UI deliberately sparse. Known English words are analyzed from a bundled compact pronunciation lexicon; only true out-of-vocabulary words use the lightweight local fallback. Manual notation is source-based: `[strong]` and `<weak>` force stress and adjacent annotations force syllable boundaries without rewriting the user's capitalization.

## Demo library

`poems.json` intentionally has exactly four fields per entry:

```json
{
  "content": "Each leaf casts its vote\nThe Autumn Referendum\nThe republic stands.",
  "title": "Autumn Referendum",
  "author": "cheeseonamonkey",
  "url": ""
}
```

The schema rejects additional fields.

## Pronunciation lexicon

The deployed site includes `assets/pronunciations.bin`, a compact indexed transformation of a pinned CMUdict snapshot with ARPAbet stress digits. It is eagerly loaded and queried before the OOV fallback. The original source spelling/capitalization is retained for rendering.

The binary is generated deterministically by `scripts/build-lexicon.mjs` during CI/Pages deployment and is deliberately not committed. To build it locally:

```sh
curl -fsSL https://raw.githubusercontent.com/cmusphinx/cmudict/74790861f652b15e4ac49015a90074ad62a27690/cmudict.dict -o /tmp/cmudict.dict
node scripts/build-lexicon.mjs /tmp/cmudict.dict assets/pronunciations.bin
```

See `THIRD_PARTY_NOTICES.md` for CMUdict attribution.

## Run locally

Serve the directory over HTTP, for example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`.

Run the test suite with:

```sh
node --test tests/*.test.mjs
```

Live site: **https://iambic.cc**
