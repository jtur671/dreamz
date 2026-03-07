# Reddit Setup Guide

## What You Need
- A Reddit account (ideally not brand new — aged accounts get less spam-filtered)
- A Reddit **Script App** (for API access)
- Karma in your target subreddits (build this before automating)

## Step 1: Create or Prepare a Reddit Account

**Option A (recommended):** Use an existing personal account that has some karma and history. Reddit's spam filters are harsh on new accounts.

**Option B:** Create a new account like `u/DreamzJournal`. But be aware:
- New accounts can't post in many subreddits
- Posts from new accounts often get auto-removed
- Build up karma first by commenting genuinely for 1-2 weeks

## Step 2: Create a Reddit App

1. Go to https://www.reddit.com/prefs/apps
2. Scroll to the bottom and click **"create another app..."**
3. Fill in:
   - **Name:** Dreamz Marketing Bot
   - **Type:** Select **"script"** (for personal use bots)
   - **Description:** Posts dream interpretation content
   - **About URL:** https://jtur671.github.io/dreamz/
   - **Redirect URI:** http://localhost:8080 (required but unused for script apps)
4. Click "create app"
5. Note two values:
   - **Client ID:** The string under "personal use script" (looks like `aB1cD2eF3gH4iJ`)
   - **Client Secret:** The "secret" field

## Step 3: Add to .env

```
REDDIT_CLIENT_ID=aB1cD2eF3gH4iJ
REDDIT_CLIENT_SECRET=your_secret_here
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
REDDIT_USER_AGENT=dreamz-bot/1.0 by u/your_reddit_username
```

**Important:** The `REDDIT_USER_AGENT` should include your Reddit username. Reddit blocks generic user agents.

## Target Subreddits

| Subreddit | Subscribers | Content Type | Rules to Know |
|-----------|-------------|-------------|---------------|
| r/Dreams | ~500K | Dream interpretation, discussion | No self-promotion in posts |
| r/LucidDreaming | ~500K | Lucid dreaming techniques | Educational focus |
| r/DreamInterpretation | ~100K | Dream meaning requests | Answering others' dreams is welcome |
| r/witchcraft | ~300K | Witchy/spiritual content | No advertising |
| r/astrology | ~200K | Astrology discussion | Related to moon/sleep cycles |

## Content Strategy (Critical)

Reddit **hates** self-promotion. Follow the **90/10 rule:**
- 90% of your activity should be genuine comments and helpful posts
- 10% can mention your app (and even then, subtly)

**What works:**
- Educational posts: "What your falling dream might mean" with genuine dream analysis
- Answering other people's dream interpretation requests
- Linking to your app in your profile bio, not in every post
- Building a reputation as a dream interpretation resource

**What gets you banned:**
- Posting links to your app in every post
- Copy-paste content across multiple subreddits
- Posting and never engaging with comments
- New account + immediate promotion

## Rate Limits

- Reddit API: **60 requests per minute** (with OAuth)
- **1 post per 10 minutes** per subreddit (Reddit enforces this)
- The automation pipeline has a built-in 2-second delay between API calls
- Recommended: **1-2 posts per day** across all subreddits

## Step 4: Build Karma First

Before running the automation, manually:
1. Subscribe to target subreddits
2. Comment on 5-10 posts per day for 1-2 weeks
3. Answer dream interpretation questions with genuine insight
4. Get your account to ~100+ karma

This prevents your automated posts from being spam-filtered.

## Troubleshooting

| Error | Fix |
|-------|-----|
| 401 Unauthorized | Check client ID, secret, username, password |
| 403 Forbidden | Account may be shadowbanned or too new |
| "RATELIMIT" | Posting too fast — increase delay between posts |
| Posts not appearing | Check the subreddit's spam filter (mods may need to approve) |
| "USER_REQUIRED" | Username/password wrong, or 2FA enabled (disable 2FA or use app password) |

## 2FA Note

If your Reddit account has 2FA enabled, the script app flow won't work with username/password. Either:
1. Disable 2FA on the bot account
2. Or implement the full OAuth2 web flow (more complex)
