import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, pollForVisibleByText, pollForNotVisibleByText, navigateToTab, waitForAnyVisible } from './helpers/actions';
import { setTestAccountPremium, setTestAccountFree, grantTestAccountAIConsent, revokeTestAccountAIConsent } from './helpers/db';

describe('Settings Screen', () => {
  beforeAll(async () => {
    // resetAuth: true wipes the persisted Supabase session so the app
    // forcibly signs in as TEST_EMAIL. Without this, the AI consent
    // sub-tests operate on a different user than the test helpers.
    await launchApp(true, true);
    await pollForVisible('home-record-button', 30000);
    // DreamContext background image backfill fires DALL-E 3 network requests
    // on fresh launch. Disable sync once so all subsequent actions are immediate.
    await device.disableSynchronization();
    // Navigate to Settings once; stay here for all tests
    await navigateToTab('Settings');
    await waitForVisible('settings-zodiac-edit', 10000);
  });

  beforeEach(async () => {
    // Close the zodiac picker if it was left open. Use the specific
    // testID — by.text('Cancel') is too broad and may hit stray Cancel
    // buttons from other modals.
    try {
      await tapById('settings-zodiac-cancel');
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
    // Close the delete-account modal if it was left open.
    try {
      await tapById('settings-delete-cancel-button');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {
      // Delete modal not open — that's fine
    }
    // Close any lingering iOS share sheet popover from test 3.
    try {
      await element(by.id('PopoverDismissRegion')).tap();
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch {
      // No popover open — that's fine
    }
    // Scroll back to top of Settings so content above the fold is visible.
    // Use the waitFor.whileElement pattern — scrollTo('top') is unreliable
    // when a previous test left a non-zero content offset on the ScrollView.
    try {
      await waitFor(element(by.id('settings-zodiac-edit')))
        .toBeVisible()
        .whileElement(by.id('settings-scroll-view'))
        .scroll(300, 'up');
    } catch {
      // Last-resort fallback
      try {
        await element(by.id('settings-scroll-view')).scrollTo('top');
      } catch { /* ignore */ }
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

  // SKIPPED: the iOS share sheet is a native UIActivityViewController
  // whose internal elements (PopoverDismissRegion, Cancel button, Close
  // label) are unreliable to hit from Detox — on iPhone it slides up as
  // a sheet, on iPad it's a popover, and neither dismisses cleanly under
  // automation. When the sheet stays open it blocks the rest of the
  // suite. This is a "no crash" smoke test, not critical-path coverage;
  // skip until we have a reliable dismissal strategy.
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should open share sheet on export (no crash)', async () => {
    await element(by.id('settings-scroll-view')).scroll(300, 'down', 0.5, 0.5);
    await pollForVisible('settings-export-button', 5000);
    await tapById('settings-export-button');
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  it('should open dream picker modal', async () => {
    // Scroll down until the delete-dream button comes into view. Single
    // fixed-offset scroll() was unreliable when the beforeEach leaves a
    // non-zero scroll position.
    await waitFor(element(by.id('settings-delete-dream-button')))
      .toBeVisible()
      .whileElement(by.id('settings-scroll-view'))
      .scroll(300, 'down');
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

    // Countdown modal should appear with the (disabled, countdown-labeled)
    // delete button. The button testID is stable; the button text changes
    // during countdown so we can't assert exact text with by.text().
    await pollForVisibleByText('This Cannot Be Undone', 5000);
    await pollForVisible('settings-delete-confirm-button', 5000);

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
    // Ensure the account is premium server-side. setTestAccountPremium
    // is a no-op unless SUPABASE_SERVICE_ROLE_KEY is configured; in
    // practice the test account is kept premium as a fixture. If the
    // tier doesn't match we skip the assertion rather than cold-restart
    // the app mid-suite (mid-test relaunches hang unpredictably in the
    // simulator).
    await setTestAccountPremium();

    // Scroll to the subscription section in the already-mounted Settings.
    await element(by.id('settings-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    // Premium users see "Manage Subscription". Free users see
    // "Upgrade to Premium". We verify the premium label is present.
    await pollForVisibleByText('Manage Subscription', 5000);
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

  // These two tests run back-to-back and walk the consent state through
  // the toggle UI without relaunching the app. Mid-suite cold restarts
  // (newInstance: true) are unreliable in the simulator — the initial
  // session/profile fetch sometimes hangs past any reasonable timeout —
  // so we drive the state machine through the real user flow instead.
  //
  // Sequence assumption: "show consent modal" runs first, leaves consent
  // ON. "revoke consent via toggle" runs second, ends with consent ON
  // again (restored via DB helper) so later tests are unaffected.
  it('should show consent modal when enabling AI from settings', async () => {
    await element(by.id('settings-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    await pollForVisible('settings-ai-consent-toggle', 5000);

    // The toggle may currently be ON or OFF depending on prior test
    // state. Tap and then race two outcomes: the "Disable AI Readings?"
    // confirmation alert (if toggle was ON) OR the consent modal (if
    // toggle was OFF). If we see the alert, confirm disable and re-tap.
    await tapById('settings-ai-consent-toggle');
    const landed = await waitForAnyVisible(
      [
        { text: 'Disable AI Readings?' }, // 0 — toggle was ON
        { id: 'ai-consent-allow' },       // 1 — toggle was OFF
      ],
      5000,
    );

    if (landed === 0) {
      // Was ON — confirm disable, wait, then tap again to trigger enable.
      await element(by.text('Disable')).tap();
      await new Promise(resolve => setTimeout(resolve, 800));
      await tapById('settings-ai-consent-toggle');
    }

    // Now the consent modal must be visible. Allow button is the
    // reliable signal — the modal overlay's 75% visibility check is flaky.
    await pollForVisible('ai-consent-allow', 5000);
    await new Promise(resolve => setTimeout(resolve, 500));
    await tapById('ai-consent-allow');
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  it('should revoke consent via toggle and block new readings', async () => {
    await element(by.id('settings-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    await pollForVisible('settings-ai-consent-toggle', 5000);

    // Toggle should be ON from the previous test. Tap to trigger the
    // "Disable AI Readings?" confirmation alert.
    await tapById('settings-ai-consent-toggle');
    await pollForVisibleByText('Disable AI Readings?', 5000);
    // Confirm disable — this calls the real revokeAIConsent() from the app.
    // Regression guard: previously threw ReferenceError because AsyncStorage
    // was referenced without being imported.
    await element(by.text('Disable')).tap();
    // Wait for the alert's dimming view to fully fade out before
    // trying to hit the tab bar.
    await new Promise(resolve => setTimeout(resolve, 800));

    // Navigate to New Dream and attempt an analysis — the local
    // hasConsent just flipped to false, so the consent modal should
    // appear client-side before the server is even hit.
    await navigateToTab('Dream');
    await pollForVisible('home-record-button', 10000);
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await element(by.id('new-dream-scroll-view')).scrollTo('top');

    // Clear any draft from a previous test so we start from a clean form.
    try {
      await pollForVisible('new-dream-draft-clear', 1000);
      await tapById('new-dream-draft-clear');
    } catch { /* no draft */ }

    await tapById('new-dream-mood-peaceful');
    await typeById('new-dream-text-input', 'A test dream after revoking consent via the settings toggle.');
    await element(by.id('new-dream-scroll-view')).scrollTo('bottom');
    await new Promise(resolve => setTimeout(resolve, 500));
    await tapById('new-dream-submit');

    // Use the Allow button as the modal visibility signal — Detox's
    // 75% threshold is unreliable on the modal overlay itself.
    await pollForVisible('ai-consent-allow', 15000);

    // Dismiss modal so we leave the test in a clean state, then restore
    // consent (via helper) for subsequent tests.
    await tapById('ai-consent-decline');
    await new Promise(resolve => setTimeout(resolve, 800));
    // Navigate back out of the NewDream stack screen to Settings so the
    // next test's beforeEach finds settings-zodiac-edit.
    await tapById('new-dream-back');
    await new Promise(resolve => setTimeout(resolve, 300));
    await navigateToTab('Settings');
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
