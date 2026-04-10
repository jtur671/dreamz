-- Add AI consent tracking columns to the underlying encrypted table
ALTER TABLE private.profiles_encrypted
  ADD COLUMN ai_consent_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN ai_consent_date timestamptz;

-- Recreate the profiles view to include the new columns
-- MUST preserve security_invoker = true so RLS on profiles_encrypted applies
CREATE OR REPLACE VIEW public.profiles WITH (security_invoker = true) AS
SELECT
  id,
  CASE WHEN email_enc IS NOT NULL THEN pgp_sym_decrypt(email_enc, private.get_encryption_key()) ELSE NULL::text END AS email,
  CASE WHEN display_name_enc IS NOT NULL THEN pgp_sym_decrypt(display_name_enc, private.get_encryption_key()) ELSE NULL::text END AS display_name,
  reading_count,
  subscription_tier,
  CASE WHEN zodiac_sign_enc IS NOT NULL THEN pgp_sym_decrypt(zodiac_sign_enc, private.get_encryption_key()) ELSE NULL::text END AS zodiac_sign,
  CASE WHEN gender_enc IS NOT NULL THEN pgp_sym_decrypt(gender_enc, private.get_encryption_key()) ELSE NULL::text END AS gender,
  CASE WHEN age_range_enc IS NOT NULL THEN pgp_sym_decrypt(age_range_enc, private.get_encryption_key()) ELSE NULL::text END AS age_range,
  onboarding_completed,
  created_at,
  updated_at,
  ai_consent_granted,
  ai_consent_date
FROM private.profiles_encrypted;

-- Update the INSERT trigger to handle ai_consent columns
CREATE OR REPLACE FUNCTION public.profiles_view_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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

-- Update the UPDATE trigger to handle ai_consent columns
CREATE OR REPLACE FUNCTION public.profiles_view_update()
RETURNS trigger
LANGUAGE plpgsql
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

-- Backfill: grant consent to all existing users
-- They signed up under the original privacy policy which disclosed AI usage
UPDATE private.profiles_encrypted
  SET ai_consent_granted = true,
      ai_consent_date = NOW()
  WHERE ai_consent_granted = false;
