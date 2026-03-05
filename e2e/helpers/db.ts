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
 * Sets the test account's subscription_tier to 'premium' so the reading limit
 * (3/month for free tier) never blocks test-submitted dreams.
 *
 * More reliable than resetTestReadingLimit() for test suites that submit dreams,
 * because it bypasses the limit entirely rather than trying to clear past readings.
 * Call this in beforeAll for any test suite that needs to submit dreams.
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
 * Resets the test account's monthly reading count to 0 by soft-deleting all
 * dreams with completed readings from the current month.
 *
 * Call this in beforeAll for any test that submits a dream and expects a reading,
 * so the free-tier limit (3/month) never blocks the test.
 */
export async function resetTestReadingLimit(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[resetTestReadingLimit] Supabase env vars not set — skipping reset');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInError) {
    console.warn('[resetTestReadingLimit] Sign-in failed:', signInError.message);
    return;
  }

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const { error } = await supabase
    .from('dreams')
    .update({ deleted_at: new Date().toISOString() })
    .gte('created_at', firstOfMonth.toISOString())
    .not('reading', 'is', null)
    .is('deleted_at', null);

  if (error) {
    console.warn('[resetTestReadingLimit] Failed to reset reading limit:', error.message);
  }

  await supabase.auth.signOut();
}
