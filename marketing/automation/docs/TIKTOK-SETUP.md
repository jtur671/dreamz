# TikTok Setup Guide

## What You Need
- A TikTok **Creator** or **Business** account
- A TikTok **Developer App** (requires approval for Content Posting API)
- Videos to upload (generated via Sora or other AI video tools)

## Important: TikTok's Content Posting API Requires Approval

Unlike the other platforms, TikTok's Content Posting API is **not instantly available**. You need to:
1. Register as a TikTok developer
2. Create an app
3. Apply for the **Content Posting API** scope
4. Wait for TikTok to review and approve your app

This can take **1-4 weeks**. Start this process early.

## Step 1: Create a TikTok Account

1. Download TikTok or go to https://www.tiktok.com/
2. Create an account (e.g., `@dreamzjournal`)
3. Switch to a **Business account**:
   - Profile → Settings → Account → Switch to Business Account
   - Select category: "App" or "Health & Wellness"
4. Fill out your bio: "Your dreams, divined. Mystical dream journal app. Link below."
5. Add your landing page URL to the bio link

## Step 2: Register as a TikTok Developer

1. Go to https://developers.tiktok.com/
2. Sign in with your TikTok account
3. Complete the developer registration form
4. Verify your email

## Step 3: Create a Developer App

1. In the TikTok Developer Portal, click **"Manage Apps"** → **"Create App"**
2. Fill in:
   - **App name:** Dreamz Marketing
   - **Description:** Automated video posting for Dreamz dream journal app
   - **App icon:** Upload your app icon
   - **Website URL:** https://jtur671.github.io/dreamz/
   - **Terms of Service URL:** https://jtur671.github.io/dreamz/privacy.html
   - **Privacy Policy URL:** https://jtur671.github.io/dreamz/privacy.html

## Step 4: Apply for Content Posting API

1. In your app's settings, go to **"Products"** or **"Scopes"**
2. Find **"Content Posting API"** (also called `video.publish` or `video.upload`)
3. Click "Apply"
4. Fill out the application:
   - Explain your use case: "Automated posting of dream interpretation videos for our dream journal app"
   - Describe what content you'll post
   - Confirm you'll follow TikTok's community guidelines
5. Submit and wait for approval

## Step 5: Get an Access Token

Once approved, use TikTok's OAuth2 flow:

1. **Authorization URL:**
   ```
   https://www.tiktok.com/v2/auth/authorize/?
     client_key=YOUR_CLIENT_KEY&
     scope=user.info.basic,video.publish&
     response_type=code&
     redirect_uri=YOUR_REDIRECT_URI
   ```

2. **Exchange code for token:**
   ```bash
   curl -X POST 'https://open.tiktokapis.com/v2/oauth/token/' \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d 'client_key=YOUR_CLIENT_KEY&client_secret=YOUR_CLIENT_SECRET&code=AUTH_CODE&grant_type=authorization_code&redirect_uri=YOUR_REDIRECT_URI'
   ```

3. The response includes:
   - `access_token` — use this in your `.env`
   - `refresh_token` — to refresh when the access token expires
   - `expires_in` — typically 86400 seconds (24 hours)

**Token refresh:** TikTok access tokens expire in 24 hours. You'll need to implement a refresh flow for continuous automation:
```bash
curl -X POST 'https://open.tiktokapis.com/v2/oauth/token/' \
  -d 'client_key=YOUR_CLIENT_KEY&client_secret=YOUR_CLIENT_SECRET&grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN'
```

## Step 6: Add to .env

```
TIKTOK_ACCESS_TOKEN=act.your_access_token_here
```

## Video Content

The automation pipeline handles uploading videos — but you need to **create the videos first**. Options:

### AI Video Generation
- **Sora (OpenAI):** Best quality, mystical aesthetic possible. Access at https://sora.com/
- **Runway Gen-3:** Good for short atmospheric clips
- **Pika:** Quick, stylized video generation

### Video Specs for TikTok
- **Format:** MP4
- **Resolution:** 1080x1920 (9:16 vertical)
- **Duration:** 15-60 seconds (sweet spot: 20-30s)
- **Max file size:** 287.6 MB (4GB for longer videos)
- **Audio:** Include trending sounds or voiceover

### Video Ideas
1. Screen recording of app with mystical voiceover
2. AI-generated dream scenes with text overlays
3. "Dream meaning" reveals (static image → interpretation text)
4. POV-style: "You wake up after dreaming about [symbol]..."

### Workflow
1. Generate video with Sora/Runway
2. Save to `marketing/automation/content/videos/`
3. The content generator creates captions + hashtags
4. The TikTok poster uploads the video with caption

## Rate Limits

- Content Posting API: Details vary by app tier
- Recommended: **1-2 videos per day** max
- TikTok's algorithm favors consistent daily posting over bulk uploads

## Troubleshooting

| Error | Fix |
|-------|-----|
| "App not approved" | Content Posting API requires review — check app status in developer portal |
| "access_token expired" | Token only lasts 24h — refresh using refresh_token |
| "scope not authorized" | Your app wasn't approved for `video.publish` — reapply |
| Upload fails with large file | Keep videos under 50MB for reliable uploads |
| Video not appearing | TikTok may review content before publishing — wait 5-10 min |
| "spam_risk_too_many_posts" | Posting too frequently — reduce to 1/day |

## Alternative: Manual Upload via TikTok App

If the Content Posting API approval takes too long, you can still:
1. Generate video content + captions with the automation pipeline
2. Manually upload via the TikTok app or TikTok Studio (desktop)
3. Copy-paste the generated caption from `queue.json`

This is the fallback while waiting for API approval.
