import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
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
  console.log('[AUTH] getFreshAccessToken() called');

  // getUser() makes a server call and triggers token refresh if needed
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[AUTH] getUser() result:', {
    userId: user?.id,
    email: user?.email,
    error: userError?.message
  });

  if (userError || !user) {
    console.log('[AUTH] getUser() failed, returning null');
    return null;
  }

  // Now get the (refreshed) session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log('[AUTH] getSession() result:', {
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    tokenLength: session?.access_token?.length,
    expiresAt: session?.expires_at,
    error: sessionError?.message
  });

  if (!session?.access_token) {
    console.log('[AUTH] No access token in session');
    return null;
  }

  // Log token preview (first/last 10 chars only for security)
  const token = session.access_token;
  console.log('[AUTH] Token preview:', token.slice(0, 10) + '...' + token.slice(-10));

  return token;
}
