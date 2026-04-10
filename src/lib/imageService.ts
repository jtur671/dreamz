import { supabase } from './supabase';

/**
 * Creates a fresh signed URL for a dream image stored in the private
 * `dream-images` bucket. Signed URLs expire after 7 days (604800 seconds).
 *
 * @param storagePath - The storage path, e.g. "{user_id}/{dream_id}.png"
 * @returns The signed URL, or null if generation failed
 */
export async function refreshDreamImageUrl(
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('dream-images')
    .createSignedUrl(storagePath, 604800);

  if (error || !data?.signedUrl) {
    console.warn('Failed to refresh dream image URL:', error?.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Derives the storage path for a dream image from user_id and dream_id.
 */
export function getDreamImagePath(userId: string, dreamId: string): string {
  return `${userId}/${dreamId}.png`;
}
