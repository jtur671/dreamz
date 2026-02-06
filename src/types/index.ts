export interface DreamSymbol {
  name: string;
  meaning: string;
  shadow: string;
  guidance: string;
}

export interface DreamReading {
  title: string;
  tldr: string;
  symbols: DreamSymbol[];
  omen: string;
  ritual: string;
  journal_prompt: string;
  tags: string[];
  content_warnings?: string[];
  image_url?: string;
}

export interface Dream {
  id: string;
  user_id: string;
  dream_text: string;
  mood?: string;
  emotions?: string[];
  reading?: DreamReading;
  dream_type: 'dream' | 'nightmare';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  reading_count: number;
  subscription_tier: 'free' | 'premium';
  zodiac_sign?: string;
  gender?: Gender;
  age_range?: AgeRange;
  onboarding_completed?: boolean;
  created_at: string;
}

export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export type Gender = typeof GENDER_OPTIONS[number]['value'];

export const AGE_RANGES = [
  '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
] as const;

export type AgeRange = typeof AGE_RANGES[number];

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
] as const;

export type ZodiacSign = typeof ZODIAC_SIGNS[number];
