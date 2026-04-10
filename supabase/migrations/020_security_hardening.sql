-- Migration: 020_security_hardening.sql
-- Purpose: Fix security issues found during audit
-- Date: 2026-04-09
--
-- Fixes:
--   C1 - profiles_view_insert() must be SECURITY DEFINER with SET search_path
--   C2 - dreams_view_insert() must be SECURITY DEFINER with SET search_path
--   H5 - Add deleted_at IS NULL filter to dreams SELECT RLS policy
--   H6 - purge_deleted_dreams() needs SET search_path
--   M1 - Tighten GRANT ALL to specific privileges on encrypted tables
--   H4 - Make dream-images bucket private
--   M8 - Add check function that warns if dev encryption key is in use

BEGIN;

-- =============================================================================
-- C1 - profiles_view_insert() → SECURITY DEFINER with SET search_path
-- =============================================================================
-- Migration 019 reverted this to SECURITY INVOKER. Migration 014 originally
-- fixed it to SECURITY DEFINER to solve the signup bug (BUG-001). The function
-- must be SECURITY DEFINER so that handle_new_user() (fired by
-- supabase_auth_admin) can access private.profiles_encrypted. Adding
-- SET search_path prevents search_path injection attacks.
--
-- This is the full current definition from 019 with ai_consent columns,
-- only changing SECURITY INVOKER → SECURITY DEFINER + SET search_path.

CREATE OR REPLACE FUNCTION public.profiles_view_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $function$
DECLARE
  _key text := private.get_encryption_key();
  _now timestamptz := COALESCE(NEW.created_at, timezone('utc'::text, now()));
BEGIN
  -- Validate gender
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
    ai_consent_granted, ai_consent_date,
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
    COALESCE(NEW.ai_consent_granted, false),
    NEW.ai_consent_date,
    _now, _now
  );
  NEW.created_at := _now;
  NEW.updated_at := _now;
  NEW.reading_count := COALESCE(NEW.reading_count, 0);
  NEW.subscription_tier := COALESCE(NEW.subscription_tier, 'free');
  NEW.onboarding_completed := COALESCE(NEW.onboarding_completed, false);
  NEW.ai_consent_granted := COALESCE(NEW.ai_consent_granted, false);
  RETURN NEW;
END;
$function$;


-- =============================================================================
-- C2 - dreams_view_insert() → SECURITY DEFINER with SET search_path
-- =============================================================================
-- Migration 017 reverted this to SECURITY INVOKER when adding 'forgot' type.
-- Must be SECURITY DEFINER (same reasoning as C1 / BUG-001).
-- This is the full current definition from 017 (with 'forgot' support),
-- only changing SECURITY INVOKER → SECURITY DEFINER + SET search_path.

CREATE OR REPLACE FUNCTION dreams_view_insert() RETURNS TRIGGER AS $$
DECLARE
  _key text := private.get_encryption_key();
  _id uuid := COALESCE(NEW.id, uuid_generate_v4());
  _now timestamptz := COALESCE(NEW.created_at, now());
  _dream_type text := COALESCE(NEW.dream_type, 'dream');
BEGIN
  IF _dream_type NOT IN ('dream', 'nightmare', 'forgot') THEN
    RAISE EXCEPTION 'Invalid dream_type: %. Must be dream, nightmare, or forgot.', _dream_type;
  END IF;

  INSERT INTO private.dreams_encrypted (
    id, user_id, dream_text_enc, mood_enc,
    reading_enc, dream_type_enc, created_at, updated_at, deleted_at
  ) VALUES (
    _id,
    NEW.user_id,
    pgp_sym_encrypt(NEW.dream_text, _key),
    CASE WHEN NEW.mood IS NOT NULL THEN pgp_sym_encrypt(NEW.mood, _key) END,
    CASE WHEN NEW.reading IS NOT NULL THEN pgp_sym_encrypt(NEW.reading::text, _key) END,
    pgp_sym_encrypt(_dream_type, _key),
    _now, _now, NEW.deleted_at
  );
  NEW.id := _id;
  NEW.created_at := _now;
  NEW.updated_at := _now;
  NEW.dream_type := _dream_type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, private, extensions;


-- =============================================================================
-- H5 - Add deleted_at IS NULL filter to dreams SELECT RLS policy
-- =============================================================================
-- The current SELECT policy on private.dreams_encrypted only checks user_id.
-- Soft-deleted dreams should not be visible via the normal API. Adding
-- deleted_at IS NULL ensures they are filtered out at the RLS level.

DROP POLICY IF EXISTS "Users can view own data" ON private.dreams_encrypted;
DROP POLICY IF EXISTS "dreams_select_own" ON private.dreams_encrypted;

CREATE POLICY "dreams_select_own" ON private.dreams_encrypted
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);


-- =============================================================================
-- H6 - purge_deleted_dreams() needs SET search_path
-- =============================================================================
-- The function is SECURITY DEFINER but lacks SET search_path, making it
-- vulnerable to search_path injection. Recreate with SET search_path.
-- Keeping the full current definition from 018.

CREATE OR REPLACE FUNCTION purge_deleted_dreams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, extensions
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM private.dreams_encrypted
  WHERE id IN (
    SELECT id FROM private.dreams_encrypted
    WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days'
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE LOG 'purge_deleted_dreams: permanently deleted % dreams', deleted_count;
  END IF;

  RETURN deleted_count;
END;
$$;


-- =============================================================================
-- M1 - Tighten GRANT ALL to specific privileges on encrypted tables
-- =============================================================================
-- Migration 012 granted ALL on the encrypted tables. Revoke and re-grant only
-- the specific DML privileges needed (no TRUNCATE, REFERENCES, TRIGGER).

REVOKE ALL ON private.profiles_encrypted FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.profiles_encrypted TO authenticated, service_role;

REVOKE ALL ON private.dreams_encrypted FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.dreams_encrypted TO authenticated, service_role;


-- =============================================================================
-- H4 - Make dream-images bucket private
-- =============================================================================
-- The bucket was created as public in migration 011. Dream images should not
-- be publicly accessible without authentication. Update to private, drop the
-- public SELECT policy, and create an authenticated-only SELECT policy.

UPDATE storage.buckets
SET public = false
WHERE id = 'dream-images';

-- Drop the overly-permissive public read policy
DROP POLICY IF EXISTS "Public read access for dream images" ON storage.objects;

-- Create authenticated-only read policy scoped to user's own folder
CREATE POLICY "Authenticated users can read own dream images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'dream-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Note: INSERT, UPDATE, DELETE policies from migration 011 remain unchanged.
-- They already enforce auth.uid()::text = (storage.foldername(name))[1].


-- =============================================================================
-- M8 - Dev encryption key detection function
-- =============================================================================
-- Callable manually during deploy verification to ensure the production
-- database is not using the dev-only encryption key.

CREATE OR REPLACE FUNCTION private.check_encryption_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private
AS $$
DECLARE
  _key text;
BEGIN
  SELECT value INTO _key
  FROM private.encryption_config
  WHERE key = 'encryption_key';

  IF _key IS NULL THEN
    RETURN 'CRITICAL: No encryption key found in private.encryption_config!';
  END IF;

  IF _key = 'dev-only-encryption-key-32chars!' THEN
    RETURN 'WARNING: Database is using the dev-only encryption key. '
           'Update private.encryption_config before going to production. '
           'Run: UPDATE private.encryption_config SET value = ''YOUR-PRODUCTION-KEY'' '
           'WHERE key = ''encryption_key'';';
  END IF;

  RETURN 'OK: Encryption key is set and is not the default dev key.';
END;
$$;

-- Only postgres and service_role should call this (no need for authenticated)
GRANT EXECUTE ON FUNCTION private.check_encryption_key() TO service_role;

COMMIT;
