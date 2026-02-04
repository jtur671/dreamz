-- Add dream_type to dreams table (dream vs nightmare classification)
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS dream_type text DEFAULT 'dream'
  CHECK (dream_type IN ('dream', 'nightmare'));

-- Add zodiac_sign to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zodiac_sign text;
