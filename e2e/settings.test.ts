import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, pollForVisibleByText, pollForNotVisibleByText, navigateToTab } from './helpers/actions';
import { setTestAccountPremium, setTestAccountFree, grantTestAccountAIConsent, revokeTestAccountAIConsent } from './helpers/db';

describe('Settings Screen', () => {
  beforeAll(async () => {
    await launchApp(true);
    await pollForVisible('home-record-button', 30000);
    // DreamContext background image backfill fires DALL-E 3 network requests
    // on fresh launch. Disable sync once so all subsequent actions are immediate.
    await device.disableSynchronization();
    // Navigate to Settings once; stay here for all tests
    await navigateToTab('Settings');
    await waitForVisible('settings-zodiac-edit', 10000);
  });

  beforeEach(async () => {
    // Close the zodiac picker if it was left open by the previous test.
    try {
      await element(by.text('Cancel')).atIndex(0).tap();
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch {
      // Zodiac picker not open — that's fine
    }
    // Close the dream picker modal if it was left open.
    try {
      await tapById('settings-dream-picker-done');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {
      // Dream picker not open — that's fine
    }
    // Close any lingering iOS share sheet popover from test 3.
    try {
      await element(by.id('PopoverDismissRegion')).tap();
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {
      // No popover open — that's fine
    }
    // Scroll back to top of Settings so content above the fold is visible
    try {
      await element(by.id('settings-scroll-view')).scrollTo('top');
    } catch {
      // If scroll fails (modal still open), cancel cleanup continues below
    }
    await waitForVisible('settings-zodiac-edit', 10000);
  });

  it('should show email and zodiac sign', async () => {
    await expect(element(by.text('Email'))).toBeVisible();
    await expect(element(by.text('Zodiac Sign'))).toBeVisible();
  });

  it('should update zodiac sign via modal', async () => {
    await tapById('settings-zodiac-edit');

    // Modal should appear
    await pollForVisibleByText('Select Your Sign', 5000);

    // Let the fade-in animation complete before tapping — with sync disabled
    // a tap fired mid-animation may not register with the React touch responder.
    await new Promise(resolve => setTimeout(resolve, 800));

    // Use testID to tap the zodiac option unambiguously — by.text('Aries')
    // would also match the zodiac value on the main Settings screen if Aries
    // happens to be the currently saved zodiac sign.
    await tapById('zodiac-option-aries');

    // Wait for the modal to CLOSE (Supabase write completes then setShowZodiacPicker(false))
    await pollForNotVisibleByText('Select Your Sign', 15000);
  });

  it('should open share sheet on export (no crash)', async () => {
    // Export button is in "Your Data" section — scroll to make it visible
    await element(by.id('settings-scroll-view')).scroll(300, 'down', 0.5, 0.5);
    await pollForVisible('settings-export-button', 5000);
    await tapById('settings-export-button');

    // Wait for share sheet to appear
    await new Promise(resolve => setTimeout(resolve, 2000));

    // On the iOS simulator the share sheet opens as a UIPopoverController.
    // Tapping the PopoverDismissRegion (the dimming backdrop) closes it.
    // Fall back to Cancel button for full-screen sheet presentation.
    try {
      await element(by.id('PopoverDismissRegion')).tap();
    } catch {
      try {
        await element(by.text('Cancel')).atIndex(0).tap();
      } catch {
        // Share sheet may not have appeared (simulator limitation)
      }
    }

    // Give the dismiss animation time to finish
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Still on settings
    await expect(element(by.id('settings-zodiac-edit'))).toBeVisible();
  });

  it('should open dream picker modal', async () => {
    // Scroll down so the delete-dream button is fully visible
    await element(by.id('settings-scroll-view')).scroll(300, 'down', 0.5, 0.5);
    await waitForVisible('settings-delete-dream-button', 5000);
    await tapById('settings-delete-dream-button');

    // Dream picker modal should appear
    await pollForVisibleByText('Select Dream to Delete', 10000);

    // Wait for the Done button to be rendered and for any animations to complete
    // before tapping — tapping mid-animation with sync disabled may not register.
    await waitForVisible('settings-dream-picker-done', 10000);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Close it
    await tapById('settings-dream-picker-done');

    await pollForNotVisibleByText('Select Dream to Delete', 10000);
  });

  // --- Delete account countdown modal tests ---

  it('should show countdown modal when deleting account', async () => {
    // Scroll to delete account link at the very bottom
    await element(by.id('settings-scroll-view')).scrollTo('bottom');
    await pollForVisible('settings-delete-account-button', 5000);
    await tapById('settings-delete-account-button');

    // First confirmation alert
    await pollForVisibleByText('Delete Account', 5000);
    await element(by.text('Yes, Continue')).tap();

    // Countdown modal should appear with disabled button
    await pollForVisibleByText('This Cannot Be Undone', 5000);
    await pollForVisible('settings-delete-confirm-button', 5000);

    // Button should show countdown text
    await pollForVisibleByText('Delete Everything (', 3000);

    // Cancel via "No, Keep My Account"
    await tapById('settings-delete-cancel-button');
    await pollForNotVisibleByText('This Cannot Be Undone', 5000);
  });

  it('should enable delete button after countdown completes', async () => {
    await element(by.id('settings-scroll-view')).scrollTo('bottom');
    await pollForVisible('settings-delete-account-button', 5000);
    await tapById('settings-delete-account-button');

    await pollForVisibleByText('Delete Account', 5000);
    await element(by.text('Yes, Continue')).tap();

    await pollForVisibleByText('This Cannot Be Undone', 5000);

    // Wait for countdown to finish (5 seconds + buffer)
    await new Promise(r => setTimeout(r, 6000));

    // Button text should now show "Delete Everything" without countdown number
    await pollForVisibleByText('Delete Everything', 3000);

    // Cancel rather than actually deleting the test account
    await tapById('settings-delete-cancel-button');
  });

  // --- Premium tier display test ---

  it('should show Manage Subscription for premium users', async () => {
    await setTestAccountPremium();
    // Relaunch to pick up the new tier
    await launchApp(false);
    await pollForVisible('home-record-button', 30000);
    await device.disableSynchronization();
    await navigateToTab('Settings');
    await waitForVisible('settings-zodiac-edit', 10000);

    // Premium user should see "Manage Subscription" not "Upgrade to Premium"
    await pollForVisibleByText('Manage Subscription', 5000);

    // Restore free tier for remaining tests
    await setTestAccountFree();
  });

  // --- Reminder toggle test ---

  it('should show time picker when reminders are toggled on', async () => {
    // Scroll to reminders section
    await element(by.id('settings-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    await pollForVisible('settings-reminder-toggle', 5000);

    // Toggle reminders on
    await tapById('settings-reminder-toggle');

    // Time picker button should appear
    await pollForVisible('settings-reminder-time', 5000);

    // Toggle back off
    await tapById('settings-reminder-toggle');
  });

  it('should show AI consent toggle', async () => {
    await element(by.id('settings-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    await pollForVisible('settings-ai-consent-toggle', 5000);
  });

  it('should show consent modal when enabling AI from settings', async () => {
    // First revoke consent so toggle is off
    await revokeTestAccountAIConsent();
    await launchApp(false);
    await pollForVisible('home-record-button', 30000);
    await device.disableSynchronization();
    await navigateToTab('Settings');
    await waitForVisible('settings-zodiac-edit', 10000);

    await element(by.id('settings-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    await pollForVisible('settings-ai-consent-toggle', 5000);
    await tapById('settings-ai-consent-toggle');

    // Consent modal should appear
    await pollForVisible('ai-consent-modal', 5000);
    await tapById('ai-consent-allow');

    // Re-grant for remaining tests
    await grantTestAccountAIConsent();
  });

  it('should sign out and return to auth screen', async () => {
    // Scroll to bottom so the sign-out button is fully visible
    await element(by.id('settings-scroll-view')).scrollTo('bottom');
    await waitForVisible('settings-signout-button', 5000);
    await tapById('settings-signout-button');

    // Confirm alert
    await pollForVisibleByText('Sign Out', 5000);
    await element(by.text('Sign Out')).atIndex(1).tap();

    // Should return to auth screen
    await waitForVisible('auth-email-input', 10000);
  });
});
