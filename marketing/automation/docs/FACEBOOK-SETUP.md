# Facebook Page Setup Guide

## What You Need
- A Facebook **Page** for Dreamz (not a personal profile)
- A Facebook **Developer App**
- A **Page Access Token** with posting permissions

## Step 1: Create a Facebook Page

1. Go to https://www.facebook.com/pages/create
2. Select **"Business or Brand"**
3. Fill in:
   - **Page name:** Dreamz — Dream Journal
   - **Category:** App, Health & Wellness, or Spiritual
   - **Description:** "Your dreams, divined. A mystical dream journal that transforms your dreams into AI-powered readings."
4. Add profile picture (app icon) and cover photo (use the dark mystical aesthetic)
5. Fill out the About section with the landing page URL

## Step 2: Create a Facebook Developer App

1. Go to https://developers.facebook.com/
2. Click **"My Apps"** → **"Create App"**
3. Select **"Business"** as the app type
4. Fill in:
   - **App name:** Dreamz Marketing
   - **Contact email:** your email
5. Once created, go to **App Dashboard**

## Step 3: Add Facebook Login Product

1. In your app dashboard, click **"Add Product"**
2. Add **"Facebook Login"**
3. This enables the permissions flow needed for Page tokens

## Step 4: Get a Page Access Token

### Quick method (short-lived, good for testing):

1. Go to https://developers.facebook.com/tools/explorer/
2. Select your app from the dropdown
3. Click **"Get User Access Token"**
4. Check these permissions:
   - `pages_manage_posts` — to create posts
   - `pages_read_engagement` — to read post metrics
   - `pages_show_list` — to list your pages
5. Click "Generate Access Token" and authorize
6. Now switch to a Page token:
   - In the Graph API Explorer, change the token dropdown to your Page name
   - Copy the Page Access Token

### Long-lived token (lasts 60 days):

Short-lived tokens expire in ~1 hour. To extend:

```bash
curl "https://graph.facebook.com/v21.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=YOUR_APP_ID&\
client_secret=YOUR_APP_SECRET&\
fb_exchange_token=YOUR_SHORT_LIVED_TOKEN"
```

This returns a long-lived user token (60 days). Then get the Page token:

```bash
curl "https://graph.facebook.com/v21.0/me/accounts?\
access_token=YOUR_LONG_LIVED_USER_TOKEN"
```

The Page token derived from a long-lived user token **never expires**.

## Step 5: Get Your Page ID

From the response above, or:
1. Go to your Facebook Page
2. Click **About** → scroll to **Page ID** (at the bottom)
3. Or use the API: `GET /me/accounts` returns both `id` and `access_token` for each page

## Step 6: Add to .env

```
FACEBOOK_PAGE_ACCESS_TOKEN=EAAxxxxxxx_your_page_token
FACEBOOK_PAGE_ID=123456789
```

## What Gets Posted

Two types of posts:

**With image** (when a DALL-E image is generated):
- Posts as a photo with caption
- Caption includes dream interpretation + app link + hashtags

**Without image:**
- Posts as a link share
- Facebook auto-generates a link preview from your landing page
- Caption includes engaging dream content + hashtags

## Content Strategy

Facebook organic reach is low (~2-5% of followers), but the Page serves as:
- A credibility signal (people check if you have a Facebook Page)
- A place for longer-form dream content
- A target for future paid ads (you need a Page to run Facebook/Instagram ads)

**What works:**
- Engaging questions: "What's the weirdest dream you've ever had?"
- Dream meaning carousels (image posts get higher reach)
- Sharing dream facts and statistics
- Responding to every comment

## Rate Limits

- Graph API: **200 calls per hour** per user
- No explicit daily post limit, but Facebook may reduce reach if you post too often
- Recommended: **1-2 posts per day**

## Troubleshooting

| Error | Fix |
|-------|-----|
| "OAuthException" / 190 | Token expired — regenerate following Step 4 |
| "Permissions error" / 200 | Missing `pages_manage_posts` permission — re-authorize |
| "(#100) No matching user found" | Using a User token instead of Page token |
| Posts not getting reach | Normal for new Pages — build followers first, then consider paid boost |
| "Application does not have permission" | App may need App Review for public use (not needed for your own Page) |

## Important: App Review

For posting to **your own Page**, you do NOT need Facebook App Review. The permissions work in "Development Mode" for admins/developers of the app.

You only need App Review if you want to post to other people's Pages.
