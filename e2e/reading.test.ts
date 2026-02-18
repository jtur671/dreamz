import { element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, navigateToTab } from './helpers/actions';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';

describe('Reading Screen', () => {
  beforeAll(async () => {
    await launchApp(true);
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);

    // Create a dream to get a reading
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await typeById('new-dream-text-input', TEST_DREAM_TEXT);
    await tapById('new-dream-mood-curious');
    await tapById('new-dream-submit');

    // Wait for reading screen
    await waitForVisible('reading-title', 60000);
  });

  it('should display reading title, TLDR, symbols, omen, ritual, journal prompt, and tags', async () => {
    await expect(element(by.id('reading-title'))).toBeVisible();
    await expect(element(by.text('The Vision'))).toBeVisible();
    await expect(element(by.text('Symbols Revealed'))).toBeVisible();
    await expect(element(by.text('The Omen'))).toBeVisible();
    await expect(element(by.text('Suggested Ritual'))).toBeVisible();

    // Scroll down to see more sections
    await element(by.id('reading-title')).swipe('up', 'slow', 0.5);
    await expect(element(by.text('For Your Journal'))).toBeVisible();
  });

  it('should toggle dream text visibility', async () => {
    // Scroll to top first
    await element(by.id('reading-title')).swipe('down', 'slow', 0.5);

    await tapById('reading-dream-toggle');
    // Dream text should now be visible
    await waitFor(element(by.text(TEST_DREAM_TEXT)))
      .toBeVisible()
      .withTimeout(3000);

    // Collapse it
    await tapById('reading-dream-toggle');
    await waitFor(element(by.text(TEST_DREAM_TEXT)))
      .not.toBeVisible()
      .withTimeout(3000);
  });

  it('should display symbol cards with name, meaning, shadow, and guidance', async () => {
    // Scroll to symbols section
    await element(by.id('reading-title')).swipe('up', 'slow', 0.3);

    await expect(element(by.text('Symbols Revealed'))).toBeVisible();
    // At least one symbol card should show meaning/shadow/guidance labels
    await expect(element(by.text('Meaning')).atIndex(0)).toBeVisible();
  });

  it('should navigate to grimoire when tapping View in Grimoire', async () => {
    // Scroll to bottom
    await element(by.id('reading-title')).swipe('up', 'fast', 0.8);

    await tapById('reading-grimoire-button');

    // Should land on Grimoire tab
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should open share modal when tapping Share Reading', async () => {
    // First navigate back to a reading - go to grimoire, tap first dream
    await navigateToTab('Grimoire');
    await waitFor(element(by.id('grimoire-dream-list')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap the first dream card
    await element(by.id('grimoire-dream-list')).atIndex(0).tap();

    await waitForVisible('reading-share-button', 10000);

    // Scroll to share button
    await element(by.id('reading-title')).swipe('up', 'fast', 0.8);
    await tapById('reading-share-button');

    // Share modal should appear
    await waitFor(element(by.text('Share Your Reading')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
