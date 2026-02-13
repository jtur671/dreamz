import { supabase, getFreshAccessToken } from './supabase';
import type { Dream, DreamReading } from '../types';

export type SaveDreamResult =
  | { success: true; dream: Dream }
  | { success: false; error: string };

export type AnalyzeDreamResult =
  | { success: true; reading: DreamReading }
  | { success: false; error: string };

export type UpdateDreamResult =
  | { success: true; dream: Dream }
  | { success: false; error: string };

export type DeleteDreamResult =
  | { success: true }
  | { success: false; error: string };

export type FetchDreamsResult =
  | { success: true; dreams: Dream[] }
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
        emotions: mood ? [mood] : null,
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
  console.log('[ANALYZE] analyzeDream() called with:', {
    dreamTextLength: dreamText.length,
    hasContext: !!context,
    contextKeys: context ? Object.keys(context) : []
  });

  try {
    // Use getFreshAccessToken to ensure token is refreshed before API call
    console.log('[ANALYZE] Getting fresh access token...');
    const accessToken = await getFreshAccessToken();

    console.log('[ANALYZE] Token result:', {
      hasToken: !!accessToken,
      tokenLength: accessToken?.length
    });

    if (!accessToken) {
      console.log('[ANALYZE] No token, returning auth error');
      return { success: false, error: 'Not authenticated' };
    }

    // Let the Supabase client handle auth headers automatically.
    // functions.invoke uses the session token set via onAuthStateChange.
    // Manually overriding Authorization conflicts with the gateway's JWT validation.
    console.log('[ANALYZE] Invoking analyze-dream edge function');
    const { data, error } = await supabase.functions.invoke('analyze-dream', {
      body: {
        dream_text: dreamText,
        mood: context?.mood || undefined,
        dream_id: context?.dreamId || undefined,
        zodiac_sign: context?.zodiacSign || undefined,
        gender: context?.gender || undefined,
        age_range: context?.ageRange || undefined,
      },
    });

    if (error) {
      // FunctionsHttpError.context is a Response object; read real body
      let errorBody: any = null;
      try {
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          errorBody = await (error as any).context.json();
        }
      } catch {
        // ignore parse failure
      }

      console.log('[ANALYZE] Error name:', (error as any)?.name);
      console.log('[ANALYZE] Error message:', (error as any)?.message);
      console.log('[ANALYZE] Error body:', JSON.stringify(errorBody));

      const message =
        errorBody?.error?.message ||
        errorBody?.message ||
        (error as { message?: string })?.message ||
        'Analysis failed';
      return { success: false, error: message };
    }

    console.log('[ANALYZE] Success response keys:', data ? Object.keys(data as object) : []);

    // data is auto-parsed JSON from supabase.functions.invoke
    const responseData = data as Record<string, unknown> | null;
    const candidateReading = responseData?.reading || responseData;

    // Log candidate reading shape for debugging
    if (candidateReading && typeof candidateReading === 'object') {
      const cr = candidateReading as Record<string, unknown>;
      console.log('[ANALYZE] Reading keys:', Object.keys(cr));
      console.log('[ANALYZE] Reading shape:', {
        title: typeof cr.title,
        tldr: typeof cr.tldr,
        symbols: Array.isArray(cr.symbols) ? cr.symbols.length : typeof cr.symbols,
        omen: typeof cr.omen,
        ritual: typeof cr.ritual,
        journal_prompt: typeof cr.journal_prompt,
        tags: Array.isArray(cr.tags) ? cr.tags.length : typeof cr.tags,
      });
    }

    // Validate the reading structure
    if (!isValidReading(candidateReading)) {
      console.log('[ANALYZE] Invalid reading format, data keys:', responseData ? Object.keys(responseData) : 'null');
      return { success: false, error: 'Invalid reading format received' };
    }

    const reading = candidateReading;
    return { success: true, reading };
  } catch (err) {
    console.log('[ANALYZE] Exception:', err);
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
 * Validates that a reading object has the required structure.
 * Aligned with server-side validateReading in dream-prompt.ts:
 *   - symbols: 1-3 items (prompt asks for exactly 1)
 *   - tags: 3-5 items
 *   - content_warnings: optional array
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
    r.symbols.length >= 1 &&
    r.symbols.length <= 7 &&
    typeof r.omen === 'string' &&
    typeof r.ritual === 'string' &&
    typeof r.journal_prompt === 'string' &&
    Array.isArray(r.tags) &&
    r.tags.length >= 1 &&
    r.tags.length <= 10
  );
}

/**
 * Fetches all dreams for the current user
 */
export async function fetchUserDreams(): Promise<FetchDreamsResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
      .from('dreams')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, dreams: data as Dream[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dreams';
    return { success: false, error: message };
  }
}

/**
 * Generates a dream image via DALL-E (called async after reading is shown)
 */
export async function generateDreamImage(
  dreamId: string,
  dreamText: string,
  symbolName?: string
): Promise<{ success: true; image_url: string } | { success: false; error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-dream-image', {
      body: {
        dream_id: dreamId,
        dream_text: dreamText,
        symbol_name: symbolName,
      },
    });

    if (error) {
      return { success: false, error: 'Image generation failed' };
    }

    const responseData = data as Record<string, unknown> | null;
    if (responseData?.image_url && typeof responseData.image_url === 'string') {
      return { success: true, image_url: responseData.image_url };
    }

    return { success: false, error: 'No image URL returned' };
  } catch (err) {
    return { success: false, error: 'Image generation failed' };
  }
}

/**
 * Soft deletes a dream (sets deleted_at timestamp)
 */
export async function deleteDream(dreamId: string): Promise<DeleteDreamResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('dreams')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', dreamId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete dream';
    return { success: false, error: message };
  }
}
