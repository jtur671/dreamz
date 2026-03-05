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
 */
export async function launchApp(withLogin = true) {
  await device.launchApp({ newInstance: true });
  if (withLogin) {
    await signInForTesting();
  }
}

/**
 * Sign in with test credentials if the auth screen is currently showing.
 * No-op if the home screen is already visible (session was persisted).
 */
export async function signInForTesting() {
  // Check if auth screen or home screen appears first
  const AUTH_TIMEOUT = 5000;
  const HOME_TIMEOUT = 30000;

  try {
    // If home screen is already visible, we're done
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(AUTH_TIMEOUT);
    return;
  } catch {
    // Not on home — auth screen must be showing, proceed with sign-in
  }

  await waitFor(element(by.id('auth-email-input')))
    .toBeVisible()
    .withTimeout(AUTH_TIMEOUT);

  await element(by.id('auth-email-input')).typeText(TEST_EMAIL);
  await element(by.id('auth-password-input')).typeText(TEST_PASSWORD);
  await element(by.id('auth-password-input')).tapReturnKey();
  await element(by.id('auth-submit-button')).tap();

  // Dismiss iOS "Save Password?" system sheet if it appears
  await new Promise(r => setTimeout(r, 800));
  await dismissSavePasswordDialog();

  // Wait for home screen after sign-in
  await waitFor(element(by.text('Welcome, Dreamer')))
    .toBeVisible()
    .withTimeout(HOME_TIMEOUT);
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
 */
export async function waitForVisible(id: string, timeout = 10000) {
  await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
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
 * Wait for an element to not be visible by testID.
 */
export async function waitForNotVisible(id: string, timeout = 10000) {
  await waitFor(element(by.id(id))).not.toBeVisible().withTimeout(timeout);
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
