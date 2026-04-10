-- Migration: 021_security_hardening_round2.sql
-- Purpose: Fix remaining security gaps from audit round 2
-- Date: 2026-04-09
--
-- Fixes:
--   N1  - UPDATE/DELETE trigger functions need SECURITY DEFINER + SET search_path
--         (INSERT triggers were fixed in 020, but UPDATE and DELETE were missed)
--   N2  - Rate limiter bypass: soft-deleting dreams resets reading count
--   N3  - Rate limiter counts dreams, not readings (reading_log table)
--   N12 - Verify/add RLS policies on private.profiles_encrypted

BEGIN;

-- =============================================================================
-- N1a - profiles_view_update() → SECURITY DEFINER + SET search_path
-- =============================================================================
-- Last defined in migration 019 as plain SECURITY INVOKER (no explicit qualifier).
-- Must match the INSERT trigger pattern from 020: SECURITY DEFINER with
-- SET search_path to prevent search_path injection.
-- Full definition from 019 preserved including ai_consent column handling.

CREATE OR REPLACE FUNCTION public.profiles_view_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $function$
DECLARE
  _key text := private.get_encryption_key();
  _now timestamptz := timezone('utc'::text, now());
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

  UPDATE private.profiles_encrypted SET
    email_enc = CASE WHEN NEW.email IS NOT NULL THEN pgp_sym_encrypt(NEW.email, _key) END,
    display_name_enc = CASE WHEN NEW.display_name IS NOT NULL THEN pgp_sym_encrypt(NEW.display_name, _key) END,
    reading_count = NEW.reading_count,
    subscription_tier = NEW.subscription_tier,
    zodiac_sign_enc = CASE WHEN NEW.zodiac_sign IS NOT NULL THEN pgp_sym_encrypt(NEW.zodiac_sign, _key) END,
    gender_enc = CASE WHEN NEW.gender IS NOT NULL THEN pgp_sym_encrypt(NEW.gender, _key) END,
    age_range_enc = CASE WHEN NEW.age_range IS NOT NULL THEN pgp_sym_encrypt(NEW.age_range, _key) END,
    onboarding_completed = NEW.onboarding_completed,
    ai_consent_granted = NEW.ai_consent_granted,
    ai_consent_date = NEW.ai_consent_date,
    updated_at = _now
  WHERE id = OLD.id;
  NEW.updated_at := _now;
  RETURN NEW;
END;
$function$;


-- =============================================================================
-- N1b - profiles_view_delete() → SECURITY DEFINER + SET search_path
-- =============================================================================
-- Last defined in migration 012 as SECURITY INVOKER. Same treatment.

CREATE OR REPLACE FUNCTION profiles_view_delete() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
  DELETE FROM private.profiles_encrypted WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


-- =============================================================================
-- N1c - dreams_view_update() → SECURITY DEFINER + SET search_path
-- =============================================================================
-- Last defined in migration 017 as SECURITY INVOKER (added 'forgot' type).
-- Full definition preserved from 017.

CREATE OR REPLACE FUNCTION dreams_view_update() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  _key text := private.get_encryption_key();
  _now timestamptz := timezone('utc'::text, now());
  _dream_type text := COALESCE(NEW.dream_type, 'dream');
BEGIN
  IF _dream_type NOT IN ('dream', 'nightmare', 'forgot') THEN
    RAISE EXCEPTION 'Invalid dream_type: %. Must be dream, nightmare, or forgot.', _dream_type;
  END IF;

  UPDATE private.dreams_encrypted SET
    dream_text_enc = pgp_sym_encrypt(NEW.dream_text, _key),
    mood_enc = CASE WHEN NEW.mood IS NOT NULL THEN pgp_sym_encrypt(NEW.mood, _key) END,
    reading_enc = CASE WHEN NEW.reading IS NOT NULL THEN pgp_sym_encrypt(NEW.reading::text, _key) END,
    dream_type_enc = pgp_sym_encrypt(_dream_type, _key),
    updated_at = _now,
    deleted_at = NEW.deleted_at
  WHERE id = OLD.id;
  NEW.updated_at := _now;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- N1d - dreams_view_delete() → SECURITY DEFINER + SET search_path
-- =============================================================================
-- Last defined in migration 013 as SECURITY INVOKER. Same treatment.

CREATE OR REPLACE FUNCTION dreams_view_delete() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
  DELETE FROM private.dreams_encrypted WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


-- =============================================================================
-- N2/N3 - Rate limiter bypass fix: independent reading_log table
-- =============================================================================
-- The analyze-dream edge function currently counts dreams via SELECT through
-- the dreams view (which filters deleted_at IS NULL via RLS). This means:
--   1) Users can soft-delete dreams to reset their reading count
--   2) The count measures dreams created, not readings generated
--
-- Fix: Track readings in a separate table that is append-only for users.
-- The edge function should INSERT a row here on each successful reading,
-- and count from this table instead of from dreams.

CREATE TABLE IF NOT EXISTS private.reading_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient per-user count queries (used by rate limiter)
CREATE INDEX IF NOT EXISTS idx_reading_log_user_id ON private.reading_log(user_id);

-- Index for time-windowed rate limiting (e.g. "max N readings per day")
CREATE INDEX IF NOT EXISTS idx_reading_log_user_created
  ON private.reading_log(user_id, created_at DESC);

-- RLS: users can only see their own log entries
ALTER TABLE private.reading_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY reading_log_select ON private.reading_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY reading_log_insert ON private.reading_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policies: reading log is append-only for users.
-- Only service_role (edge functions) or postgres can modify/delete rows.

GRANT SELECT, INSERT ON private.reading_log TO authenticated, service_role;


-- =============================================================================
-- N12 - Ensure RLS policies exist on private.profiles_encrypted
-- =============================================================================
-- Migration 001 created SELECT and UPDATE policies on public.profiles.
-- Migration 012 moved the table to private.profiles_encrypted via
-- ALTER TABLE ... SET SCHEMA. PostgreSQL preserves RLS policies on schema
-- moves, so the original policies should still exist under their old names.
-- However, there were never INSERT or DELETE policies on profiles (001 only
-- created SELECT + UPDATE). We defensively ensure all needed policies exist.
--
-- Note: "CREATE POLICY IF NOT EXISTS" is not supported in all PostgreSQL
-- versions, so we use DROP IF EXISTS + CREATE for safety.

-- Ensure RLS is enabled (should already be, but defensive)
ALTER TABLE private.profiles_encrypted ENABLE ROW LEVEL SECURITY;

-- SELECT: users can only read their own profile
-- Drop old name from migration 001 if it exists, then create with consistent name
DROP POLICY IF EXISTS "Users can view own profile" ON private.profiles_encrypted;
DROP POLICY IF EXISTS "profiles_enc_select" ON private.profiles_encrypted;

CREATE POLICY "profiles_enc_select" ON private.profiles_encrypted
  FOR SELECT USING (auth.uid() = id);

-- UPDATE: users can only update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON private.profiles_encrypted;
DROP POLICY IF EXISTS "profiles_enc_update" ON private.profiles_encrypted;

CREATE POLICY "profiles_enc_update" ON private.profiles_encrypted
  FOR UPDATE USING (auth.uid() = id);

-- INSERT: needed for the signup trigger path (handle_new_user → view → trigger)
-- The INSERT trigger is SECURITY DEFINER so this policy is primarily for
-- direct authenticated access, which should be restricted to own row.
DROP POLICY IF EXISTS "profiles_enc_insert" ON private.profiles_encrypted;

CREATE POLICY "profiles_enc_insert" ON private.profiles_encrypted
  FOR INSERT WITH CHECK (auth.uid() = id);

-- DELETE: users can only delete their own profile
DROP POLICY IF EXISTS "profiles_enc_delete" ON private.profiles_encrypted;

CREATE POLICY "profiles_enc_delete" ON private.profiles_encrypted
  FOR DELETE USING (auth.uid() = id);

COMMIT;
