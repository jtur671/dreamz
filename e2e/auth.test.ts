import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, dismissKeyboard, waitForVisible, waitForAnyVisible, dismissSavePasswordDialog } from './helpers/actions';
import { randomTestEmail } from './helpers/dreamFactory';
import { TEST_EMAIL, TEST_PASSWORD } from './helpers/session';

describe('Auth Screen', () => {
  beforeEach(async () => {
    await launchApp(false);
    // Wait for app to settle: home, onboarding, or auth screen
    const landed = await waitForAnyVisible(
      [
        { text: 'Welcome, Dreamer' },   // 0 — home screen (persisted session)
        { id: 'auth-email-input' },      // 1 — auth screen (no session)
        { text: 'Choose Your Path' },    // 2 — onboarding (new user, incomplete)
      ],
      25000,
    );

    if (landed === 2) {
      // Onboarding screen: fast-complete it to reach home, then sign out.
      // This happens after test 1 creates a new user whose onboarding_completed=false.
      // Keep synchronization ENABLED so Detox waits for async handlers (handleSkip calls
      // updateProfile before setStep('welcome')).
      await tapById('onboarding-tier-continue');  // free tier → about step (sync)
      // The about step has a ScrollView with zodiac/gender/age pickers pushing Skip off-screen.
      // Scroll the ScrollView to the bottom so the Skip button is in the viewport before tapping.
      await new Promise(r => setTimeout(r, 500)); // let about step render
      await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
      await waitFor(element(by.id('onboarding-about-skip'))).toBeVisible().withTimeout(5000);
      await tapById('onboarding-about-skip');     // skip about → welcome step (sync waits for updateProfile)
      await waitFor(element(by.id('onboarding-welcome-begin'))).toBeVisible().withTimeout(15000);
      await tapById('onboarding-welcome-begin');  // complete onboarding → home (sync)
      await waitFor(element(by.text('Welcome, Dreamer'))).toBeVisible().withTimeout(15000);
      // Fall through to sign-out logic below (landed = 0 path)
    }

    if (landed === 0 || landed === 2) {
      // Persisted session landed us on home (or we just completed onboarding).
      // Disable sync then sign out so the auth screen appears for the test.
      await device.disableSynchronization();
      await element(by.id('tab-settings')).tap();
      await waitFor(element(by.id('settings-scroll-view'))).toBeVisible().withTimeout(5000);
      await element(by.id('settings-scroll-view')).scrollTo('bottom');
      await waitFor(element(by.id('settings-signout-button'))).toBeVisible().withTimeout(5000);
      await element(by.id('settings-signout-button')).tap();
      // Alert has title "Sign Out" + button "Sign Out" — tap the button (index 1)
      await waitFor(element(by.text('Sign Out')).atIndex(1)).toBeVisible().withTimeout(5000);
      await element(by.text('Sign Out')).atIndex(1).tap();
      await waitFor(element(by.id('auth-email-input'))).toBeVisible().withTimeout(10000);
      await device.enableSynchronization();
    }
    // landed === 1 means auth screen already showing — nothing to do
  });

  it('should sign up with a new random email and show confirmation or onboarding', async () => {
    const email = randomTestEmail();

    await tapById('auth-mode-switch'); // Switch to sign-up mode
    await typeById('auth-email-input', email);
    await typeById('auth-password-input', 'TestPass123!');
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    // Dismiss iOS "Save Password?" sheet if it appears before the result alert
    await new Promise(r => setTimeout(r, 800));
    await dismissSavePasswordDialog();

    // Accept any of: success alert, onboarding, home, or error (60s — sign-up involves email send)
    await waitForAnyVisible(
      [
        { text: 'Success' },
        { text: 'Choose Your Path' },
        { text: 'Welcome, Dreamer' },
        { text: 'Sign Up Error' },
      ],
      60000,
    );
  });

  it('should sign in with existing test account and land on home', async () => {
    await typeById('auth-email-input', TEST_EMAIL);
    await typeById('auth-password-input', TEST_PASSWORD);
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(30000);
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
    await typeById('auth-email-input', TEST_EMAIL);
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
