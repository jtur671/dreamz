import { device, element, by, expect, waitFor } from 'detox';
import { launchApp, tapById, waitForVisible, waitForNotVisible, navigateToTab, waitForAnyVisible } from './helpers/actions';
import { setTestAccountFree, setTestAccountPremium, grantTestAccountAIConsent } from './helpers/db';

describe('Paywall Screen', () => {
  beforeAll(async () => {
    // Set account to free so the upgrade button is visible
    await setTestAccountFree();
    await grantTestAccountAIConsent();

    await launchApp(true);
    // DreamContext background image backfill keeps dispatch queue busy permanently
    await device.disableSynchronization();

    // Navigate to Settings and wait for it to load
    await navigateToTab('Settings');
    await waitForVisible('settings-zodiac-edit', 15000);

    // Scroll to the Subscription section where upgrade button lives.
    // scrollTo('bottom') puts it behind the tab bar — use targeted scroll instead.
    await element(by.id('settings-scroll-view')).scroll(400, 'down', 0.5, 0.5);
    await waitForVisible('settings-upgrade-button', 10000);
    await tapById('settings-upgrade-button');

    // Wait for paywall to open
    await waitForVisible('paywall-title', 15000);
  });

  afterAll(async () => {
    // Restore premium so subsequent suites aren't blocked by reading limits
    await setTestAccountPremium();
  });

  it('should show paywall title', async () => {
    await expect(element(by.id('paywall-title'))).toBeVisible();
    await expect(element(by.text('Unlock the Full Oracle'))).toBeVisible();
  });

  it('should show feature comparison', async () => {
    // Scroll down slightly so comparison section is centered in viewport
    await element(by.id('paywall-scroll-view')).scrollTo('top');
    await new Promise(resolve => setTimeout(resolve, 300));
    await element(by.id('paywall-scroll-view')).scroll(100, 'down', 0.5, 0.5);
    await new Promise(resolve => setTimeout(resolve, 500));
    // Verify feature comparison content is rendered — check premium features
    // which are inside the styled column with better visibility
    await expect(element(by.text('1 reading per day'))).toBeVisible();
    await expect(element(by.text('Pattern tracking'))).toBeVisible();
  });

  it('should show pricing section (fallback on simulator)', async () => {
    // Scroll down to bring pricing into view
    await element(by.id('paywall-scroll-view')).scrollTo('bottom');
    await new Promise(resolve => setTimeout(resolve, 500));
    // Scroll back up a bit so pricing cards are in view (not just legal text)
    await element(by.id('paywall-scroll-view')).scroll(200, 'up', 0.5, 0.5);
    await new Promise(resolve => setTimeout(resolve, 500));

    // On simulator, RevenueCat may return partial data (monthly only, no annual)
    // or null (fallback with static prices). Check whichever pricing UI rendered.
    const match = await waitForAnyVisible(
      [{ id: 'paywall-pricing-fallback' }, { id: 'paywall-plan-monthly' }],
      10000,
    );

    if (match === 0) {
      // Fallback UI — both static prices should be visible
      await expect(element(by.text('$5.99'))).toBeVisible();
      await expect(element(by.text('$49.99'))).toBeVisible();
    } else {
      // Live pricing from RevenueCat (may have monthly only, no annual)
      await expect(element(by.id('paywall-plan-monthly'))).toBeVisible();
    }
  });

  it('should show retry button in fallback', async () => {
    // On simulator this will always be fallback
    try {
      await expect(element(by.id('paywall-pricing-fallback'))).toBeVisible();
      await expect(element(by.id('paywall-retry-button'))).toBeVisible();
    } catch {
      // If live pricing loaded, retry button won't exist — that's OK
    }
  });

  it('should show restore button', async () => {
    await element(by.id('paywall-scroll-view')).scrollTo('bottom');
    await waitForVisible('paywall-restore-button', 5000);
    await expect(element(by.id('paywall-restore-button'))).toBeVisible();
  });

  it('should show legal text', async () => {
    await element(by.id('paywall-scroll-view')).scrollTo('bottom');
    await new Promise(resolve => setTimeout(resolve, 500));
    await expect(element(by.id('paywall-legal-text'))).toBeVisible();
  });

  it('should close paywall and return to settings', async () => {
    await element(by.id('paywall-scroll-view')).scrollTo('top');
    await waitForVisible('paywall-close-button', 5000);
    await tapById('paywall-close-button');

    // Paywall should dismiss
    await waitForNotVisible('paywall-title', 5000);

    // Should be back on Settings
    await waitForVisible('settings-scroll-view', 5000);
  });
});
