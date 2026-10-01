# Iambic

A small, mobile-first prosody/scansion tool for poetry.

Annotate syllable stress, inspect counts and meter, and switch between traditional marks and typographic emphasis. Runs as a static site.

## Add a poem

Poems live in [`poems.json`](./poems.json). Pull requests adding poetry are encouraged.

```json
{
  "title": "Autumn Referendum",
  "author": "Dev",
  "text": "Each leaf casts its vote.\nThe Autumn Referendum\nThe republic stands.",
  "license": "CC0-1.0",
  "tags": ["haiku"]
}
```

Required: `title`, `author`, `text`, `license`. Optional: `tags`, `source`, `excerpt`.

Only submit work you wrote or have permission to redistribute, or public-domain work with a source.

## Run locally

Serve the directory with any static server, e.g.:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`.

Live site: **https://iambic.cc**
