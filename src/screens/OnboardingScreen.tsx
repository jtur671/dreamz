import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { updateProfile, completeOnboarding } from '../lib/profileService';
import { ZODIAC_SIGNS, GENDER_OPTIONS, AGE_RANGES, Gender, AgeRange } from '../types';

type OnboardingStep = 'tier' | 'about' | 'welcome';

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<OnboardingStep>('tier');
  const [selectedTier, setSelectedTier] = useState<'free' | 'premium'>('free');
  const [selectedZodiac, setSelectedZodiac] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [selectedAge, setSelectedAge] = useState<AgeRange | null>(null);
  const [saving, setSaving] = useState(false);

  const handleTierContinue = () => {
    setStep('about');
  };

  const handleAboutContinue = async () => {
    setSaving(true);
    // Save profile data for free tier
    if (selectedTier === 'free') {
      const updates: Parameters<typeof updateProfile>[0] = {
        subscription_tier: 'free',
      };
      if (selectedZodiac) updates.zodiac_sign = selectedZodiac;
      if (selectedGender) updates.gender = selectedGender;
      if (selectedAge) updates.age_range = selectedAge;

      await updateProfile(updates);
    }
    setSaving(false);
    setStep('welcome');
  };

  const handleSkip = async () => {
    setSaving(true);
    // Still save tier selection even when skipping
    await updateProfile({ subscription_tier: selectedTier });
    setSaving(false);
    setStep('welcome');
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
    const steps: OnboardingStep[] = ['tier', 'about', 'welcome'];
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
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>Choose Your Path</Text>
      <Text style={styles.stepSubtitle}>
        Select the experience that resonates with your journey
      </Text>

      <TouchableOpacity
        style={[
          styles.tierCard,
          selectedTier === 'free' && styles.tierCardSelected,
        ]}
        onPress={() => setSelectedTier('free')}
        activeOpacity={0.8}
      >
        {selectedTier === 'free' && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        )}
        <Text style={styles.tierName}>Free</Text>
        <Text style={styles.tierDescription}>Begin your dream exploration</Text>
        <View style={styles.tierFeatures}>
          <Text style={styles.tierFeature}>3 readings per month</Text>
          <Text style={styles.tierFeature}>Dream journal</Text>
          <Text style={styles.tierFeature}>Symbol insights</Text>
          <Text style={styles.tierFeature}>Grimoire access</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tierCard,
          styles.tierCardPremium,
          selectedTier === 'premium' && styles.tierCardSelected,
        ]}
        onPress={() => setSelectedTier('premium')}
        activeOpacity={0.8}
      >
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
        <Text style={styles.tierName}>Premium</Text>
        <Text style={styles.tierDescription}>Unlock deeper mysteries</Text>
        <View style={styles.tierFeatures}>
          <Text style={[styles.tierFeature, styles.premiumFeature]}>Unlimited readings</Text>
          <Text style={[styles.tierFeature, styles.premiumFeature]}>Advanced insights</Text>
          <Text style={[styles.tierFeature, styles.premiumFeature]}>Pattern tracking</Text>
          <Text style={[styles.tierFeature, styles.premiumFeature]}>Export features</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.continueButton}
        onPress={handleTierContinue}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAboutStep = () => (
    <ScrollView contentContainerStyle={styles.stepContent}>
      <Text style={styles.stepTitle}>Tell Us About You</Text>
      <Text style={styles.stepSubtitle}>
        Personalize your readings (all optional)
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Sign</Text>
        <View style={styles.optionsGrid}>
          {ZODIAC_SIGNS.map((sign) => (
            <TouchableOpacity
              key={sign}
              style={[
                styles.optionChip,
                selectedZodiac === sign && styles.optionChipSelected,
              ]}
              onPress={() => setSelectedZodiac(selectedZodiac === sign ? null : sign)}
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
              style={[
                styles.optionChip,
                selectedGender === option.value && styles.optionChipSelected,
              ]}
              onPress={() => setSelectedGender(selectedGender === option.value ? null : option.value)}
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
              style={[
                styles.optionChip,
                selectedAge === range && styles.optionChipSelected,
              ]}
              onPress={() => setSelectedAge(selectedAge === range ? null : range)}
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
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={saving}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, styles.continueButtonFlex, saving && styles.buttonDisabled]}
          onPress={handleAboutContinue}
          disabled={saving}
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderWelcomeStep = () => (
    <View style={styles.welcomeContent}>
      <Text style={styles.welcomeEmoji}>{'  '}</Text>
      <Text style={styles.welcomeTitle}>Your Grimoire Awaits</Text>
      <Text style={styles.welcomeSubtitle}>
        The veil between worlds grows thin.{'\n'}
        Your dreams hold messages waiting to be deciphered.
      </Text>

      <View style={styles.welcomeFeatures}>
        <Text style={styles.welcomeFeature}>Record your nocturnal visions</Text>
        <Text style={styles.welcomeFeature}>Receive mystical interpretations</Text>
        <Text style={styles.welcomeFeature}>Discover hidden symbols</Text>
        <Text style={styles.welcomeFeature}>Track patterns over time</Text>
      </View>

      <TouchableOpacity
        style={[styles.beginButton, saving && styles.buttonDisabled]}
        onPress={handleBeginJourney}
        disabled={saving}
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
    borderColor: '#6b4e9e',
    backgroundColor: '#2d2a4e',
  },
  tierCardPremium: {
    opacity: 0.7,
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
  comingSoonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#4a4a6e',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    color: '#a89cc8',
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
    marginBottom: 16,
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
});
