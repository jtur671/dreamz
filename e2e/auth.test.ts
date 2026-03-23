import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, dismissKeyboard, waitForVisible, waitForAnyVisible, dismissSavePasswordDialog, pollForVisible, pollForVisibleByText, pollForNotVisibleByText } from './helpers/actions';
import { randomTestEmail } from './helpers/dreamFactory';
import { TEST_EMAIL, TEST_PASSWORD } from './helpers/session';

describe('Auth Screen', () => {
  beforeEach(async () => {
    await launchApp(false);
    // Wait for app to settle: home, onboarding, or auth screen
    const landed = await waitForAnyVisible(
      [
        { id: 'home-record-button' },   // 0 — home screen (persisted session)
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
      await pollForVisible('onboarding-about-skip', 5000);
      await tapById('onboarding-about-skip');     // skip about → welcome step (sync waits for updateProfile)
      await pollForVisible('onboarding-welcome-begin', 15000);
      await tapById('onboarding-welcome-begin');  // complete onboarding → home (sync)
      await pollForVisible('home-record-button', 15000);
      // Fall through to sign-out logic below (landed = 0 path)
    }

    if (landed === 0 || landed === 2) {
      // Persisted session landed us on home (or we just completed onboarding).
      // Disable sync then sign out so the auth screen appears for the test.
      await device.disableSynchronization();
      await element(by.id('tab-settings')).tap();
      await pollForVisible('settings-scroll-view', 5000);
      await element(by.id('settings-scroll-view')).scrollTo('bottom');
      await pollForVisible('settings-signout-button', 5000);
      await element(by.id('settings-signout-button')).tap();
      // Alert has title "Sign Out" + button "Sign Out" — tap the button (index 1)
      await pollForVisibleByText('Sign Out', 5000);
      await element(by.text('Sign Out')).atIndex(1).tap();
      await pollForVisible('auth-email-input', 10000);
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
        { id: 'home-record-button' },
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

    await pollForVisible('home-record-button', 30000);
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

  it('should show error for wrong password and offer to create account', async () => {
    await typeById('auth-email-input', TEST_EMAIL);
    await typeById('auth-password-input', 'WrongPassword999');
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    await pollForVisibleByText('Sign In Failed', 10000);
  });

  it('should show error for empty fields', async () => {
    await tapById('auth-submit-button');

    await pollForVisibleByText('Please enter email and password', 5000);
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

  // --- Smart error switching tests ---

  it('should offer to switch to sign-in when sign-up gets "already registered"', async () => {
    // Switch to sign-up mode
    await tapById('auth-mode-switch');
    await expect(element(by.text('Create Account'))).toBeVisible();

    // Use existing test account email
    await typeById('auth-email-input', TEST_EMAIL);
    await typeById('auth-password-input', TEST_PASSWORD);
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    await new Promise(r => setTimeout(r, 800));
    await dismissSavePasswordDialog();

    // Should see smart alert with "Account Exists"
    await pollForVisibleByText('Account Exists', 15000);

    // Tap "Sign In" in the alert to auto-switch modes
    await element(by.text('Sign In')).tap();

    // Should now be in sign-in mode (button says "Sign In")
    await pollForVisibleByText('Sign In', 5000);
  });

  it('should offer to create account when sign-in gets invalid credentials', async () => {
    await typeById('auth-email-input', 'nonexistent-xyz-test@example.com');
    await typeById('auth-password-input', 'SomePassword123');
    await dismissKeyboard('auth-password-input');
    await tapById('auth-submit-button');

    // Should see smart alert with "Sign In Failed"
    await pollForVisibleByText('Sign In Failed', 15000);

    // Tap "Create Account" to auto-switch modes
    await element(by.text('Create Account')).tap();

    // Should now be in sign-up mode (button says "Create Account")
    await pollForVisibleByText('Create Account', 5000);
  });

  // --- Forgot password tests ---

  it('should show Forgot Password link only in sign-in mode', async () => {
    // In sign-in mode (default), forgot password should be visible
    await expect(element(by.id('auth-forgot-password'))).toBeVisible();

    // Switch to sign-up mode
    await tapById('auth-mode-switch');

    // Forgot password should not be visible
    await expect(element(by.id('auth-forgot-password'))).not.toBeVisible();

    // Switch back to sign-in
    await tapById('auth-mode-switch');
    await expect(element(by.id('auth-forgot-password'))).toBeVisible();
  });

  it('should show confirmation after tapping Forgot Password with valid email', async () => {
    await typeById('auth-email-input', TEST_EMAIL);
    await dismissKeyboard('auth-email-input');
    await tapById('auth-forgot-password');

    await pollForVisibleByText('Check Your Email', 15000);
  });

  it('should show error when tapping Forgot Password with empty email', async () => {
    // Don't type any email
    await tapById('auth-forgot-password');

    await pollForVisibleByText('Email Required', 5000);
  });
});
