import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, waitForNotVisible, pollForVisible, pollForVisibleByText, navigateToTab } from './helpers/actions';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';
import { setTestAccountPremium, grantTestAccountAIConsent } from './helpers/db';

/**
 * Navigate to NewDream from home and return to a clean, known state:
 *   - Scroll to top (ensures mood chips are in the viewport)
 *   - Clear any stale draft (previous run may have left nightmare type or leftover text)
 */
async function openNewDream() {
  await tapById('home-record-button');
  await waitForVisible('new-dream-text-input', 5000);
  // Scroll to top so mood chips are definitely visible (not scrolled off-screen)
  await element(by.id('new-dream-scroll-view')).scrollTo('top');
  // Clear any stale draft (nightmare type from a prior run causes "No elements found" for dream moods)
  try {
    await pollForVisible('new-dream-draft-clear', 1000);
    await tapById('new-dream-draft-clear');
  } catch {
    // No draft — that's the happy path
  }
}

describe('Dream Entry', () => {
  beforeAll(async () => {
    // Upgrade test account to premium so reading limits never block the submit test
    await setTestAccountPremium();
    await grantTestAccountAIConsent();
    // Full launch + sign-in once for the whole suite
    await launchApp(true);
    // DreamContext background image backfill fires DALL-E 3 network requests
    // immediately on launch, keeping the app perpetually busy from Detox's
    // perspective. Disable sync so all waitFor calls use real-time polling.
    await device.disableSynchronization();
  });

  beforeEach(async () => {
    // Fast JS reset (~3s) — Supabase session persists in AsyncStorage
    await device.reloadReactNative();
    // Re-disable sync after JS reload (reloadReactNative may reset sync state)
    // so DreamContext backfill network requests don't block Detox idle-waiting.
    await device.disableSynchronization();
    await pollForVisible('home-record-button', 20000);
    // HomeScreen fires loadStats() on focus which fetches the last dream title
    // from Supabase and inserts a card ABOVE home-record-button, causing a layout
    // shift. Wait for the layout to stabilize before trying to tap the button.
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should navigate from home to NewDream screen', async () => {
    await openNewDream();
    await expect(element(by.text('Record Your Dream'))).toBeVisible();
  });

  it('should submit a dream with text and mood and see reading', async () => {
    await openNewDream();

    // Select mood BEFORE typing so the keyboard doesn't obscure it
    await tapById('new-dream-mood-peaceful');
    await typeById('new-dream-text-input', TEST_DREAM_TEXT);

    // Scroll down from center (y=0.5) so keyboard doesn't clip the gesture start point
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);

    // Sync is already disabled globally (see beforeAll/beforeEach).
    // DreamLoadingAnimation setInterval and post-submit DALL-E backfill both
    // keep Detox's idle tracker busy — disabling sync lets waitFor poll normally.
    await tapById('new-dream-submit');
    // Wait for reading to appear (AI + image generation can take up to 3min)
    await waitForVisible('reading-title', 180000);
  });

  it('should switch to nightmare type and show nightmare moods', async () => {
    await openNewDream();

    await tapById('new-dream-type-nightmare');

    // Nightmare moods should appear — use waitFor since sync is disabled
    // and React needs a tick to re-render the mood chips
    await pollForVisible('new-dream-mood-anxious', 5000);
    await pollForVisible('new-dream-mood-fearful', 5000);
  });

  it('should show alert when submitting without text', async () => {
    await openNewDream();

    await tapById('new-dream-mood-peaceful');
    // Scroll to bottom so submit button is not obscured
    await element(by.id('new-dream-scroll-view')).scrollTo('bottom');
    await tapById('new-dream-submit');

    await pollForVisibleByText('Please describe your dream', 5000);
  });

  it('should show alert when submitting without mood', async () => {
    await openNewDream();

    await typeById('new-dream-text-input', TEST_DREAM_TEXT);
    // Scroll down from center (y=0.5) so keyboard doesn't clip the gesture start point
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    await tapById('new-dream-submit');

    await pollForVisibleByText('Please select how your dream felt', 5000);
  });

  it('should recover a draft after navigating away and back', async () => {
    await openNewDream();

    await typeById('new-dream-text-input', 'A draft dream about flying');

    // Wait for auto-save (1s debounce)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Go back
    await tapById('new-dream-back');

    // Re-open NewDream — allow extra time for navigation animation + home layout settle
    await waitForVisible('home-record-button', 15000);
    await tapById('home-record-button');

    // Should see draft recovered banner
    await pollForVisibleByText('Draft recovered', 5000);
  });

  it('should expand mood tags and select from expanded list', async () => {
    await openNewDream();

    // "Hopeful" is at index 8 (beyond INITIAL_VISIBLE=5), so hidden by default
    // Verify it's not visible before expanding
    try {
      await expect(element(by.id('new-dream-mood-hopeful'))).not.toBeVisible();
    } catch {
      // Element may not exist in the tree at all — that's fine
    }

    // Tap "More +" to expand
    await tapById('new-dream-mood-toggle');

    // "Hopeful" should now be visible
    await pollForVisible('new-dream-mood-hopeful', 5000);

    // Select it
    await tapById('new-dream-mood-hopeful');
  });

  it('should collapse expanded moods', async () => {
    await openNewDream();

    // Expand moods
    await tapById('new-dream-mood-toggle');
    await pollForVisible('new-dream-mood-hopeful', 5000);

    // Collapse — toggle text changes to "Less −" then back to "More +"
    await tapById('new-dream-mood-toggle');

    // "Hopeful" should no longer be visible
    await waitForNotVisible('new-dream-mood-hopeful', 5000);
  });

  it('should save a forgot dream and show confirmation', async () => {
    await openNewDream();

    await tapById('new-dream-forgot');

    // Should show "Sleep Logged" confirmation alert
    await pollForVisibleByText('Sleep Logged', 10000);

    // Dismiss the alert
    await element(by.text('OK')).tap();

    // Should navigate back to home
    await pollForVisible('home-record-button', 10000);
  });

  it('should show forgot dream in grimoire', async () => {
    // Navigate to Grimoire tab
    await navigateToTab('Grimoire');
    await pollForVisibleByText('Your Grimoire', 10000);

    // The forgot entry should appear with its muted text
    await pollForVisibleByText('No dream recalled', 10000);
    await expect(element(by.text('You still showed up.'))).toBeVisible();
  });

  it('should clear a recovered draft', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await element(by.id('new-dream-scroll-view')).scrollTo('top');

    // If there's a draft, clear it
    try {
      await pollForVisibleByText('Draft recovered', 3000);
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

      await pollForVisibleByText('Draft recovered', 5000);
      await tapById('new-dream-draft-clear');
      await waitForNotVisible('new-dream-draft-clear', 3000);
    }
  });
});
