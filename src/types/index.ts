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
  created_at: string;
}

export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
] as const;

export type ZodiacSign = typeof ZODIAC_SIGNS[number];
