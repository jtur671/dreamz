import { supabase } from './supabase';
import { withTimeout } from './timeout';
import type { Profile, Gender, AgeRange } from '../types';

const AUTH_TIMEOUT_MS = 5000;
const QUERY_TIMEOUT_MS = 5000;

/**
 * Fetches the current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  try {
    const { data: { user } } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_TIMEOUT_MS,
      'getProfile:getUser',
    );

    if (!user) {
      return null;
    }

    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      QUERY_TIMEOUT_MS,
      'getProfile:select',
    );

    if (error || !data) {
      return null;
    }

    return data as Profile;
  } catch {
    return null;
  }
}

/**
 * Updates the user's zodiac sign
 */
export async function updateZodiacSign(zodiacSign: string): Promise<boolean> {
  try {
    const { data: { user } } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_TIMEOUT_MS,
      'updateZodiacSign:getUser',
    );

    if (!user) {
      return false;
    }

    const { error } = await withTimeout(
      supabase
        .from('profiles')
        .update({ zodiac_sign: zodiacSign })
        .eq('id', user.id),
      QUERY_TIMEOUT_MS,
      'updateZodiacSign:update',
    );

    return !error;
  } catch {
    return false;
  }
}

/**
 * Updates multiple profile fields at once
 */
export async function updateProfile(updates: {
  display_name?: string;
  zodiac_sign?: string;
  gender?: Gender;
  age_range?: AgeRange;
  onboarding_completed?: boolean;
}): Promise<boolean> {
  try {
    const { data: { user } } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_TIMEOUT_MS,
      'updateProfile:getUser',
    );

    if (!user) {
      return false;
    }

    const { error } = await withTimeout(
      supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id),
      QUERY_TIMEOUT_MS,
      'updateProfile:update',
    );

    return !error;
  } catch {
    return false;
  }
}

/**
 * Marks onboarding as complete for the current user
 */
export async function completeOnboarding(): Promise<boolean> {
  return updateProfile({ onboarding_completed: true });
}
