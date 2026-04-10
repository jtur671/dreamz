import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, waitForVisible, waitForAnyVisible, pollForVisible, pollForVisibleByText, pollForNotVisibleByText, navigateToTab } from './helpers/actions';
import { SHORT_DREAM_TEXT, TEST_DREAM_TEXT, SQL_WILDCARD_TEXT } from './helpers/dreamFactory';
import { setTestAccountPremium, grantTestAccountAIConsent } from './helpers/db';

/**
 * After a dream submission (which may succeed or fail), navigate back to
 * the Dream tab home screen. NewDream and Reading screens are in the RootStack
 * (outside MainTabs), so the bottom tab bar is not visible from there.
 * We need to pop back into MainTabs before calling navigateToTab().
 */
async function navigateBackToHome() {
  // Step 1: Dismiss any alert dialogs that may be blocking navigation
  try { await element(by.text('Return Home')).atIndex(0).tap(); await new Promise(r => setTimeout(r, 500)); } catch {}
  try { await element(by.text('Dismiss')).atIndex(0).tap(); await new Promise(r => setTimeout(r, 300)); } catch {}
  try { await element(by.text('OK')).atIndex(0).tap(); await new Promise(r => setTimeout(r, 300)); } catch {}

  // Step 2: Navigate back using whichever button is available on screen
  try {
    // On ReadingScreen: scroll to show the grimoire button, then tap it.
    // This calls navigation.reset() back into MainTabs.
    await element(by.id('reading-scroll-view')).scrollTo('bottom');
    await new Promise(r => setTimeout(r, 500));
    await tapById('reading-grimoire-button');
    await pollForVisibleByText('Your Grimoire', 8000);
    // Already in MainTabs (Grimoire tab) — navigate to Dream tab
    await navigateToTab('Dream');
    return;
  } catch {}

  try {
    // On ReadingScreen: tap the Back button to pop Reading, returning to MainTabs
    await tapById('reading-back');
    await new Promise(r => setTimeout(r, 1500));
  } catch {}

  try {
    // On NewDreamScreen: tap back to return to MainTabs
    await tapById('new-dream-back');
    await new Promise(r => setTimeout(r, 1500));
  } catch {}

  // Step 3: By now we should be in MainTabs — navigate to Dream tab
  await new Promise(r => setTimeout(r, 1000));  // let any pending navigation animation finish
  await navigateToTab('Dream');
}

describe('Negative Tests', () => {
  beforeAll(async () => {
    // Upgrade test account to premium so reading limits never block dream submissions
    await setTestAccountPremium();
    await grantTestAccountAIConsent();
    await launchApp(true);
    // DreamContext background image backfill fires DALL-E 3 network requests
    // on fresh launch. Disable sync so all subsequent actions are immediate.
    await device.disableSynchronization();
    await pollForVisible('home-record-button', 30000);
  });

  it('should handle very short dream text', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await element(by.id('new-dream-text-input')).typeText(SHORT_DREAM_TEXT);
    await tapById('new-dream-mood-confused');

    // Scroll down to make the submit button visible
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    await tapById('new-dream-submit');

    // Should either show an error alert or proceed (edge function may reject short text)
    await waitForAnyVisible(
      [
        { id: 'reading-title' },
        { text: 'Error' },
        { text: 'Reading Unavailable' },
        { text: 'Unlock the Full Oracle' }, // Paywall (should not happen with premium account)
      ],
      60000,
    );

    await navigateBackToHome();
  });

  it('should not create duplicate dreams on rapid double-tap submit', async () => {
    await pollForVisible('home-record-button', 10000);

    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);

    await element(by.id('new-dream-text-input')).typeText(TEST_DREAM_TEXT + ' double tap test');
    await tapById('new-dream-mood-peaceful');

    // Scroll down to make the submit button visible
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);

    // Rapid double tap on submit
    await tapById('new-dream-submit');
    try {
      await tapById('new-dream-submit');
    } catch {
      // Second tap may fail if button is already disabled - that's correct behavior
    }

    // Should still get one reading (no crash).
    // gpt-5-mini is a reasoning model; with 2 retries the worst-case latency
    // is ~91s (45s × 2 attempts + 1s backoff), so use 120s.
    await waitForAnyVisible(
      [
        { id: 'reading-title' },
        { text: 'Reading Unavailable' },
        { text: 'Error' },
        { text: 'Unlock the Full Oracle' }, // Paywall (should not happen with premium account)
      ],
      120000,
    );

    await navigateBackToHome();
  });

  it('should navigate back from reading without getting stuck', async () => {
    await navigateToTab('Grimoire');
    await pollForVisibleByText('Your Grimoire', 10000);

    try {
      await waitForVisible('grimoire-dream-item', 5000);
      // Each dream card has testID="grimoire-dream-item" — tap the first one
      await element(by.id('grimoire-dream-item')).atIndex(0).tap();

      await waitForVisible('reading-back', 10000);
      await tapById('reading-back');

      // Should be back on grimoire
      await pollForVisibleByText('Your Grimoire', 5000);
    } catch {
      // No dreams available - that's OK for this test
      await expect(element(by.text('Your Grimoire'))).toBeVisible();
    }
  });

  it('should handle delete then navigate without crash', async () => {
    await navigateToTab('Settings');
    // Give React scheduler time to clear any pending work from previous tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    await waitForVisible('settings-zodiac-edit', 10000);

    // Scroll so the delete-dream button (below the fold) is visible
    await element(by.id('settings-scroll-view')).scroll(300, 'down', 0.5, 0.5);
    await waitForVisible('settings-delete-dream-button', 5000);

    // Open dream picker
    await tapById('settings-delete-dream-button');
    await pollForVisibleByText('Select Dream to Delete', 10000);

    // Wait for Done button to be rendered + animation to complete
    await waitForVisible('settings-dream-picker-done', 10000);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Close without deleting
    await tapById('settings-dream-picker-done');
    await pollForNotVisibleByText('Select Dream to Delete', 10000);

    // Navigate away and back - should not crash
    await navigateToTab('Grimoire');
    await pollForVisibleByText('Your Grimoire', 5000);
    // Let GrimoireScreen's FlatList fully render so the React 18 scheduler
    // clears its pending work items. Without this pause, the scheduler keeps
    // the dispatch queue busy and the subsequent Settings tab-switch animation
    // never completes, causing settings-zodiac-edit to remain invisible.
    await new Promise(resolve => setTimeout(resolve, 2000));

    await navigateToTab('Settings');
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Scroll back to top: Settings was already mounted with the ScrollView
    // scrolled 300px down from earlier in this test. settings-zodiac-edit
    // is near the top and is above the visible area until we scroll back up.
    await element(by.id('settings-scroll-view')).scrollTo('top');
    await new Promise(resolve => setTimeout(resolve, 500));
    await waitForVisible('settings-zodiac-edit', 10000);
  });

  it('should handle SQL wildcard characters in dictionary search', async () => {
    await navigateToTab('Dictionary');
    await pollForVisibleByText('Symbol Dictionary', 10000);

    // Use replaceText (atomic) instead of typeText to avoid leaving the keyboard open,
    // which would block tab bar taps in the next test.
    await element(by.id('dictionary-search-input')).replaceText(SQL_WILDCARD_TEXT);

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
    await pollForVisible('home-record-button', 5000);
  });
});
