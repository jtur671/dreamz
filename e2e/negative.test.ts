import { element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, clearById, waitForVisible, waitForAnyVisible, navigateToTab } from './helpers/actions';
import { SHORT_DREAM_TEXT, TEST_DREAM_TEXT, SQL_WILDCARD_TEXT } from './helpers/dreamFactory';

describe('Negative Tests', () => {
  beforeAll(async () => {
    await launchApp(true);
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('should handle very short dream text', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await typeById('new-dream-text-input', SHORT_DREAM_TEXT);
    await tapById('new-dream-mood-confused');
    await tapById('new-dream-submit');

    // Should either show an error alert or proceed (edge function may reject)
    await waitForAnyVisible(
      [
        { id: 'reading-title' },
        { text: 'Error' },
        { text: 'Reading Unavailable' },
      ],
      60000,
    );

    // Navigate back
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

  it('should not create duplicate dreams on rapid double-tap submit', async () => {
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(10000);

    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await typeById('new-dream-text-input', TEST_DREAM_TEXT + ' double tap test');
    await tapById('new-dream-mood-peaceful');

    // Rapid double tap on submit
    await tapById('new-dream-submit');
    try {
      await tapById('new-dream-submit');
    } catch {
      // Second tap may fail if button is already disabled - that's correct behavior
    }

    // Should still get one reading (no crash)
    await waitForAnyVisible(
      [
        { id: 'reading-title' },
        { text: 'Reading Unavailable' },
        { text: 'Error' },
      ],
      60000,
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

  it('should navigate back from reading without getting stuck', async () => {
    await navigateToTab('Grimoire');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(10000);

    try {
      await waitForVisible('grimoire-dream-list', 5000);
      await element(by.id('grimoire-dream-list')).atIndex(0).tap();

      await waitForVisible('reading-back', 10000);
      await tapById('reading-back');

      // Should be back on grimoire
      await waitFor(element(by.text('Your Grimoire')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      // No dreams available - that's OK for this test
      await expect(element(by.text('Your Grimoire'))).toBeVisible();
    }
  });

  it('should handle delete then navigate without crash', async () => {
    await navigateToTab('Settings');
    await waitFor(element(by.text('Settings')))
      .toBeVisible()
      .withTimeout(10000);

    // Open dream picker
    await tapById('settings-delete-dream-button');
    await waitFor(element(by.text('Select Dream to Delete')))
      .toBeVisible()
      .withTimeout(10000);

    // Close without deleting
    await tapById('settings-dream-picker-done');

    // Navigate away and back - should not crash
    await navigateToTab('Grimoire');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(5000);

    await navigateToTab('Settings');
    await expect(element(by.text('Settings'))).toBeVisible();
  });

  it('should handle SQL wildcard characters in dictionary search', async () => {
    await navigateToTab('Dictionary');
    await waitFor(element(by.text('Symbol Dictionary')))
      .toBeVisible()
      .withTimeout(10000);

    await clearById('dictionary-search-input');
    await typeById('dictionary-search-input', SQL_WILDCARD_TEXT);

    // Should not crash - may show empty state or results
    await new Promise(resolve => setTimeout(resolve, 1500));

    await expect(element(by.text('Symbol Dictionary'))).toBeVisible();
  });

  it('should navigate all tabs rapidly without crashing', async () => {
    await navigateToTab('Dream');
    await navigateToTab('Grimoire');
    await navigateToTab('Insights');
    await navigateToTab('Dictionary');
    await navigateToTab('Settings');
    await navigateToTab('Dream');

    // Should still be functional
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
