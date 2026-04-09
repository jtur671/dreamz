# QA Checklist — Dream Dictionary App MVP

Use this checklist for every PR/feature. A change is not "done" until the applicable items are checked and the verification notes are recorded.

---

## 0) PR Summary (required)
- [ ] Goal (1–2 sentences):
- [ ] Scope (what's included):
- [ ] Non-goals (what's explicitly not included):
- [ ] Files touched (high level list):
- [ ] How to test (commands + manual steps):

Verification notes:
- Commands run:
- Devices tested (iOS/Android/simulator):
- Screens verified:

---

## 1) Core User Flows (MVP)
### Auth
- [ ] Sign up / sign in works
- [ ] Session persists across app restart (if applicable)
- [ ] Sign out works and clears protected screens

Notes:

### New Dream Entry
- [ ] Can enter dream text and submit
- [ ] Input validation works (empty dream blocked; clear error)
- [ ] Loading state shows while analyzing
- [ ] Error state shows on failure (network/model/auth)

Notes:

### Dream Reading (AI)
- [ ] AI response is valid JSON matching `reading.schema.json`
- [ ] Client validates JSON before rendering
- [ ] Retry logic works (only limited retries)
- [ ] Fallback output appears if model returns invalid JSON
- [ ] No medical/diagnostic or "certain prediction" language in UI (spot-check)

Notes:

### Save + History (Grimoire)
- [ ] Reading is saved to user's account
- [ ] History list loads and displays title/date/omen
- [ ] Opening an item shows the saved reading correctly
- [ ] Search works (if included in this PR)

Notes:

### Delete / Export
- [ ] Delete dream removes it from DB and UI updates immediately
- [ ] Export produces correct data (format confirmed)
- [ ] Delete account (if implemented) removes user data

Notes:

---

## 2) Security & Privacy (required)
- [ ] No secrets committed (keys in env vars only)
- [ ] Minimal data collection (no precise location, no full DOB)
- [ ] Dream text not shown in notifications or logs by default
- [ ] Sensitive data not printed in console logs (spot-check)

### Supabase / Backend
- [ ] RLS enabled on tables with correct policies
- [ ] Users can only read/write their own rows (verified)
- [ ] API endpoints require auth (verified)
- [ ] Input validation present server-side

How verified (include at least one):
- [ ] Manual: attempted cross-user access and it failed
- [ ] Automated test covers RLS
- [ ] SQL policy review recorded

Notes:

---

## 3) Reliability & Error Handling (required)
- [ ] Offline / flaky network behavior is graceful (no crashes)
- [ ] Timeouts handled (user sees a helpful message)
- [ ] Empty states exist (no dreams, no symbols, etc.)
- [ ] App does not crash on malformed/partial reading data

Notes:

---

## 4) Performance & UX (required)
- [ ] No obvious unnecessary re-renders in main screens (spot-check)
- [ ] Lists use performant list components (FlatList / equivalent)
- [ ] Loading states are present and not jarring
- [ ] Text is readable (contrast, sizes, spacing)
- [ ] "Mystical" tone consistent and not cheesy (spot-check)

Notes:

---

## 5) Automated Checks (run what exists)
- [ ] Lint passed
- [ ] Typecheck passed
- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] E2E smoke test passed (if present)

Commands run and results:
- `...`

---

## 6) Regression Checklist (quick)
- [ ] Existing auth flow still works
- [ ] Existing history list still loads
- [ ] Settings screen still opens
- [ ] No new warnings/errors spam in console

Notes:

---

## 7) New Features (v0.2.0)

### Draft Saving & Recovery
- [ ] Typing a dream auto-saves draft to local storage
- [ ] Closing app mid-entry preserves draft
- [ ] Reopening NewDreamScreen shows recovery prompt if draft exists
- [ ] Accepting recovery restores dream text, mood, and dream type
- [ ] Declining recovery clears draft
- [ ] Draft expires after 7 days (verify with time manipulation or wait)
- [ ] Submitting dream clears draft

Test steps:
1. Open NewDreamScreen, type partial dream, close app
2. Reopen app, navigate to NewDreamScreen
3. Verify recovery prompt appears
4. Accept recovery, verify content restored

### Dream Type Selection (Dream/Nightmare)
- [ ] Dream type toggle visible on NewDreamScreen
- [ ] Default is "dream"
- [ ] Can switch to "nightmare"
- [ ] Dream type persists in saved dream
- [ ] Dream type displays correctly in Grimoire list
- [ ] Dream type included in reading analysis

Test steps:
1. Create dream with type "dream", verify saved
2. Create dream with type "nightmare", verify saved
3. Check Grimoire shows correct type for each

### Zodiac Sign Settings
- [ ] Zodiac picker visible in SettingsScreen
- [ ] All 12 signs available
- [ ] Selection saves to profile
- [ ] Selection persists across app restart
- [ ] Can clear/change zodiac sign

Test steps:
1. Open Settings, select zodiac sign
2. Close and reopen app
3. Verify zodiac sign persisted
4. Change to different sign, verify update

### Personalized Readings (Zodiac)
- [ ] If zodiac set, reading mentions astrological context
- [ ] Reading adapts interpretation to zodiac sign
- [ ] Works correctly with no zodiac set (fallback)

Test steps:
1. Set zodiac to "Scorpio", submit dream
2. Verify reading includes Scorpio-relevant interpretation
3. Clear zodiac, submit another dream
4. Verify reading works without zodiac context

### Symbol Library (Backend)
- [ ] Symbols table has 45 curated + 5,707 DreamMoods (~5,752 total)
- [ ] Symbols readable by any authenticated user
- [ ] Symbol categories: nature, celestial, action, body, object, place, person, animal, theme

Verify with:
```sql
SELECT COUNT(*) FROM symbols; -- should be ~5,752
SELECT COUNT(*) FROM symbols WHERE source = 'curated'; -- should be 45
SELECT DISTINCT category FROM symbols;
```

---

## 8) AI Data Consent (Apple 5.1.1/5.1.2 Compliance)

### Onboarding Disclosure
- [ ] AI disclosure step appears between "about" and "welcome"
- [ ] Progress dots show 4 steps
- [ ] Disclosure mentions: dream text, mood, profile context, OpenAI
- [ ] Privacy policy link works
- [ ] "Continue" advances to welcome step (no gate)
- [ ] Skip on about step still shows AI disclosure

### Just-In-Time Consent Modal
- [ ] First dream analysis triggers consent modal
- [ ] Modal lists all data types sent (dream text, mood, zodiac/gender/age)
- [ ] Modal identifies OpenAI as recipient
- [ ] "Allow Dream Readings" grants consent and proceeds to analysis
- [ ] "Not Now" dismisses modal, no data sent, returns to dream entry
- [ ] Subsequent dream submissions skip modal after consent granted

### Consent Persistence
- [ ] Consent persists across app restart (AsyncStorage + Supabase)
- [ ] Consent persists across device change (Supabase sync)
- [ ] Revoking in Settings sets toggle off and blocks future AI calls
- [ ] Re-granting shows full consent modal (not just toggle)

### Grimoire No-Consent State
- [ ] No-consent user sees simplified journal cards (text, mood, date only)
- [ ] "Enable Readings" banner appears at top of Grimoire
- [ ] Tapping banner shows consent modal
- [ ] Symbol filter pills hidden in no-consent state
- [ ] Search only matches dream text and mood (no tags/omen)
- [ ] Empty state says "Your journal awaits..." not "grimoire"
- [ ] Pre-consent dreams remain plain after granting consent (no retroactive AI)
- [ ] New dreams after consent get full readings
- [ ] Mixed state renders correctly (old plain + new reading cards)

### Edge Cases
- [ ] "I don't remember" works without AI consent
- [ ] Offline consent grant saves to AsyncStorage
- [ ] Existing users (migration backfill) see no consent modal

Notes:

---

## Sign-off
- QA verified by: (agent/name)
- Date:
- Remaining known issues / follow-ups:
