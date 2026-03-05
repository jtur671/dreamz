-- Migration: Rewrite handle_new_user() to bypass the view/trigger chain (BUG-001 follow-up)
--
-- Migration 014 changed profiles_view_insert() to SECURITY DEFINER and added
-- grants for supabase_auth_admin, but sign-up still fails. The remaining issue
-- is in the path:
--
--   supabase_auth_admin → auth.users INSERT
--     → on_auth_user_created trigger → handle_new_user() (SECURITY DEFINER, postgres)
--     → INSERT INTO public.profiles  ← this fires profiles_view_insert_trigger
--     → profiles_view_insert() (SECURITY DEFINER after mig-014) → ...
--
-- Despite the SECURITY DEFINER on profiles_view_insert(), the interaction with
-- the view's security_invoker=true option and the supabase_auth_admin session
-- context may still cause privilege checks to fail in Supabase's hosted PG.
--
-- Fix: Rewrite handle_new_user() to insert DIRECTLY into private.profiles_encrypted,
-- bypassing the view and its INSTEAD OF trigger entirely. Since handle_new_user()
-- is SECURITY DEFINER (owner=postgres, which owns the private schema), this is
-- the shortest and most reliable path.
--
-- The view (public.profiles) and its triggers remain in place for all other
-- INSERT operations from app code (saveDream, updateProfile, etc.), which run
-- as the authenticated or service_role user and go through the view normally.
--
-- Diagnosed by Claude Code, 2026-02-21. See docs/BUGS.md BUG-001.

BEGIN;

-- ============================================================================
-- Rewrite handle_new_user() to directly insert into private.profiles_encrypted
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _key text;
BEGIN
  -- Retrieve encryption key. This call is safe: get_encryption_key() is
  -- SECURITY DEFINER (owner=postgres) and handle_new_user() is also
  -- SECURITY DEFINER (owner=postgres), so both run with postgres privileges.
  _key := private.get_encryption_key();

  -- Insert directly into the encrypted table, bypassing the view/INSTEAD OF
  -- trigger chain entirely. This removes all intermediate privilege questions.
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
      THEN pgp_sym_encrypt(new.email, _key)
    END,
    0,
    'free',
    false,
    now(),
    now()
  );

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Surface the real PostgreSQL error through Supabase Auth's opaque
  -- "Database error saving new user" wrapper so we can diagnose it.
  RAISE EXCEPTION 'handle_new_user() failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
