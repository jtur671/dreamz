# RevenueCat Setup Guide

The app code is fully wired. This doc covers the external setup you need to do before payments will work in production.

---

## What's already done in the app

| Component | Status |
|-----------|--------|
| `react-native-purchases` SDK installed | ✅ |
| `initPurchases()` called on app start | ✅ |
| `PaywallScreen` with pricing, free trial, purchase/restore | ✅ |
| `checkPremiumAccess()` checks `entitlements.active['premium']` | ✅ |
| Unlimited readings for all tiers; free tier sees ads, premium is ad-free | ✅ |
| Profile `subscription_tier` updated in Supabase after successful purchase | ✅ |
| Env vars wired: `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` | ✅ (needs real key) |

---

## What you still need to do

There are two parts: **App Store Connect** (Apple) and **RevenueCat dashboard**.

---

## Part 1: App Store Connect — Create the Subscription Product

> You need an Apple Developer account ($99/yr) first.

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → select Dreamz (or create the app first if you haven't)

2. In the left sidebar, click **Monetization** → **Subscriptions**

3. Click **+** to create a **Subscription Group**
   - Name: `Premium` (displayed to users in Settings → Subscriptions)

4. Inside that group, create **two** subscription products:

   **Monthly:**
   - **Reference Name**: `Dreamz Premium Monthly`
   - **Product ID**: `dreamz_premium_monthly`
   - **Subscription Duration**: 1 Month
   - **Pricing**: **$5.99/month** (Tier 6)
   - Optional: add a **7-day free trial** — click "Add Introductory Offer" → Free Trial → 7 Days

   **Annual:**
   - **Reference Name**: `Dreamz Premium Yearly`
   - **Product ID**: `dreamz_premium_yearly`
   - **Subscription Duration**: 1 Year
   - **Pricing**: **$35.99/year** (Tier 36) — ~50% savings vs monthly

5. For each product, add **Localization** (required):
   - Display Name: `Dreamz Premium`
   - Description: `Unlimited dream readings, advanced insights, and pattern tracking.`

7. Fill in **Review Information** (required for App Review):
   - Screenshot of the paywall screen (use one from `store/generated/`)
   - Review Notes: `Test account credentials: [your Sandbox test account email/password]`

8. Submit the subscription for review alongside your app.

---

## Part 2: RevenueCat Dashboard Setup

1. Create an account at [revenuecat.com](https://revenuecat.com) (free to start)

2. Click **+ New Project** → Name it `Dreamz`

3. **Add iOS App**:
   - Platform: App Store
   - App Name: `Dreamz`
   - Bundle ID: `com.dreamz.app`
   - App Store Connect App-Specific Shared Secret:
     - In App Store Connect → Dreamz app → Monetization → Subscriptions → **App-Specific Shared Secret** → Generate
     - Paste that here

4. **Create an Entitlement**:
   - Go to **Entitlements** → **+ New**
   - Identifier: `premium`  *(must match exactly — the app checks for this string)*
   - Display name: `Premium`

5. **Create Products**:
   - Go to **Products** → **+ New**
   - Product Identifier: `dreamz_premium_monthly`  *(must match the App Store product ID from Part 1 exactly)*
   - Attach it to the `premium` entitlement
   - Repeat for `dreamz_premium_yearly` — same entitlement

6. **Create an Offering**:
   - Go to **Offerings** → **+ New**
   - Identifier: `default`  *(the app calls `offerings.current` which returns the default offering)*
   - Display name: `Default`
   - Add **two Packages**:
     - Monthly: Identifier `$rc_monthly`, Duration: Monthly, Product: `dreamz_premium_monthly`
     - Annual: Identifier `$rc_annual`, Duration: Annual, Product: `dreamz_premium_yearly`
   - Set this offering as **Current** (the default)

7. **Copy your API key**:
   - Go to **Project Settings** → **API Keys**
   - Copy the **iOS Public SDK key** (starts with `appl_`)
   - Add it to your `.env` file:
     ```
     EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxxxx
     ```
   - Rebuild the app: `npm run detox:rebundle:ios` (dev) or full production build

---

## Part 3: Testing Purchases (Sandbox)

Apple has a Sandbox environment for testing purchases without real money.

1. In App Store Connect → **Users and Access** → **Sandbox Testers** → **+** → create a test Apple ID (use a fake email you control, e.g. `youremail+sandbox@gmail.com`)

2. On your **physical iPhone** (not simulator):
   - Settings → App Store → scroll down → **Sandbox Account** → sign in with the sandbox Apple ID

3. Run the app, trigger the paywall, tap **Subscribe Now** — it will charge $0 and grant premium access

4. To test the free trial: the sandbox compresses trial periods (7-day trial = ~3 minutes in sandbox)

---

## Webhook (Optional but Recommended)

Without a webhook, premium status in Supabase only updates when the user actively opens the app. If a subscription lapses (user cancels), their `subscription_tier` in your DB won't automatically revert to `free`.

For MVP this is fine — the edge function's reading limit is enforced server-side and RevenueCat is the source of truth for entitlements. But for a tighter integration later:

1. In RevenueCat → **Project Settings** → **Webhooks** → **+ Add**
2. URL: `https://<your-supabase-project>.supabase.co/functions/v1/revenuecat-webhook`
3. You'd need to build a small edge function that receives the event and updates `subscription_tier` in the profiles table

This is a Phase 2 item — not needed to ship.

---

## Summary Checklist

- [ ] Apple Developer account active ($99/yr)
- [ ] App created in App Store Connect
- [ ] Subscription products created: `dreamz_premium_monthly` ($5.99/mo) and `dreamz_premium_yearly` ($35.99/yr)
- [ ] (Optional) 7-day free trial added to monthly subscription
- [ ] RevenueCat project created with iOS app
- [ ] Entitlement `premium` created in RevenueCat
- [ ] Products `dreamz_premium_monthly` and `dreamz_premium_yearly` added in RevenueCat, both linked to `premium` entitlement
- [ ] Default offering created with monthly and annual packages
- [ ] RevenueCat iOS SDK key copied to `.env` as `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
- [ ] App rebuilt with new env var
- [ ] Tested end-to-end with a Sandbox account on a real device
