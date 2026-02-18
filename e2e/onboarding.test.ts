import { element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, waitForAnyVisible } from './helpers/actions';
import { randomTestEmail } from './helpers/dreamFactory';

async function signUpAndDismissAlert() {
  const email = randomTestEmail();

  await tapById('auth-mode-switch');
  await typeById('auth-email-input', email);
  await typeById('auth-password-input', '***REMOVED***');
  await tapById('auth-submit-button');

  await waitForAnyVisible(
    [{ text: 'Choose Your Path' }, { text: 'Success' }],
    15000,
  );

  // Dismiss success alert if present
  try {
    await element(by.text('OK')).tap();
  } catch {
    // No alert to dismiss
  }

  await waitForVisible('onboarding-tier-free', 10000);
}

describe('Onboarding Flow', () => {
  beforeEach(async () => {
    await launchApp(false);
  });

  it('should complete full onboarding: tier -> about -> welcome -> home', async () => {
    await signUpAndDismissAlert();

    // Select free tier and continue
    await tapById('onboarding-tier-free');
    await tapById('onboarding-tier-continue');

    // About step - select zodiac, gender, age
    await waitForVisible('onboarding-zodiac-aries', 5000);
    await tapById('onboarding-zodiac-aries');
    await tapById('onboarding-gender-female');
    await tapById('onboarding-age-25-34');
    await tapById('onboarding-about-continue');

    // Welcome step
    await waitForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    // Should land on home
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should skip about-you step and still reach home', async () => {
    await signUpAndDismissAlert();

    await tapById('onboarding-tier-free');
    await tapById('onboarding-tier-continue');

    // Skip about step
    await waitForVisible('onboarding-about-skip', 5000);
    await tapById('onboarding-about-skip');

    // Welcome step
    await waitForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should persist zodiac choice in settings after onboarding', async () => {
    await signUpAndDismissAlert();

    await tapById('onboarding-tier-free');
    await tapById('onboarding-tier-continue');

    await waitForVisible('onboarding-zodiac-leo', 5000);
    await tapById('onboarding-zodiac-leo');
    await tapById('onboarding-about-continue');

    await waitForVisible('onboarding-welcome-begin', 10000);
    await tapById('onboarding-welcome-begin');

    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate to Settings tab and verify zodiac
    await element(by.text('Settings')).tap();
    await waitFor(element(by.text('Leo')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
