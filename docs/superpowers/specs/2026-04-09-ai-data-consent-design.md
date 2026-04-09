# AI Data Consent Flow — Design Spec

**Date:** 2026-04-09
**Status:** Draft
**Apple Review Guidelines:** 5.1.1(i), 5.1.2(i)
**Submission ID:** f40e94c8-4559-4184-b85e-fed0ef9b4609

## Problem

Apple rejected version 1.0 because the app sends user dream data to OpenAI for AI-powered readings without:
1. Disclosing what data is sent
2. Identifying who receives the data (OpenAI)
3. Obtaining explicit user consent before transmission

The app currently has only a privacy policy link on the auth screen. Apple requires in-app disclosure and consent, not just a privacy policy.

## Solution Overview

Implement a two-part consent flow:

1. **Onboarding disclosure** (informational) — A new step in onboarding that explains how dream readings work and what data is involved. No gate; just awareness.
2. **Just-in-time consent modal** (blocking) — A modal shown before the first `analyzeDream()` call that requires explicit opt-in. Users who decline can still journal dreams but cannot receive AI readings.

Users can manage their consent in Settings at any time.

## Approach

**Approach A: Consent Modal Component** — A single reusable `<AIConsentModal>` component used in two contexts (onboarding informational step and just-in-time blocking modal), with a `useAIConsent` hook managing state across Supabase and AsyncStorage.

Alternatives considered:
- **Two separate screens** — More files, duplicated copy, harder to keep in sync.
- **Context-level gating** — Over-engineered for MVP; only one AI entry point exists today.

## Data Model

### Supabase `profiles` Table — New Columns

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `ai_consent_granted` | `boolean` | `false` | Whether user has accepted AI data sharing |
| `ai_consent_date` | `timestamptz` | `null` | When consent was granted (null if never granted) |

### AsyncStorage Cache

**Key:** `dreamz_ai_consent`
**Value:** `{ granted: boolean, date: string | null }`

Used for fast local reads. Supabase is the source of truth; AsyncStorage is a cache that prevents waiting on a network call to determine consent state.

### `Profile` Type Update

Add to `src/types/index.ts`:
```typescript
interface Profile {
  // ... existing fields ...
  ai_consent_granted?: boolean;
  ai_consent_date?: string;
}
```

## `useAIConsent` Hook

**File:** `src/hooks/useAIConsent.ts`

```typescript
interface UseAIConsent {
  hasConsent: boolean | null;  // null = still loading
  grantConsent: () => Promise<void>;
  revokeConsent: () => Promise<void>;
}
```

**Behavior:**
- On mount: reads AsyncStorage first (fast), then syncs with Supabase profile (authoritative)
- `grantConsent()`: writes `ai_consent_granted = true` and `ai_consent_date = now()` to both Supabase and AsyncStorage
- `revokeConsent()`: writes `ai_consent_granted = false` and `ai_consent_date = null` to both stores
- Returns `null` for `hasConsent` while loading to prevent flash of consent modal

## Onboarding — AI Disclosure Step

### Flow Change

Before: `tier` -> `about` -> `welcome` (3 steps, 3 progress dots)
After: `tier` -> `about` -> `ai-disclosure` -> `welcome` (4 steps, 4 progress dots)

### `ai-disclosure` Step Content

**Title:** "How Your Dreams Are Read"

**Body:**
> When you request a reading, your dream text and selected mood are sent to an AI service (OpenAI) for interpretation.
>
> If you've shared your zodiac sign, gender, or age range, these are included to personalize your reading.
>
> Your dreams are never used to train AI models. Your data is never sold.

**Links:** Privacy Policy (`https://dreamz-journal.com/privacy.html`)

**Button:** "Continue" (advances to welcome step, no consent gate)

### Skip Behavior

If the user skips the "about" step, they still see the `ai-disclosure` step before `welcome`.

## Just-In-Time Consent Modal (`AIConsentModal`)

### File

`src/components/AIConsentModal.tsx`

### Trigger

In `NewDreamScreen.handleSubmit()`, after input validation passes:
1. Check `hasConsent` from `useAIConsent()`
2. If `false`, show `AIConsentModal` instead of proceeding
3. If `true`, proceed with `analyzeDream()` as normal

### Modal Content

**Title:** "Before We Read Your Dream"

**Body:**
> To interpret your dream, we send the following to OpenAI:
> - Your dream text
> - Your selected mood
> - Profile details you've shared (zodiac sign, gender, age range)
>
> Your data is processed solely for generating your reading and is not used to train AI models.

**Link:** "Read our Privacy Policy" -> `https://dreamz-journal.com/privacy.html`

**Primary button:** "Allow Dream Readings"
- Calls `grantConsent()`
- Then continues with `analyzeDream()` flow

**Secondary button:** "Not Now"
- Dismisses modal
- User returns to dream entry screen
- No data is sent
- Modal reappears on next submission attempt

### TestIDs

- `ai-consent-modal` — modal container
- `ai-consent-allow` — allow button
- `ai-consent-decline` — not now button
- `ai-consent-privacy-link` — privacy policy link

## Grimoire — No-Consent State

When `hasConsent === false`, the Grimoire screen adapts:

### Banner

A styled card below the title, above the dream list:

> "Your dreams are private reflections. Enable AI readings to unlock mystical interpretations and symbol tracking."

**Button:** "Enable Readings" -> shows `AIConsentModal`
**Dismissable:** per session (local state, reappears next app open)

**TestIDs:**
- `grimoire-consent-banner` — banner container
- `grimoire-consent-enable` — enable button
- `grimoire-consent-dismiss` — dismiss button

### Dream Cards (Simplified)

- Show: date badge, dream type icon, mood, dream text preview (2 lines)
- Hide: reading title, tldr (these come from the reading which doesn't exist)
- No "No reading yet" label — the card is simply a journal entry
- Tapping a card shows the full dream text in a read-only detail view (not the Reading screen)

### Hidden Features

- **Symbol filter pills** — hidden (no readings = no symbols)
- **Search** — still available but only searches dream text and mood (no tags/omen/title from readings)

### Preserved Features

- **Streak badge** — still shows (journaling consistency is independent of AI)
- **Pull to refresh** — still works
- **Delete via long-press** — still works
- **Empty state** — changes copy: "Your journal awaits its first entry..." (instead of grimoire)

## Settings — AI Consent Toggle

### Location

New section after notification preferences, before account management.

### Content

**Section title:** "AI Data Sharing"
**Description:** "Dream readings are powered by OpenAI."
**Link:** "Learn more" -> Privacy Policy
**Toggle:** "Allow AI dream readings" (on/off)

### Behavior

- **Toggling off:** calls `revokeAIConsent()`, shows confirmation alert
- **Toggling on:** shows `AIConsentModal` for re-confirmation; only grants consent if user taps "Allow"

### TestIDs

- `settings-ai-consent-toggle` — the switch
- `settings-ai-consent-learn-more` — privacy link

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useAIConsent.ts` | Consent state hook |
| `src/components/AIConsentModal.tsx` | Reusable consent modal |
| `supabase/migrations/YYYYMMDDHHMMSS_add_ai_consent.sql` | DB migration |
| `e2e/ai-consent.test.ts` | E2E tests for consent flow |
| `e2e/ai-consent-grimoire.test.ts` | E2E tests for Grimoire no-consent state |
| `src/lib/__tests__/aiConsentService.test.ts` | Unit tests for consent service |

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `ai_consent_granted`, `ai_consent_date` to `Profile` |
| `src/lib/profileService.ts` | Add `grantAIConsent()`, `revokeAIConsent()` functions |
| `src/screens/OnboardingScreen.tsx` | Add `ai-disclosure` step, update progress dots to 4 |
| `src/screens/NewDreamScreen.tsx` | Check consent before `analyzeDream()`, show modal if needed |
| `src/screens/GrimoireScreen.tsx` | Conditional rendering for no-consent state |
| `src/screens/SettingsScreen.tsx` | Add AI consent toggle section |
| `src/lib/__tests__/profileService.test.ts` | Add tests for consent fields |
| `e2e/onboarding.test.ts` | Update for 4-step flow |
| `e2e/dream-entry.test.ts` | Grant consent in `beforeAll` |
| `e2e/grimoire.test.ts` | Grant consent in `beforeAll` |
| `e2e/settings.test.ts` | Add consent toggle tests |
| `e2e/helpers/db.ts` | Add `grantTestAccountAIConsent()`, `revokeTestAccountAIConsent()` |
| `docs/QA.md` | Add AI Data Consent section |

## Testing Plan

### New Unit Tests — `src/lib/__tests__/aiConsentService.test.ts`

- `getAIConsent()` returns cached AsyncStorage value when available
- `getAIConsent()` falls back to Supabase profile when AsyncStorage is empty
- `getAIConsent()` returns `false` for new users (no consent record)
- `grantAIConsent()` writes to both Supabase and AsyncStorage with timestamp
- `revokeAIConsent()` clears both Supabase and AsyncStorage
- `grantAIConsent()` handles Supabase failure gracefully (still writes AsyncStorage)
- `revokeAIConsent()` handles Supabase failure gracefully

### Updated Unit Tests — `src/lib/__tests__/profileService.test.ts`

- `updateProfile()` supports `ai_consent_granted` and `ai_consent_date` fields
- `getProfile()` returns consent fields in profile object

### New E2E Tests — `e2e/ai-consent.test.ts`

- Onboarding shows AI disclosure step between "about" and "welcome"
- AI disclosure step has "Continue" button (no accept/decline gate)
- First dream submission shows consent modal (not previously consented)
- Tapping "Allow Dream Readings" grants consent and proceeds to analysis
- Tapping "Not Now" dismisses modal, returns to dream entry (no analysis)
- After granting consent, subsequent dream submissions skip the modal
- After revoking consent in Settings, next dream submission shows modal again

### New E2E Tests — `e2e/ai-consent-grimoire.test.ts`

- No-consent user sees simplified dream cards (text preview, mood, date — no reading title/tldr)
- No-consent user sees "Enable Readings" banner at top of Grimoire
- Tapping "Enable Readings" banner shows consent modal
- After granting consent via banner, Grimoire updates to full view
- No-consent user does NOT see symbol filter pills
- No-consent user search only searches dream text (no tags/omen)
- Tapping a dream card in no-consent mode shows dream text detail (not Reading screen)
- Pre-consent dreams remain as plain journal cards after granting consent (no retroactive analysis)
- New dream submitted after granting consent receives a full AI reading
- Grimoire correctly shows mixed state: old plain cards alongside new reading cards

### Updated E2E Tests

**`e2e/onboarding.test.ts`**
- All existing tests updated for 4-step flow (tier -> about -> ai-disclosure -> welcome)
- Progress dots show 4 dots instead of 3
- "Skip" on about step lands on ai-disclosure, not welcome

**`e2e/dream-entry.test.ts`**
- `beforeAll` grants AI consent for test account
- All existing tests pass unchanged after consent is pre-granted

**`e2e/grimoire.test.ts`**
- `beforeAll` grants AI consent for test account
- All existing tests pass unchanged after consent is pre-granted

**`e2e/settings.test.ts`**
- AI consent toggle is visible
- Toggling off revokes consent
- Toggling on re-shows consent modal

### E2E Helper Updates — `e2e/helpers/db.ts`

- `grantTestAccountAIConsent()` — sets `ai_consent_granted = true`, `ai_consent_date = now()` in test profile
- `revokeTestAccountAIConsent()` — sets `ai_consent_granted = false`, `ai_consent_date = null`

### QA Checklist — `docs/QA.md` New Section

**AI Data Consent (Apple 5.1.1/5.1.2 compliance)**
- [ ] Onboarding shows AI disclosure step with correct copy
- [ ] First dream analysis triggers consent modal
- [ ] Consent modal lists: dream text, mood, profile context, OpenAI as recipient
- [ ] "Allow" grants consent, analysis proceeds
- [ ] "Not Now" dismisses, no data sent, user can still journal
- [ ] Consent persists across app restart (Supabase + AsyncStorage)
- [ ] Consent persists across device change (Supabase sync)
- [ ] Revoking consent in Settings blocks future AI calls
- [ ] Revoking consent changes Grimoire to journal-only mode
- [ ] Re-granting consent restores full Grimoire and AI analysis
- [ ] "I don't remember" (forgot) works without AI consent
- [ ] Privacy policy link in consent modal is tappable and loads correctly
- [ ] Pre-consent journal entries remain as plain text after granting consent (no retroactive AI)
- [ ] New dreams submitted after consent get full AI readings
- [ ] Grimoire displays mixed state correctly (old plain cards + new reading cards)

## Migration

```sql
-- Add AI consent tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN ai_consent_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN ai_consent_date timestamptz;

-- Backfill: grant consent to all existing users (they accepted the privacy policy at sign-up)
UPDATE profiles
  SET ai_consent_granted = true,
      ai_consent_date = NOW()
  WHERE ai_consent_granted = false;
```

Note: Existing users are backfilled with consent granted because they signed up under the original privacy policy which disclosed AI usage. Only new users will see the consent flow.

## Privacy Policy Update (External)

The privacy policy at `https://dreamz-journal.com/privacy.html` must be updated to explicitly state:
- What data is collected (dream text, mood, optional profile: zodiac, gender, age range)
- Who receives it (OpenAI, via Supabase Edge Function)
- Purpose (generating dream interpretations only)
- Data is not used to train AI models
- User can revoke consent at any time in Settings

This is an external change outside the codebase.

## Post-Consent Behavior for Existing Dreams

When a user grants AI consent after having already journaled dreams, **only new dream submissions get AI readings.** Existing journal entries remain as plain text — no retroactive analysis, no batch processing.

In the Grimoire, pre-consent dreams continue to show as simplified journal cards (date, mood, dream text preview) even after consent is granted. They are visually distinct from post-consent dreams that have full readings with titles, tldrs, and symbols.

## Edge Cases

1. **Consent loading state** — `hasConsent` starts as `null`. The submit button remains functional. If the user taps submit while consent is still loading, wait for the consent state to resolve before deciding whether to show the modal or proceed with analysis. Do not block the UI while loading — only gate at the moment of submission.
2. **AsyncStorage/Supabase mismatch** — Supabase is authoritative. If AsyncStorage says consented but Supabase says no (e.g., data cleared server-side), Supabase wins. The hook syncs on mount.
3. **Offline consent grant** — If Supabase is unreachable when granting consent, write to AsyncStorage only. Next time the app syncs with Supabase, persist the consent. This prevents blocking the user when offline.
4. **Existing users upgrading** — The migration backfills consent for all existing users. They will not see the consent modal.
5. **"I don't remember" flow** — Forgot-dream entries never call `analyzeDream()`, so no consent check is needed.
6. **Re-granting after revoke** — Toggling consent back on in Settings shows the full consent modal again (not a simple toggle). This ensures the user re-reads the disclosure.
