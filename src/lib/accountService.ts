import { supabase } from './supabase';

export interface ExportedDream {
  entry_number: number;
  date: string;
  dream_text: string;
  mood: string | null;
  type: string;
  reading: {
    title: string;
    summary: string;
    plain_english: string | null;
    symbols: unknown[];
    omen: string;
    ritual: string;
    reflection: string;
    themes: string[];
    content_warnings: string[];
    image_url: string | null;
  } | null;
}

export interface ExportedProfile {
  email: string;
  display_name: string | null;
  subscription_tier: 'free' | 'premium';
  zodiac_sign: string | null;
  gender: string | null;
  age_range: string | null;
  reading_count: number;
  account_created_at: string | null;
  ai_consent_granted: boolean;
  ai_consent_date: string | null;
}

export interface ExportData {
  exported_at: string;
  app: string;
  format_version: number;
  profile: ExportedProfile;
  total_dreams: number;
  dreams: ExportedDream[];
}

export type ExportResult =
  | { success: true; data: ExportData }
  | { success: false; error: string };

export type DeleteAccountResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Exports all user data in a privacy-safe, portable format.
 * Covers GDPR Art. 15 (right of access) and Art. 20 (portability):
 * dreams, profile, email, subscription tier, and AI consent history.
 */
export async function exportUserDreams(): Promise<ExportResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const [dreamsResult, profileResult] = await Promise.all([
      supabase
        .from('dreams')
        .select('dream_text, mood, dream_type, reading, created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('display_name, subscription_tier, zodiac_sign, gender, age_range, reading_count, created_at, ai_consent_granted, ai_consent_date')
        .eq('id', user.id)
        .single(),
    ]);

    const { data: dreams, error } = dreamsResult;

    if (error) {
      return { success: false, error: error.message };
    }

    const profileRow = profileResult.data;

    const exportedProfile: ExportedProfile = {
      email: user.email ?? '',
      display_name: profileRow?.display_name ?? null,
      subscription_tier: profileRow?.subscription_tier ?? 'free',
      zodiac_sign: profileRow?.zodiac_sign ?? null,
      gender: profileRow?.gender ?? null,
      age_range: profileRow?.age_range ?? null,
      reading_count: profileRow?.reading_count ?? 0,
      account_created_at: profileRow?.created_at ?? null,
      ai_consent_granted: profileRow?.ai_consent_granted ?? false,
      ai_consent_date: profileRow?.ai_consent_date ?? null,
    };

    // Format dreams for export (privacy-safe, no internal IDs)
    const exportedDreams: ExportedDream[] = (dreams || []).map((dream, index) => ({
      entry_number: index + 1,
      date: new Date(dream.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      dream_text: dream.dream_text,
      mood: dream.mood,
      type: dream.dream_type || 'dream',
      reading: dream.reading ? {
        title: dream.reading.title,
        summary: dream.reading.tldr,
        plain_english: dream.reading.plain_english || null,
        symbols: dream.reading.symbols,
        omen: dream.reading.omen,
        ritual: dream.reading.ritual,
        reflection: dream.reading.journal_prompt,
        themes: dream.reading.tags,
        content_warnings: dream.reading.content_warnings || [],
        image_url: dream.reading.image_url || null,
      } : null,
    }));

    const exportData: ExportData = {
      exported_at: new Date().toISOString(),
      app: 'Dreamz',
      format_version: 2,
      profile: exportedProfile,
      total_dreams: exportedDreams.length,
      dreams: exportedDreams,
    };

    return { success: true, data: exportData };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export dreams';
    return { success: false, error: message };
  }
}

/**
 * Permanently deletes all user data via edge function
 * (dreams, profile, and auth user)
 */
export async function deleteUserAccount(password?: string): Promise<DeleteAccountResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: password ? { password } : {},
    });

    if (error) {
      let errorBody: any = null;
      try {
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          errorBody = await (error as any).context.json();
        }
      } catch {
        // ignore parse failure
      }
      const message = errorBody?.error?.message || errorBody?.error || (error as any)?.message || 'Failed to delete account';
      return { success: false, error: message };
    }

    const responseData = data as Record<string, unknown> | null;
    if (!responseData?.success) {
      return { success: false, error: 'Failed to delete account' };
    }

    // Sign out locally after successful server-side deletion
    await supabase.auth.signOut();

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete account';
    return { success: false, error: message };
  }
}
