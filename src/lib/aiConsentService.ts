import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const STORAGE_KEY_PREFIX = 'dreamz_ai_consent';

interface ConsentState {
  granted: boolean;
  date: string | null;
}

function cacheKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

async function cacheWrite(userId: string, state: ConsentState): Promise<void> {
  try {
    await SecureStore.setItemAsync(cacheKey(userId), JSON.stringify(state));
  } catch {
    // Best-effort cache — Supabase is the source of truth.
  }
}

async function cacheRead(userId: string): Promise<ConsentState | null> {
  try {
    const cached = await SecureStore.getItemAsync(cacheKey(userId));
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

async function cacheDelete(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(cacheKey(userId));
  } catch {
    // ignore
  }
}

/**
 * Get the current AI consent state.
 *
 * Supabase is authoritative. We always try Supabase first when a user is
 * signed in, so admin revocations or changes made on other devices are
 * reflected immediately. SecureStore is a per-user read-through fallback
 * used only when Supabase is unreachable.
 *
 * The cache key is scoped by user id to prevent consent state from one
 * account leaking into another account on the same device (iOS Keychain
 * survives app reinstalls).
 */
export async function getAIConsent(): Promise<ConsentState> {
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
      // Network / RLS failure — fall back to last-known state if we have one.
      const cached = await cacheRead(user.id);
      return cached ?? { granted: false, date: null };
    }

    const state: ConsentState = {
      granted: data.ai_consent_granted ?? false,
      date: data.ai_consent_date ?? null,
    };

    await cacheWrite(user.id, state);
    return state;
  } catch {
    return { granted: false, date: null };
  }
}

/**
 * Force a fresh read of consent state from Supabase, bypassing and
 * updating the local cache. Call this when the server has told us the
 * client's view of consent is stale (e.g. analyze-dream returned
 * CONSENT_REQUIRED even though the client thought consent was granted).
 */
export async function refreshAIConsent(): Promise<ConsentState> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await cacheDelete(user.id);
  }
  return getAIConsent();
}

/**
 * Grant AI consent. Supabase is the authoritative store; SecureStore is
 * a best-effort cache. Throws if Supabase rejects the write so callers
 * can surface the failure to the user, but silently tolerates a missing
 * SecureStore native module.
 */
export async function grantAIConsent(): Promise<void> {
  const now = new Date().toISOString();
  const state: ConsentState = { granted: true, date: now };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_granted: true, ai_consent_date: now })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to grant AI consent: ${error.message}`);
  }

  await cacheWrite(user.id, state);
}

/**
 * Revoke AI consent. Same contract as grant: Supabase authoritative,
 * cache best-effort, throws on authoritative write failure.
 */
export async function revokeAIConsent(): Promise<void> {
  const state: ConsentState = { granted: false, date: null };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_granted: false, ai_consent_date: null })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to revoke AI consent: ${error.message}`);
  }

  await cacheWrite(user.id, state);
}
