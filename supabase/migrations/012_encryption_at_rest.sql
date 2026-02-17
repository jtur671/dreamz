-- Migration: Encryption at Rest for User Data
--
-- Encrypts all sensitive columns in dreams and profiles tables using pgcrypto.
-- Uses PostgreSQL views + INSTEAD OF triggers so that all existing client code,
-- edge functions, and RLS policies continue to work transparently.
--
-- Key storage: private.encryption_config table + SECURITY DEFINER accessor function.
-- The key is NOT stored as a GUC (which Supabase hosted doesn't allow setting).
-- The key table lives in the 'private' schema (not exposed by PostgREST).
--
-- To change the key for production, UPDATE private.encryption_config directly
-- via Supabase SQL Editor BEFORE deploying. Then re-encrypt existing data.
--
-- Security measures:
--   - Views use security_invoker=true so RLS is enforced against the calling user
--   - Encrypted tables in 'private' schema (not exposed by PostgREST)
--   - Key stored in private table with SECURITY DEFINER accessor (not queryable via API)
--   - Only authenticated and service_role get view access (no anon)
--   - CHECK constraints enforced in trigger functions
--   - Nullable columns wrapped in CASE to prevent pgp_sym_decrypt(NULL) crash

BEGIN;

-- 1. Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create private schema (not exposed by PostgREST)
CREATE SCHEMA IF NOT EXISTS private;

-- 3. Create encryption key storage table
-- Only postgres (table owner) can read/write this directly.
CREATE TABLE private.encryption_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Insert dev key (for production: UPDATE this row via SQL Editor before deploying)
INSERT INTO private.encryption_config (key, value)
VALUES ('encryption_key', 'dev-only-encryption-key-32chars!');

-- No grants to anon/authenticated/service_role — only postgres can access directly.
-- Revoke any default grants just to be safe.
REVOKE ALL ON private.encryption_config FROM anon, authenticated, service_role;

-- 4. Create SECURITY DEFINER accessor function
-- This runs as postgres (the owner) so it can read the private table,
-- regardless of who calls it. It lives in the private schema so PostgREST
-- does NOT expose it as an RPC endpoint.
CREATE OR REPLACE FUNCTION private.get_encryption_key() RETURNS text AS $$
  SELECT value FROM private.encryption_config WHERE key = 'encryption_key';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant EXECUTE to roles that use the views/triggers (but NOT direct table access)
GRANT EXECUTE ON FUNCTION private.get_encryption_key() TO authenticated, service_role;

-- =============================================================================
-- DREAMS TABLE
-- =============================================================================

-- 5a. Drop the BEFORE UPDATE trigger (we handle updated_at in INSTEAD OF triggers)
DROP TRIGGER IF EXISTS update_dreams_updated_at ON dreams;

-- 5b. Move table to private schema and rename
ALTER TABLE public.dreams SET SCHEMA private;
ALTER TABLE private.dreams RENAME TO dreams_encrypted;

-- Indexes and RLS policies automatically follow the table.

-- 6. Add encrypted columns
ALTER TABLE private.dreams_encrypted ADD COLUMN dream_text_enc bytea;
ALTER TABLE private.dreams_encrypted ADD COLUMN mood_enc bytea;
ALTER TABLE private.dreams_encrypted ADD COLUMN emotions_enc bytea;
ALTER TABLE private.dreams_encrypted ADD COLUMN reading_enc bytea;
ALTER TABLE private.dreams_encrypted ADD COLUMN dream_type_enc bytea;

-- 7. Encrypt existing data
UPDATE private.dreams_encrypted SET
  dream_text_enc = pgp_sym_encrypt(dream_text, private.get_encryption_key()),
  mood_enc = CASE WHEN mood IS NOT NULL
    THEN pgp_sym_encrypt(mood, private.get_encryption_key())
  END,
  emotions_enc = CASE WHEN emotions IS NOT NULL
    THEN pgp_sym_encrypt(emotions::text, private.get_encryption_key())
  END,
  reading_enc = CASE WHEN reading IS NOT NULL
    THEN pgp_sym_encrypt(reading::text, private.get_encryption_key())
  END,
  dream_type_enc = pgp_sym_encrypt(COALESCE(dream_type, 'dream'), private.get_encryption_key());

-- 8. Drop plaintext columns (CHECK constraints drop automatically with the column)
ALTER TABLE private.dreams_encrypted DROP COLUMN dream_text;
ALTER TABLE private.dreams_encrypted DROP COLUMN mood;
ALTER TABLE private.dreams_encrypted DROP COLUMN emotions;
ALTER TABLE private.dreams_encrypted DROP COLUMN reading;
ALTER TABLE private.dreams_encrypted DROP COLUMN dream_type;

-- 9. Enforce NOT NULL on required encrypted columns
ALTER TABLE private.dreams_encrypted ALTER COLUMN dream_text_enc SET NOT NULL;
ALTER TABLE private.dreams_encrypted ALTER COLUMN dream_type_enc SET NOT NULL;

-- 10. Grant private schema access to roles that need it (for view internals only)
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT ALL ON private.dreams_encrypted TO authenticated, service_role;

-- 11. Create dreams VIEW (auto-decrypts on SELECT)
-- security_invoker = true ensures RLS on the underlying table is checked against
-- the calling user (e.g. 'authenticated'), NOT the view owner (postgres/superuser).
CREATE VIEW public.dreams WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  -- dream_text_enc and dream_type_enc are NOT NULL, safe to decrypt directly
  pgp_sym_decrypt(dream_text_enc, private.get_encryption_key()) AS dream_text,
  -- Nullable columns MUST use CASE to avoid pgp_sym_decrypt(NULL) crash
  CASE WHEN mood_enc IS NOT NULL
    THEN pgp_sym_decrypt(mood_enc, private.get_encryption_key())
  END AS mood,
  CASE WHEN emotions_enc IS NOT NULL
    THEN pgp_sym_decrypt(emotions_enc, private.get_encryption_key())::text[]
  END AS emotions,
  CASE WHEN reading_enc IS NOT NULL
    THEN pgp_sym_decrypt(reading_enc, private.get_encryption_key())::jsonb
  END AS reading,
  pgp_sym_decrypt(dream_type_enc, private.get_encryption_key()) AS dream_type,
  created_at,
  updated_at,
  deleted_at
FROM private.dreams_encrypted;

-- Only authenticated users and service_role can access (no anon)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dreams TO authenticated, service_role;

-- 12. INSTEAD OF INSERT trigger for dreams view
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
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER dreams_view_insert_trigger
  INSTEAD OF INSERT ON public.dreams
  FOR EACH ROW EXECUTE FUNCTION dreams_view_insert();

-- 13. INSTEAD OF UPDATE trigger for dreams view
CREATE OR REPLACE FUNCTION dreams_view_update() RETURNS TRIGGER AS $$
DECLARE
  _key text := private.get_encryption_key();
  _now timestamptz := timezone('utc'::text, now());
  _dream_type text := COALESCE(NEW.dream_type, 'dream');
BEGIN
  -- Validate dream_type
  IF _dream_type NOT IN ('dream', 'nightmare') THEN
    RAISE EXCEPTION 'Invalid dream_type: %. Must be dream or nightmare.', _dream_type;
  END IF;

  UPDATE private.dreams_encrypted SET
    dream_text_enc = pgp_sym_encrypt(NEW.dream_text, _key),
    mood_enc = CASE WHEN NEW.mood IS NOT NULL THEN pgp_sym_encrypt(NEW.mood, _key) END,
    emotions_enc = CASE WHEN NEW.emotions IS NOT NULL THEN pgp_sym_encrypt(NEW.emotions::text, _key) END,
    reading_enc = CASE WHEN NEW.reading IS NOT NULL THEN pgp_sym_encrypt(NEW.reading::text, _key) END,
    dream_type_enc = pgp_sym_encrypt(_dream_type, _key),
    updated_at = _now,
    deleted_at = NEW.deleted_at
  WHERE id = OLD.id;
  NEW.updated_at := _now;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER dreams_view_update_trigger
  INSTEAD OF UPDATE ON public.dreams
  FOR EACH ROW EXECUTE FUNCTION dreams_view_update();

-- 14. INSTEAD OF DELETE trigger for dreams view
CREATE OR REPLACE FUNCTION dreams_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM private.dreams_encrypted WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER dreams_view_delete_trigger
  INSTEAD OF DELETE ON public.dreams
  FOR EACH ROW EXECUTE FUNCTION dreams_view_delete();

-- =============================================================================
-- PROFILES TABLE
-- =============================================================================

-- 15a. Drop the BEFORE UPDATE trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- 15b. Move to private schema and rename
ALTER TABLE public.profiles SET SCHEMA private;
ALTER TABLE private.profiles RENAME TO profiles_encrypted;

-- 16. Add encrypted columns
ALTER TABLE private.profiles_encrypted ADD COLUMN email_enc bytea;
ALTER TABLE private.profiles_encrypted ADD COLUMN display_name_enc bytea;
ALTER TABLE private.profiles_encrypted ADD COLUMN zodiac_sign_enc bytea;
ALTER TABLE private.profiles_encrypted ADD COLUMN gender_enc bytea;
ALTER TABLE private.profiles_encrypted ADD COLUMN age_range_enc bytea;

-- 17. Encrypt existing data
UPDATE private.profiles_encrypted SET
  email_enc = CASE WHEN email IS NOT NULL
    THEN pgp_sym_encrypt(email, private.get_encryption_key())
  END,
  display_name_enc = CASE WHEN display_name IS NOT NULL
    THEN pgp_sym_encrypt(display_name, private.get_encryption_key())
  END,
  zodiac_sign_enc = CASE WHEN zodiac_sign IS NOT NULL
    THEN pgp_sym_encrypt(zodiac_sign, private.get_encryption_key())
  END,
  gender_enc = CASE WHEN gender IS NOT NULL
    THEN pgp_sym_encrypt(gender, private.get_encryption_key())
  END,
  age_range_enc = CASE WHEN age_range IS NOT NULL
    THEN pgp_sym_encrypt(age_range, private.get_encryption_key())
  END;

-- 18. Drop plaintext columns
ALTER TABLE private.profiles_encrypted DROP COLUMN email;
ALTER TABLE private.profiles_encrypted DROP COLUMN display_name;
ALTER TABLE private.profiles_encrypted DROP COLUMN zodiac_sign;
ALTER TABLE private.profiles_encrypted DROP COLUMN gender;
ALTER TABLE private.profiles_encrypted DROP COLUMN age_range;

-- 19. Grant private schema access for profiles
GRANT ALL ON private.profiles_encrypted TO authenticated, service_role;

-- 20. Create profiles VIEW (auto-decrypts on SELECT)
CREATE VIEW public.profiles WITH (security_invoker = true) AS
SELECT
  id,
  -- All profile encrypted columns are nullable; CASE prevents pgp_sym_decrypt(NULL) crash
  CASE WHEN email_enc IS NOT NULL
    THEN pgp_sym_decrypt(email_enc, private.get_encryption_key())
  END AS email,
  CASE WHEN display_name_enc IS NOT NULL
    THEN pgp_sym_decrypt(display_name_enc, private.get_encryption_key())
  END AS display_name,
  reading_count,
  subscription_tier,
  CASE WHEN zodiac_sign_enc IS NOT NULL
    THEN pgp_sym_decrypt(zodiac_sign_enc, private.get_encryption_key())
  END AS zodiac_sign,
  CASE WHEN gender_enc IS NOT NULL
    THEN pgp_sym_decrypt(gender_enc, private.get_encryption_key())
  END AS gender,
  CASE WHEN age_range_enc IS NOT NULL
    THEN pgp_sym_decrypt(age_range_enc, private.get_encryption_key())
  END AS age_range,
  onboarding_completed,
  created_at,
  updated_at
FROM private.profiles_encrypted;

-- Only authenticated users and service_role can access (no anon)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;

-- 21. INSTEAD OF INSERT trigger for profiles view
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
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER profiles_view_insert_trigger
  INSTEAD OF INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_insert();

-- 22. INSTEAD OF UPDATE trigger for profiles view
CREATE OR REPLACE FUNCTION profiles_view_update() RETURNS TRIGGER AS $$
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
    updated_at = _now
  WHERE id = OLD.id;
  NEW.updated_at := _now;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER profiles_view_update_trigger
  INSTEAD OF UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_update();

-- 23. INSTEAD OF DELETE trigger for profiles view
CREATE OR REPLACE FUNCTION profiles_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM private.profiles_encrypted WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER profiles_view_delete_trigger
  INSTEAD OF DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_delete();

-- =============================================================================
-- handle_new_user() compatibility
-- =============================================================================
-- No change needed: handle_new_user() is SECURITY DEFINER (runs as postgres).
-- It INSERTs into public.profiles (now a view). The INSTEAD OF trigger fires,
-- running as postgres (which bypasses RLS on private.profiles_encrypted).
-- The trigger calls private.get_encryption_key() which is SECURITY DEFINER,
-- so it can access the key table regardless.

COMMIT;
