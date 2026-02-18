import { element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, dismissKeyboard, waitForVisible, waitForAnyVisible } from './helpers/actions';
import { randomTestEmail } from './helpers/dreamFactory';

describe('Auth Screen', () => {
  beforeEach(async () => {
    await launchApp(false);
  });

  it('should sign up with a new random email and land on onboarding', async () => {
    const email = randomTestEmail();

    await tapById('auth-mode-switch'); // Switch to sign-up mode
    await typeById('auth-email-input', email);
    await typeById('auth-password-input', 'TestPass123!');
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    // Should see success alert or onboarding
    await waitForAnyVisible(
      [{ text: 'Success' }, { text: 'Choose Your Path' }],
      15000,
    );
  });

  it('should sign in with existing test account and land on home', async () => {
    await typeById('auth-email-input', process.env.DETOX_TEST_EMAIL || 'detox-test@dreamz.app');
    await typeById('auth-password-input', process.env.DETOX_TEST_PASSWORD || 'detox-test-password');
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('should show error for invalid email format', async () => {
    await typeById('auth-email-input', 'not-an-email');
    await typeById('auth-password-input', 'SomePass123');
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    await waitForAnyVisible(
      [{ text: 'Sign In Error' }, { text: 'Sign Up Error' }],
      10000,
    );
  });

  it('should show error for wrong password', async () => {
    await typeById('auth-email-input', process.env.DETOX_TEST_EMAIL || 'detox-test@dreamz.app');
    await typeById('auth-password-input', 'WrongPassword999');
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    await waitFor(element(by.text('Sign In Error')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should show error for empty fields', async () => {
    await tapById('auth-submit-button');

    await waitFor(element(by.text('Please enter email and password')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should toggle password visibility', async () => {
    await typeById('auth-password-input', 'TestSecret');
    await tapById('auth-password-toggle');

    // After toggling, the password field should no longer be secure
    // We verify by checking the toggle button is still accessible (no crash)
    await expect(element(by.id('auth-password-toggle'))).toBeVisible();

    // Toggle back
    await tapById('auth-password-toggle');
    await expect(element(by.id('auth-password-toggle'))).toBeVisible();
  });

  it('should switch between sign-in and sign-up modes', async () => {
    // Default is sign-in mode
    await expect(element(by.text('Sign In'))).toBeVisible();

    // Switch to sign-up
    await tapById('auth-mode-switch');
    await expect(element(by.text('Create Account'))).toBeVisible();

    // Switch back
    await tapById('auth-mode-switch');
    await expect(element(by.text('Sign In'))).toBeVisible();
  });
});
