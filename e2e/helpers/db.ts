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
 *
 * Uses the service_role key + update_subscription_tier RPC because the
 * profiles_view_update trigger locks subscription_tier to its old value
 * on normal view updates.
 */
export async function setTestAccountPremium(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[setTestAccountPremium] Supabase env vars not set (need SUPABASE_SERVICE_ROLE_KEY) — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseServiceRoleKey);

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

  const { error } = await supabase.rpc('update_subscription_tier', {
    p_user_id: user.id,
    p_tier: 'premium',
  });

  if (error) {
    console.warn('[setTestAccountPremium] Failed to set premium:', error.message);
  }

  await supabase.auth.signOut();
}

/**
 * Sets the test account's subscription_tier to 'free' so the upgrade button
 * is visible on the Settings screen (it only renders when tier is free).
 * Call this in beforeAll for paywall tests.
 *
 * Uses the service_role key + update_subscription_tier RPC because the
 * profiles_view_update trigger locks subscription_tier to its old value
 * on normal view updates.
 */
export async function setTestAccountFree(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[setTestAccountFree] Supabase env vars not set (need SUPABASE_SERVICE_ROLE_KEY) — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseServiceRoleKey);

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

  const { error } = await supabase.rpc('update_subscription_tier', {
    p_user_id: user.id,
    p_tier: 'free',
  });

  if (error) {
    console.warn('[setTestAccountFree] Failed to set free:', error.message);
  }

  await supabase.auth.signOut();
}

/**
 * Sets onboarding_completed = true for the test account.
 * Call this in afterAll for onboarding tests to prevent state leaking
 * into subsequent test suites.
 */
export async function completeTestAccountOnboarding(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[completeTestAccountOnboarding] Supabase env vars not set — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    console.warn('[completeTestAccountOnboarding] Sign-in failed:', signInError.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[completeTestAccountOnboarding] No user after sign-in');
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id);

  if (error) {
    console.warn('[completeTestAccountOnboarding] Failed:', error.message);
  }

  await supabase.auth.signOut();
}

/**
 * Grants AI consent for the test account.
 * Call this in beforeAll for test suites that need AI analysis.
 */
export async function grantTestAccountAIConsent(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[grantTestAccountAIConsent] Supabase env vars not set — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    console.warn('[grantTestAccountAIConsent] Sign-in failed:', signInError.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[grantTestAccountAIConsent] No user after sign-in');
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_granted: true, ai_consent_date: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.warn('[grantTestAccountAIConsent] Failed:', error.message);
  }

  await supabase.auth.signOut();
}

/**
 * Revokes AI consent for the test account.
 * Call this in beforeAll for test suites that test the no-consent state.
 */
export async function revokeTestAccountAIConsent(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[revokeTestAccountAIConsent] Supabase env vars not set — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    console.warn('[revokeTestAccountAIConsent] Sign-in failed:', signInError.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[revokeTestAccountAIConsent] No user after sign-in');
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_granted: false, ai_consent_date: null })
    .eq('id', user.id);

  if (error) {
    console.warn('[revokeTestAccountAIConsent] Failed:', error.message);
  }

  await supabase.auth.signOut();
}
