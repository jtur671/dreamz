import { supabase } from './supabase';

export interface ExportedDream {
  entry_number: number;
  date: string;
  dream_text: string;
  mood: number | null;
  emotions: string[] | null;
  type: string;
  reading: {
    title: string;
    summary: string;
    symbols: unknown[];
    omen: string;
    ritual: string;
    reflection: string;
    themes: string[];
  } | null;
}

export interface ExportData {
  exported_at: string;
  app: string;
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
 * Exports all user dreams in a privacy-safe format (no internal IDs)
 */
export async function exportUserDreams(): Promise<ExportResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: dreams, error } = await supabase
      .from('dreams')
      .select('dream_text, mood, emotions, dream_type, reading, created_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

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
      emotions: dream.emotions,
      type: dream.dream_type || 'dream',
      reading: dream.reading ? {
        title: dream.reading.title,
        summary: dream.reading.tldr,
        symbols: dream.reading.symbols,
        omen: dream.reading.omen,
        ritual: dream.reading.ritual,
        reflection: dream.reading.journal_prompt,
        themes: dream.reading.tags,
      } : null,
    }));

    const exportData: ExportData = {
      exported_at: new Date().toISOString(),
      app: 'Dreamz',
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
export async function deleteUserAccount(): Promise<DeleteAccountResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Call the delete-account edge function (handles full deletion including auth user)
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMessage = data.error?.message || data.error || 'Failed to delete account';
      return { success: false, error: errorMessage };
    }

    // Sign out locally after successful server-side deletion
    await supabase.auth.signOut();

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete account';
    return { success: false, error: message };
  }
}
