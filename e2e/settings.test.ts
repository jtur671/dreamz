import { element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, waitForVisible, navigateToTab } from './helpers/actions';

describe('Settings Screen', () => {
  beforeAll(async () => {
    await launchApp(true);
    await waitFor(element(by.text('Welcome, Dreamer')))
      .toBeVisible()
      .withTimeout(15000);
  });

  beforeEach(async () => {
    await navigateToTab('Settings');
    await waitFor(element(by.text('Settings')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should show email and zodiac sign', async () => {
    await expect(element(by.text('Email'))).toBeVisible();
    await expect(element(by.text('Zodiac Sign'))).toBeVisible();
  });

  it('should update zodiac sign via modal', async () => {
    await tapById('settings-zodiac-edit');

    // Modal should appear
    await waitFor(element(by.text('Select Your Sign')))
      .toBeVisible()
      .withTimeout(5000);

    // Select Leo
    await element(by.text('Leo')).tap();

    // Modal should close and Leo should be visible
    await waitFor(element(by.text('Leo')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should open share sheet on export (no crash)', async () => {
    await tapById('settings-export-button');

    // Share sheet should appear or at minimum no crash
    // Wait a moment for the share sheet to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Dismiss share sheet if it appeared (platform-specific)
    try {
      await element(by.text('Cancel')).atIndex(0).tap();
    } catch {
      // Share sheet might auto-dismiss or not appear in simulator
    }

    // Still on settings
    await expect(element(by.text('Settings'))).toBeVisible();
  });

  it('should open dream picker modal', async () => {
    await tapById('settings-delete-dream-button');

    // Dream picker modal should appear
    await waitFor(element(by.text('Select Dream to Delete')))
      .toBeVisible()
      .withTimeout(10000);

    // Close it
    await tapById('settings-dream-picker-done');

    await waitFor(element(by.text('Select Dream to Delete')))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it('should sign out and return to auth screen', async () => {
    await tapById('settings-signout-button');

    // Confirm alert
    await waitFor(element(by.text('Sign Out')).atIndex(1))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('Sign Out')).atIndex(1).tap();

    // Should return to auth screen
    await waitForVisible('auth-email-input', 10000);
  });
});
