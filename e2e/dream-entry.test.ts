import { element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, waitForNotVisible, navigateToTab } from './helpers/actions';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';

describe('Dream Entry', () => {
  beforeEach(async () => {
    await launchApp(true);
    // Wait for home screen
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('should navigate from home to NewDream screen', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await expect(element(by.text('Record Your Dream'))).toBeVisible();
  });

  it('should submit a dream with text and mood and see reading', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await typeById('new-dream-text-input', TEST_DREAM_TEXT);
    await tapById('new-dream-mood-peaceful');
    await tapById('new-dream-submit');

    // Wait for reading to appear (loading may take time)
    await waitForVisible('reading-title', 60000);
  });

  it('should switch to nightmare type and show nightmare moods', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await tapById('new-dream-type-nightmare');

    // Nightmare moods should appear
    await expect(element(by.id('new-dream-mood-anxious'))).toBeVisible();
    await expect(element(by.id('new-dream-mood-fearful'))).toBeVisible();
  });

  it('should show alert when submitting without text', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await tapById('new-dream-mood-peaceful');
    await tapById('new-dream-submit');

    await waitFor(element(by.text('Please describe your dream')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show alert when submitting without mood', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await typeById('new-dream-text-input', TEST_DREAM_TEXT);
    await tapById('new-dream-submit');

    await waitFor(element(by.text('Please select how your dream felt')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should recover a draft after navigating away and back', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await typeById('new-dream-text-input', 'A draft dream about flying');

    // Wait for auto-save (1s debounce)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Go back
    await tapById('new-dream-back');

    // Re-open NewDream
    await waitForVisible('home-record-button', 5000);
    await tapById('home-record-button');

    // Should see draft recovered banner
    await waitFor(element(by.text('Draft recovered')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should clear a recovered draft', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    // If there's a draft, clear it
    try {
      await waitFor(element(by.text('Draft recovered')))
        .toBeVisible()
        .withTimeout(3000);
      await tapById('new-dream-draft-clear');

      // Draft banner should disappear
      await waitForNotVisible('new-dream-draft-clear', 3000);
    } catch {
      // No draft to clear - that's fine, type one first
      await typeById('new-dream-text-input', 'Draft to clear');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await tapById('new-dream-back');

      await waitForVisible('home-record-button', 5000);
      await tapById('home-record-button');

      await waitFor(element(by.text('Draft recovered')))
        .toBeVisible()
        .withTimeout(5000);
      await tapById('new-dream-draft-clear');
      await waitForNotVisible('new-dream-draft-clear', 3000);
    }
  });
});
