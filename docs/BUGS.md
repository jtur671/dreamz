# Bug Post Mortems

## BUG-001: New User Sign-Up Broken (Production)

**Date Discovered:** 2026-02-21
**Severity:** Critical — blocks all new user acquisition
**Status:** FIXED — migration 016 deployed 2026-02-22 (final fix)

---

### Summary

All new account sign-ups fail with HTTP 500 `unexpected_failure` and the message `"Database error saving new user"`. The `handle_new_user()` PostgreSQL trigger function is throwing an unhandled exception when Supabase Auth inserts a new row into `auth.users`.

---

### User Impact

- New users cannot create accounts
- The app's AuthScreen shows an Alert: `Sign Up Error: Database error saving new user`
- Existing users are unaffected (sign-in works; only INSERT into `auth.users` is broken)
- All Detox e2e onboarding tests fail as a secondary effect

---

### Timeline

| Time | Event |
|------|-------|
| Migration 012 deployed | Encryption at rest introduced; `public.profiles` replaced with an encrypted VIEW |
| 2026-02-21 | Detox e2e onboarding tests began failing; manual `curl` confirmed HTTP 500 on all sign-up attempts |

---

### Root Cause Analysis

**Trigger chain (migration 001 → migration 012):**

1. `supabase.auth.signUp()` triggers Supabase Auth to INSERT into `auth.users`
2. The `on_auth_user_created` trigger fires → calls `public.handle_new_user()` (SECURITY DEFINER)
3. `handle_new_user()` does `INSERT INTO public.profiles (id, email)`
4. Migration 012 replaced `public.profiles` table with a VIEW; INSTEAD OF INSERT triggers now call `profiles_view_insert()` (SECURITY INVOKER)
5. `profiles_view_insert()` calls `private.get_encryption_key()` then inserts encrypted data into `private.profiles_encrypted`

**Most likely failure points (in order of probability):**

1. **Missing encryption key row** — `private.encryption_config` may be empty if the `INSERT INTO private.encryption_config` statement in migration 012 failed silently. `private.get_encryption_key()` would return `NULL`; `pgp_sym_encrypt(email, NULL)` throws `"key must not be empty"`.

2. **Permission gap** — `profiles_view_insert()` is SECURITY INVOKER. If the calling context is `supabase_auth_admin` (not `postgres`), it may lack EXECUTE on `private.get_encryption_key()`. The grant covers `authenticated` and `service_role` but not `supabase_auth_admin`.

3. **pgcrypto not available** — Unlikely since `CREATE EXTENSION IF NOT EXISTS pgcrypto` was in migration 012, which is marked as applied.

---

### Investigation Steps Taken

```bash
# Confirmed HTTP 500 on every sign-up attempt:
curl -X POST "${SUPABASE_URL}/auth/v1/signup" \
  -H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" \
  -d '{"email":"test@test.dreamz.app","password":"OnboardTest1!"}'
# → {"code":500,"error_code":"unexpected_failure","msg":"Database error saving new user"}

# Confirmed all 13 migrations are applied to remote:
npx supabase migration list
# → 001–013 all applied

# Confirmed existing users can still query profiles (sign-in and profile reads work):
curl "${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1" -H "apikey: ${ANON_KEY}"
# → [] (empty but no error — RLS filters, query works)
```

---

### Resolution Steps

**To diagnose exact cause** (requires psql or Supabase SQL Editor access):

```sql
-- 1. Check encryption key exists
SELECT key, length(value) as key_length FROM private.encryption_config;
-- Expected: one row with key='encryption_key' and key_length=32

-- 2. If missing, re-insert the key:
INSERT INTO private.encryption_config (key, value)
VALUES ('encryption_key', 'dev-only-encryption-key-32chars!')
ON CONFLICT (key) DO NOTHING;

-- 3. Test the trigger manually:
BEGIN;
INSERT INTO public.profiles (id, email) VALUES (gen_random_uuid(), 'diag-test@test.com');
ROLLBACK;
-- Any error here is the root cause.

-- 4. Check grant on get_encryption_key (fix if supabase_auth_admin needs it):
GRANT EXECUTE ON FUNCTION private.get_encryption_key() TO supabase_auth_admin;
```

**If encryption key is missing**: The INSERT in migration 012 may have failed. Re-run:
```sql
INSERT INTO private.encryption_config (key, value)
VALUES ('encryption_key', 'dev-only-encryption-key-32chars!')
ON CONFLICT (key) DO NOTHING;
```

**If it's a permission issue**: Add the missing grant:
```sql
GRANT EXECUTE ON FUNCTION private.get_encryption_key() TO supabase_auth_admin;
GRANT ALL ON private.profiles_encrypted TO supabase_auth_admin;
```

After fixing, create a migration `014_fix_signup_trigger.sql` so the fix is tracked.

---

### Prevention / Lessons Learned

1. **Always test sign-up after schema migrations** — Any change to `public.profiles` (or anything the `handle_new_user()` trigger touches) must be followed by a test sign-up with a fresh account.

2. **SECURITY INVOKER triggers + SECURITY DEFINER callers are subtle** — The role that `SECURITY INVOKER` trigger functions run as depends on the calling stack. Explicitly grant to `supabase_auth_admin` for any function called from auth triggers, not just `authenticated`/`service_role`.

3. **Add the trigger chain to the e2e pre-flight check** — The `auth.test.ts` sign-up test should be the first test that runs (it is). A failure here surfaces this class of bug immediately.

4. **For encryption key INSERT: use `ON CONFLICT DO NOTHING`** — Migration 012's `INSERT INTO private.encryption_config` should have used `ON CONFLICT (key) DO NOTHING` so re-runs don't fail.

5. **Validate migrations in staging before remote push** — A local Supabase instance (with Docker) should be used to validate migrations before `supabase db push`.

---

### Secondary Impact: Onboarding E2E Tests

The `e2e/onboarding.test.ts` suite requires creating new Supabase accounts. With sign-up broken, all 3 tests fail. Temporary workaround options:

- **Option A (preferred):** Fix the production bug, then tests pass normally.
- **Option B (interim):** Add `DETOX_FORCE_ONBOARDING=1` launch arg that sets `needsOnboarding = true` for the test user without requiring a new account. This requires a small App.tsx change and a rebuild.
- **Option C (structural):** Make onboarding tests reset `onboarding_completed = false` for the test user via Supabase REST API before each test, then relaunch.

---

---

### Actual Root Cause (Confirmed 2026-02-21)

After deeper investigation, the root cause was confirmed to be a **SECURITY INVOKER trigger running as `supabase_auth_admin`**, not a missing encryption key.

**Evidence:**
- Service role `INSERT INTO profiles` (via REST API) → succeeded (FK error only), proving the encryption key IS present and the trigger WORKS for roles that have private schema access.
- `supabase_auth_admin` signup → HTTP 500, proving the issue is role-specific.

**Exact failure chain:**
1. Supabase Auth (session role: `supabase_auth_admin`) INSERTs into `auth.users`
2. `on_auth_user_created` trigger fires → `handle_new_user()` (SECURITY DEFINER, owner=postgres)
3. Inside `handle_new_user()`, `INSERT INTO public.profiles` fires the INSTEAD OF trigger
4. `profiles_view_insert()` was SECURITY INVOKER — in Supabase's hosted PG environment, this resolves to `supabase_auth_admin` (the session user), NOT `postgres` (the DEFINER context)
5. `supabase_auth_admin` has NO USAGE on schema `private`, no access to `private.profiles_encrypted`
6. INSERT blocked → trigger exception → "Database error saving new user"

**Fix (migration 014):**
1. Re-created `profiles_view_insert()` and `dreams_view_insert()` as `SECURITY DEFINER` — they now always run as postgres (their owner), regardless of calling context
2. Added `GRANT USAGE ON SCHEMA private`, `GRANT SELECT/INSERT/UPDATE ON private.profiles_encrypted`, and `GRANT EXECUTE ON FUNCTION private.get_encryption_key()` to `supabase_auth_admin` as belt-and-suspenders
3. Added a `DO $$` block that raises an exception if the encryption key is missing (makes future breakage loud, not silent)

**True Final Fix (migration 016, 2026-02-22):**

After migration 015 added an EXCEPTION handler, the real error was surfaced:
`"function pgp_sym_encrypt(character varying, text) does not exist (SQLSTATE: 42883)"`

Two sub-issues:
1. `handle_new_user()` is SECURITY DEFINER but had no `SET search_path`. SECURITY DEFINER functions inherit the **caller's** search_path, not the owner's. The `supabase_auth_admin` session search_path does NOT include the `extensions` schema where pgcrypto lives. PostgreSQL could not resolve `pgp_sym_encrypt`.
2. `new.email` is `character varying` (not `text`). `pgp_sym_encrypt` only has `text/bytea` overloads. When pgcrypto IS found (e.g. via service_role), the implicit cast works. But when combined with the search_path issue, there is no matching function signature.

Fix: `SET search_path = public, extensions, private` on `handle_new_user()` + `new.email::text` cast.
Also hardened `private.get_encryption_key()` with `SET search_path = private`.

Verified working: `curl -X POST .../auth/v1/signup` → HTTP 200 with `access_token`.

*Fixed by Claude Code on 2026-02-22*

---

## TestFlight Feedback (Mar 6, 2026)

### BUG-002: Apple Sign-In Not Working (Production)
- **Severity:** Critical — blocks sign-up for Apple ID users
- **Status:** FIXED (2026-03-07)
- **Reported by:** TestFlight testers
- **Root Cause:** Supabase Apple provider client ID was set to `env(...)` placeholder instead of the actual bundle identifier `com.dreamzjournal.app`. Additionally, the provisioning profile needed to be regenerated with the Sign In with Apple capability.
- **Fix:** Updated Supabase Dashboard Apple provider client ID to `com.dreamzjournal.app`. Regenerated provisioning profile. For native iOS sign-in (via `signInWithIdToken`), the client ID must be the app's bundle identifier, not a Services ID.

### BUG-003: Google Sign-In Not Working (Production)
- **Severity:** Critical — blocks sign-up for Google users
- **Status:** FIXED (2026-03-07)
- **Reported by:** TestFlight testers
- **Root Cause:** The redirect URI `dreamz://auth/callback` was missing from the Supabase redirect URLs allowlist.
- **Fix:** Added `dreamz://auth/callback` to the Supabase Dashboard under Authentication > URL Configuration > Redirect URLs.

### BUG-004: No Confirmation Email After Sign-Up
- **Severity:** Low — misleading UX, not a functional issue
- **Status:** FIXED (2026-03-07)
- **Reported by:** TestFlight testers
- **Details:** After creating an account with email, the app showed "Check your email for confirmation" but no email was ever sent. Email confirmations are intentionally disabled in Supabase for MVP (`enable_confirmations = false`), and no SMTP is configured. Users are auto-signed-in immediately.
- **Fix:** Removed the misleading alert. Sign-up now silently proceeds to onboarding via `onAuthStateChange`. Email confirmation can be added post-launch if needed.

---

## Manual Testing Bugs (Mar 18, 2026)

### BUG-005: Grimoire Stale Filter Causes Empty List After Tab Switch
- **Severity:** Medium — user gets trapped in empty state with no escape
- **Status:** FIXED (2026-03-18)
- **Found by:** Manual testing
- **Steps to reproduce:**
  1. Open Grimoire tab with enough dreams to show symbol filter pills (threshold: 4+ dreams containing the same symbol)
  2. Tap a symbol filter pill to activate it
  3. Delete several dreams (reducing that symbol's count below the threshold of 4)
  4. Navigate to Settings tab
  5. Navigate back to Grimoire tab
- **Expected:** All dreams show (filter auto-cleared since the symbol pill no longer exists)
- **Actual:** "No dreams match your search" with no pills visible to clear the filter. User is trapped.
- **Root cause:** `activePill` state persists across tab switches, but `symbolPills` is recomputed from the current dream list on each render. After deletions reduce a symbol's count below 4, the pill disappears from `symbolPills` but `activePill` still holds the stale value. The `filteredDreams` memo applies the stale pill filter, returns zero results, and the empty state renders without any visible pill to tap to clear.
- **Fix:** Added a `useEffect` in `GrimoireScreen.tsx` that watches `activePill` and `symbolPills`. When `activePill` is set but no longer present in `symbolPills`, it resets `activePill` to `null`.
- **Files changed:** `src/screens/GrimoireScreen.tsx`
- **Regression test:** `e2e/grimoire-filter.test.ts`

### BUG-006: Dictionary Deep Link Crashes from ReadingScreen
- **Severity:** Medium — tapping Dictionary badge on symbol cards throws a navigation error
- **Status:** FIXED (2026-03-18)
- **Found by:** Manual testing
- **Steps to reproduce:**
  1. Open a dream reading (from Grimoire or after creating a new dream)
  2. Tap the "Dictionary" badge on any symbol card that links to the curated dictionary
- **Expected:** Navigate to Dictionary tab with the symbol name pre-filled in search
- **Actual:** Error: `The action 'NAVIGATE' with payload {"name":"Dictionary","params":{"search":"Lake"}} was not handled by any navigator`
- **Root cause:** `ReadingScreen` lives in the root Stack navigator, but `Dictionary` is inside the `MainTabs` tab navigator. `CommonActions.navigate` cannot reach across navigator boundaries — it only searches the current navigator and its parents, not nested children.
- **Fix:** Changed `navigateToDictionary()` in the `SymbolCard` component from `CommonActions.navigate` to `CommonActions.reset`, targeting `MainTabs > Dictionary` with the search param. This is the same pattern already used by `handleViewInGrimoire` in the same file.
- **Files changed:** `src/screens/ReadingScreen.tsx`

### BUG-007: Grimoire Filter Pills Text Unreadable
- **Severity:** Low — cosmetic issue, pills are too cramped to read comfortably
- **Status:** FIXED (2026-03-18)
- **Found by:** Manual testing
- **Steps to reproduce:**
  1. Open Grimoire tab with enough dreams to show symbol filter pills
  2. Observe the pill row
- **Expected:** Pill text is clearly readable with comfortable padding
- **Actual:** Text appears clipped and too small; vertical space is cramped
- **Root cause:** Style values were too tight: `maxHeight: 44`, `fontSize: 13`, `paddingVertical: 6`. On device, this combination clips text descenders and makes pills feel cramped.
- **Fix:** Increased `pillRow.maxHeight` to 52, `pillText.fontSize` to 14, `pill.paddingVertical` to 8, and added `alignItems: 'center'` to `pillRowContent` for proper vertical centering.
- **Files changed:** `src/screens/GrimoireScreen.tsx`

### BUG-008: Dream Images Not Loading for Premium Users
- **Severity:** Medium — premium feature (AI dream images) silently broken
- **Status:** FIXED (2026-03-18)
- **Found by:** Manual testing
- **Steps to reproduce:**
  1. Sign in as a premium user
  2. Create a new dream and submit for reading
  3. Observe the dream image placeholder animation
- **Expected:** AI-generated dream image appears after a short delay
- **Actual:** Placeholder animation plays indefinitely; image never loads
- **Root cause:** Two issues in the `generate-dream-image` edge function:
  1. The model was set to `gpt-image-1`, which is deprecated. The current model is `gpt-image-1.5`.
  2. The API request body was missing `response_format: "url"`, so the response may have defaulted to base64 encoding instead of a URL. The client code expects a URL.
- **Fix:** Updated `OPENAI_IMAGE_MODEL` to `"gpt-image-1.5"` and added `response_format: "url"` to the API request body.
- **Files changed:** `supabase/functions/generate-dream-image/index.ts`
