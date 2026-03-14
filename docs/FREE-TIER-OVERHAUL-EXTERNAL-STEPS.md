# Free Tier Overhaul — External Steps

All code changes are committed. These are the manual steps needed to go live.

---

## 1. Install the Google Mobile Ads SDK

```bash
npm install react-native-google-mobile-ads --legacy-peer-deps
```

This requires a **new dev build** (not Expo Go). After installing, run:

```bash
npx expo prebuild --clean
npx expo run:ios   # or eas build
```

---

## 2. Create AdMob Account & Get IDs

1. Go to https://admob.google.com and sign in / create an account
2. **Register both apps:**
   - iOS: `com.dreamzjournal.app`
   - Android: `com.dreamzjournal.app`
3. **Create an Interstitial ad unit** for each platform
4. Note down:
   - **iOS App ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`)
   - **Android App ID** (same format)
   - **iOS Interstitial Ad Unit ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`)
   - **Android Interstitial Ad Unit ID** (same format)

---

## 3. Update app.json with Real AdMob App IDs

Replace the placeholder IDs in `app.json`:

```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-YOUR_REAL_ANDROID_APP_ID",
    "iosAppId": "ca-app-pub-YOUR_REAL_IOS_APP_ID"
  }
]
```

---

## 4. Set Ad Unit ID Environment Variables

Add to your `.env` (and `.env.example`):

```
EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ
```

In dev builds, test ad IDs are used automatically (`__DEV__` check in `adService.ts`).

---

## 5. Update Prices in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Navigate to your app > Subscriptions
3. Update **Monthly** price: $4.99 -> **$5.99**
4. Update **Annual** price: $29.99 -> **$35.99**
5. Save and submit for review if needed

---

## 6. Update Prices in Google Play Console

1. Go to https://play.google.com/console
2. Navigate to your app > Monetize > Subscriptions
3. Update **Monthly** price: $4.99 -> **$5.99**
4. Update **Annual** price: $29.99 -> **$35.99**
5. Save

---

## 7. Update Prices in RevenueCat

1. Go to https://app.revenuecat.com
2. Ensure the new App Store / Google Play prices are synced
3. Verify the offerings still map correctly to the updated products

---

## 8. Deploy Edge Functions

Both `analyze-dream` (tiered model) and `generate-dream-image` (premium gate) were changed:

```bash
npx supabase functions deploy analyze-dream
npx supabase functions deploy generate-dream-image
```

---

## 9. Smoke Test Checklist

After all the above:

- [ ] **Free user submits dream** — should get reading (no limit), uses gpt-5-nano (check Supabase logs), no image generated, interstitial ad shows
- [ ] **Premium user submits dream** — uses gpt-5-mini, image generates, no ad
- [ ] **Paywall shows $5.99/mo and $35.99/yr** (fallback and live pricing)
- [ ] **Onboarding shows updated features** ("Unlimited readings" for free, "Deeper AI readings / Dream imagery / Ad-free" for premium)
- [ ] **Settings upgrade text** reads "Deeper readings, dream imagery & no ads"
- [ ] **Ad failure doesn't block dream flow** — kill network during ad load, dream still completes
- [ ] **E2E tests pass** — `npm run detox:test:ios`

---

## Order of Operations

Recommended sequence to minimize downtime:

1. Deploy edge functions (step 8) — backwards compatible, free users just get nano now
2. Update store prices (steps 5-7) — can take up to 24h to propagate
3. Install SDK + configure AdMob (steps 1-4) — requires new build
4. Submit new build to TestFlight / internal testing
5. Smoke test (step 9)
6. Submit to App Store / Play Store review
