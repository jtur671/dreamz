import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getOfferings,
  purchasePremium,
  restorePurchases,
  isPurchasesConfigured,
} from '../lib/purchaseService';
import { updateProfile } from '../lib/profileService';
import type { PurchasesPackage, PurchasesOffering, PACKAGE_TYPE } from 'react-native-purchases';

type PaywallScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route?: {
    params?: {
      source?: 'onboarding' | 'limit' | 'settings';
    };
  };
};

type PlanType = 'monthly' | 'annual';

const FREE_FEATURES = [
  '3 readings per month',
  'Dream journal',
  'Symbol insights',
  'Grimoire access',
];

const PREMIUM_FEATURES = [
  'Unlimited readings',
  'Advanced insights',
  'Pattern tracking',
  'Export features',
  'Priority support',
];

export default function PaywallScreen({ navigation, route }: PaywallScreenProps) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual');

  useEffect(() => {
    loadOfferings();
  }, []);

  async function loadOfferings() {
    const current = await getOfferings();
    setOffering(current);
    setLoading(false);
  }

  async function handlePurchase(pkg: PurchasesPackage) {
    setPurchasing(true);
    try {
      const result = await purchasePremium(pkg);
      if (result.success) {
        // Update profile tier in database
        await updateProfile({ subscription_tier: 'premium' });
        Alert.alert(
          'Welcome to Premium',
          'The oracle speaks without limits. Your deeper journey begins now.',
          [{ text: 'Continue', onPress: () => navigation.goBack() }],
        );
      }
    } catch (error: any) {
      Alert.alert('Purchase Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.isPremium) {
        await updateProfile({ subscription_tier: 'premium' });
        Alert.alert(
          'Purchases Restored',
          'Your premium access has been restored.',
          [{ text: 'Continue', onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert('No Purchases Found', 'We could not find any previous premium purchases.');
      }
    } catch {
      Alert.alert('Restore Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  const monthlyPackage = offering?.availablePackages?.find(
    (p) => p.packageType === 'MONTHLY' as PACKAGE_TYPE || p.product.identifier.toLowerCase().includes('monthly'),
  ) ?? offering?.availablePackages?.[0] ?? null;
  const annualPackage = offering?.availablePackages?.find(
    (p) => p.packageType === 'ANNUAL' as PACKAGE_TYPE || p.product.identifier.toLowerCase().includes('yearly') || p.product.identifier.toLowerCase().includes('annual'),
  ) ?? null;

  const selectedPackage = selectedPlan === 'annual' && annualPackage ? annualPackage : monthlyPackage;
  const introPrice = selectedPackage?.product?.introPrice;
  const hasFreeTrial = introPrice && introPrice.price === 0;

  return (
    <SafeAreaView style={styles.container} testID="paywall-screen">
      <ScrollView contentContainerStyle={styles.scrollContent} testID="paywall-scroll-view">
        <TouchableOpacity
          testID="paywall-close-button"
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close paywall"
        >
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>

        <Text testID="paywall-title" style={styles.title}>Unlock the Full Oracle</Text>
        <Text style={styles.subtitle}>
          Unlimited readings await beyond the veil
        </Text>

        {/* Feature comparison */}
        <View testID="paywall-feature-comparison" style={styles.comparisonContainer}>
          <View style={styles.tierColumn}>
            <Text style={styles.tierHeader}>Free</Text>
            {FREE_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Text style={styles.featureCheck}>{'  '}</Text>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.tierColumn, styles.premiumColumn]}>
            <Text style={[styles.tierHeader, styles.premiumHeader]}>Premium</Text>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Text style={styles.premiumCheck}>{'  '}</Text>
                <Text style={[styles.featureText, styles.premiumFeatureText]}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing */}
        {loading ? (
          <ActivityIndicator testID="paywall-loading" size="large" color="#9b7fd4" style={styles.loader} />
        ) : monthlyPackage ? (
          <View testID="paywall-pricing" style={styles.pricingContainer}>
            {/* Plan selector */}
            <View style={styles.planSelector}>
              <TouchableOpacity
                testID="paywall-plan-monthly"
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('monthly')}
                accessibilityRole="button"
                accessibilityLabel="Monthly plan"
                accessibilityState={{ selected: selectedPlan === 'monthly' }}
              >
                <Text style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelSelected]}>Monthly</Text>
                <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>
                  {monthlyPackage.product.priceString}
                </Text>
                <Text style={[styles.planPeriod, selectedPlan === 'monthly' && styles.planPeriodSelected]}>/month</Text>
              </TouchableOpacity>

              {annualPackage && (
                <TouchableOpacity
                  testID="paywall-plan-annual"
                  style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
                  onPress={() => setSelectedPlan('annual')}
                  accessibilityRole="button"
                  accessibilityLabel="Annual plan, save 50 percent"
                  accessibilityState={{ selected: selectedPlan === 'annual' }}
                >
                  <View style={styles.saveBadge}>
                    <Text style={styles.saveBadgeText}>Save 50%</Text>
                  </View>
                  <Text style={[styles.planLabel, selectedPlan === 'annual' && styles.planLabelSelected]}>Annual</Text>
                  <Text style={[styles.planPrice, selectedPlan === 'annual' && styles.planPriceSelected]}>
                    {annualPackage.product.priceString}
                  </Text>
                  <Text style={[styles.planPeriod, selectedPlan === 'annual' && styles.planPeriodSelected]}>/year</Text>
                </TouchableOpacity>
              )}
            </View>

            {hasFreeTrial && (
              <Text style={styles.trialText}>
                Free for {introPrice.periodNumberOfUnits} {introPrice.periodUnit.toLowerCase()}
                {introPrice.periodNumberOfUnits > 1 ? 's' : ''}, then {selectedPackage!.product.priceString}/{selectedPlan === 'annual' ? 'year' : 'month'}
              </Text>
            )}

            <TouchableOpacity
              testID="paywall-purchase-button"
              style={[styles.purchaseButton, (purchasing || restoring) && styles.buttonDisabled]}
              onPress={() => handlePurchase(selectedPackage!)}
              disabled={purchasing || restoring}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={hasFreeTrial ? 'Start Free Trial' : 'Subscribe Now'}
            >
              <Text style={styles.purchaseButtonText}>
                {purchasing
                  ? 'Processing...'
                  : hasFreeTrial
                    ? 'Start Free Trial'
                    : 'Subscribe Now'}
              </Text>
            </TouchableOpacity>

            {hasFreeTrial && (
              <Text style={styles.trialNote}>
                Try premium free for 7 days. Cancel anytime.
              </Text>
            )}
          </View>
        ) : (
          <View testID="paywall-pricing-fallback" style={styles.pricingContainer}>
            {/* Fallback plan cards when RevenueCat is unavailable */}
            <View style={styles.planSelector}>
              <TouchableOpacity
                testID="paywall-fallback-monthly"
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('monthly')}
                accessibilityRole="button"
                accessibilityLabel="Monthly plan"
                accessibilityState={{ selected: selectedPlan === 'monthly' }}
              >
                <Text style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelSelected]}>Monthly</Text>
                <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>$4.99</Text>
                <Text style={[styles.planPeriod, selectedPlan === 'monthly' && styles.planPeriodSelected]}>/month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="paywall-fallback-annual"
                style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
                onPress={() => setSelectedPlan('annual')}
                accessibilityRole="button"
                accessibilityLabel="Annual plan, save 50 percent"
                accessibilityState={{ selected: selectedPlan === 'annual' }}
              >
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>Save 50%</Text>
                </View>
                <Text style={[styles.planLabel, selectedPlan === 'annual' && styles.planLabelSelected]}>Annual</Text>
                <Text style={[styles.planPrice, selectedPlan === 'annual' && styles.planPriceSelected]}>$29.99</Text>
                <Text style={[styles.planPeriod, selectedPlan === 'annual' && styles.planPeriodSelected]}>/year</Text>
              </TouchableOpacity>
            </View>
            {!isPurchasesConfigured() ? (
              <>
                <Text testID="paywall-unavailable-text" style={styles.unavailableText}>
                  Android subscriptions are coming soon. Stay tuned for premium access on this platform.
                </Text>
                <TouchableOpacity
                  testID="paywall-android-ok-button"
                  style={[styles.purchaseButton, { marginTop: 16 }]}
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel="Got it"
                >
                  <Text style={styles.purchaseButtonText}>Got It</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text testID="paywall-unavailable-text" style={styles.unavailableText}>
                  Unable to load subscription options. Please check your connection and try again.
                </Text>
                <TouchableOpacity
                  testID="paywall-retry-button"
                  style={[styles.purchaseButton, { marginTop: 16 }]}
                  onPress={loadOfferings}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading subscriptions"
                >
                  <Text style={styles.purchaseButtonText}>Retry</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Restore */}
        <TouchableOpacity
          testID="paywall-restore-button"
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing || restoring}
          accessibilityRole="button"
          accessibilityLabel="Restore Purchases"
        >
          <Text style={styles.restoreText}>
            {restoring ? 'Restoring...' : 'Restore Purchases'}
          </Text>
        </TouchableOpacity>

        <Text testID="paywall-legal-text" style={styles.legalText}>
          Payment will be charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account at confirmation of purchase.
          Subscription automatically renews unless cancelled at least 24 hours before
          the end of the current period. Manage subscriptions in {Platform.OS === 'ios' ? 'your device Settings' : 'Google Play Store settings'}.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  closeText: {
    color: '#8b7fa8',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a89cc8',
    textAlign: 'center',
    marginBottom: 32,
  },
  comparisonContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  tierColumn: {
    flex: 1,
    marginRight: 8,
  },
  premiumColumn: {
    marginRight: 0,
    marginLeft: 8,
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6b4e9e',
  },
  tierHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8b7fa8',
    marginBottom: 16,
    textAlign: 'center',
  },
  premiumHeader: {
    color: '#e0d4f7',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureCheck: {
    fontSize: 14,
    marginRight: 8,
    color: '#8b7fa8',
  },
  premiumCheck: {
    fontSize: 14,
    marginRight: 8,
    color: '#9b7fd4',
  },
  featureText: {
    fontSize: 13,
    color: '#8b7fa8',
    flex: 1,
  },
  premiumFeatureText: {
    color: '#c0b4e0',
  },
  loader: {
    marginVertical: 24,
  },
  pricingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  planSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    width: '100%',
  },
  planCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#3a3a5e',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#9b7fd4',
    backgroundColor: '#2a2a4e',
  },
  planLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b7fa8',
    marginBottom: 4,
  },
  planLabelSelected: {
    color: '#c0b4e0',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8b7fa8',
  },
  planPriceSelected: {
    color: '#e0d4f7',
  },
  planPeriod: {
    fontSize: 13,
    color: '#8b7fa8',
    marginTop: 2,
  },
  planPeriodSelected: {
    color: '#a89cc8',
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    right: -1,
    backgroundColor: '#9b7fd4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  saveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 8,
  },
  trialText: {
    fontSize: 14,
    color: '#a89cc8',
    marginBottom: 16,
    textAlign: 'center',
  },
  unavailableText: {
    fontSize: 14,
    color: '#8b7fa8',
    marginTop: 8,
    textAlign: 'center',
  },
  purchaseButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  trialNote: {
    fontSize: 13,
    color: '#a89cc8',
    marginTop: 12,
    textAlign: 'center',
  },
  restoreButton: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 24,
  },
  restoreText: {
    color: '#9b7fd4',
    fontSize: 14,
  },
  legalText: {
    fontSize: 11,
    color: '#5a5a7a',
    textAlign: 'center',
    lineHeight: 16,
  },
});
