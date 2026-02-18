import { device, element, by, waitFor, expect, web } from 'detox';
import { getTestLaunchArgs } from './session';

/**
 * Dismiss the keyboard by tapping the return key on the last focused input.
 * Pass the testID of the input that currently has focus.
 */
export async function dismissKeyboard(inputId: string) {
  await element(by.id(inputId)).tapReturnKey();
}

/**
 * Launch the app with optional auto-login via Detox launch args.
 */
export async function launchApp(withLogin = true) {
  if (withLogin) {
    const launchArgs = getTestLaunchArgs();
    await device.launchApp({ newInstance: true, launchArgs });
  } else {
    await device.launchApp({ newInstance: true });
  }
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
 * Wait for an element to not be visible by testID.
 */
export async function waitForNotVisible(id: string, timeout = 10000) {
  await waitFor(element(by.id(id))).not.toBeVisible().withTimeout(timeout);
}

/**
 * Navigate to a bottom tab by its label text.
 */
export async function navigateToTab(tabName: 'Dream' | 'Grimoire' | 'Insights' | 'Dictionary' | 'Settings') {
  await element(by.text(tabName)).tap();
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
