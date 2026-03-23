/**
 * Tests for Purchase Service (RevenueCat wrapper)
 * @file src/lib/__tests__/purchaseService.test.ts
 */

// Mock react-native (Platform.OS used by purchaseService)
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock react-native-purchases before importing the service
const mockPurchases = {
  setLogLevel: jest.fn(),
  configure: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
};
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
  LOG_LEVEL: { DEBUG: 'DEBUG', INFO: 'INFO' },
}));

// Must import after mocks
import {
  initPurchases,
  isPurchasesConfigured,
  checkPremiumAccess,
  purchasePremium,
  restorePurchases,
} from '../purchaseService';

describe('Purchase Service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore env vars
    process.env = { ...originalEnv };
  });

  // -----------------------------------------------------------------------
  // checkPremiumAccess
  // -----------------------------------------------------------------------

  describe('checkPremiumAccess', () => {
    it('should return true when premium entitlement is active', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValueOnce({
        entitlements: {
          active: { premium: { isActive: true } },
        },
      });

      const result = await checkPremiumAccess();
      expect(result).toBe(true);
    });

    it('should return false when no premium entitlement', async () => {
      mockPurchases.getCustomerInfo.mockResolvedValueOnce({
        entitlements: { active: {} },
      });

      const result = await checkPremiumAccess();
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockPurchases.getCustomerInfo.mockRejectedValueOnce(new Error('Network'));

      const result = await checkPremiumAccess();
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // purchasePremium
  // -----------------------------------------------------------------------

  describe('purchasePremium', () => {
    const mockPackage = { identifier: 'monthly' } as any;

    it('should return success when entitlement granted', async () => {
      const customerInfo = {
        entitlements: { active: { premium: { isActive: true } } },
      };
      mockPurchases.purchasePackage.mockResolvedValueOnce({ customerInfo });

      const result = await purchasePremium(mockPackage);
      expect(result.success).toBe(true);
      expect(result.customerInfo).toBeDefined();
    });

    it('should return false when user cancels', async () => {
      const cancelError = new Error('User cancelled');
      (cancelError as any).userCancelled = true;
      mockPurchases.purchasePackage.mockRejectedValueOnce(cancelError);

      const result = await purchasePremium(mockPackage);
      expect(result.success).toBe(false);
    });

    it('should throw on non-cancel errors', async () => {
      mockPurchases.purchasePackage.mockRejectedValueOnce(new Error('Payment failed'));

      await expect(purchasePremium(mockPackage)).rejects.toThrow('Payment failed');
    });

    it('should return false when entitlement not active after purchase', async () => {
      const customerInfo = {
        entitlements: { active: {} },
      };
      mockPurchases.purchasePackage.mockResolvedValueOnce({ customerInfo });

      const result = await purchasePremium(mockPackage);
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // restorePurchases
  // -----------------------------------------------------------------------

  describe('restorePurchases', () => {
    it('should return isPremium true when entitlement found', async () => {
      mockPurchases.restorePurchases.mockResolvedValueOnce({
        entitlements: { active: { premium: { isActive: true } } },
      });

      const result = await restorePurchases();
      expect(result.success).toBe(true);
      expect(result.isPremium).toBe(true);
    });

    it('should return isPremium false when no entitlement', async () => {
      mockPurchases.restorePurchases.mockResolvedValueOnce({
        entitlements: { active: {} },
      });

      const result = await restorePurchases();
      expect(result.success).toBe(true);
      expect(result.isPremium).toBe(false);
    });

    it('should return failure on error', async () => {
      mockPurchases.restorePurchases.mockRejectedValueOnce(new Error('Restore failed'));

      const result = await restorePurchases();
      expect(result.success).toBe(false);
      expect(result.isPremium).toBe(false);
    });
  });
});
