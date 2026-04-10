import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const CHUNK_SIZE = 2048;

/**
 * A SecureStore-backed storage adapter that handles values larger than
 * expo-secure-store's 2048-byte limit by transparently chunking.
 */
const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;
    // Check for chunked storage
    const chunks: string[] = [];
    let i = 0;
    while (true) {
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
      // Clean up any old chunks
      let i = 0;
      while (true) {
        const existing = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (!existing) break;
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        i++;
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
    // Clean up extra old chunks from a previous longer value
    let j = chunks.length;
    while (true) {
      const existing = await SecureStore.getItemAsync(`${key}_chunk_${j}`);
      if (!existing) break;
      await SecureStore.deleteItemAsync(`${key}_chunk_${j}`);
      j++;
    }
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    let i = 0;
    while (true) {
      const existing = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (!existing) break;
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      i++;
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
