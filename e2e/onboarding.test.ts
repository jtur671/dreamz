import { device, element, by, waitFor } from 'detox';
import { tapById, typeById, waitForVisible, waitForAnyVisible } from './helpers/actions';
import { TEST_EMAIL, TEST_PASSWORD } from './helpers/session';
import { resetOnboardingState } from './helpers/db';

/**
 * Sign in with the persistent test account and wait for the OnboardingScreen.
 *
 * Prerequisite: resetOnboardingState() must have been called so that
 * onboarding_completed = false in the DB. Combined with the App.tsx fix
 * (onAuthStateChange SIGNED_IN checks profile), signing in will route to
 * OnboardingScreen instead of MainTabs.
 */
async function signInAndExpectOnboarding() {
  await waitForVisible('auth-email-input', 10000);
  await typeById('auth-email-input', TEST_EMAIL);
  await typeById('auth-password-input', TEST_PASSWORD);
  await element(by.id('auth-password-input')).tapReturnKey();
  await tapById('auth-submit-button');

  // Wait for the tier screen (profile check via onAuthStateChange → needsOnboarding = true)
  await waitFor(element(by.id('onboarding-tier-free')))
    .toBeVisible()
    .withTimeout(30000);
}

describe('Onboarding Flow', () => {
  beforeEach(async () => {
    // Reset the test account's onboarding flag in the DB BEFORE launching the app,
    // so getSession() on startup or onAuthStateChange on sign-in will trigger onboarding.
    await resetOnboardingState();

    await device.launchApp({ newInstance: true });

    // Detect which screen appeared after launch.
    const landed = await waitForAnyVisible(
      [
        { id: 'auth-email-input' },   // 0 — no session / signed out
        { text: 'Welcome, Dreamer' }, // 1 — session with onboarding already complete
        { text: 'Choose Your Path' }, // 2 — session with onboarding_completed=false (happy path)
      ],
      30000,
    );

    if (landed === 2) {
      // Already on the tier step — nothing else to do.
      return;
    }

    if (landed === 1) {
      // Somehow landed on Home (onboarding_completed was not reset in time or
      // app used a cached value). Sign out so we can sign back in.
      await device.disableSynchronization();
      await element(by.id('tab-settings')).tap();
      await waitForVisible('settings-scroll-view', 5000);
      await element(by.id('settings-scroll-view')).scrollTo('bottom');
      await waitForVisible('settings-signout-button', 5000);
      await element(by.id('settings-signout-button')).tap();
      await waitFor(element(by.text('Sign Out')).atIndex(1)).toBeVisible().withTimeout(5000);
      await element(by.text('Sign Out')).atIndex(1).tap();
      await waitForVisible('auth-email-input', 20000);
      await device.enableSynchronization();
    }

    // landed === 0 or arrived here after sign-out: sign in to trigger onboarding.
    await signInAndExpectOnboarding();
  });

  it('should complete full onboarding: tier -> about -> welcome -> home', async () => {
    // Select free tier and continue
    await tapById('onboarding-tier-free');
    await tapById('onboarding-tier-continue');

    // About step - select zodiac, gender, age (items near top visible without scrolling)
    await waitForVisible('onboarding-zodiac-aries', 5000);
    await tapById('onboarding-zodiac-aries');
    await tapById('onboarding-gender-female');
    await tapById('onboarding-age-25-34');
    // Continue button is below the fold — scroll to bottom first
    await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
    await waitForVisible('onboarding-about-continue', 3000);
    await tapById('onboarding-about-continue');

    // Welcome step
    await waitForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    // Should land on home
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('should skip about-you step and still reach home', async () => {
    await tapById('onboarding-tier-free');
    await tapById('onboarding-tier-continue');

    // Skip button is below the fold — scroll to bottom first
    await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
    await waitForVisible('onboarding-about-skip', 5000);
    await tapById('onboarding-about-skip');

    // Welcome step
    await waitForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('should persist zodiac choice in settings after onboarding', async () => {
    await tapById('onboarding-tier-free');
    await tapById('onboarding-tier-continue');

    await waitForVisible('onboarding-zodiac-leo', 5000);
    await tapById('onboarding-zodiac-leo');
    // Continue button is below the fold — scroll to bottom first
    await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
    await waitForVisible('onboarding-about-continue', 3000);
    await tapById('onboarding-about-continue');

    await waitForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);

    // Navigate to Settings and verify zodiac persisted
    await element(by.id('tab-settings')).tap();
    await waitFor(element(by.text('Leo')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
