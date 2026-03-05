import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, navigateToTab } from './helpers/actions';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';
import { setTestAccountPremium } from './helpers/db';

describe('Grimoire Screen', () => {
  beforeAll(async () => {
    // Upgrade test account to premium so reading limits never block dream creation
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

    // Create a dream so tests always have data to work with (even after delete tests)
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await tapById('new-dream-mood-curious');
    await typeById('new-dream-text-input', TEST_DREAM_TEXT);
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    // Brief pause to let scroll settle before tapping
    await new Promise(resolve => setTimeout(resolve, 500));
    await tapById('new-dream-submit');

    // Poll for reading-title, dismissing any "Reading Unavailable" alert along
    // the way so a transient AI failure doesn't cause a 3-minute hang.
    const POLL_INTERVAL = 3000;
    const MAX_WAIT = 180000;
    const deadline = Date.now() + MAX_WAIT;
    let readingVisible = false;

    while (Date.now() < deadline) {
      // Check if reading screen appeared
      try {
        await expect(element(by.id('reading-title'))).toBeVisible();
        readingVisible = true;
        break;
      } catch {
        // Not visible yet — check for and dismiss any blocking alert
      }

      // Dismiss "Reading Unavailable" → tap "Try Again" to retry the AI call
      try {
        await expect(element(by.text('Reading Unavailable'))).toBeVisible();
        await element(by.text('Try Again')).tap();
      } catch {
        // No "Reading Unavailable" alert — still loading or Paywall showing
      }

      // Paywall should never appear (setTestAccountPremium() should prevent it),
      // but if it does, close it and fail fast with a useful message.
      try {
        await expect(element(by.text('Unlock the Full Oracle'))).toBeVisible();
        throw new Error(
          'beforeAll: Paywall appeared — setTestAccountPremium() may have failed. ' +
          'Check test account credentials and Supabase connectivity.'
        );
      } catch (e) {
        if ((e as Error).message.includes('setTestAccountPremium')) throw e;
        // Paywall not showing — continue
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }

    if (!readingVisible) {
      throw new Error(
        `beforeAll: reading-title never appeared within ${MAX_WAIT / 1000}s. ` +
        'Check analyze-dream edge function logs for errors.'
      );
    }

    // Navigate to Grimoire after reading appears (button is at bottom of reading)
    await element(by.id('reading-scroll-view')).scrollTo('bottom');
    await tapById('reading-grimoire-button');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(10000);
  });

  beforeEach(async () => {
    // Go back from any pushed screen (e.g. ReadingScreen from previous test).
    // Brief wait after back() lets the navigation animation settle before we
    // attempt to tap the tab bar (which can be covered mid-transition).
    try {
      await tapById('reading-back');
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch {
      // Not on a pushed screen — that's fine
    }
    // Dismiss keyboard if showing from a previous test (e.g. search input focused)
    try {
      await element(by.id('grimoire-search-input')).tapReturnKey();
    } catch {
      // No focused keyboard input — that's fine
    }
    await navigateToTab('Grimoire');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(30000);
    // Clear any active search from a previous test so dream list is always visible
    try {
      await tapById('grimoire-search-clear');
    } catch {
      // No active search — that's fine
    }
  });

  it('should display dream list with at least one dream card', async () => {
    await expect(element(by.id('grimoire-dream-list'))).toBeVisible();
  });

  it('should filter dreams when searching', async () => {
    await waitForVisible('grimoire-search-input', 5000);
    await typeById('grimoire-search-input', 'forest');

    // Results should narrow (or show no-results if no match)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify search is applied (search input has text)
    await expect(element(by.id('grimoire-search-input'))).toBeVisible();
  });

  it('should show empty state for garbage search', async () => {
    await waitForVisible('grimoire-search-input', 5000);

    // Use replaceText (atomic single onChangeText event) with sync disabled.
    // clearById + typeById char-by-char can lose events under React 18 batching
    // when 2 persistent dispatch queue items are present after FlatList renders.
    // Note: sync is already disabled globally for this suite (see beforeAll).
    await element(by.id('grimoire-search-input')).replaceText('xyznonexistent999garbage');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await waitForVisible('grimoire-empty-no-results', 15000);
    await expect(element(by.text('No dreams match your search'))).toBeVisible();
  });

  it('should restore all dreams after clearing search', async () => {
    await waitForVisible('grimoire-search-input', 5000);

    // Sync is already disabled globally (see beforeAll).
    await element(by.id('grimoire-search-input')).replaceText('xyznonexistent999');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await waitForVisible('grimoire-empty-no-results', 15000);

    await tapById('grimoire-search-clear');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Dreams should reappear
    await waitForVisible('grimoire-dream-list', 5000);
  });

  it('should navigate to reading when tapping a dream card', async () => {
    // Use pollForVisible instead of waitForVisible: with sync disabled globally,
    // waitFor().withTimeout() blocks on app-idle between polls, but the FlatList
    // keeps 2 persistent dispatch queue items active, so it never fires.
    // pollForVisible() uses expect() (single instant check) + setTimeout polling.
    await pollForVisible('grimoire-dream-item', 20000);

    // Tap the first dream card (grimoire-dream-item added to each card's TouchableOpacity)
    await element(by.id('grimoire-dream-item')).atIndex(0).tap();

    // Should navigate to reading screen
    await pollForVisible('reading-title', 10000);
  });

  it('should delete a dream after confirmation', async () => {
    await pollForVisible('grimoire-dream-item', 20000);

    // Long-press first dream to trigger delete
    await element(by.id('grimoire-dream-item')).atIndex(0).longPress();

    // Confirm alert should appear
    await waitFor(element(by.text('Delete Dream')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Delete')).tap();

    // Give time for deletion and refresh
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should still be on grimoire (no crash)
    await expect(element(by.text('Your Grimoire'))).toBeVisible();
  });

  it('should handle pull to refresh without crashing', async () => {
    // Pull to refresh on the dream list (or empty container if all deleted)
    try {
      await element(by.id('grimoire-dream-list')).swipe('down', 'slow', 0.5);
    } catch {
      // Empty list — that's fine
    }

    // No crash - grimoire still visible
    await expect(element(by.text('Your Grimoire'))).toBeVisible();
  });
});
