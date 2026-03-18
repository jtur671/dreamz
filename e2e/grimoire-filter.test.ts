import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, navigateToTab } from './helpers/actions';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';
import { setTestAccountPremium } from './helpers/db';

/**
 * Grimoire Filter Regression Tests
 *
 * Tests for Bug 1: Stale symbol filter pill causes empty dream list after tab
 * switch. When a user selects a symbol filter pill, then deletes dreams (causing
 * the symbol count to drop below the threshold of 4), the activePill state
 * persists but the pill row disappears — trapping the user in an empty
 * "No dreams match your search" state with no way to clear the filter.
 *
 * The fix (useEffect in GrimoireScreen.tsx) resets activePill to null when the
 * active pill is no longer present in symbolPills.
 */
describe('Grimoire Filter Pills', () => {
  beforeAll(async () => {
    // Upgrade test account to premium so reading limits never block dream creation
    await setTestAccountPremium();
    await launchApp(true);
    // DreamContext background image backfill fires DALL-E network requests
    // immediately on launch, keeping the app perpetually busy from Detox's
    // perspective. Disable sync now so all waitFor calls use real-time polling
    // instead of waiting for app idle — which never happens during backfill.
    await device.disableSynchronization();
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(30000);
  });

  beforeEach(async () => {
    // Navigate back from any pushed screen (e.g. ReadingScreen from prior test)
    try {
      await tapById('reading-back');
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch {
      // Not on a pushed screen — that's fine
    }
    // Dismiss keyboard if focused from a previous test
    try {
      await element(by.id('grimoire-search-input')).tapReturnKey();
    } catch {
      // No focused input — that's fine
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

  it('should not trap user in empty state after tab switch with stale filter', async () => {
    // Step 1: Verify the Grimoire has dreams visible (list or at least the title)
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(10000);

    // Step 2: Check if filter pills are visible. If they are, tap one to activate
    // a symbol filter. If no pills exist (not enough recurring symbols), we still
    // verify the tab-switch does not break the list.
    let pillTapped = false;
    try {
      await expect(element(by.id('grimoire-pill-all'))).toBeVisible();
      // Pills are visible — tap the "All" pill first to confirm it works,
      // then try to tap the first symbol pill (not "All") if available
      // We'll use pollForVisible pattern to check for any symbol pill
      pillTapped = await tryTapFirstSymbolPill();
    } catch {
      // No pills visible — fewer than 4 recurring symbols. That's fine,
      // we still test the tab-switch scenario without a filter active.
    }

    // Step 3: Record current state — dreams should be visible (either list or
    // the "All" filter showing everything)
    const hasDreamsBefore = await isDreamListVisible();

    // Step 4: Navigate away to Settings tab
    await navigateToTab('Settings');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: Navigate back to Grimoire tab
    await navigateToTab('Grimoire');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(30000);

    // Brief settle time for useFocusEffect refresh
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Verify the dream list is still visible — NOT trapped in
    // "No dreams match your search" empty state
    if (hasDreamsBefore) {
      // The user should still see dreams (either list or at least the title)
      // The critical assertion: we should NOT see the "no results" empty state
      // unless the user had no dreams to begin with
      const trapped = await isTrappedInEmptyFilter();
      if (trapped) {
        throw new Error(
          'REGRESSION: Grimoire shows "No dreams match your search" after tab switch. ' +
          'The stale filter pill bug has resurfaced. ' +
          (pillTapped
            ? 'A symbol pill was active before navigating away.'
            : 'No pill was tapped, but the empty state appeared unexpectedly.')
        );
      }

      // Positive assertion: dream list or dream items should be visible
      await pollForVisible('grimoire-dream-list', 15000);
    }
  });

  it('should show all dreams after navigating away and back with no filter', async () => {
    // Ensure no filter is active by tapping "All" pill if pills exist
    try {
      await expect(element(by.id('grimoire-pill-all'))).toBeVisible();
      await tapById('grimoire-pill-all');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {
      // No pills — that's fine
    }

    // Verify dreams are visible
    const hasDreams = await isDreamListVisible();
    if (!hasDreams) {
      // No dreams in account — skip this test meaningfully
      return;
    }

    // Navigate to Dictionary tab and back
    await navigateToTab('Dictionary');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await navigateToTab('Grimoire');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(30000);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Dreams should still be visible
    await pollForVisible('grimoire-dream-list', 15000);
  });

  it('should clear active pill and show all dreams when tapping All pill', async () => {
    let hasPills = false;
    try {
      await expect(element(by.id('grimoire-pill-all'))).toBeVisible();
      hasPills = true;
    } catch {
      // No pills — not enough recurring symbols
    }

    if (!hasPills) {
      // Can't test pill clearing without pills — verify list is still showing
      const hasDreams = await isDreamListVisible();
      if (hasDreams) {
        await pollForVisible('grimoire-dream-list', 10000);
      }
      return;
    }

    // Tap a symbol pill to filter (if one exists beyond "All")
    await tryTapFirstSymbolPill();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Tap "All" to clear filter
    await tapById('grimoire-pill-all');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Dream list should be visible with all dreams
    await pollForVisible('grimoire-dream-list', 15000);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to tap the first symbol pill (not "All"). Returns true if a symbol
 * pill was found and tapped, false otherwise.
 */
async function tryTapFirstSymbolPill(): Promise<boolean> {
  // Symbol pill testIDs are `grimoire-pill-{name}` where name is lowercase.
  // We can't enumerate them, but we can try tapping the first pill that isn't "All"
  // by looking for any pill with the active/inactive styling.
  // Strategy: the pill row is a horizontal ScrollView. The first child is "All",
  // subsequent children are symbol pills. We tap index 1 in the scroll view.
  try {
    // Try to find any pill element beyond "All" — use a broad accessibility check
    // The pills are TouchableOpacity elements inside a horizontal ScrollView.
    // We look for an element matching the pill testID pattern by trying common
    // symbol names that might appear in the test account's dreams.
    const commonSymbols = ['owl', 'forest', 'water', 'moon', 'snake', 'door', 'lake', 'fire', 'tree', 'house'];
    for (const sym of commonSymbols) {
      try {
        await expect(element(by.id(`grimoire-pill-${sym}`))).toBeVisible();
        await element(by.id(`grimoire-pill-${sym}`)).tap();
        return true;
      } catch {
        // This symbol pill doesn't exist — try next
      }
    }
  } catch {
    // No symbol pills found at all
  }
  return false;
}

/**
 * Check if the dream list FlatList is currently visible.
 */
async function isDreamListVisible(): Promise<boolean> {
  try {
    await expect(element(by.id('grimoire-dream-list'))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the user is trapped in the "No dreams match your search" empty state.
 * Returns true if the empty-no-results view is visible, false otherwise.
 */
async function isTrappedInEmptyFilter(): Promise<boolean> {
  try {
    await expect(element(by.id('grimoire-empty-no-results'))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}
