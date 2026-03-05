-- Migration: Fix search_path for trigger functions (BUG-001 final fix)
--
-- The EXCEPTION handler in migration 015 revealed the actual PostgreSQL error:
--   "function pgp_sym_encrypt(character varying, text) does not exist"
--
-- Root cause: SECURITY DEFINER functions inherit the CALLER's search_path if
-- no SET search_path is specified. When handle_new_user() fires in the
-- supabase_auth_admin session (used by Supabase Auth / GoTrue), that session's
-- search_path does NOT include the 'extensions' schema where pgcrypto lives.
-- PostgreSQL cannot find pgp_sym_encrypt, so it throws "does not exist".
--
-- Note: auth.users.email is character varying (not text), which also requires
-- an explicit cast since pgp_sym_encrypt only has text/bytea overloads.
--
-- Fix: Explicitly set search_path in all affected SECURITY DEFINER functions
-- and cast varchar → text where needed. This is also the Supabase-recommended
-- hardening for SECURITY DEFINER functions (prevents search_path injection).
--
-- Diagnosed by Claude Code, 2026-02-21. See docs/BUGS.md BUG-001.

BEGIN;

-- ============================================================================
-- Final version of handle_new_user() with correct search_path and type cast
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _key text;
BEGIN
  _key := private.get_encryption_key();

  INSERT INTO private.profiles_encrypted (
    id,
    email_enc,
    reading_count,
    subscription_tier,
    onboarding_completed,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    CASE WHEN new.email IS NOT NULL
      THEN pgp_sym_encrypt(new.email::text, _key)  -- cast varchar → text
    END,
    0,
    'free',
    false,
    now(),
    now()
  );

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'handle_new_user() failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, extensions, private;  -- ensures pgcrypto is findable

-- ============================================================================
-- Harden private.get_encryption_key() with explicit search_path too
-- ============================================================================
CREATE OR REPLACE FUNCTION private.get_encryption_key()
RETURNS text AS $$
  SELECT value FROM private.encryption_config WHERE key = 'encryption_key';
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = private;  -- only needs private schema

-- Re-grant after replace (CREATE OR REPLACE preserves grants but be explicit)
GRANT EXECUTE ON FUNCTION private.get_encryption_key() TO authenticated, service_role, supabase_auth_admin;

COMMIT;
