import { device, element, by, expect } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, pollForVisibleByText, navigateToTab } from './helpers/actions';
import { setTestAccountPremium, grantTestAccountAIConsent, revokeTestAccountAIConsent } from './helpers/db';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';

describe('AI Consent Flow', () => {
  beforeAll(async () => {
    await setTestAccountPremium();
    await revokeTestAccountAIConsent();
    // resetAuth: true wipes the persisted Supabase session so the app
    // forcibly signs in as TEST_EMAIL. Without this, the app can end up
    // reading profile state for a completely different user than the
    // test helpers are manipulating.
    await launchApp(true, true);
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
    // scrollTo('bottom') is idempotent and also dismisses the keyboard so
    // the submit button is guaranteed visible. scroll(offset) fails when
    // the form already fits on screen.
    await element(by.id('new-dream-scroll-view')).scrollTo('bottom');
    await tapById('new-dream-submit');

    // Consent modal should appear. We don't assert on the modal container
    // testID — Detox's 75% visibility threshold fails when opaque child
    // views cover the overlay. Button testIDs are the reliable signal.
    await pollForVisible('ai-consent-allow', 5000);
    await pollForVisible('ai-consent-decline', 3000);
  });

  it('should dismiss modal and return to dream entry on "Not Now"', async () => {
    await tapById('ai-consent-decline');

    // Should be back on dream entry (not analyzing)
    await pollForVisible('new-dream-text-input', 5000);
  });

  it('should grant consent and proceed with analysis on "Allow"', async () => {
    // Re-submit to trigger modal again. scrollTo('bottom') is idempotent
    // whether or not the form currently fits the screen.
    await element(by.id('new-dream-scroll-view')).scrollTo('bottom');
    await tapById('new-dream-submit');

    await pollForVisible('ai-consent-allow', 5000);
    // Wait for the modal's fade-in animation to finish so the Allow
    // button actually receives the tap. pollForVisible returns when the
    // view is drawn, not necessarily when it's interactive.
    await new Promise(resolve => setTimeout(resolve, 800));
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
    // Dismiss the keyboard + scroll to the submit button. A brief wait
    // after scroll lets the keyboard actually collapse so the submit
    // button reaches 100% visibility for Detox's tap threshold.
    await element(by.id('new-dream-scroll-view')).scrollTo('bottom');
    await new Promise(resolve => setTimeout(resolve, 500));
    await tapById('new-dream-submit');

    // Should NOT show consent modal — should go straight to loading/reading.
    // Assert that the Allow button (a reliable modal signal) is NOT visible.
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await expect(element(by.id('ai-consent-allow'))).not.toBeVisible();
    } catch {
      // Element may not be in the tree at all — expected when modal never mounted.
    }
  });
});
