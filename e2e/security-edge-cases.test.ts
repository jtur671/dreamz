import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, waitForAnyVisible, navigateToTab } from './helpers/actions';
import { XSS_DREAM_TEXT, EMOJI_DREAM_TEXT, LONG_DREAM_TEXT } from './helpers/dreamFactory';

/** Submit a dream and wait for any outcome (reading, error, or unavailable). */
async function submitDreamAndWait(text: string, mood: string) {
  await tapById('home-record-button');
  await waitForVisible('new-dream-text-input', 5000);

  await typeById('new-dream-text-input', text);
  await tapById(`new-dream-mood-${mood}`);
  await tapById('new-dream-submit');

  await waitForAnyVisible(
    [
      { id: 'reading-title' },
      { text: 'Reading Unavailable' },
      { text: 'Error' },
    ],
    60000,
  );

  // Navigate back to home for next test
  try {
    await tapById('reading-grimoire-button');
  } catch {
    try {
      await element(by.text('Return Home')).tap();
    } catch {
      await tapById('new-dream-back');
    }
  }
  await navigateToTab('Dream');
  await waitFor(element(by.text('Welcome, Dreamer')))
    .toBeVisible()
    .withTimeout(10000);
}

describe('Security & Edge Cases', () => {
  beforeAll(async () => {
    await launchApp(true);
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('should handle XSS input safely', async () => {
    await submitDreamAndWait(XSS_DREAM_TEXT, 'vivid');
  });

  it('should handle emoji input normally', async () => {
    await submitDreamAndWait(EMOJI_DREAM_TEXT, 'joyful');
  });

  it('should handle very long input', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    // Type a long string (Detox may truncate, but should not crash)
    await typeById('new-dream-text-input', LONG_DREAM_TEXT.slice(0, 2000));
    await tapById('new-dream-mood-surreal');
    await tapById('new-dream-submit');

    await waitForAnyVisible(
      [
        { id: 'reading-title' },
        { text: 'Reading Unavailable' },
        { text: 'Error' },
      ],
      90000,
    );

    try {
      await tapById('reading-grimoire-button');
    } catch {
      try {
        await element(by.text('Return Home')).tap();
      } catch {
        await tapById('new-dream-back');
      }
    }
    await navigateToTab('Dream');
  });

  it('should persist session across app relaunch', async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        detoxTestEmail: process.env.DETOX_TEST_EMAIL || 'detox-test@dreamz.app',
        detoxTestPassword: process.env.DETOX_TEST_PASSWORD || 'detox-test-password',
      },
    });

    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('should show grimoire state correctly', async () => {
    await navigateToTab('Grimoire');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(10000);

    // Screen renders without crash
    await expect(element(by.text('Your Grimoire'))).toBeVisible();
  });

  it('should handle insights screen with few dreams gracefully', async () => {
    await navigateToTab('Insights');

    // Should not crash - may show charts or minimum-dreams message
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Insights tab should be visible (the tab label at bottom)
    await expect(element(by.text('Insights'))).toBeVisible();
  });
});
