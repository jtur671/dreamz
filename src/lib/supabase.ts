import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const CHUNK_SIZE = 2048;

/**
 * A SecureStore-backed storage adapter that handles values larger than
 * expo-secure-store's 2048-byte limit by transparently chunking.
 *
 * Write atomicity: a `${key}_count` sentinel is written LAST. Its presence
 * means the write is consistent. Force-quit mid-write leaves the sentinel
 * either unset (read falls back to legacy behavior for old installs) or
 * pointing to a prior consistent value.
 *
 * Read: if the sentinel exists, read exactly that many chunks. A missing
 * chunk in that range means corruption → return null so the caller treats
 * it as "no session" and forces a fresh login. Without the sentinel, fall
 * back to the legacy read-until-gap behavior so existing logged-in users
 * aren't force-logged-out by this upgrade.
 */
const COUNT_KEY_SUFFIX = '_count';
const MAX_LEGACY_CLEANUP_CHUNKS = 64; // safety bound — never loop forever

const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;

    // New format: trust the count sentinel.
    const countStr = await SecureStore.getItemAsync(`${key}${COUNT_KEY_SUFFIX}`);
    if (countStr !== null) {
      const count = parseInt(countStr, 10);
      if (!Number.isFinite(count) || count <= 0) return null;
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (!chunk) return null; // corruption → force fresh login
        chunks.push(chunk);
      }
      return chunks.join('');
    }

    // Legacy fallback: read-until-gap. Load-bearing for one release so
    // users written by the old non-atomic code aren't force-logged-out.
    const chunks: string[] = [];
    let i = 0;
    while (i < MAX_LEGACY_CLEANUP_CHUNKS) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (!chunk) break;
      chunks.push(chunk);
      i++;
    }
    return chunks.length > 0 ? chunks.join('') : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      // Clean up any old chunks + sentinel
      await SecureStore.deleteItemAsync(`${key}${COUNT_KEY_SUFFIX}`);
      for (let i = 0; i < MAX_LEGACY_CLEANUP_CHUNKS; i++) {
        const existing = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (!existing) break;
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
      return;
    }
    // Chunk the value
    const chunks = value.match(/.{1,2048}/g) || [];
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }
    // Remove the non-chunked key if it exists
    await SecureStore.deleteItemAsync(key);
    // Clean up extra old chunks from a previous longer value (bounded)
    let j = chunks.length;
    let cleaned = 0;
    while (cleaned < MAX_LEGACY_CLEANUP_CHUNKS) {
      const existing = await SecureStore.getItemAsync(`${key}_chunk_${j}`);
      if (!existing) break;
      await SecureStore.deleteItemAsync(`${key}_chunk_${j}`);
      j++;
      cleaned++;
    }
    // Sentinel written LAST — its presence commits the write.
    await SecureStore.setItemAsync(`${key}${COUNT_KEY_SUFFIX}`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    await SecureStore.deleteItemAsync(`${key}${COUNT_KEY_SUFFIX}`);
    for (let i = 0; i < MAX_LEGACY_CLEANUP_CHUNKS; i++) {
      const existing = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (!existing) break;
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: LargeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Gets a fresh access token by calling getUser() first to trigger token refresh,
 * then returns the session access token.
 * Use this instead of getSession() directly to avoid expired token issues.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  // getUser() makes a server call and triggers token refresh if needed
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Now get the (refreshed) session
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return null;
  }

  return session.access_token;
}
