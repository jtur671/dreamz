# Google Play Store Setup Guide

This doc covers everything needed to publish Dreamz on the Google Play Store. The app code is already configured for Android (`app.json` has `android.package: com.dreamzjournal.app`).

---

## Prerequisites

- [Google Play Developer account](https://play.google.com/console/signup) ($25 one-time fee)
- EAS CLI installed (`npm install -g eas-cli`)
- Logged into EAS (`eas login`)

---

## Step 1: Build the Android Production APK/AAB

EAS Build handles signing automatically. On first Android build, EAS will generate a keystore and upload signing key to Google Play for you.

```bash
# Production Android build (generates .aab for Play Store)
npx eas-cli build --platform android --profile production
```

This will:
- Generate an Android App Bundle (.aab)
- Create and manage the signing keystore (stored in EAS)
- Auto-increment the `versionCode`

> **Important:** EAS manages your keystore. To download it later: `eas credentials --platform android`

---

## Step 2: Create the App in Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in:
   - **App name:** `Dreamz`
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free (with in-app purchases)
4. Accept the declarations and click **Create app**

---

## Step 3: Store Listing

Go to **Grow > Store presence > Main store listing** and fill in:

### Text

| Field | Value |
|-------|-------|
| **App name** | `Dreamz: Dream Journal & Diary` |
| **Short description** (80 chars max) | `AI dream meanings, symbols & mystical readings. Your private dream journal.` |
| **Full description** (4000 chars max) | See below |

**Full description:**

```
Dreamz transforms your dreams into mystical readings with symbols, omens, and rituals.

Write your dream. Get an AI-powered reading. Save it to your Grimoire. Notice the patterns.

YOUR DREAMS, DIVINED
Every dream entry receives a personalized reading with:
- A poetic title and summary
- 1-3 symbols with meaning, shadow, and guidance
- An omen to watch for in waking life
- A ritual to ground the dream's energy
- A journal prompt for deeper reflection

YOUR PRIVATE GRIMOIRE
All your dreams and readings are saved in your personal Grimoire — a searchable, scrollable archive of your dream life. Look back and notice recurring symbols and themes.

SYMBOL DICTIONARY
Browse 5,000+ dream symbols with meanings drawn from mythology, psychology, and mystical traditions.

VOICE RECORDING
Speak your dreams aloud and let Dreamz transcribe them. Perfect for capturing details before they fade.

PRIVATE BY DEFAULT
Your dreams are yours alone. We use encryption, row-level security, and collect only what's necessary. No tracking. No data selling. Export or delete your data anytime.

FREE TIER
- Unlimited dream readings
- Unlimited dream journaling
- Full symbol dictionary access
- Occasional ads between readings

PREMIUM
- Deeper AI readings
- Dream imagery
- Ad-free experience
- Pattern tracking & export

Dreamz is for the curious, the mystical, and anyone who believes their dreams have something to say.
```

### Graphics

| Asset | Spec | Source |
|-------|------|--------|
| **App icon** | 512x512 PNG, 32-bit, no alpha | `assets/icon.png` (resize if needed) |
| **Feature graphic** | 1024x500 PNG or JPG | `store/generated/play-feature.png` |
| **Phone screenshots** | Min 2, 16:9 or 9:16, JPEG/PNG | `store/generated/01-hero.png` through `05-symbols.png` |
| **Tablet screenshots** | Optional but recommended | `store/generated/01-hero-ipad.png` through `05-symbols-ipad.png` |

> **Note:** Phone screenshots from the iOS set may need to be resized. Google Play requires min 320px, max 3840px on each side, and aspect ratio max 2:1. The iPhone screenshots should work — just verify dimensions.

---

## Step 4: Content Rating

Go to **Policy > App content > Content rating**:

1. Start the questionnaire
2. Select **IARC** rating
3. Answer honestly:
   - Violence: None
   - Sexuality: None
   - Language: None
   - Controlled substances: None
   - User-generated content: **Yes** (users write dream entries, but content is private and not shared)
   - Personal info collection: **Yes** (email address)
4. Submit — you'll likely get **Everyone** or **Everyone 10+**

---

## Step 5: Data Safety

Go to **Policy > App content > Data safety**:

### Data collected

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email address | Yes | No | Account management |
| Other user-generated content (dreams) | Yes | No | App functionality |
| App interactions | No | No | — |
| Purchase history | Yes (via Google Play) | No | Subscription management |

### Security practices
- Data is encrypted in transit (HTTPS)
- Data is encrypted at rest (pgcrypto + Supabase)
- Users can request data deletion (in-app Settings)
- Users can request data export (in-app Settings)

### Third-party data sharing
- Dream text is sent to OpenAI for analysis (no PII included)
- Subscription data is managed by RevenueCat (anonymous user ID only)

---

## Step 6: App Access (for Review)

Go to **Policy > App content > App access**:

- Select **All or some functionality is restricted**
- Add credentials so the reviewer can sign in:
  - **Email:** `review@dreamzjournal.app`
  - **Password:** `DreamzReview2026`
  - **Instructions:** `Sign in with email/password. The account has premium access enabled. Create a dream entry to see an AI reading.`

---

## Step 7: Ads Declaration

Go to **Policy > App content > Ads**:
- Select **Yes, my app contains ads**

---

## Step 8: Target Audience

Go to **Policy > App content > Target audience**:
- Target age group: **18 and over** (safest — avoids COPPA/children's content requirements)

---

## Step 9: Set Up In-App Purchases (RevenueCat + Google Play Billing)

### 9a. Create Subscriptions in Google Play Console

1. Go to **Monetize > Products > Subscriptions**
2. Click **Create subscription**

**Monthly:**
- Product ID: `dreamz_premium_monthly`
- Name: `Dreamz Premium Monthly`
- Add a base plan:
  - Billing period: 1 month
  - Price: $5.99
  - (Optional) Add a free trial offer: 7 days

**Annual:**
- Product ID: `dreamz_premium_yearly`
- Name: `Dreamz Premium Yearly`
- Add a base plan:
  - Billing period: 1 year
  - Price: $35.99

### 9b. Connect RevenueCat to Google Play

1. In RevenueCat dashboard, go to your Dreamz project
2. Click **+ Add App** → select **Google Play**
3. Fill in:
   - Package name: `com.dreamzjournal.app`
   - Service Account JSON: you need to create this (see below)

### 9c. Create a Google Play Service Account

RevenueCat needs a service account to validate purchases:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one linked to Play Console)
3. Go to **IAM & Admin > Service Accounts**
4. Click **Create Service Account**
   - Name: `revenuecat-play-billing`
   - Role: none needed here (permissions are set in Play Console)
5. Click on the created account → **Keys** → **Add Key** → **JSON** → Download
6. Go to [Google Play Console](https://play.google.com/console) → **Settings > API access**
7. Link the Google Cloud project if not already linked
8. Find your service account → **Grant access**
9. Set permissions:
   - **Financial data, orders, and cancellation survey responses:** View
   - **Manage orders and subscriptions:** Yes
10. Upload the JSON key file to RevenueCat

### 9d. Add Products in RevenueCat

1. Go to **Products** → **+ New**
2. Add `dreamz_premium_monthly` (Google Play) → attach to `premium` entitlement
3. Add `dreamz_premium_yearly` (Google Play) → attach to `premium` entitlement

### 9e. Update Offering

Your existing `default` offering should already have monthly and annual packages. Ensure the Google Play products are linked to the same packages alongside the iOS products.

### 9f. Add Android API Key to .env

1. In RevenueCat → **Project Settings > API Keys**
2. Copy the **Google Play Public SDK key** (starts with `goog_`)
3. Add to `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxxxx
   ```
4. Update `src/lib/purchases.ts` to use the Android key when `Platform.OS === 'android'`

---

## Step 10: Upload the Build

### Option A: Use EAS Submit

Add Android submit config to `eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "6760150023"
      },
      "android": {
        "serviceAccountKeyPath": "./play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

Then:
```bash
# Submit the latest build to Google Play internal testing track
npx eas-cli submit --platform android --latest
```

### Option B: Manual Upload

1. Download the `.aab` from EAS: `eas build:list --platform android` → copy URL → download
2. In Google Play Console → **Release > Testing > Internal testing**
3. Click **Create new release**
4. Upload the `.aab` file
5. Add release notes:
   ```
   Initial release of Dreamz — AI dream journal with mystical readings.
   ```
6. Click **Review release** → **Start rollout**

---

## Step 11: Testing Tracks

Google Play has a testing pipeline. Use it before going to production:

| Track | Purpose | Who can access |
|-------|---------|----------------|
| **Internal testing** | First — dev team only, immediate availability | Up to 100 testers by email |
| **Closed testing** | Second — invite beta testers | Specific email list or Google Group |
| **Open testing** | Third — public beta | Anyone with the link |
| **Production** | Final — live on Play Store | Everyone |

### Internal Testing Setup
1. Go to **Release > Testing > Internal testing**
2. Click **Testers** → **Create email list**
3. Add tester emails
4. Share the opt-in link with testers

> **Tip:** Start with internal testing. Once stable, promote the same build to production.

---

## Step 12: Promote to Production

1. Go to **Release > Production**
2. Click **Create new release**
3. Select the build from internal/closed testing (or upload a new `.aab`)
4. Add release notes
5. Set rollout percentage (start with 20% if cautious, or 100%)
6. Click **Review release** → **Start rollout to production**

Google Play review typically takes a few hours to a few days for new apps.

---

## OAuth Setup for Android

Google Sign-In should work as-is since the OAuth flow uses `expo-web-browser` with the Supabase redirect. Verify:

1. The redirect URL `dreamz://auth/callback` is in the Supabase Dashboard redirect allowlist (already done for iOS — same URL works)
2. The `dreamz` scheme is set in `app.json` (already configured)

Apple Sign-In is not available on Android — the button is already conditionally rendered with `Platform.OS === 'ios'`.

---

## Checklist

- [ ] Google Play Developer account created ($25)
- [ ] `eas build --platform android --profile production` completed
- [ ] App created in Google Play Console
- [ ] Store listing filled in (title, descriptions, screenshots, feature graphic)
- [ ] Content rating questionnaire completed
- [ ] Data safety section completed
- [ ] App access credentials provided for review
- [ ] Ads declaration: yes, contains ads
- [ ] Target audience: 18+
- [ ] Subscription products created: `dreamz_premium_monthly` ($5.99) and `dreamz_premium_yearly` ($35.99)
- [ ] Google Play service account created and JSON key downloaded
- [ ] RevenueCat: Google Play app added with service account JSON
- [ ] RevenueCat: Google Play products added and linked to `premium` entitlement
- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` added to `.env`
- [ ] `src/lib/purchases.ts` updated for Android API key
- [ ] Build uploaded to internal testing track
- [ ] Tested on real Android device (sign-up, dream entry, reading, paywall purchase)
- [ ] Promoted to production
- [ ] Privacy policy URL set: `https://jtur671.github.io/dreamz/privacy.html`

---

## Key Differences from iOS

| Area | iOS | Android |
|------|-----|---------|
| Store fee | $99/year | $25 one-time |
| Build format | .ipa | .aab |
| Signing | Provisioning profiles + certs | Keystore (EAS manages) |
| Review time | 24-48 hours typical | Hours to a few days |
| Testing | TestFlight | Internal/Closed/Open testing tracks |
| Payments | `appl_` RevenueCat key | `goog_` RevenueCat key |
| Apple Sign-In | Available | Not available (Google only) |
| Submit command | `eas submit --platform ios` | `eas submit --platform android` |
