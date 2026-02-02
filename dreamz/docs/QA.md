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

## Sign-off
- QA verified by: (agent/name)
- Date:
- Remaining known issues / follow-ups:
