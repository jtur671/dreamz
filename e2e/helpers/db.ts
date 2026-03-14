import { createClient } from '@supabase/supabase-js';
import { TEST_EMAIL, TEST_PASSWORD } from './session';

/**
 * Resets the test account's onboarding_completed to false so the next
 * app launch will route to the OnboardingScreen instead of MainTabs.
 * Call this in beforeEach for onboarding tests.
 */
export async function resetOnboardingState(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[resetOnboardingState] Supabase env vars not set — skipping');
    return;
  }

  // Use `any` to avoid Supabase generated-types errors in the test environment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    console.warn('[resetOnboardingState] Sign-in failed:', signInError.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[resetOnboardingState] No user after sign-in');
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: false })
    .eq('id', user.id);

  if (error) {
    console.warn('[resetOnboardingState] Update failed:', error.message);
  }

  await supabase.auth.signOut();
}

/**
 * Sets the test account's subscription_tier to 'premium'.
 * Call this in beforeAll for any test suite that needs premium features.
 */
export async function setTestAccountPremium(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[setTestAccountPremium] Supabase env vars not set — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    console.warn('[setTestAccountPremium] Sign-in failed:', signInError.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[setTestAccountPremium] No user after sign-in');
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: 'premium' })
    .eq('id', user.id);

  if (error) {
    console.warn('[setTestAccountPremium] Failed to set premium:', error.message);
  }

  await supabase.auth.signOut();
}

/**
 * Sets the test account's subscription_tier to 'free' so the upgrade button
 * is visible on the Settings screen (it only renders when tier is free).
 * Call this in beforeAll for paywall tests.
 */
export async function setTestAccountFree(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[setTestAccountFree] Supabase env vars not set — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    console.warn('[setTestAccountFree] Sign-in failed:', signInError.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[setTestAccountFree] No user after sign-in');
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: 'free' })
    .eq('id', user.id);

  if (error) {
    console.warn('[setTestAccountFree] Failed to set free:', error.message);
  }

  await supabase.auth.signOut();
}

