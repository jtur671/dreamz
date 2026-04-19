/**
 * Ad service for showing interstitial ads to free-tier users.
 *
 * Uses react-native-google-mobile-ads. If the package is not installed
 * (e.g., before the dev build includes it), all functions are safe no-ops.
 */

let AdModule: any = null;
let interstitial: any = null;
let adLoaded = false;
let initialized = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AdModule = require('react-native-google-mobile-ads');
} catch {
  // Package not installed yet — all functions become no-ops
}

/**
 * Initializes the Google Mobile Ads SDK. Must be called once at app startup
 * before any ad can load. Without this, `InterstitialAd.load()` silently
 * fails and no ads ever show (which was the v1.0.1 build 46 bug).
 *
 * Note: this OTA does NOT add `expo-tracking-transparency` since it would
 * require a new native binary. Ads serve as non-personalized until the
 * next binary release adds the ATT prompt.
 */
export async function initializeAds(): Promise<void> {
  if (!AdModule || initialized) return;
  try {
    const mobileAds = AdModule.default;
    if (typeof mobileAds !== 'function') return;
    await mobileAds().initialize();
    initialized = true;
    // Kick off the first ad load immediately so the first free-tier submit
    // has a chance of finding an ad ready, rather than waiting for the user
    // to navigate to NewDream.
    preloadInterstitialAd();
  } catch (e) {
    console.warn('[ads] initializeAds failed', e);
  }
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
 * Show the preloaded interstitial ad. Resolves when the ad closes, when the
 * wait window elapses without an ad becoming available, or on error.
 *
 * If the ad isn't loaded yet (common on first submit of a fresh install),
 * polls for up to `timeoutMs` for it to finish loading instead of silently
 * no-op'ing — that no-op was the v1.0.1 build 46 "zero ads ever" bug.
 */
export function showInterstitialAd(timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (!AdModule) {
      resolve();
      return;
    }

    const tryShow = (): boolean => {
      if (interstitial && adLoaded) {
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
        return true;
      }
      return false;
    };

    if (tryShow()) return;

    // Not loaded — wait briefly. Nudge the loader in case it wasn't running.
    if (!interstitial) preloadInterstitialAd();
    const start = Date.now();
    const poll = setInterval(() => {
      if (tryShow()) {
        clearInterval(poll);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(poll);
        console.warn('[ads] interstitial not available within wait window');
        resolve();
      }
    }, 100);
  });
}
