# Dreamz Marketing Automation

Automated content generation and posting to Pinterest, Reddit, Facebook, and TikTok for the Dreamz dream journal app.

## Quick Start

```bash
cd marketing/automation
cp .env.example .env       # fill in your credentials (see setup guides below)
npm install
npm run generate           # generate a batch of posts + images
npm run post               # post everything due right now
```

## Commands

| Command | What it does |
|---------|-------------|
| `npm run generate` | Claude generates posts for all 4 platforms + DALL-E creates pin images |
| `npm run post` | Post all due queue items immediately (platforms run in parallel) |
| `npm run start` | Start cron scheduler — checks queue every 5 min, posts due items |
| `npm run dev` | Start scheduler in watch mode (auto-restarts on code changes) |

### Standalone scripts

```bash
npx tsx src/generator/content.ts 3       # generate 3 batches
npx tsx src/generator/images.ts "water"  # generate a pin image for water dreams
```

## Setup Guides

Each platform requires its own credentials. You can start with just one and add more over time — platforms without credentials auto-disable.

| Guide | What you'll set up | Time | Cost |
|-------|--------------------|------|------|
| [Content Generation](docs/CONTENT-GENERATION-SETUP.md) | Anthropic + OpenAI API keys | 5 min | ~$3/mo |
| [Pinterest](docs/PINTEREST-SETUP.md) | Business account + developer app | 15 min | Free |
| [Reddit](docs/REDDIT-SETUP.md) | Script app + karma building | 15 min + 1-2 weeks karma | Free |
| [Facebook](docs/FACEBOOK-SETUP.md) | Page + developer app + page token | 20 min | Free |
| [TikTok](docs/TIKTOK-SETUP.md) | Developer app + API approval | 20 min + 1-4 weeks approval | Free |

**Start with:** Content Generation + Pinterest (fastest to get running).

## Architecture

```
src/
├── index.ts              ← Cron scheduler (checks every 5 min)
├── post-now.ts           ← Manual trigger
├── config.ts             ← Environment variables
├── types.ts              ← Shared TypeScript types
├── generator/
│   ├── content.ts        ← Claude API → generates posts for all platforms
│   └── images.ts         ← DALL-E 3 → generates pin images
├── platforms/
│   ├── pinterest.ts      ← Pinterest API v5
│   ├── reddit.ts         ← snoowrap (Reddit API)
│   ├── facebook.ts       ← Facebook Graph API v21
│   └── tiktok.ts         ← TikTok Content Posting API v2
├── queue/
│   └── store.ts          ← JSON content queue with retry logic
└── utils/
    └── logger.ts

content/
├── queue.json            ← Pending/posted/failed items
└── images/               ← Generated pin images
```

## How It Works

1. **Generate:** `npm run generate` calls Claude to create platform-specific content (captions, titles, descriptions) and DALL-E to create pin images. Each item is added to `content/queue.json` with a scheduled time (staggered 6 hours apart).

2. **Post:** The scheduler (or `npm run post`) checks the queue for items past their scheduled time. Due items are posted to their respective platforms in parallel. Each platform handles its own API calls sequentially (for rate limits).

3. **Retry:** Failed posts retry up to 3 times before being marked as `failed`. Check `queue.json` for error details.

## Cost Summary

| Item | Cost |
|------|------|
| Content generation (Claude API) | ~$0.02 per batch |
| Image generation (DALL-E 3) | ~$0.08 per image |
| All platform APIs | Free |
| **Monthly estimate (1 batch/day)** | **~$3/month** |
