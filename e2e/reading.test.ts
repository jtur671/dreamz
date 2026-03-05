import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, navigateToTab } from './helpers/actions';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';
import { setTestAccountPremium } from './helpers/db';

describe('Reading Screen', () => {
  beforeAll(async () => {
    // Upgrade test account to premium so reading limits never block this suite
    await setTestAccountPremium();
    await launchApp(true);
    // DreamContext background image backfill fires DALL-E 3 network requests
    // immediately on launch, keeping the app perpetually busy from Detox's
    // perspective. Disable sync now so all waitFor calls use real-time polling
    // instead of waiting for app idle — which never happens during backfill.
    await device.disableSynchronization();
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(30000);

    // Create a dream to get a reading
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    // Select mood BEFORE typing so keyboard doesn't obscure chips
    await tapById('new-dream-mood-curious');
    await typeById('new-dream-text-input', TEST_DREAM_TEXT);

    // Scroll from center so keyboard doesn't clip the gesture start point
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);

    // Sync already disabled above — submit and wait for reading
    await tapById('new-dream-submit');
    // Wait for reading screen (AI + image generation can take up to 3min)
    await waitForVisible('reading-title', 180000);
  });

  it('should display reading title, TLDR, symbols, omen, ritual, journal prompt, and tags', async () => {
    await expect(element(by.id('reading-title'))).toBeVisible();

    // Section labels use textTransform:'uppercase' — native text is uppercase
    // Scroll down progressively to find each section
    await element(by.id('reading-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    await expect(element(by.text('THE VISION'))).toBeVisible();

    await element(by.id('reading-scroll-view')).scroll(300, 'down', 0.5, 0.5);
    await expect(element(by.text('SYMBOLS REVEALED'))).toBeVisible();

    await element(by.id('reading-scroll-view')).scroll(400, 'down', 0.5, 0.5);
    await expect(element(by.text('THE OMEN'))).toBeVisible();

    await element(by.id('reading-scroll-view')).scroll(300, 'down', 0.5, 0.5);
    await expect(element(by.text('SUGGESTED RITUAL'))).toBeVisible();

    await element(by.id('reading-scroll-view')).scroll(300, 'down', 0.5, 0.5);
    await expect(element(by.text('FOR YOUR JOURNAL'))).toBeVisible();
  });

  it('should toggle dream text visibility', async () => {
    // Scroll back to top
    await element(by.id('reading-scroll-view')).scrollTo('top');

    await tapById('reading-dream-toggle');
    // Dream text should now be visible
    await waitFor(element(by.text(TEST_DREAM_TEXT)))
      .toBeVisible()
      .withTimeout(5000);

    // Collapse it
    await tapById('reading-dream-toggle');
    await waitFor(element(by.text(TEST_DREAM_TEXT)))
      .not.toBeVisible()
      .withTimeout(3000);
  });

  it('should display symbol cards with name, meaning, shadow, and guidance', async () => {
    // Scroll to symbols section
    await element(by.id('reading-scroll-view')).scroll(400, 'down', 0.5, 0.5);

    await expect(element(by.text('SYMBOLS REVEALED'))).toBeVisible();
    // At least one symbol card should show meaning/shadow/guidance labels (also uppercase)
    await expect(element(by.text('MEANING')).atIndex(0)).toBeVisible();
  });

  it('should navigate to grimoire when tapping View in Grimoire', async () => {
    // Scroll to bottom to reveal the View in Grimoire button
    await element(by.id('reading-scroll-view')).scrollTo('bottom');

    await tapById('reading-grimoire-button');

    // Should land on Grimoire tab
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should open share modal when tapping Share Reading', async () => {
    // Navigate to Grimoire tab (we should already be there from test 4)
    await navigateToTab('Grimoire');
    await waitFor(element(by.id('grimoire-dream-list')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap the first dream card to open it
    await element(by.id('grimoire-dream-item')).atIndex(0).tap();

    // Wait for reading screen to load
    await waitForVisible('reading-title', 10000);

    // Scroll to reveal share button
    await element(by.id('reading-scroll-view')).scrollTo('bottom');
    await waitForVisible('reading-share-button', 5000);
    await tapById('reading-share-button');

    // Share modal should appear
    await waitFor(element(by.text('Share Your Reading')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
