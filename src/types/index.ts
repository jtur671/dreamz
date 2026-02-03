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
}

export interface Dream {
  id: string;
  user_id: string;
  dream_text: string;
  mood?: string;
  emotions?: string[];
  reading?: DreamReading;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  reading_count: number;
  subscription_tier: 'free' | 'premium';
  created_at: string;
}
