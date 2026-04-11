import { device, element, by, waitFor, expect } from 'detox';
import { getTestLaunchArgs, TEST_EMAIL, TEST_PASSWORD } from './session';

/**
 * Dismiss the keyboard by tapping the return key on the last focused input.
 * Pass the testID of the input that currently has focus.
 */
export async function dismissKeyboard(inputId: string) {
  await element(by.id(inputId)).tapReturnKey();
}

/**
 * Dismiss the iOS "Save Password?" / "Use Strong Password?" system sheet if it appears.
 * This native iOS sheet appears after typing passwords and can block the test flow.
 * Polls for up to 2.5s total; silently gives up if the dialog never appears.
 */
export async function dismissSavePasswordDialog(): Promise<void> {
  const labels = ['Not Now', 'Never for This Website', "Never for This App", "Don't Save", 'Never'];
  const CHECK_INTERVAL = 250;
  const MAX_WAIT = 2500;
  for (let elapsed = 0; elapsed < MAX_WAIT; elapsed += CHECK_INTERVAL) {
    for (const label of labels) {
      try {
        await element(by.text(label)).tap();
        return; // dismissed successfully
      } catch {}
    }
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
  // Dialog did not appear — that's fine
}

/**
 * Launch the app. If withLogin=true, performs the sign-in flow if the auth
 * screen appears (Supabase persists the session so this is usually only
 * needed on the first test of a simulator boot).
 *
 * Google Mobile Ads SDK keeps the main run loop perpetually busy, so we
 * disable Detox synchronization immediately after launch — before any waits.
 */
/**
 * Launch the app.
 *
 * `resetAuth: true` wipes app data (including the iOS Keychain-backed
 * Supabase session) via `delete: true` so the app MUST re-authenticate
 * with TEST_EMAIL. Use this in beforeAll of any suite whose assertions
 * depend on the test user's profile state being readable by the helpers.
 * Otherwise a stale persisted session from a prior run (possibly for a
 * completely different user) will silently make the helpers no-ops.
 */
export async function launchApp(withLogin = true, resetAuth = false) {
  await device.launchApp({
    newInstance: true,
    delete: resetAuth,
    permissions: { notifications: 'YES' },
  });
  // Must disable sync before any waits — AdMob keeps the main thread busy,
  // causing waitFor().withTimeout() to never poll.
  await device.disableSynchronization();
  if (withLogin) {
    await signInForTesting({ forceReauth: resetAuth });
  }
}

/**
 * Sign in with test credentials if the auth screen is currently showing.
 * No-op if the home screen is already visible (session was persisted).
 *
 * Uses poll-based waits (expect() instant checks) because Detox sync is
 * disabled due to Google Mobile Ads keeping the main run loop busy.
 */
export async function signInForTesting(opts: { forceReauth?: boolean } = {}) {
  // 30s to tolerate slow simulator cold-starts (profile fetch + session restore).
  const AUTH_TIMEOUT = 30000;
  const HOME_TIMEOUT = 30000;

  // Poll for home screen, auth screen, or onboarding screen
  const landed = await waitForAnyVisible(
    [
      { id: 'home-record-button' },  // 0 — home (persisted session)
      { id: 'auth-email-input' },    // 1 — auth screen
      { text: 'Choose Your Path' },  // 2 — onboarding (stale onboarding_completed=false)
    ],
    AUTH_TIMEOUT,
  );

  if (landed === 0) {
    // Already signed in. If caller asked for force-reauth (because the
    // persisted session may belong to a different user than TEST_EMAIL),
    // sign out via Settings so we land on the auth screen.
    if (opts.forceReauth) {
      await signOutViaSettings();
      await pollForVisible('auth-email-input', HOME_TIMEOUT);
      // fall through to sign-in path
    } else {
      return;
    }
  } else if (landed === 2) {
    // Landed on onboarding — skip through it to reach home
    await skipOnboarding();
    return;
  }

  await element(by.id('auth-email-input')).typeText(TEST_EMAIL);
  await element(by.id('auth-password-input')).typeText(TEST_PASSWORD);
  await element(by.id('auth-password-input')).tapReturnKey();
  await element(by.id('auth-submit-button')).tap();

  // Dismiss iOS "Save Password?" system sheet if it appears
  await new Promise(r => setTimeout(r, 800));
  await dismissSavePasswordDialog();

  // After sign-in, app may go to home OR onboarding
  const postSignIn = await waitForAnyVisible(
    [
      { id: 'home-record-button' },  // 0 — home
      { text: 'Choose Your Path' },  // 1 — onboarding
    ],
    HOME_TIMEOUT,
  );

  if (postSignIn === 1) {
    await skipOnboarding();
  }
}

/**
 * Sign out via the Settings screen. Only call when you are on the home
 * tab and signed in. Leaves the app on the auth screen.
 */
async function signOutViaSettings() {
  await element(by.id('tab-settings')).tap();
  // Scroll to bottom so the sign-out button is visible
  await pollForVisible('settings-scroll-view', 10000);
  await element(by.id('settings-scroll-view')).scrollTo('bottom');
  await pollForVisible('settings-signout-button', 5000);
  await element(by.id('settings-signout-button')).tap();
  // Confirm the alert
  await pollForVisibleByText('Sign Out', 5000);
  // Two elements with text "Sign Out": the button and the alert. Tap the alert's.
  await element(by.text('Sign Out')).atIndex(1).tap();
}

/**
 * Skip through onboarding screens to reach home.
 * Used when the test account's onboarding_completed is stale (false).
 */
async function skipOnboarding() {
  // Tier step — select Free and continue
  await pollForVisible('onboarding-tier-free', 5000);
  await element(by.id('onboarding-tier-free')).tap();
  await new Promise(r => setTimeout(r, 300));
  await element(by.id('onboarding-tier-continue')).tap();

  // About step — skip
  await pollForVisible('onboarding-about-scroll', 5000);
  await new Promise(r => setTimeout(r, 800));
  await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
  await pollForVisible('onboarding-about-skip', 3000);
  await element(by.id('onboarding-about-skip')).tap();

  // AI Disclosure step — continue
  await pollForVisible('onboarding-ai-continue', 10000);
  await element(by.id('onboarding-ai-continue')).tap();

  // Welcome step — begin
  await pollForVisible('onboarding-welcome-begin', 10000);
  await element(by.id('onboarding-welcome-begin')).tap();

  // Wait for home
  await pollForVisible('home-record-button', 15000);
}

/**
 * Tap an element by its testID.
 */
export async function tapById(id: string) {
  await element(by.id(id)).tap();
}

/**
 * Type text into an element by its testID.
 */
export async function typeById(id: string, text: string) {
  await element(by.id(id)).typeText(text);
}

/**
 * Clear text from an element by its testID.
 */
export async function clearById(id: string) {
  await element(by.id(id)).clearText();
}

/**
 * Wait for an element to be visible by testID.
 * Delegates to pollForVisible since Detox sync is globally disabled (AdMob).
 */
export async function waitForVisible(id: string, timeout = 10000) {
  await pollForVisible(id, timeout);
}

/**
 * Poll for an element to be visible by testID using expect() rather than waitFor().
 *
 * Use this instead of waitForVisible() when device.disableSynchronization() is active
 * and there are persistent dispatch queue work items (e.g. FlatList render cycles)
 * that cause waitFor().withTimeout() to never poll — because waitFor still waits for
 * app idle between polls even with sync disabled.
 *
 * Uses .atIndex(0) to handle FlatList items where multiple elements share the same
 * testID. expect().toBeVisible() is a single instant check not gated on app idle.
 */
export async function pollForVisible(id: string, timeout = 10000): Promise<void> {
  const INTERVAL = 500;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await expect(element(by.id(id)).atIndex(0)).toBeVisible();
      return;
    } catch {
      // not visible yet — or multiple elements / wrong state; keep polling
    }
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
  }
  // Final attempt — let it throw naturally so Detox captures a proper failure
  await expect(element(by.id(id)).atIndex(0)).toBeVisible();
}

/**
 * Poll for an element to be visible by text using expect() rather than waitFor().
 * Same rationale as pollForVisible() — works when Detox sync is disabled.
 */
export async function pollForVisibleByText(text: string, timeout = 10000): Promise<void> {
  const INTERVAL = 500;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await expect(element(by.text(text)).atIndex(0)).toBeVisible();
      return;
    } catch {
      // not visible yet
    }
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
  }
  // Final attempt — let it throw
  await expect(element(by.text(text)).atIndex(0)).toBeVisible();
}

/**
 * Wait for an element to not be visible by testID.
 * Uses polling since Detox sync is globally disabled (AdMob).
 */
export async function waitForNotVisible(id: string, timeout = 10000) {
  const INTERVAL = 500;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await expect(element(by.id(id)).atIndex(0)).not.toBeVisible();
      return;
    } catch {
      // still visible — keep polling
    }
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
  }
  // Final attempt — let it throw
  await expect(element(by.id(id)).atIndex(0)).not.toBeVisible();
}

/**
 * Poll for text element to NOT be visible.
 * Uses polling since Detox sync is globally disabled (AdMob).
 */
export async function pollForNotVisibleByText(text: string, timeout = 10000): Promise<void> {
  const INTERVAL = 500;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await expect(element(by.text(text)).atIndex(0)).not.toBeVisible();
      return;
    } catch {
      // still visible — keep polling
    }
    await new Promise(resolve => setTimeout(resolve, INTERVAL));
  }
  await expect(element(by.text(text)).atIndex(0)).not.toBeVisible();
}

/**
 * Navigate to a bottom tab by its testID (added via tabBarTestID in App.tsx).
 * Using testID instead of text avoids issues with textTransform and keyboard clipping.
 */
export async function navigateToTab(tabName: 'Dream' | 'Grimoire' | 'Insights' | 'Dictionary' | 'Settings') {
  const tabIds: Record<string, string> = {
    Dream: 'tab-dream',
    Grimoire: 'tab-grimoire',
    Insights: 'tab-insights',
    Dictionary: 'tab-dictionary',
    Settings: 'tab-settings',
  };
  await element(by.id(tabIds[tabName])).tap();
}

/**
 * Wait for any one of several elements (by text or testID) to be visible.
 * Returns the index of the first match, or throws after timeout.
 */
export async function waitForAnyVisible(
  matchers: Array<{ id?: string; text?: string }>,
  timeout = 10000,
): Promise<number> {
  const interval = 500;
  const maxAttempts = Math.ceil(timeout / interval);

  for (let i = 0; i < maxAttempts; i++) {
    for (let idx = 0; idx < matchers.length; idx++) {
      try {
        const m = matchers[idx];
        const el = m.id ? element(by.id(m.id)) : element(by.text(m.text!));
        await expect(el).toBeVisible();
        return idx;
      } catch {
        // not visible yet
      }
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(
    `None of the elements became visible within ${timeout}ms: ${JSON.stringify(matchers)}`
  );
}
