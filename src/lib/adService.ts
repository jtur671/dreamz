/**
 * Ad service for showing interstitial ads to free-tier users.
 *
 * Uses react-native-google-mobile-ads. If the package is not installed
 * (e.g., before the dev build includes it), all functions are safe no-ops.
 */

let AdModule: any = null;
let interstitial: any = null;
let adLoaded = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AdModule = require('react-native-google-mobile-ads');
} catch {
  // Package not installed yet — all functions become no-ops
}

function getAdUnitId(): string {
  if (!AdModule) return '';
  const { TestIds } = AdModule;
  if (__DEV__) return TestIds.INTERSTITIAL;
  const { Platform } = require('react-native');
  return Platform.OS === 'ios'
    ? (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || TestIds.INTERSTITIAL)
    : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || TestIds.INTERSTITIAL);
}

/**
 * Preload an interstitial ad so it's ready to show immediately.
 * Call on screen mount for free users. Safe to call multiple times.
 */
export function preloadInterstitialAd(): void {
  if (!AdModule || adLoaded || interstitial) return;

  try {
    const { InterstitialAd, AdEventType } = AdModule;
    interstitial = InterstitialAd.createForAdRequest(getAdUnitId());

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      adLoaded = true;
    });

    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      adLoaded = false;
      interstitial = null;
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      adLoaded = false;
      interstitial = null;
      preloadInterstitialAd();
    });

    interstitial.load();
  } catch {
    interstitial = null;
    adLoaded = false;
  }
}

/**
 * Show the preloaded interstitial ad. Resolves when the ad closes or on error.
 * Never blocks the dream analysis flow.
 */
export function showInterstitialAd(): Promise<void> {
  return new Promise((resolve) => {
    if (!AdModule || !interstitial || !adLoaded) {
      resolve();
      return;
    }

    const { AdEventType } = AdModule;
    const closeListener = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      closeListener();
      resolve();
    });

    try {
      interstitial.show();
    } catch {
      closeListener();
      resolve();
    }
  });
}
