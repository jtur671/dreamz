-- Migration: 023_security_hardening_round4.sql
-- Purpose: Fix security issues from audit round 4
-- Date: 2026-04-09
--
-- Fixes:
--   N-PURGE-GRANTS (HIGH) - purge_deleted_dreams() callable by any authenticated
--                            user. Revoke and restrict to service_role only.
--   N-TIER-INSERT (MEDIUM) - profiles_view_insert() accepts client-supplied
--                            subscription_tier and reading_count. Hardcode safe
--                            defaults so clients cannot escalate on signup.
--   N-CONSENT-DATE (LOW)   - ai_consent_date is client-writable. Set it
--                            server-side based on consent state transitions.
--   N-SEARCHPATH (LOW)     - Drop orphaned update_updated_at_column() function
--                            (triggers removed in 012, function left behind).

BEGIN;

-- =============================================================================
-- N-PURGE-GRANTS (HIGH) - Revoke public access to purge_deleted_dreams()
-- =============================================================================
-- This SECURITY DEFINER function deletes from private.dreams_encrypted and
-- was callable by any authenticated user, allowing mass-deletion of all
-- users' soft-deleted dreams. Restrict to service_role (pg_cron runs as
-- postgres which is superuser, so it is unaffected by REVOKE).

REVOKE ALL ON FUNCTION public.purge_deleted_dreams() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_deleted_dreams() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_deleted_dreams() TO service_role;


-- =============================================================================
-- N-TIER-INSERT (MEDIUM) - Hardcode subscription_tier and reading_count on insert
-- =============================================================================
-- The profiles_view_insert() trigger (last defined in 020) copies
-- NEW.subscription_tier and NEW.reading_count from the client. A malicious
-- client could set subscription_tier = 'premium' or reading_count = -999
-- on signup. Hardcode both to safe defaults.
--
-- Full definition from 020 preserved with SECURITY DEFINER + SET search_path.
-- Only changes: subscription_tier always 'free', reading_count always 0.

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
    0,                                    -- never accept client value
    'free',                               -- never accept client value
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
  NEW.reading_count := 0;                -- reflect hardcoded value back
  NEW.subscription_tier := 'free';       -- reflect hardcoded value back
  NEW.onboarding_completed := COALESCE(NEW.onboarding_completed, false);
  NEW.ai_consent_granted := COALESCE(NEW.ai_consent_granted, false);
  RETURN NEW;
END;
$function$;


-- =============================================================================
-- N-CONSENT-DATE (LOW) - Server-set ai_consent_date in profiles_view_update()
-- =============================================================================
-- The ai_consent_date was client-writable via NEW.ai_consent_date. A client
-- could backdate or forge consent timestamps. Fix: derive the date from the
-- consent state transition (grant → set now(), revoke → clear, no change →
-- preserve existing).
--
-- Full definition from 022 preserved with SECURITY DEFINER + SET search_path
-- + OLD.subscription_tier + OLD.reading_count. Only ai_consent_date changed.

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
    reading_count = OLD.reading_count,              -- immutable from client
    subscription_tier = OLD.subscription_tier,      -- immutable from client
    zodiac_sign_enc = CASE WHEN NEW.zodiac_sign IS NOT NULL THEN pgp_sym_encrypt(NEW.zodiac_sign, _key) END,
    gender_enc = CASE WHEN NEW.gender IS NOT NULL THEN pgp_sym_encrypt(NEW.gender, _key) END,
    age_range_enc = CASE WHEN NEW.age_range IS NOT NULL THEN pgp_sym_encrypt(NEW.age_range, _key) END,
    onboarding_completed = NEW.onboarding_completed,
    ai_consent_granted = NEW.ai_consent_granted,
    ai_consent_date = CASE
      WHEN NEW.ai_consent_granted = true AND OLD.ai_consent_granted = false
      THEN timezone('utc'::text, now())             -- set on grant
      WHEN NEW.ai_consent_granted = false
      THEN NULL                                     -- clear on revoke
      ELSE OLD.ai_consent_date                      -- preserve existing
    END,
    updated_at = _now
  WHERE id = OLD.id;
  NEW.updated_at := _now;
  RETURN NEW;
END;
$function$;


-- =============================================================================
-- N-SEARCHPATH (LOW) - Drop orphaned update_updated_at_column()
-- =============================================================================
-- Created in migration 001 for update_profiles_updated_at and
-- update_dreams_updated_at triggers. Both triggers were dropped in migration
-- 012 when tables moved to the private schema (view triggers handle
-- updated_at now). The function has been orphaned since then.

DROP FUNCTION IF EXISTS public.update_updated_at_column();

COMMIT;
