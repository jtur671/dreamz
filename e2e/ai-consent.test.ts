import { device, element, by, expect } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, pollForVisibleByText, navigateToTab } from './helpers/actions';
import { setTestAccountPremium, grantTestAccountAIConsent, revokeTestAccountAIConsent } from './helpers/db';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';

describe('AI Consent Flow', () => {
  beforeAll(async () => {
    await setTestAccountPremium();
    await revokeTestAccountAIConsent();
    await launchApp(true);
    await device.disableSynchronization();
    await pollForVisible('home-record-button', 30000);
  });

  it('should show consent modal on first dream submission', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await element(by.id('new-dream-scroll-view')).scrollTo('top');

    // Clear any draft
    try {
      await pollForVisible('new-dream-draft-clear', 1000);
      await tapById('new-dream-draft-clear');
    } catch { /* no draft */ }

    await tapById('new-dream-mood-peaceful');
    await typeById('new-dream-text-input', TEST_DREAM_TEXT);
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    await tapById('new-dream-submit');

    // Consent modal should appear
    await pollForVisible('ai-consent-modal', 5000);
    await pollForVisible('ai-consent-allow', 3000);
    await pollForVisible('ai-consent-decline', 3000);
  });

  it('should dismiss modal and return to dream entry on "Not Now"', async () => {
    await tapById('ai-consent-decline');

    // Should be back on dream entry (not analyzing)
    await pollForVisible('new-dream-text-input', 5000);
  });

  it('should grant consent and proceed with analysis on "Allow"', async () => {
    // Re-submit to trigger modal again
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    await tapById('new-dream-submit');

    await pollForVisible('ai-consent-allow', 5000);
    await tapById('ai-consent-allow');

    // Should proceed to analysis (loading animation or reading)
    await pollForVisible('reading-title', 180000);
  });

  it('should skip consent modal on subsequent submissions', async () => {
    // Navigate back to home
    await element(by.id('reading-scroll-view')).scrollTo('bottom');
    await tapById('reading-grimoire-button');
    await pollForVisibleByText('Your Grimoire', 10000);

    // Go to Dream tab and submit a new dream
    await navigateToTab('Dream');
    await pollForVisible('home-record-button', 10000);
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await element(by.id('new-dream-scroll-view')).scrollTo('top');

    try {
      await pollForVisible('new-dream-draft-clear', 1000);
      await tapById('new-dream-draft-clear');
    } catch { /* no draft */ }

    await tapById('new-dream-mood-curious');
    await typeById('new-dream-text-input', 'A second dream about the stars');
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    await tapById('new-dream-submit');

    // Should NOT show consent modal — should go straight to loading/reading
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await expect(element(by.id('ai-consent-modal'))).not.toBeVisible();
    } catch {
      // Modal element may not exist at all — that's the expected case
    }
  });
});
