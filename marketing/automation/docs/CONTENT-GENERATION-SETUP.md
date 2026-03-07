# Content Generation Setup Guide

## What You Need
- An **Anthropic API key** (for Claude — generates post copy)
- An **OpenAI API key** (for DALL-E 3 — generates pin images)

## Step 1: Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign in or create an account
3. Go to **API Keys** → **Create Key**
4. Name it: "Dreamz Marketing"
5. Copy the key (starts with `sk-ant-`)

**Pricing:** Claude Sonnet 4.6 costs ~$3 per 1M input tokens, ~$15 per 1M output tokens. A batch of 4 posts (one per platform) costs roughly $0.01-0.02.

## Step 2: OpenAI API Key

1. Go to https://platform.openai.com/
2. Sign in or create an account
3. Go to **API Keys** → **Create new secret key**
4. Name it: "Dreamz Marketing"
5. Copy the key (starts with `sk-`)

**Pricing:** DALL-E 3 at 1024x1792 (portrait) costs $0.080 per image. One pin image per batch = ~$0.08 per batch.

## Step 3: Add to .env

```
ANTHROPIC_API_KEY=sk-ant-your_key_here
OPENAI_API_KEY=sk-your_key_here
```

## How Content Generation Works

### `npm run generate` (or `npx tsx src/generator/content.ts [count]`)

1. Picks a random dream symbol from a pool of 40 (falling, flying, teeth, water, snakes, etc.)
2. Calls Claude API with the Dreamz brand voice to generate 4 posts:
   - **Pinterest:** SEO title + description + image generation prompt
   - **Reddit:** Educational post with title, body, target subreddit
   - **Facebook:** Engaging post with question + landing page link
   - **TikTok:** Video caption with hashtags
3. Calls DALL-E 3 to generate a pin image (dark mystical aesthetic, 1024x1792)
4. Enqueues all 4 posts to `content/queue.json` with staggered scheduling (6-hour intervals)

### `npx tsx src/generator/images.ts [symbol]`

Generates a single pin image for a dream symbol:
```bash
npx tsx src/generator/images.ts "water"
npx tsx src/generator/images.ts "teeth falling out"
npx tsx src/generator/images.ts "flying"
```

Images save to `content/images/` as PNG files.

## Cost Estimate

| Action | Cost |
|--------|------|
| 1 content batch (4 posts) | ~$0.02 (Claude) |
| 1 pin image | ~$0.08 (DALL-E 3) |
| 1 full batch + image | ~$0.10 |
| Daily batch (1/day for 30 days) | ~$3.00/month |
| 3 batches/week for a month | ~$1.20/month |

## Content Queue

Generated content goes into `content/queue.json`. Each item:

```json
{
  "id": "uuid",
  "platform": "pinterest",
  "status": "pending",
  "content": {
    "title": "What Does Dreaming About Water Mean?",
    "text": "Water in dreams often reflects your emotional state...",
    "imagePath": "content/images/pin-water-1709740800000.png",
    "link": "https://apps.apple.com/app/id6760150023",
    "hashtags": ["#dreammeaning", "#dreamjournal"]
  },
  "scheduledFor": "2026-03-07T12:00:00.000Z",
  "retries": 0
}
```

Items post when `scheduledFor` time passes and the scheduler runs.

## Customizing Content

### Change the dream symbol pool
Edit `src/generator/content.ts` — the `DREAM_SYMBOLS` array near the top.

### Change the brand voice
Edit the `SYSTEM_PROMPT` in `src/generator/content.ts`. Currently encodes the Dreamz mystical voice.

### Change image style
Edit `generatePinImage()` in `src/generator/images.ts` — the DALL-E prompt template.

### Change scheduling interval
Edit `content.ts` — the stagger interval is currently 6 hours between posts.
