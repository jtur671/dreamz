-- Allow 'forgot' as a dream_type value
--
-- Because dreams is an encrypted view (migration 012, updated in 013),
-- the dream_type constraint lives in INSTEAD OF trigger functions.
-- We update both INSERT and UPDATE triggers to accept 'forgot'.

-- Update INSERT trigger to allow 'forgot'
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
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Update UPDATE trigger to allow 'forgot'
CREATE OR REPLACE FUNCTION dreams_view_update() RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY INVOKER;
