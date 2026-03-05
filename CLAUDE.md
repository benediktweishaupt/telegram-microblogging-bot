# Telegram Microblogging Bot

## Architecture

- **Astro site** (`src/`): Static site with content collections. Posts are markdown in `src/content/posts/`, images in `src/assets/posts/`.
- **Cloudflare Worker** (`worker/`): Receives Telegram webhooks, downloads photos, commits to GitHub via Git Data API.
- **GitHub Actions** (`.github/workflows/deploy.yml`): Builds Astro on push to main, deploys to GitHub Pages.

## Key files

- `worker/src/index.ts` — webhook entry point, message routing by type
- `worker/src/post.ts` — markdown generation, `extractHashtags()`, `extractDate()`
- `worker/src/media-group.ts` — multi-photo buffering via KV (3s delay)
- `worker/src/location.ts` — location KV helpers, GitHub post update
- `worker/src/github.ts` — atomic Git commits via GitHub Git Data API
- `worker/src/telegram.ts` — Telegram API helpers (download, send)
- `worker/src/geocoding.ts` — Nominatim reverse geocode, Google Maps URL parsing
- `worker/src/types.ts` — shared TypeScript types
- `src/components/Post.astro` — post rendering (photo posts, text-only cards)
- `src/content.config.ts` — content collection schema (date, author, location, tags, images)
- `src/pages/index.astro` — feed page
- `src/layouts/BaseLayout.astro` — HTML shell

## Conventions

- Posts use UTC timestamps for slugs: `YYYY-MM-DD-HHmmss`
- Images named: `YYYY-MM-DD-HHmmss-NN.jpg` (NN = zero-indexed)
- Frontmatter fields: `date`, `author`, `location?`, `tags[]`, `images[]`
- Only allowed authors are mapped by Telegram user ID in worker secrets
- All other Telegram users are silently ignored (200 OK, no action)
- Worker deploys: `cd worker && CLOUDFLARE_API_TOKEN=... npx wrangler deploy`

## Features

- `#hashtags` in text/caption → extracted, stored in frontmatter `tags[]`
- `@YYYY-MM-DD [HH:MM]` at start of text → backdating (defaults to 12:00 UTC if no time)
- Location: sent after a post → attaches to it; sent before → stored in KV (5min TTL) for next post
- Media groups: buffered in KV, processed when message count stabilizes after 3s
- Text-only posts render as serif cards on gray background
- Photo posts always display at 4:5 aspect ratio with object-fit cover
