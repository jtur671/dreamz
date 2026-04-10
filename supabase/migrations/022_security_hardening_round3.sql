-- Migration: 022_security_hardening_round3.sql
-- Purpose: Fix critical security issues from audit round 3
-- Date: 2026-04-09
--
-- Fixes:
--   C-RATE - Rate limiter broken: private schema not exposed via PostgREST.
--            Create public view + RPC for reading_log access.
--   C-TIER - subscription_tier and reading_count are client-writable via
--            profiles_view_update(). Lock both to OLD values.
--   C-RLS  - Missing INSERT/UPDATE/DELETE policies on private.dreams_encrypted.
--   C-DEL  - delete-account misses soft-deleted dreams. Add helper RPC.
--   M1     - reading_log INSERT grant to authenticated is unnecessary.

BEGIN;

-- =============================================================================
-- C-RATE - Rate limiter broken: private.reading_log not queryable via PostgREST
-- =============================================================================
-- The analyze-dream edge function queries private.reading_log via
-- { db: { schema: "private" } } but PostgREST only exposes public and
-- graphql_public schemas. Queries silently return empty results, so the
-- rate limiter never fires.
--
-- Fix: Create a public view (security_invoker so RLS applies) for reading
-- the count, and an RPC function for inserting (service_role only).

CREATE VIEW public.reading_log WITH (security_invoker = true) AS
SELECT id, user_id, created_at FROM private.reading_log;

-- Grant SELECT only (no INSERT/UPDATE/DELETE through the view)
GRANT SELECT ON public.reading_log TO authenticated, service_role;

-- RPC function for inserting a reading log entry (service_role only, called by edge function)
CREATE OR REPLACE FUNCTION public.log_reading(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private
AS $$
BEGIN
  INSERT INTO private.reading_log (user_id) VALUES (p_user_id);
END;
$$;

-- Only service_role can call this
REVOKE ALL ON FUNCTION public.log_reading(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_reading(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_reading(uuid) TO service_role;


-- =============================================================================
-- C-TIER / M2 - subscription_tier and reading_count are client-writable
-- =============================================================================
-- The profiles_view_update() trigger (last defined in 021) blindly copies
-- NEW.subscription_tier and NEW.reading_count, allowing any authenticated
-- user to PATCH themselves to premium or reset their reading count.
--
-- Fix: Always use OLD values for these two fields, ignoring whatever the
-- client sends. Only server-side processes (edge functions using
-- service_role with direct table access) can modify these fields.
--
-- Full definition preserved from 021 with SECURITY DEFINER + SET search_path,
-- only changing the two field assignments to use OLD instead of NEW.

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
    ai_consent_date = NEW.ai_consent_date,
    updated_at = _now
  WHERE id = OLD.id;
  NEW.updated_at := _now;
  RETURN NEW;
END;
$function$;


-- =============================================================================
-- C-RLS - Missing INSERT/UPDATE/DELETE policies on private.dreams_encrypted
-- =============================================================================
-- Migration 020 only created a SELECT policy (dreams_select_own with
-- deleted_at IS NULL filter). The original INSERT/UPDATE/DELETE policies
-- from migration 001 were renamed "Users can ..." and moved with the table
-- in migration 012, but they may have been dropped or may not exist.
-- Defensively drop-and-recreate to ensure all four policies exist.

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert own data" ON private.dreams_encrypted;
DROP POLICY IF EXISTS "dreams_enc_insert" ON private.dreams_encrypted;

CREATE POLICY "dreams_enc_insert" ON private.dreams_encrypted
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update own data" ON private.dreams_encrypted;
DROP POLICY IF EXISTS "dreams_enc_update" ON private.dreams_encrypted;

CREATE POLICY "dreams_enc_update" ON private.dreams_encrypted
  FOR UPDATE USING (auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete own data" ON private.dreams_encrypted;
DROP POLICY IF EXISTS "dreams_enc_delete" ON private.dreams_encrypted;

CREATE POLICY "dreams_enc_delete" ON private.dreams_encrypted
  FOR DELETE USING (auth.uid() = user_id);


-- =============================================================================
-- C-DEL - delete-account misses soft-deleted dreams
-- =============================================================================
-- The delete-account edge function deletes via the public.dreams view, but
-- RLS on the underlying table filters out soft-deleted rows (deleted_at IS
-- NOT NULL). This means soft-deleted dreams survive account deletion.
--
-- Fix: Add a SECURITY DEFINER RPC that bypasses RLS to delete ALL dreams
-- for a user, including soft-deleted ones. Only callable by service_role.

CREATE OR REPLACE FUNCTION public.delete_all_user_dreams(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private
AS $$
BEGIN
  DELETE FROM private.dreams_encrypted WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_all_user_dreams(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_all_user_dreams(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_all_user_dreams(uuid) TO service_role;


-- =============================================================================
-- M1 - reading_log INSERT grant to authenticated is unnecessary
-- =============================================================================
-- Migration 021 granted SELECT + INSERT on private.reading_log to
-- authenticated. The INSERT is unnecessary because authenticated users
-- should not write directly to the reading_log; the edge function uses
-- service_role via the public.log_reading() RPC instead.
-- Also drop the INSERT RLS policy which is no longer needed.

REVOKE INSERT ON private.reading_log FROM authenticated;
DROP POLICY IF EXISTS reading_log_insert ON private.reading_log;

COMMIT;
