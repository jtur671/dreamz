-- Migration: Fix new user sign-up trigger (BUG-001)
--
-- Root cause: profiles_view_insert() and dreams_view_insert() were declared
-- SECURITY INVOKER. When handle_new_user() (SECURITY DEFINER, owner=postgres)
-- runs inside a supabase_auth_admin session and does INSERT INTO public.profiles,
-- the INSTEAD OF trigger fires. In Supabase's hosted PostgreSQL environment the
-- effective role for SECURITY INVOKER triggers resolves to supabase_auth_admin
-- (the session_user) rather than the DEFINER context's current_user (postgres).
--
-- supabase_auth_admin has no USAGE on the private schema and no access to
-- private.profiles_encrypted, causing the INSERT to fail with:
--   "Database error saving new user"
--
-- Fix: re-create both INSTEAD OF INSERT triggers as SECURITY DEFINER so they
-- always execute as their owner (postgres), which has full access.
-- Also add explicit grants for supabase_auth_admin as belt-and-suspenders.
--
-- Safe to re-run: all statements are idempotent (CREATE OR REPLACE / GRANT).
--
-- Diagnosed by Claude Code, 2026-02-21. See docs/BUGS.md BUG-001.

BEGIN;

-- ============================================================================
-- 1. Grant supabase_auth_admin access to the private schema
--    Belt-and-suspenders: covers any remaining SECURITY INVOKER path.
-- ============================================================================
GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON private.profiles_encrypted TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON private.dreams_encrypted  TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.get_encryption_key()    TO supabase_auth_admin;

-- ============================================================================
-- 2. Re-create profiles INSTEAD OF INSERT trigger as SECURITY DEFINER
--    SECURITY DEFINER ensures the function always runs as its owner (postgres),
--    regardless of the calling session role.
-- ============================================================================
CREATE OR REPLACE FUNCTION profiles_view_insert() RETURNS TRIGGER AS $$
DECLARE
  _key text := private.get_encryption_key();
  _now timestamptz := COALESCE(NEW.created_at, timezone('utc'::text, now()));
BEGIN
  -- Validate gender (replaces CHECK constraint lost from column drop)
  IF NEW.gender IS NOT NULL AND NEW.gender NOT IN (
    'female', 'male', 'non-binary', 'genderfluid', 'genderqueer', 'agender', 'two-spirit', 'prefer-not-to-say'
  ) THEN
    RAISE EXCEPTION 'Invalid gender: %', NEW.gender;
  END IF;

  -- Validate age_range
  IF NEW.age_range IS NOT NULL AND NEW.age_range NOT IN (
    '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
  ) THEN
    RAISE EXCEPTION 'Invalid age_range: %', NEW.age_range;
  END IF;

  INSERT INTO private.profiles_encrypted (
    id, email_enc, display_name_enc, reading_count, subscription_tier,
    zodiac_sign_enc, gender_enc, age_range_enc, onboarding_completed,
    created_at, updated_at
  ) VALUES (
    NEW.id,
    CASE WHEN NEW.email IS NOT NULL THEN pgp_sym_encrypt(NEW.email, _key) END,
    CASE WHEN NEW.display_name IS NOT NULL THEN pgp_sym_encrypt(NEW.display_name, _key) END,
    COALESCE(NEW.reading_count, 0),
    COALESCE(NEW.subscription_tier, 'free'),
    CASE WHEN NEW.zodiac_sign IS NOT NULL THEN pgp_sym_encrypt(NEW.zodiac_sign, _key) END,
    CASE WHEN NEW.gender IS NOT NULL THEN pgp_sym_encrypt(NEW.gender, _key) END,
    CASE WHEN NEW.age_range IS NOT NULL THEN pgp_sym_encrypt(NEW.age_range, _key) END,
    COALESCE(NEW.onboarding_completed, false),
    _now, _now
  );
  NEW.created_at := _now;
  NEW.updated_at := _now;
  NEW.reading_count := COALESCE(NEW.reading_count, 0);
  NEW.subscription_tier := COALESCE(NEW.subscription_tier, 'free');
  NEW.onboarding_completed := COALESCE(NEW.onboarding_completed, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;   -- ← was SECURITY INVOKER

-- ============================================================================
-- 3. Re-create dreams INSTEAD OF INSERT trigger as SECURITY DEFINER
--    Same rationale: any INSERT on the dreams view from the auth context would
--    fail if SECURITY INVOKER resolved to supabase_auth_admin.
-- ============================================================================
CREATE OR REPLACE FUNCTION dreams_view_insert() RETURNS TRIGGER AS $$
DECLARE
  _key text := private.get_encryption_key();
  _id uuid := COALESCE(NEW.id, uuid_generate_v4());
  _now timestamptz := COALESCE(NEW.created_at, now());
  _dream_type text := COALESCE(NEW.dream_type, 'dream');
BEGIN
  -- Validate dream_type (replaces CHECK constraint lost from column drop)
  IF _dream_type NOT IN ('dream', 'nightmare') THEN
    RAISE EXCEPTION 'Invalid dream_type: %. Must be dream or nightmare.', _dream_type;
  END IF;

  INSERT INTO private.dreams_encrypted (
    id, user_id, dream_text_enc, mood_enc, emotions_enc,
    reading_enc, dream_type_enc, created_at, updated_at, deleted_at
  ) VALUES (
    _id,
    NEW.user_id,
    pgp_sym_encrypt(NEW.dream_text, _key),
    CASE WHEN NEW.mood IS NOT NULL THEN pgp_sym_encrypt(NEW.mood, _key) END,
    CASE WHEN NEW.emotions IS NOT NULL THEN pgp_sym_encrypt(NEW.emotions::text, _key) END,
    CASE WHEN NEW.reading IS NOT NULL THEN pgp_sym_encrypt(NEW.reading::text, _key) END,
    pgp_sym_encrypt(_dream_type, _key),
    _now, _now, NEW.deleted_at
  );
  -- Set RETURNING values
  NEW.id := _id;
  NEW.created_at := _now;
  NEW.updated_at := _now;
  NEW.dream_type := _dream_type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;   -- ← was SECURITY INVOKER

-- ============================================================================
-- 4. Verify the encryption key is present (failsafe)
--    This will RAISE if the key is missing, making migration fail loudly rather
--    than silently producing NULL-key encryption errors at runtime.
-- ============================================================================
DO $$
DECLARE
  _key text;
BEGIN
  SELECT private.get_encryption_key() INTO _key;
  IF _key IS NULL OR length(_key) = 0 THEN
    RAISE EXCEPTION 'BUG: private.encryption_config is empty. Insert the key before deploying.';
  END IF;
END $$;

COMMIT;
