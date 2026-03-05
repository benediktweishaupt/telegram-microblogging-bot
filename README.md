# Telegram Microblogging Bot

A private microblog powered by Telegram. Send photos, text, and locations via a Telegram bot — they appear on a static site built with Astro and hosted on GitHub Pages.

## Features

- **Photo posts** — single images or multi-image albums
- **Text posts** — displayed as styled cards with serif typography
- **Location** — attach via Telegram pin or Google Maps link, auto-geocoded
- **Hashtags** — `#tags` in captions are extracted and displayed
- **Backdating** — prefix with `@2026-03-01` or `@2026-03-01 14:30`
- **Private** — only whitelisted Telegram user IDs can post

## Architecture

```
Telegram Bot → Cloudflare Worker → GitHub API → GitHub Actions → GitHub Pages
```

The Cloudflare Worker receives webhooks from Telegram, downloads photos, and commits markdown + images to your GitHub repo via the Git Data API. GitHub Actions then builds the Astro site and deploys to GitHub Pages.

## Setup

### 1. Create your repo

Click **"Use this template"** on GitHub to create your own repo (public or private).

### 2. Create a Telegram bot

1. Open Telegram, find [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts
3. Save the **bot token**

### 3. Get your Telegram user ID

1. Find [@userinfobot](https://t.me/userinfobot) on Telegram
2. Send any message — it replies with your **Id**

### 4. Create a GitHub personal access token

1. Go to [Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Create a token with **Contents: Read and write** permission for your repo
3. Save the token

### 5. Set up Cloudflare

1. Create a free [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. Register a workers.dev subdomain
3. Create a [User API Token](https://dash.cloudflare.com/profile/api-tokens) with **Workers** permissions
4. Create a KV namespace:
   ```bash
   CLOUDFLARE_API_TOKEN=your-token npx wrangler kv namespace create MEDIA_GROUPS
   ```
5. Copy the namespace ID into `worker/wrangler.toml`

### 6. Configure

Update these files in your repo:

**`astro.config.mjs`** — uncomment and set:
```js
site: 'https://YOUR_USERNAME.github.io',
base: '/YOUR_REPO_NAME',
```

**`worker/wrangler.toml`** — set KV namespace ID and repo:
```toml
id = "your-kv-namespace-id"
GITHUB_REPO = "your-username/your-repo-name"
```

### 7. Deploy the worker

```bash
cd worker
CLOUDFLARE_API_TOKEN=your-token npx wrangler secret put TELEGRAM_BOT_TOKEN
CLOUDFLARE_API_TOKEN=your-token npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
CLOUDFLARE_API_TOKEN=your-token npx wrangler secret put GITHUB_TOKEN
CLOUDFLARE_API_TOKEN=your-token npx wrangler secret put BENE_TELEGRAM_ID
CLOUDFLARE_API_TOKEN=your-token npx wrangler secret put SANDRA_TELEGRAM_ID
CLOUDFLARE_API_TOKEN=your-token npx wrangler deploy
```

Generate a webhook secret (any random string) and note it for the next step.

### 8. Set the Telegram webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-worker.your-subdomain.workers.dev","secret_token":"your-webhook-secret"}'
```

### 9. Enable GitHub Pages

1. Go to your repo → Settings → Pages
2. Source: **GitHub Actions**

## Usage

| Action | Result |
|--------|--------|
| Send a photo | Creates a photo post |
| Send multiple photos at once | Creates a multi-image post |
| Send text | Creates a text-only post |
| Send location after a post | Attaches location to that post |
| Send location before a post | Stored, attached to next post |
| Send a Google Maps link | Extracts coordinates, attaches to post |
| `#beach #sunset` in caption | Extracted as tags |
| `@2026-03-01` at start of text | Backdates the post |
| `@2026-03-01 14:30` at start | Backdates with specific time |

## Stack

- [Astro 5](https://astro.build) — static site generator
- [Tailwind CSS 4](https://tailwindcss.com) — styling
- [Cloudflare Workers](https://workers.cloudflare.com) — webhook handler
- [Cloudflare KV](https://developers.cloudflare.com/kv/) — media group buffering
- [GitHub Pages](https://pages.github.com) — hosting
