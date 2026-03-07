# Pinterest Setup Guide

## What You Need
- A Pinterest **Business account** (free)
- A Pinterest **Developer App**
- A **Board** to pin to

## Step 1: Convert to Business Account

1. Go to https://www.pinterest.com/business/create/
2. Either convert your existing personal account or create a new business account
3. Fill in business name: "Dreamz" or "Dreamz Journal"
4. Select category: "Apps" or "Health & Wellness"

## Step 2: Create a Developer App

1. Go to https://developers.pinterest.com/apps/
2. Sign in with your Pinterest business account
3. Click "Create app"
4. Fill in:
   - **App name:** Dreamz Marketing
   - **Description:** Automated pin creation for Dreamz dream journal app
   - **Website URL:** https://jtur671.github.io/dreamz/
5. Accept the terms and create the app

## Step 3: Get Your Access Token

1. In your app dashboard, go to the **"Generate token"** section
2. Select these scopes:
   - `boards:read` — to list your boards
   - `pins:read` — to verify pins
   - `pins:write` — to create pins
3. Click "Generate token"
4. Copy the token immediately (it's only shown once)

**Token expiration:** Pinterest access tokens expire after 30 days. You'll need to refresh or regenerate periodically. For long-term automation, implement the OAuth refresh flow (the token response includes a `refresh_token`).

## Step 4: Create a Board

1. Go to your Pinterest profile
2. Click "+" → "Create board"
3. Name it something like: **"Dream Meanings & Symbolism"**
4. Set visibility to **Public**
5. Get the board ID:
   - Open the board
   - The URL will be like `pinterest.com/yourname/dream-meanings/`
   - To get the numeric ID, use the API: `GET https://api.pinterest.com/v5/boards` with your token
   - Or run: `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.pinterest.com/v5/boards`
   - The response will include `"id": "123456789"` — that's your board ID

## Step 5: Add to .env

```
PINTEREST_ACCESS_TOKEN=pina_your_token_here
PINTEREST_BOARD_ID=123456789
```

## What Gets Posted

Each Pinterest post creates a pin with:
- **Image:** AI-generated dream symbol art (dark mystical aesthetic, 1024x1792)
- **Title:** SEO-optimized dream meaning title (e.g., "What Does Dreaming About Water Mean?")
- **Description:** Dream interpretation with keywords + app mention
- **Link:** Points to your App Store listing or landing page

## Rate Limits

- Pinterest API allows **100 requests per minute** per user token
- Pin creation: no explicit daily limit, but Pinterest may flag accounts that create too many pins too fast
- Recommended: **3-5 pins per day** max for organic growth

## Troubleshooting

| Error | Fix |
|-------|-----|
| 401 Unauthorized | Token expired — regenerate at developers.pinterest.com |
| 403 Forbidden | Missing scopes — regenerate token with `pins:write` scope |
| 429 Too Many Requests | Hit rate limit — slow down posting frequency |
| "Board not found" | Check `PINTEREST_BOARD_ID` is the numeric ID, not the URL slug |
