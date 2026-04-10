-- Migration: 025_fix_dreams_insert_impersonation.sql
-- Purpose: Fix critical cross-user impersonation in dreams_view_insert()
-- Date: 2026-04-10
--
-- Bug caught by e2e test SEC-RLS004:
--
--   Migration 020 made dreams_view_insert() SECURITY DEFINER so the trigger
--   can write to private.dreams_encrypted (which is restricted to the owning
--   role). But the function passes NEW.user_id straight through to the
--   INSERT without validating it against auth.uid(). Because SECURITY DEFINER
--   runs as the function owner (postgres, a superuser), the RLS policy
--   `WITH CHECK (auth.uid() = user_id)` on private.dreams_encrypted is
--   bypassed entirely.
--
--   Result: any authenticated user can POST /rest/v1/dreams with
--   `user_id: <victim_uuid>` and a dream row will be written into the
--   victim's journal. They cannot read it back (SELECT RLS is still
--   security_invoker via the view), but they can pollute another user's
--   Grimoire with arbitrary content.
--
--   The UPDATE and DELETE triggers are NOT affected: they operate on
--   `WHERE id = OLD.id`, and OLD is populated from the view's SELECT pass,
--   which IS subject to RLS via security_invoker = true on the view. A
--   user cannot "see" another user's dream row, so cannot target it.
--
-- Fix: Validate inside the SECURITY DEFINER function that NEW.user_id
-- matches the caller's auth.uid(). auth.uid() reads the JWT claim from
-- the session, not the role, so it still returns the real caller even
-- inside a DEFINER function.

BEGIN;

CREATE OR REPLACE FUNCTION dreams_view_insert() RETURNS TRIGGER AS $$
DECLARE
  _key text := private.get_encryption_key();
  _id uuid := COALESCE(NEW.id, uuid_generate_v4());
  _now timestamptz := COALESCE(NEW.created_at, now());
  _dream_type text := COALESCE(NEW.dream_type, 'dream');
  _uid uuid := auth.uid();
BEGIN
  -- SECURITY: Prevent cross-user impersonation. SECURITY DEFINER bypasses
  -- RLS on the underlying table, so user_id must be validated here.
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_id IS NOT NULL AND NEW.user_id <> _uid THEN
    RAISE EXCEPTION 'Cannot insert dream for another user' USING ERRCODE = '42501';
  END IF;

  IF _dream_type NOT IN ('dream', 'nightmare', 'forgot') THEN
    RAISE EXCEPTION 'Invalid dream_type: %. Must be dream, nightmare, or forgot.', _dream_type;
  END IF;

  INSERT INTO private.dreams_encrypted (
    id, user_id, dream_text_enc, mood_enc,
    reading_enc, dream_type_enc, created_at, updated_at, deleted_at
  ) VALUES (
    _id,
    _uid,
    pgp_sym_encrypt(NEW.dream_text, _key),
    CASE WHEN NEW.mood IS NOT NULL THEN pgp_sym_encrypt(NEW.mood, _key) END,
    CASE WHEN NEW.reading IS NOT NULL THEN pgp_sym_encrypt(NEW.reading::text, _key) END,
    pgp_sym_encrypt(_dream_type, _key),
    _now, _now, NEW.deleted_at
  );
  NEW.id := _id;
  NEW.user_id := _uid;
  NEW.created_at := _now;
  NEW.updated_at := _now;
  NEW.dream_type := _dream_type;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, private, extensions;

COMMIT;
