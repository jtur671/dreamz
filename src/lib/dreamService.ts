import { supabase } from './supabase';
import type { Dream, DreamReading } from '../types';

const EDGE_FUNCTION_URL = 'https://vjqvxraqeptgmbxnipqo.supabase.co/functions/v1/analyze-dream';

export type SaveDreamResult =
  | { success: true; dream: Dream }
  | { success: false; error: string };

export type AnalyzeDreamResult =
  | { success: true; reading: DreamReading }
  | { success: false; error: string };

export type UpdateDreamResult =
  | { success: true; dream: Dream }
  | { success: false; error: string };

/**
 * Saves a new dream entry to the database
 */
export async function saveDream(
  dreamText: string,
  mood?: string,
  dreamType: 'dream' | 'nightmare' = 'dream'
): Promise<SaveDreamResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('dreams')
      .insert({
        user_id: user.id,
        dream_text: dreamText.trim(),
        mood: mood || null,
        dream_type: dreamType,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, dream: data as Dream };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save dream';
    return { success: false, error: message };
  }
}

export interface AnalyzeDreamContext {
  mood?: string;
  dreamId?: string;
  zodiacSign?: string;
  gender?: string;
  ageRange?: string;
}

/**
 * Calls the Edge Function to analyze a dream and generate a reading
 */
export async function analyzeDream(
  dreamText: string,
  context?: AnalyzeDreamContext
): Promise<AnalyzeDreamResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        dream_text: dreamText,
        mood: context?.mood || undefined,
        dream_id: context?.dreamId || undefined,
        zodiac_sign: context?.zodiacSign || undefined,
        gender: context?.gender || undefined,
        age_range: context?.ageRange || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Analysis failed (${response.status})`;
      return { success: false, error: errorMessage };
    }

    const data = await response.json();

    // Validate the reading structure
    if (!isValidReading(data.reading || data)) {
      return { success: false, error: 'Invalid reading format received' };
    }

    const reading = data.reading || data;
    return { success: true, reading };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to analyze dream';
    return { success: false, error: message };
  }
}

/**
 * Updates an existing dream with a reading
 */
export async function updateDreamWithReading(
  dreamId: string,
  reading: DreamReading
): Promise<UpdateDreamResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('dreams')
      .update({ reading })
      .eq('id', dreamId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, dream: data as Dream };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update dream';
    return { success: false, error: message };
  }
}

/**
 * Validates that a reading object has the required structure
 */
function isValidReading(reading: unknown): reading is DreamReading {
  if (!reading || typeof reading !== 'object') {
    return false;
  }

  const r = reading as Record<string, unknown>;

  return (
    typeof r.title === 'string' &&
    typeof r.tldr === 'string' &&
    Array.isArray(r.symbols) &&
    r.symbols.length >= 3 &&
    r.symbols.length <= 7 &&
    typeof r.omen === 'string' &&
    typeof r.ritual === 'string' &&
    typeof r.journal_prompt === 'string' &&
    Array.isArray(r.tags) &&
    r.tags.length >= 3 &&
    r.tags.length <= 7
  );
}
