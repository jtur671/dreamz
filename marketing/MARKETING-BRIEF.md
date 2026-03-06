# Dreamz Marketing Brief

> Feed this document into a marketing project to kick off launch strategy.

---

## Product Summary

**App Name:** Dreamz
**Tagline:** Your dreams, divined.
**Platform:** iOS (App Store)
**Bundle ID:** com.dreamzjournal.app
**App Store Connect ID:** 6760150023
**Status:** TestFlight (v1.0.0 build 3, Mar 6 2026). Pending App Store submission.

## What It Does

Dreamz is a mystical dream journal that transforms dream entries into AI-powered "readings" with symbols, omens, rituals, and journal prompts. Users write or voice-record their dreams and receive a personalized mystical interpretation saved to their Grimoire.

**Core Loop:** Write/Record Dream -> Get AI Reading -> Save to Grimoire -> Notice Patterns

## Key Features

| Feature | Free | Premium ($4.99/mo or $29.99/yr) |
|---------|------|----------------------------------|
| Dream journal (text + voice) | Yes | Yes |
| AI mystical readings | 3/month | Unlimited |
| Symbol dictionary (5,700+) | Yes | Yes |
| Grimoire (dream history) | Yes | Yes |
| Advanced insights & patterns | - | Yes |
| Export features | - | Yes |
| Priority support | - | Yes |

## Target Audience

**Primary Persona:** "Luna, 28" — The Curious Mystic
- Wakes with vivid dreams 2-3x/week
- Into astrology, tarot, wellness, spirituality
- Uses Co-Star, Headspace, Pattern, or similar
- Wants meaning without clinical analysis
- Values privacy (won't share raw dream text)
- Appreciates dark, atmospheric, beautiful UI

**Demographics:**
- 18-35, skewing female
- Wellness/spirituality adjacent
- Active on TikTok, Instagram, Pinterest
- Podcast listeners (wellness, astrology, true crime/mystery)

**Psychographics:**
- Believes dreams carry meaning
- Enjoys self-reflection and journaling
- Drawn to mystical/witchy aesthetics
- Privacy-conscious
- Willing to pay for tools that feel personal and magical

## Brand Voice & Tone

- **Mystical but accessible** — "a wise friend who reads tarot"
- Modern, slightly poetic, never cheesy
- No clinical/diagnostic language
- Framing: "often suggests...", "may reflect..." (interpretation, not prediction)
- Dark, atmospheric aesthetic (deep purples, golds, midnight blues)
- Keywords: mystical, private, personal, divined, oracle, grimoire, veil

## Competitive Landscape

| Competitor | Gap Dreamz Fills |
|-----------|------------------|
| Dream journal apps (basic) | No AI interpretation, no mystical tone |
| Co-Star / Pattern | Astrology-only, no dream focus |
| ChatGPT | No dedicated UX, no grimoire, no privacy |
| Dream dictionary websites | Static meanings, no personalization |

**Unique positioning:** The only dream journal that gives you a full mystical reading (not just a dictionary lookup) with a beautiful, private-first mobile experience.

## Pricing

- **Free tier:** 3 AI readings/month, full journal + dictionary access
- **Premium monthly:** $4.99/month — unlimited readings + advanced features
- **Premium annual:** $29.99/year (50% savings) — same as monthly

## Assets Available

- 12 App Store screenshots (iPhone 6.7" + 6.5") in `store/generated/`
- App icon (dark mystical theme)
- Privacy policy: https://jtur671.github.io/dreamz/privacy.html
- Support page linked in App Store listing

## Marketing Channels to Explore

### Organic / Content
- **TikTok:** "What your dream meant" short-form content, dream interpretation videos
- **Instagram:** Aesthetic dream symbol cards, Reels showing the app in action
- **Pinterest:** Dream symbol pins, "dream meaning" SEO content
- **Reddit:** r/Dreams, r/LucidDreaming, r/witchcraft, r/astrology (authentic participation, not spam)

### ASO (App Store Optimization)
- Keywords: dream journal, dream meaning, dream interpretation, dream dictionary, dream analysis
- Category: Health & Fitness or Lifestyle
- Subtitle optimization

### Paid (future)
- TikTok ads targeting wellness/astrology audiences
- Instagram/Facebook ads with dream symbol creative
- Apple Search Ads on competitor keywords

### Partnerships
- Astrology/tarot influencers
- Wellness podcasts
- Sleep/dream content creators

### Launch Strategy Ideas
- "First 1000 users get premium free for a month" promo code
- Dream symbol of the day social content
- "Most common dream meanings" viral content series
- Collaboration with astrology apps for cross-promotion

## Technical Notes for Marketing Site

- App is Expo/React Native (iOS first, Android possible later)
- Backend: Supabase (Postgres + Auth + Edge Functions)
- AI: OpenAI GPT-5-mini for readings, DALL-E 3 for dream images
- Privacy: encrypted at rest (pgcrypto), RLS enforced, no PII collection beyond email
- RevenueCat for subscription management

## Open Questions

- [ ] Landing page needed? (domain, design, email capture)
- [ ] Social media accounts created? (TikTok, Instagram, Twitter/X)
- [ ] Press kit / media assets needed?
- [ ] Launch date target?
- [ ] Promo code strategy for early adopters?
- [ ] App Store submission timeline (after TestFlight validation)?
