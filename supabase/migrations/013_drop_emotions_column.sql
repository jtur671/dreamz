-- Migration: Remove redundant emotions column
--
-- The emotions column (text[]) always contained [mood] — a duplicate of the mood
-- column. All client code uses mood directly. This migration removes emotions
-- from the encrypted table, view, and INSTEAD OF triggers.

BEGIN;

-- 1. Drop the view first (it depends on emotions_enc column)
DROP VIEW IF EXISTS public.dreams CASCADE;

-- 2. Drop the emotions_enc column from the encrypted table
ALTER TABLE private.dreams_encrypted DROP COLUMN IF EXISTS emotions_enc;

CREATE VIEW public.dreams WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  pgp_sym_decrypt(dream_text_enc, private.get_encryption_key()) AS dream_text,
  CASE WHEN mood_enc IS NOT NULL
    THEN pgp_sym_decrypt(mood_enc, private.get_encryption_key())
  END AS mood,
  CASE WHEN reading_enc IS NOT NULL
    THEN pgp_sym_decrypt(reading_enc, private.get_encryption_key())::jsonb
  END AS reading,
  pgp_sym_decrypt(dream_type_enc, private.get_encryption_key()) AS dream_type,
  created_at,
  updated_at,
  deleted_at
FROM private.dreams_encrypted;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dreams TO authenticated, service_role;

-- 3. Recreate INSTEAD OF INSERT trigger (without emotions)
CREATE OR REPLACE FUNCTION dreams_view_insert() RETURNS TRIGGER AS $$
DECLARE
  _key text := private.get_encryption_key();
  _id uuid := COALESCE(NEW.id, uuid_generate_v4());
  _now timestamptz := COALESCE(NEW.created_at, now());
  _dream_type text := COALESCE(NEW.dream_type, 'dream');
BEGIN
  IF _dream_type NOT IN ('dream', 'nightmare') THEN
    RAISE EXCEPTION 'Invalid dream_type: %. Must be dream or nightmare.', _dream_type;
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
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER dreams_view_insert_trigger
  INSTEAD OF INSERT ON public.dreams
  FOR EACH ROW EXECUTE FUNCTION dreams_view_insert();

-- 4. Recreate INSTEAD OF UPDATE trigger (without emotions)
CREATE OR REPLACE FUNCTION dreams_view_update() RETURNS TRIGGER AS $$
DECLARE
  _key text := private.get_encryption_key();
  _now timestamptz := timezone('utc'::text, now());
  _dream_type text := COALESCE(NEW.dream_type, 'dream');
BEGIN
  IF _dream_type NOT IN ('dream', 'nightmare') THEN
    RAISE EXCEPTION 'Invalid dream_type: %. Must be dream or nightmare.', _dream_type;
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
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER dreams_view_update_trigger
  INSTEAD OF UPDATE ON public.dreams
  FOR EACH ROW EXECUTE FUNCTION dreams_view_update();

-- 5. Recreate INSTEAD OF DELETE trigger (unchanged, but CASCADE dropped it)
CREATE OR REPLACE FUNCTION dreams_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM private.dreams_encrypted WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER dreams_view_delete_trigger
  INSTEAD OF DELETE ON public.dreams
  FOR EACH ROW EXECUTE FUNCTION dreams_view_delete();

COMMIT;
