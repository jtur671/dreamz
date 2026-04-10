import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const STORAGE_KEY = 'dreamz_ai_consent';

interface ConsentState {
  granted: boolean;
  date: string | null;
}

/**
 * Get the current AI consent state.
 * Checks SecureStore cache first, falls back to Supabase profile.
 */
export async function getAIConsent(): Promise<ConsentState> {
  // Check local cache first
  try {
    const cached = await SecureStore.getItemAsync(STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Cache read failed — fall through to Supabase
  }

  // Fall back to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { granted: false, date: null };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('ai_consent_granted, ai_consent_date')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      return { granted: false, date: null };
    }

    const state: ConsentState = {
      granted: data.ai_consent_granted ?? false,
      date: data.ai_consent_date ?? null,
    };

    // Cache for next time
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return { granted: false, date: null };
  }
}

/**
 * Grant AI consent. Writes to both Supabase and SecureStore.
 * If Supabase fails, still writes to SecureStore (offline support).
 */
export async function grantAIConsent(): Promise<void> {
  const now = new Date().toISOString();
  const state: ConsentState = { granted: true, date: now };

  // Write to SecureStore first (fast, offline-safe)
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));

  // Write to Supabase (authoritative)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ ai_consent_granted: true, ai_consent_date: now })
        .eq('id', user.id);
    }
  } catch {
    // Supabase write failed — SecureStore still has the consent
  }
}

/**
 * Revoke AI consent. Clears SecureStore cache and writes revoked state to Supabase.
 * If Supabase fails, the cache is still cleared so getAIConsent() will re-fetch.
 */
export async function revokeAIConsent(): Promise<void> {
  const state: ConsentState = { granted: false, date: null };

  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));

  // Write to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ ai_consent_granted: false, ai_consent_date: null })
        .eq('id', user.id);
    }
  } catch {
    // Supabase write failed — AsyncStorage still cleared
  }
}
