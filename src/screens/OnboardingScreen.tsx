import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { updateProfile, completeOnboarding } from '../lib/profileService';
import { checkPremiumAccess } from '../lib/purchaseService';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { ZODIAC_SIGNS, GENDER_OPTIONS, AGE_RANGES, Gender, AgeRange } from '../types';

type OnboardingStep = 'tier' | 'about' | 'ai-disclosure' | 'welcome';

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const { contentStyle } = useResponsiveLayout();
  const [step, setStep] = useState<OnboardingStep>('tier');
  const [selectedTier, setSelectedTier] = useState<'free' | 'premium'>('free');
  const [selectedZodiac, setSelectedZodiac] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [selectedAge, setSelectedAge] = useState<AgeRange | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  // When returning from Paywall after a successful purchase, auto-advance
  useFocusEffect(
    useCallback(() => {
      if (step === 'tier') {
        checkPremiumAccess().then((hasPremium) => {
          if (hasPremium) {
            setSelectedTier('premium');
            setStep('about');
          }
        });
      }
    }, [step])
  );

  const handleTierContinue = async () => {
    if (selectedTier === 'premium') {
      // Check if user already has premium via RevenueCat
      const hasPremium = await checkPremiumAccess();
      if (!hasPremium) {
        // Navigate to paywall; don't let them self-upgrade without paying
        (navigation as any).navigate('Paywall', { source: 'onboarding' });
        return;
      }
    }
    setStep('about');
  };

  const handleAboutContinue = async () => {
    setSaving(true);
    // Only save 'free' tier from onboarding — premium requires RevenueCat purchase
    const tier = selectedTier === 'premium' && await checkPremiumAccess() ? 'premium' : 'free';
    const updates: Parameters<typeof updateProfile>[0] = {
      subscription_tier: tier,
    };
    if (displayName.trim()) updates.display_name = displayName.trim();
    if (selectedZodiac) updates.zodiac_sign = selectedZodiac;
    if (selectedGender) updates.gender = selectedGender;
    if (selectedAge) updates.age_range = selectedAge;

    await updateProfile(updates);
    setSaving(false);
    setStep('ai-disclosure');
  };

  const handleSkip = async () => {
    setSaving(true);
    // Only save 'free' tier from onboarding — premium requires RevenueCat purchase
    const tier = selectedTier === 'premium' && await checkPremiumAccess() ? 'premium' : 'free';
    await updateProfile({ subscription_tier: tier });
    setSaving(false);
    setStep('ai-disclosure');
  };

  const handleBeginJourney = async () => {
    setSaving(true);
    await completeOnboarding();
    setSaving(false);
    // Navigate to main app
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' as never }],
    });
  };

  const renderProgressDots = () => {
    const steps: OnboardingStep[] = ['tier', 'about', 'ai-disclosure', 'welcome'];
    const currentIndex = steps.indexOf(step);

    return (
      <View style={styles.progressContainer}>
        {steps.map((s, index) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              index <= currentIndex && styles.progressDotActive,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderTierStep = () => (
    <ScrollView contentContainerStyle={[styles.stepContent, contentStyle]}>
      <Text style={styles.stepTitle}>Choose Your Path</Text>
      <Text style={styles.stepSubtitle}>
        Select the experience that resonates with your journey
      </Text>

      <TouchableOpacity
        testID="onboarding-tier-free"
        style={[
          styles.tierCard,
          selectedTier === 'free' && styles.tierCardSelected,
          selectedTier === 'premium' && styles.tierCardDimmed,
        ]}
        onPress={() => setSelectedTier('free')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Free plan — 1 reading per day"
        accessibilityState={{ selected: selectedTier === 'free' }}
      >
        {selectedTier === 'free' && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        )}
        <Text style={styles.tierName}>Free</Text>
        <Text style={styles.tierDescription}>Begin your dream exploration</Text>
        <View style={styles.tierFeatures}>
          <Text style={styles.tierFeature}>1 reading per day</Text>
          <Text style={styles.tierFeature}>Dream journal</Text>
          <Text style={styles.tierFeature}>Standard AI model</Text>
          <Text style={styles.tierFeature}>Grimoire access</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        testID="onboarding-tier-premium"
        style={[
          styles.tierCard,
          selectedTier === 'premium' && styles.tierCardSelected,
          selectedTier === 'free' && styles.tierCardDimmed,
        ]}
        onPress={() => setSelectedTier('premium')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Premium plan — 30 readings per month, dream imagery, no ads, $5.99 per month or $49.99 per year"
        accessibilityState={{ selected: selectedTier === 'premium' }}
      >
        {selectedTier === 'premium' ? (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        ) : (
          <View style={styles.pricingBadge}>
            <Text style={styles.pricingBadgeText}>From $4.17/mo</Text>
          </View>
        )}
        <Text style={styles.tierName}>Premium</Text>
        <Text style={styles.tierDescription}>Unlock deeper mysteries</Text>
        <Text style={styles.tierPricing}>$5.99/mo or $49.99/yr</Text>
        <View style={styles.tierFeatures}>
          <Text style={[styles.tierFeature, styles.premiumFeature]}>30 readings per month</Text>
          <Text style={[styles.tierFeature, styles.premiumFeature]}>Dream imagery</Text>
          <Text style={[styles.tierFeature, styles.premiumFeature]}>Ad-free experience</Text>
          <Text style={[styles.tierFeature, styles.premiumFeature]}>Pattern tracking</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        testID="onboarding-tier-continue"
        style={styles.continueButton}
        onPress={handleTierContinue}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAboutStep = () => (
    <ScrollView testID="onboarding-about-scroll" contentContainerStyle={[styles.stepContent, contentStyle]}>
      <Text style={styles.stepTitle}>Tell Us About You</Text>
      <Text style={styles.stepSubtitle}>
        Personalize your readings (all optional)
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What Should We Call You?</Text>
        <TextInput
          testID="onboarding-display-name"
          style={styles.nameInput}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name (optional)"
          placeholderTextColor="#6b5b8a"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={50}
          returnKeyType="done"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Sign</Text>
        <View style={styles.optionsGrid}>
          {ZODIAC_SIGNS.map((sign) => (
            <TouchableOpacity
              key={sign}
              testID={`onboarding-zodiac-${sign.toLowerCase()}`}
              style={[
                styles.optionChip,
                selectedZodiac === sign && styles.optionChipSelected,
              ]}
              onPress={() => setSelectedZodiac(selectedZodiac === sign ? null : sign)}
              accessibilityRole="button"
              accessibilityLabel={sign}
              accessibilityState={{ selected: selectedZodiac === sign }}
            >
              <Text
                style={[
                  styles.optionChipText,
                  selectedZodiac === sign && styles.optionChipTextSelected,
                ]}
              >
                {sign}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gender</Text>
        <View style={styles.optionsGrid}>
          {GENDER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              testID={`onboarding-gender-${option.value}`}
              style={[
                styles.optionChip,
                selectedGender === option.value && styles.optionChipSelected,
              ]}
              onPress={() => setSelectedGender(selectedGender === option.value ? null : option.value)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: selectedGender === option.value }}
            >
              <Text
                style={[
                  styles.optionChipText,
                  selectedGender === option.value && styles.optionChipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Age Range</Text>
        <View style={styles.optionsGrid}>
          {AGE_RANGES.map((range) => (
            <TouchableOpacity
              key={range}
              testID={`onboarding-age-${range}`}
              style={[
                styles.optionChip,
                selectedAge === range && styles.optionChipSelected,
              ]}
              onPress={() => setSelectedAge(selectedAge === range ? null : range)}
              accessibilityRole="button"
              accessibilityLabel={range}
              accessibilityState={{ selected: selectedAge === range }}
            >
              <Text
                style={[
                  styles.optionChipText,
                  selectedAge === range && styles.optionChipTextSelected,
                ]}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          testID="onboarding-about-skip"
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Skip personalisation"
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="onboarding-about-continue"
          style={[styles.continueButton, styles.continueButtonFlex, saving && styles.buttonDisabled]}
          onPress={handleAboutContinue}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderAIDisclosureStep = () => (
    <ScrollView contentContainerStyle={[styles.stepContent, contentStyle]}>
      <Text style={styles.stepTitle}>How Your Dreams Are Read</Text>
      <Text style={styles.stepSubtitle}>
        A little transparency before we begin
      </Text>

      <View style={styles.disclosureCard}>
        <Text style={styles.disclosureText}>
          When you request a reading, your dream text and selected mood are sent
          to an AI service (OpenAI) for interpretation.
        </Text>
        <Text style={styles.disclosureText}>
          If you've shared your zodiac sign, gender, or age range, these are
          included to personalize your reading.
        </Text>
        <Text style={[styles.disclosureText, styles.disclosureEmphasis]}>
          Your dreams are never used to train AI models.{'\n'}
          Your data is never sold.
        </Text>
      </View>

      <TouchableOpacity
        testID="onboarding-ai-privacy-link"
        onPress={() => Linking.openURL('https://dreamz-journal.com/privacy.html')}
        accessibilityRole="link"
        accessibilityLabel="Read our Privacy Policy"
      >
        <Text style={styles.privacyLinkText}>Read our Privacy Policy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="onboarding-ai-continue"
        style={styles.continueButton}
        onPress={() => setStep('welcome')}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderWelcomeStep = () => (
    <View style={[styles.welcomeContent, contentStyle]}>
      <Text style={styles.welcomeEmoji}>{'  '}</Text>
      <Text style={styles.welcomeTitle}>Your Grimoire Awaits</Text>
      <Text style={styles.welcomeSubtitle}>
        The veil between worlds grows thin.{'\n'}
        Your dreams hold messages waiting to be deciphered.
      </Text>

      <View style={styles.grimoireExplainer}>
        <Text style={styles.grimoireExplainerText}>
          <Text style={styles.grimoireExplainerBold}>Grimoire</Text>
          {' \u2014 from the French word for a book of personal spells. Yours will be a private collection of your dreams and their meanings.'}
        </Text>
      </View>

      <View style={styles.welcomeFeatures}>
        <Text style={styles.welcomeFeature}>Record your nocturnal visions</Text>
        <Text style={styles.welcomeFeature}>Receive mystical interpretations</Text>
        <Text style={styles.welcomeFeature}>Discover hidden symbols</Text>
        <Text style={styles.welcomeFeature}>Track patterns over time</Text>
      </View>

      <TouchableOpacity
        testID="onboarding-welcome-begin"
        style={[styles.beginButton, saving && styles.buttonDisabled]}
        onPress={handleBeginJourney}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Begin Your Journey"
      >
        <Text style={styles.beginButtonText}>
          {saving ? 'Opening the portal...' : 'Begin Your Journey'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderProgressDots()}
      {step === 'tier' && renderTierStep()}
      {step === 'about' && renderAboutStep()}
      {step === 'ai-disclosure' && renderAIDisclosureStep()}
      {step === 'welcome' && renderWelcomeStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3a3a5e',
    marginHorizontal: 6,
  },
  progressDotActive: {
    backgroundColor: '#6b4e9e',
  },
  stepContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#a89cc8',
    textAlign: 'center',
    marginBottom: 32,
  },
  tierCard: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#3a3a5e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tierCardSelected: {
    borderColor: '#9b7fd4',
    backgroundColor: '#322d54',
    shadowColor: '#6b4e9e',
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  tierCardDimmed: {
    opacity: 0.45,
    borderColor: '#2a2a4e',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#6b4e9e',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pricingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#6b4e9e',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pricingBadgeText: {
    color: '#e0d4f7',
    fontSize: 12,
    fontWeight: '600',
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 4,
  },
  tierDescription: {
    fontSize: 14,
    color: '#a89cc8',
    marginBottom: 4,
  },
  tierPricing: {
    fontSize: 13,
    color: '#9b7fd4',
    fontWeight: '600',
    marginBottom: 12,
  },
  tierFeatures: {
    marginTop: 8,
  },
  tierFeature: {
    fontSize: 14,
    color: '#c0b4e0',
    marginBottom: 8,
    paddingLeft: 8,
  },
  premiumFeature: {
    color: '#8b7fa8',
  },
  continueButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonFlex: {
    flex: 1,
    marginTop: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0d4f7',
    marginBottom: 12,
  },
  nameInput: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#e0d4f7',
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionChip: {
    backgroundColor: '#2a2a4e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  optionChipSelected: {
    backgroundColor: '#6b4e9e',
    borderColor: '#6b4e9e',
  },
  optionChipText: {
    color: '#a89cc8',
    fontSize: 14,
  },
  optionChipTextSelected: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginRight: 12,
  },
  skipButtonText: {
    color: '#8b7fa8',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  welcomeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  welcomeEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#a89cc8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  grimoireExplainer: {
    backgroundColor: '#2a2a5e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(107, 78, 158, 0.4)',
  },
  grimoireExplainerText: {
    fontSize: 14,
    color: '#c0b8d8',
    lineHeight: 20,
    textAlign: 'center',
  },
  grimoireExplainerBold: {
    fontWeight: '700',
    color: '#e0d4f7',
  },
  welcomeFeatures: {
    marginBottom: 40,
  },
  welcomeFeature: {
    fontSize: 14,
    color: '#c0b4e0',
    textAlign: 'center',
    marginBottom: 12,
  },
  beginButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  beginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclosureCard: {
    backgroundColor: '#2a2a5e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(107, 78, 158, 0.4)',
  },
  disclosureText: {
    fontSize: 15,
    color: '#c0b8d8',
    lineHeight: 22,
    marginBottom: 12,
  },
  disclosureEmphasis: {
    fontWeight: '600',
    color: '#e0d4f7',
    marginBottom: 0,
  },
  privacyLinkText: {
    color: '#9b7fd4',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
});
