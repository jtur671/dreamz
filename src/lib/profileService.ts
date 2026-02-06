import { supabase } from './supabase';
import type { Profile, Gender, AgeRange } from '../types';

/**
 * Fetches the current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ zodiac_sign: zodiacSign })
      .eq('id', user.id);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Updates multiple profile fields at once
 */
export async function updateProfile(updates: {
  zodiac_sign?: string;
  gender?: Gender;
  age_range?: AgeRange;
  subscription_tier?: 'free' | 'premium';
  onboarding_completed?: boolean;
}): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

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
