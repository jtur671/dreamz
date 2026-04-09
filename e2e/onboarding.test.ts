import { device, element, by, waitFor, expect } from 'detox';
import { tapById, typeById, waitForVisible, waitForAnyVisible, pollForVisible, pollForVisibleByText } from './helpers/actions';
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
  await pollForVisible('auth-email-input', 10000);
  await typeById('auth-email-input', TEST_EMAIL);
  await typeById('auth-password-input', TEST_PASSWORD);
  await element(by.id('auth-password-input')).tapReturnKey();
  await tapById('auth-submit-button');

  // Wait for the tier screen (profile check via onAuthStateChange → needsOnboarding = true)
  await pollForVisible('onboarding-tier-free', 30000);
}

describe('Onboarding Flow', () => {
  beforeEach(async () => {
    // Reset the test account's onboarding flag in the DB BEFORE launching the app,
    // so getSession() on startup or onAuthStateChange on sign-in will trigger onboarding.
    await resetOnboardingState();

    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
    // AdMob keeps the main dispatch queue perpetually busy — disable sync
    // so poll-based waits (waitForAnyVisible, pollForVisible) can function.
    await device.disableSynchronization();

    // Detect which screen appeared after launch.
    const landed = await waitForAnyVisible(
      [
        { id: 'auth-email-input' },   // 0 — no session / signed out
        { id: 'home-record-button' }, // 1 — session with onboarding already complete
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
      await pollForVisible('settings-scroll-view', 5000);
      await element(by.id('settings-scroll-view')).scrollTo('bottom');
      await pollForVisible('settings-signout-button', 5000);
      await element(by.id('settings-signout-button')).tap();
      await pollForVisibleByText('Sign Out', 5000);
      await element(by.text('Sign Out')).atIndex(1).tap();
      await pollForVisible('auth-email-input', 20000);
      await device.enableSynchronization();
    }

    // landed === 0 or arrived here after sign-out: sign in to trigger onboarding.
    await signInAndExpectOnboarding();
  });

  it('should complete full onboarding: tier -> about -> welcome -> home', async () => {
    // Select free tier and continue
    await tapById('onboarding-tier-free');
    await new Promise(r => setTimeout(r, 300));
    await tapById('onboarding-tier-continue');

    // About step - select zodiac, gender, age (items near top visible without scrolling)
    // Wait for step transition animation to finish (CASpringAnimation overlay blocks taps)
    await pollForVisible('onboarding-zodiac-aries', 5000);
    await new Promise(r => setTimeout(r, 800));
    await tapById('onboarding-zodiac-aries');
    await tapById('onboarding-gender-female');
    await tapById('onboarding-age-25-34');
    // Continue button is below the fold — scroll to bottom first
    await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
    await pollForVisible('onboarding-about-continue', 3000);
    await tapById('onboarding-about-continue');

    // AI Disclosure step
    await pollForVisible('onboarding-ai-continue', 10000);
    await tapById('onboarding-ai-continue');

    // Welcome step
    await pollForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    // Should land on home
    await pollForVisible('home-record-button', 15000);
  });

  it('should skip about-you step and still reach home', async () => {
    await tapById('onboarding-tier-free');
    await new Promise(r => setTimeout(r, 300));
    await tapById('onboarding-tier-continue');

    // Skip button is below the fold — scroll to bottom first
    await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
    await pollForVisible('onboarding-about-skip', 5000);
    await tapById('onboarding-about-skip');

    // AI Disclosure step
    await pollForVisible('onboarding-ai-continue', 10000);
    await tapById('onboarding-ai-continue');

    // Welcome step
    await pollForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    await pollForVisible('home-record-button', 15000);
  });

  it('should persist display name from onboarding in settings', async () => {
    await tapById('onboarding-tier-free');
    await new Promise(r => setTimeout(r, 300));
    await tapById('onboarding-tier-continue');

    // About step — type display name
    await pollForVisible('onboarding-display-name', 5000);
    await new Promise(r => setTimeout(r, 800));
    await typeById('onboarding-display-name', 'Luna');

    // Scroll to continue button and tap
    await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
    await pollForVisible('onboarding-about-continue', 3000);
    await tapById('onboarding-about-continue');

    // AI Disclosure step
    await pollForVisible('onboarding-ai-continue', 10000);
    await tapById('onboarding-ai-continue');

    // Welcome step
    await pollForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    await pollForVisible('home-record-button', 15000);

    // Navigate to Settings and verify display name persisted
    await element(by.id('tab-settings')).tap();
    await pollForVisibleByText('Luna', 5000);
  });

  it('should persist zodiac choice in settings after onboarding', async () => {
    await tapById('onboarding-tier-free');
    await new Promise(r => setTimeout(r, 300));
    await tapById('onboarding-tier-continue');

    await pollForVisible('onboarding-zodiac-leo', 5000);
    await new Promise(r => setTimeout(r, 800));
    await tapById('onboarding-zodiac-leo');
    // Continue button is below the fold — scroll to bottom first
    await element(by.id('onboarding-about-scroll')).scrollTo('bottom');
    await pollForVisible('onboarding-about-continue', 3000);
    await tapById('onboarding-about-continue');

    // AI Disclosure step
    await pollForVisible('onboarding-ai-continue', 10000);
    await tapById('onboarding-ai-continue');

    await pollForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    await pollForVisible('home-record-button', 15000);

    // Navigate to Settings and verify zodiac persisted
    await element(by.id('tab-settings')).tap();
    await pollForVisibleByText('Leo', 5000);
  });
});
