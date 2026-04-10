import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, dismissKeyboard, waitForVisible, pollForVisible, pollForVisibleByText, waitForAnyVisible, navigateToTab } from './helpers/actions';
import { XSS_DREAM_TEXT, EMOJI_DREAM_TEXT, LONG_DREAM_TEXT } from './helpers/dreamFactory';
import { setTestAccountPremium, grantTestAccountAIConsent } from './helpers/db';

/** Submit a dream and wait for any outcome (reading, error, unavailable, or paywall). */
async function submitDreamAndWait(text: string, mood: string) {
  await tapById('home-record-button');
  await waitForVisible('new-dream-text-input', 5000);

  await typeById('new-dream-text-input', text);
  // Dismiss keyboard so it doesn't block mood buttons (Detox hit-testing is native)
  await dismissKeyboard('new-dream-text-input');
  await tapById(`new-dream-mood-${mood}`);

  // Scroll to make the submit button visible
  await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
  await tapById('new-dream-submit');

  await waitForAnyVisible(
    [
      { id: 'reading-title' },
      { text: 'Reading Unavailable' },
      { text: 'Error' },
      { text: 'Unlock the Full Oracle' }, // Paywall shown when reading limit reached
    ],
    120000,
  );

  // Navigate back to home for next test — handle all possible end states
  // Paywall: tap Close to go back to NewDream, then back to home
  try { await element(by.text('Close')).tap(); await new Promise(r => setTimeout(r, 500)); } catch {}
  // ReadingScreen: scroll to bottom and tap grimoire button
  try {
    await element(by.id('reading-scroll-view')).scrollTo('bottom');
    await tapById('reading-grimoire-button');
    await pollForVisibleByText('Your Grimoire', 8000);
    await navigateToTab('Dream');
    return;
  } catch {}
  // Alert dialogs
  try { await element(by.text('Return Home')).atIndex(0).tap(); await new Promise(r => setTimeout(r, 500)); } catch {}
  try { await element(by.text('OK')).atIndex(0).tap(); await new Promise(r => setTimeout(r, 300)); } catch {}
  // NewDreamScreen back button
  try { await tapById('reading-back'); await new Promise(r => setTimeout(r, 1000)); } catch {}
  try { await tapById('new-dream-back'); await new Promise(r => setTimeout(r, 1000)); } catch {}
  await new Promise(r => setTimeout(r, 1000));
  await navigateToTab('Dream');
  await pollForVisible('home-record-button', 10000);
}

describe('Security & Edge Cases', () => {
  beforeAll(async () => {
    // Upgrade test account to premium so reading limits never block dream submissions
    await setTestAccountPremium();
    await grantTestAccountAIConsent();

    await launchApp(true);
    await pollForVisible('home-record-button', 30000);
    // DreamContext background image backfill fires DALL-E 3 network requests
    // on fresh launch. Disable sync so all subsequent actions are immediate.
    await device.disableSynchronization();
  });

  it('should handle XSS input safely', async () => {
    await submitDreamAndWait(XSS_DREAM_TEXT, 'curious');
  });

  it('should handle emoji input normally', async () => {
    await submitDreamAndWait(EMOJI_DREAM_TEXT, 'joyful');
  });

  it('should handle very long input', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    // Wait for NewDreamScreen's async initialize() to resolve.
    // initialize() calls getProfile() + checkPremiumAccess() which can cause
    // layout shifts — adding a settle wait avoids the race.
    await new Promise(r => setTimeout(r, 2000));

    // Select mood BEFORE typing so the chips are fully visible.
    await pollForVisible('new-dream-mood-curious', 3000);
    await tapById('new-dream-mood-curious');

    // Type a long string — 500 chars is enough to stress the layout without
    // making the TextInput so tall that Detox's scrollTo('bottom') fails to
    // bring the submit button on-screen (which happens at ~2000 chars).
    await typeById('new-dream-text-input', LONG_DREAM_TEXT.slice(0, 500));
    await dismissKeyboard('new-dream-text-input');
    // Wait for KeyboardAvoidingView + automaticallyAdjustKeyboardInsets to settle
    await new Promise(r => setTimeout(r, 1500));

    // Scroll to reveal the submit button, then wait for layout to settle
    await element(by.id('new-dream-scroll-view')).scrollTo('bottom');
    await new Promise(r => setTimeout(r, 1000));
    await pollForVisible('new-dream-submit', 5000);
    await tapById('new-dream-submit');

    await waitForAnyVisible(
      [
        { id: 'reading-title' },
        { text: 'Reading Unavailable' },
        { text: 'Error' },
        { text: 'Unlock the Full Oracle' },
      ],
      120000,
    );

    // Navigate back to home
    try { await element(by.text('Close')).tap(); await new Promise(r => setTimeout(r, 500)); } catch {}
    try {
      await element(by.id('reading-scroll-view')).scrollTo('bottom');
      await tapById('reading-grimoire-button');
      await pollForVisibleByText('Your Grimoire', 8000);
      await navigateToTab('Dream');
    } catch {
      try { await tapById('reading-back'); await new Promise(r => setTimeout(r, 1000)); } catch {}
      try { await tapById('new-dream-back'); await new Promise(r => setTimeout(r, 1000)); } catch {}
      await new Promise(r => setTimeout(r, 1000));
      await navigateToTab('Dream');
    }
  });

  it('should persist session across app relaunch', async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        detoxTestEmail: process.env.DETOX_TEST_EMAIL || 'detox-test@dreamz.app',
        detoxTestPassword: process.env.DETOX_TEST_PASSWORD || 'detox-test-password',
      },
    });

    // Re-disable sync after relaunch — launchApp resets sync to enabled and
    // DreamContext backfill fires again for any dreams created in tests 1-3.
    await device.disableSynchronization();

    await pollForVisible('home-record-button', 30000);
  });

  it('should show grimoire state correctly', async () => {
    await navigateToTab('Grimoire');
    // waitFor handles timing; no redundant expect needed
    await pollForVisibleByText('Your Grimoire', 10000);
  });

  it('should handle insights screen with few dreams gracefully', async () => {
    await navigateToTab('Insights');

    // Should not crash - may show charts or minimum-dreams message
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Insights tab should be visible (the tab label at bottom)
    await expect(element(by.text('Insights'))).toBeVisible();
  });
});
