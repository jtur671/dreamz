import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';

// RevenueCat API keys from environment
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '';

const ENTITLEMENT_ID = 'premium';

// Track whether RevenueCat was successfully configured
let purchasesConfigured = false;

/**
 * Initialize RevenueCat SDK. Call once on app start.
 */
export async function initPurchases(): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

  if (!apiKey) {
    console.warn('[RevenueCat] API key not configured for', Platform.OS);
    purchasesConfigured = false;
    return;
  }

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    await Purchases.configure({ apiKey });
    purchasesConfigured = true;
    console.log('[RevenueCat] Configured successfully');
  } catch (error) {
    console.error('[RevenueCat] Configure failed:', error);
    purchasesConfigured = false;
  }
}

/**
 * Whether RevenueCat SDK is configured (API key present and initialized).
 */
export function isPurchasesConfigured(): boolean {
  return purchasesConfigured;
}

/**
 * Check if user has active premium entitlement (paid or trial).
 */
export async function checkPremiumAccess(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get available offerings (products + pricing).
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!purchasesConfigured) {
    console.warn('[RevenueCat] getOfferings skipped — SDK not configured');
    return null;
  }
  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) {
      console.warn('[RevenueCat] No current offering — check RevenueCat dashboard: products, entitlements, and offerings must all be configured');
    }
    return offerings.current;
  } catch (error) {
    console.error('[RevenueCat] getOfferings failed:', error);
    return null;
  }
}

/**
 * Purchase the premium monthly package.
 * Returns true if purchase succeeded, false otherwise.
 */
export async function purchasePremium(pkg: PurchasesPackage): Promise<{ success: boolean; customerInfo?: CustomerInfo }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    return { success: isPremium, customerInfo };
  } catch (error: any) {
    // User cancelled
    if (error.userCancelled) {
      return { success: false };
    }
    throw error;
  }
}

/**
 * Restore previous purchases (e.g. after reinstall or new device).
 */
export async function restorePurchases(): Promise<{ success: boolean; isPremium: boolean }> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    return { success: true, isPremium };
  } catch {
    return { success: false, isPremium: false };
  }
}

