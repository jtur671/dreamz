/**
 * Ad service for showing interstitial ads to free-tier users.
 *
 * Uses react-native-google-mobile-ads. If the package is not installed
 * (e.g., before the dev build includes it), all functions are safe no-ops.
 */

// Production AdMob interstitial unit IDs ("Readings" unit, format: Interstitial).
// Hard-coded as a fallback so that if EAS Build doesn't have the
// EXPO_PUBLIC_ADMOB_INTERSTITIAL_* env vars set (a real bug we hit on
// build 46), we still request the production unit instead of falling back
// to TestIds.INTERSTITIAL — which Google's exchange refuses to fill in
// production-signed apps. Verified live in the AdMob console on 2026-04-25.
const PROD_INTERSTITIAL_IOS = 'ca-app-pub-8597027816949059/4714295967';
const PROD_INTERSTITIAL_ANDROID = 'ca-app-pub-8597027816949059/4583968876';

let AdModule: any = null;
let interstitial: any = null;
let adLoaded = false;
let initialized = false;
let lastErrorCode: string | null = null;
let lastErrorMessage: string | null = null;
let lastLoadAttemptAt = 0;

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
  // Order: env override (for staging / future ad-unit rotations) → hard-coded
  // production constants → TestIds (last resort, only useful in dev). The
  // hard-coded layer is what makes this OTA/binary-portable: even if the
  // env var is missing in EAS Build, production users still hit a real
  // ad unit Google will actually fill.
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS
      || PROD_INTERSTITIAL_IOS
      || TestIds.INTERSTITIAL;
  }
  return process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID
    || PROD_INTERSTITIAL_ANDROID
    || TestIds.INTERSTITIAL;
}

/**
 * Snapshot of ad-loader state for debug surfaces (e.g. an opt-in "ad health"
 * row in Settings). Never throws; safe to call from any render path.
 */
export function getAdHealth(): {
  initialized: boolean;
  unitId: string;
  loaded: boolean;
  hasInstance: boolean;
  lastLoadAttemptAt: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
} {
  return {
    initialized,
    unitId: getAdUnitId(),
    loaded: adLoaded,
    hasInstance: !!interstitial,
    lastLoadAttemptAt,
    lastErrorCode,
    lastErrorMessage,
  };
}

/**
 * Preload an interstitial ad so it's ready to show immediately.
 * Call on screen mount for free users. Safe to call multiple times.
 */
export function preloadInterstitialAd(): void {
  if (!AdModule || adLoaded || interstitial) return;

  try {
    const { InterstitialAd, AdEventType } = AdModule;
    const unitId = getAdUnitId();
    lastLoadAttemptAt = Date.now();
    interstitial = InterstitialAd.createForAdRequest(unitId);

    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      adLoaded = true;
      lastErrorCode = null;
      lastErrorMessage = null;
      console.log('[ads] interstitial LOADED', { unitId });
    });

    // Per feedback_ads_priority: never silently swallow ad delivery failures.
    // Log the actual code so we can tell apart no-fill / network-error /
    // internal-error / invalid-request from a single console line.
    interstitial.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
      adLoaded = false;
      interstitial = null;
      const e = (error || {}) as { code?: string; message?: string };
      lastErrorCode = e.code ?? 'unknown';
      lastErrorMessage = e.message ?? String(error);
      console.warn('[ads] interstitial ERROR', {
        unitId,
        code: lastErrorCode,
        message: lastErrorMessage,
      });
    });

    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      adLoaded = false;
      interstitial = null;
      preloadInterstitialAd();
    });

    interstitial.load();
  } catch (e: any) {
    interstitial = null;
    adLoaded = false;
    lastErrorCode = 'create-failed';
    lastErrorMessage = e?.message ?? String(e);
    console.warn('[ads] interstitial create/load threw', e);
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
        console.warn('[ads] interstitial not available within wait window', {
          waitedMs: Date.now() - start,
          lastErrorCode,
          lastErrorMessage,
          hasInstance: !!interstitial,
          unitId: getAdUnitId(),
        });
        resolve();
      }
    }, 100);
  });
}
