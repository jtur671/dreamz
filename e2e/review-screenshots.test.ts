import { device, element, by } from 'detox';
import {
  launchApp,
  navigateToTab,
  pollForVisible,
  tapById,
} from './helpers/actions';
import { setTestAccountFree, setTestAccountPremium, grantTestAccountAIConsent } from './helpers/db';

/**
 * Takes screenshots to demonstrate Apple review fixes:
 * - 3.1.2(c): Privacy Policy + Terms of Use links on Paywall and Settings
 *
 * Screenshots are saved to e2e/artifacts/
 */
describe('Apple Review Screenshots', () => {
  beforeAll(async () => {
    // Set to free so the Upgrade button appears in Settings
    await setTestAccountFree();
    await grantTestAccountAIConsent();
    await launchApp(true);
  });

  afterAll(async () => {
    await setTestAccountPremium();
  });

  it('should screenshot Paywall with legal links', async () => {
    await navigateToTab('Settings');
    await pollForVisible('settings-scroll-view', 15000);

    // Scroll to Subscription section to find Upgrade button
    await element(by.id('settings-scroll-view')).scroll(400, 'down', 0.5, 0.5);
    await pollForVisible('settings-upgrade-button', 10000);
    await tapById('settings-upgrade-button');

    // Wait for Paywall to load
    await pollForVisible('paywall-title', 15000);

    // Scroll to the bottom to show the legal links
    await element(by.id('paywall-scroll-view')).scrollTo('bottom');
    await pollForVisible('paywall-legal-links', 5000);

    await device.takeScreenshot('paywall-legal-links');

    // Close the paywall
    await element(by.id('paywall-scroll-view')).scrollTo('top');
    await tapById('paywall-close-button');
  });

  it('should screenshot Settings with legal links', async () => {
    await pollForVisible('settings-scroll-view', 15000);

    // Scroll to the very bottom to show Privacy Policy + Terms of Use
    await element(by.id('settings-scroll-view')).scrollTo('bottom');

    await device.takeScreenshot('settings-legal-links');
  });
});
