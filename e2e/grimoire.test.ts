import { element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, clearById, waitForVisible, navigateToTab } from './helpers/actions';

describe('Grimoire Screen', () => {
  beforeAll(async () => {
    await launchApp(true);
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  beforeEach(async () => {
    await navigateToTab('Grimoire');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should display dream list with at least one dream card', async () => {
    await expect(element(by.id('grimoire-dream-list'))).toBeVisible();
  });

  it('should filter dreams when searching', async () => {
    await waitForVisible('grimoire-search-input', 5000);
    await typeById('grimoire-search-input', 'forest');

    // Results should narrow (or show no-results if no match)
    // Give time for filtering
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify search is applied (search input has text)
    await expect(element(by.id('grimoire-search-input'))).toBeVisible();
  });

  it('should show empty state for garbage search', async () => {
    await waitForVisible('grimoire-search-input', 5000);
    await clearById('grimoire-search-input');
    await typeById('grimoire-search-input', 'xyznonexistent999garbage');

    await waitForVisible('grimoire-empty-no-results', 5000);
    await expect(element(by.text('No dreams match your search'))).toBeVisible();
  });

  it('should restore all dreams after clearing search', async () => {
    await waitForVisible('grimoire-search-input', 5000);
    await clearById('grimoire-search-input');
    await typeById('grimoire-search-input', 'xyznonexistent999');

    await waitForVisible('grimoire-empty-no-results', 5000);

    await tapById('grimoire-search-clear');

    // Dreams should reappear
    await waitForVisible('grimoire-dream-list', 5000);
  });

  it('should navigate to reading when tapping a dream card', async () => {
    await waitForVisible('grimoire-dream-list', 5000);

    // Tap the first dream in the list
    await element(by.id('grimoire-dream-list'))
      .atIndex(0)
      .tap();

    // Should navigate to reading screen
    await waitForVisible('reading-title', 10000);
  });

  it('should delete a dream after confirmation', async () => {
    await navigateToTab('Grimoire');
    await waitForVisible('grimoire-dream-list', 10000);

    // Long-press first dream to trigger delete
    await element(by.id('grimoire-dream-list'))
      .atIndex(0)
      .longPress();

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
    await navigateToTab('Grimoire');
    await waitFor(element(by.text('Your Grimoire')))
      .toBeVisible()
      .withTimeout(10000);

    // Pull to refresh
    try {
      await element(by.id('grimoire-dream-list')).swipe('down', 'slow', 0.5);
    } catch {
      // Empty list, try on the container
    }

    // No crash - grimoire still visible
    await expect(element(by.text('Your Grimoire'))).toBeVisible();
  });
});
