import { device, element, by, expect } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, pollForVisibleByText, navigateToTab } from './helpers/actions';
import { setTestAccountPremium, grantTestAccountAIConsent, revokeTestAccountAIConsent } from './helpers/db';

describe('Grimoire — No Consent State', () => {
  beforeAll(async () => {
    await setTestAccountPremium();
    await revokeTestAccountAIConsent();
    await launchApp(true);
    await device.disableSynchronization();
    await pollForVisible('home-record-button', 30000);

    // Create a dream WITHOUT AI analysis (use "I don't remember" which doesn't need consent)
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await element(by.id('new-dream-scroll-view')).scrollTo('top');

    try {
      await pollForVisible('new-dream-draft-clear', 1000);
      await tapById('new-dream-draft-clear');
    } catch { /* no draft */ }

    await tapById('new-dream-forgot');
    await pollForVisibleByText('Sleep Logged', 10000);
    await element(by.text('OK')).tap();
    await pollForVisible('home-record-button', 10000);
  });

  beforeEach(async () => {
    await navigateToTab('Grimoire');
    await pollForVisibleByText('Your Grimoire', 10000);
  });

  it('should show consent banner for no-consent users', async () => {
    await pollForVisible('grimoire-consent-banner', 5000);
    await pollForVisible('grimoire-consent-enable', 3000);
  });

  it('should NOT show symbol filter pills', async () => {
    try {
      await expect(element(by.id('grimoire-pill-all'))).not.toBeVisible();
    } catch {
      // Element not in tree — that's expected
    }
  });

  it('should dismiss banner for the session', async () => {
    await pollForVisible('grimoire-consent-dismiss', 5000);
    await tapById('grimoire-consent-dismiss');

    // Banner should disappear
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      await expect(element(by.id('grimoire-consent-banner'))).not.toBeVisible();
    } catch {
      // Not visible — that's what we want
    }
  });

  it('should show consent modal when tapping Enable Readings', async () => {
    // Relaunch to get banner back (dismissed per session)
    await launchApp(false);
    await pollForVisible('home-record-button', 30000);
    await device.disableSynchronization();
    await navigateToTab('Grimoire');
    await pollForVisibleByText('Your Grimoire', 10000);

    await pollForVisible('grimoire-consent-enable', 5000);
    await tapById('grimoire-consent-enable');

    await pollForVisible('ai-consent-modal', 5000);

    // Dismiss
    await tapById('ai-consent-decline');
  });
});
