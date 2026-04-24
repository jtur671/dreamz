import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radii } from '../theme';
import { PaperGrain } from '../components/PaperGrain';
import { SymbolIcon } from '../components/SymbolIcon';
import { saveDream, analyzeDream, AnalyzeDreamContext } from '../lib/dreamService';
import { getProfile } from '../lib/profileService';
import { saveDraft, loadDraft, clearDraft } from '../lib/draftService';
import { checkPremiumAccess } from '../lib/purchaseService';
import { preloadInterstitialAd, showInterstitialAd } from '../lib/adService';
import { useAIConsent } from '../hooks/useAIConsent';
import AIConsentModal from '../components/AIConsentModal';
import VoiceRecorder from '../components/VoiceRecorder';
import DreamLoadingAnimation from '../components/DreamLoadingAnimation';
import { useDreams } from '../hooks/useDreams';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { getIndividualMoodFrequency } from '../lib/insightsService';
import type { Profile } from '../types';

type NewDreamScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type LoadingState = 'idle' | 'saving' | 'interpreting' | 'error';

const DREAM_MOODS = [
  'Peaceful', 'Curious', 'Inspired', 'Joyful', 'Confused', 'Nostalgic', 'Vivid', 'Surreal',
  'Hopeful', 'Romantic', 'Adventurous', 'Melancholic', 'Ethereal', 'Powerful', 'Playful', 'Grateful', 'Mystical', 'Tender',
];
const NIGHTMARE_MOODS = [
  'Anxious', 'Fearful', 'Trapped', 'Chased', 'Confused', 'Helpless', 'Disturbed', 'Unsettled',
  'Paranoid', 'Panicked', 'Disoriented', 'Overwhelmed', 'Violated', 'Abandoned', 'Powerless', 'Haunted', 'Suffocated', 'Frozen',
];
const INITIAL_VISIBLE = 5;

export default function NewDreamScreen({ navigation }: NewDreamScreenProps) {
  const { contentStyle, isTablet } = useResponsiveLayout();
  const [dreamText, setDreamText] = useState('');
  const [dreamType, setDreamType] = useState<'dream' | 'nightmare'>('dream');
  const [moods, setMoods] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasDraftRecovered, setHasDraftRecovered] = useState(false);
  const [savedDreamId, setSavedDreamId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [moodExpanded, setMoodExpanded] = useState(false);
  const { hasConsent, grantConsent, refreshConsent } = useAIConsent();
  const [showConsentModal, setShowConsentModal] = useState(false);
  // When the user grants consent via the modal, we want to auto-resume the
  // submission. Using a ref + effect avoids a stale-closure bug where
  // handleSubmit captured the pre-grant `hasConsent=false` value.
  const resubmitOnGrantRef = useRef(false);
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { dreams } = useDreams();

  // Smart-order moods by individual usage frequency, fallback to default order
  const moodFrequency = useMemo(() => getIndividualMoodFrequency(dreams), [dreams]);

  const orderedDreamMoods = useMemo(() => {
    if (moodFrequency.length === 0) return DREAM_MOODS;
    const freqMap = new Map(moodFrequency.map((f) => [f.name, f.count]));
    return [...DREAM_MOODS].sort((a, b) => {
      const fa = freqMap.get(a) || 0;
      const fb = freqMap.get(b) || 0;
      if (fb !== fa) return fb - fa;
      return DREAM_MOODS.indexOf(a) - DREAM_MOODS.indexOf(b);
    });
  }, [moodFrequency]);

  const orderedNightmareMoods = useMemo(() => {
    if (moodFrequency.length === 0) return NIGHTMARE_MOODS;
    const freqMap = new Map(moodFrequency.map((f) => [f.name, f.count]));
    return [...NIGHTMARE_MOODS].sort((a, b) => {
      const fa = freqMap.get(a) || 0;
      const fb = freqMap.get(b) || 0;
      if (fb !== fa) return fb - fa;
      return NIGHTMARE_MOODS.indexOf(a) - NIGHTMARE_MOODS.indexOf(b);
    });
  }, [moodFrequency]);

  const isLoading = loadingState === 'saving' || loadingState === 'interpreting';

  // Load profile and draft on mount
  useEffect(() => {
    async function initialize() {
      // Load profile (includes zodiac, gender, age_range for personalized readings)
      const profile = await getProfile();
      if (profile) {
        setUserProfile(profile);

        const premium = profile.subscription_tier === 'premium' || await checkPremiumAccess();
        setIsPremium(premium);
        if (!premium) {
          preloadInterstitialAd();
        }
      }

      // Load draft
      const draft = await loadDraft();
      if (draft && draft.dreamText.trim()) {
        setDreamText(draft.dreamText);
        setDreamType(draft.dreamType);
        if (draft.mood) {
          setMoods(draft.mood.split(', ').filter(Boolean));
        }
        setHasDraftRecovered(true);
      }
    }
    initialize();
  }, []);

  const moodString = moods.length > 0 ? moods.join(', ') : undefined;

  // Auto-save draft with debounce
  const autoSaveDraft = useCallback(() => {
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }

    draftTimeoutRef.current = setTimeout(() => {
      if (dreamText.trim()) {
        saveDraft({ dreamText, dreamType, mood: moodString });
      }
    }, 1000); // Save after 1 second of inactivity
  }, [dreamText, dreamType, moodString]);

  useEffect(() => {
    autoSaveDraft();
    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, [autoSaveDraft]);

  // After the user grants consent via the modal, resume the submission in
  // a fresh render so handleSubmit's closure sees `hasConsent === true`.
  // After the user grants consent via the modal, resume the submission
  // in a fresh render so handleSubmit's closure sees hasConsent === true.
  useEffect(() => {
    if (resubmitOnGrantRef.current && hasConsent === true) {
      resubmitOnGrantRef.current = false;
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConsent]);

  async function handleSubmit() {
    if (!dreamText.trim()) {
      Alert.alert('Error', 'Please describe your dream');
      return;
    }

    if (dreamText.length > 10000) {
      Alert.alert('Error', 'Dream text is too long. Please keep it under 10,000 characters.');
      return;
    }

    if (moods.length === 0) {
      Alert.alert('Error', 'Please select how your dream felt');
      return;
    }

    // Check AI consent before proceeding with analysis.
    if (hasConsent === null) {
      // Still loading consent state — wait for it
      const { getAIConsent } = await import('../lib/aiConsentService');
      const consentState = await getAIConsent();
      if (!consentState.granted) {
        setShowConsentModal(true);
        return;
      }
    } else if (!hasConsent) {
      setShowConsentModal(true);
      return;
    }

    setErrorMessage(null);

    // Step 1: Save the dream (skip if already saved from a previous attempt)
    let dreamId = savedDreamId;

    if (!dreamId) {
      setLoadingState('saving');

      const saveResult = await saveDream(dreamText.trim(), moodString, dreamType);

      if (!saveResult.success) {
        setLoadingState('error');
        setErrorMessage(saveResult.error);
        Alert.alert('Error', saveResult.error);
        return;
      }

      dreamId = saveResult.dream.id;
      setSavedDreamId(dreamId);
    }

    // Step 2: Analyze the dream with user profile context
    setLoadingState('interpreting');

    const analyzeContext: AnalyzeDreamContext = {
      dreamId,
      mood: moodString,
      zodiacSign: userProfile?.zodiac_sign,
      gender: userProfile?.gender,
      ageRange: userProfile?.age_range,
    };

    // Start analysis; show interstitial ad for free users during the wait
    const analyzePromise = analyzeDream(dreamText.trim(), analyzeContext);
    if (!isPremium) {
      try { await showInterstitialAd(); } catch { /* never block analysis */ }
    }
    const analyzeResult = await analyzePromise;

    if (!analyzeResult.success) {
      setLoadingState('error');
      setErrorMessage(analyzeResult.error);
      // Server says the user's consent is not granted (e.g. revoked on
      // another device, or our local cache was stale). Resync from
      // Supabase and re-prompt instead of showing a dead-end error.
      if (analyzeResult.code === 'CONSENT_REQUIRED') {
        await refreshConsent();
        setLoadingState('idle');
        setShowConsentModal(true);
        return;
      }
      // Dream was saved but analysis failed - offer to continue or retry
      Alert.alert(
        'Reading Unavailable',
        'Your dream was saved, but the oracle could not provide a reading at this time. Would you like to try again?',
        [
          {
            text: 'Return Home',
            onPress: async () => {
              await clearDraft();
              setSavedDreamId(null);
              navigation.goBack();
            },
            style: 'cancel',
          },
          {
            text: 'Try Again',
            onPress: () => retryAnalysis(dreamId),
          },
        ]
      );
      return;
    }

    // Step 3: Clear draft and navigate to reading screen
    // Note: The Edge Function auto-saves the reading to the dream record
    await clearDraft();
    setSavedDreamId(null);
    setLoadingState('idle');
    navigation.replace('Reading', {
      reading: analyzeResult.reading,
      dreamId,
      dreamText: dreamText.trim(),
      alreadySaved: true,
      subscriptionTier: isPremium ? 'premium' : 'free',
    });
  }

  async function retryAnalysis(dreamId: string) {
    setLoadingState('interpreting');
    setErrorMessage(null);

    const retryContext: AnalyzeDreamContext = {
      dreamId,
      mood: moodString,
      zodiacSign: userProfile?.zodiac_sign,
      gender: userProfile?.gender,
      ageRange: userProfile?.age_range,
    };

    const analyzeResult = await analyzeDream(dreamText.trim(), retryContext);

    if (!analyzeResult.success) {
      setLoadingState('error');
      setErrorMessage(analyzeResult.error);
      if (analyzeResult.code === 'CONSENT_REQUIRED') {
        await refreshConsent();
        setLoadingState('idle');
        setShowConsentModal(true);
        return;
      }
      Alert.alert(
        'Reading Unavailable',
        'The oracle remains silent. Your dream has been saved to your Grimoire.',
        [
          {
            text: 'Return Home',
            onPress: async () => {
              await clearDraft();
              setSavedDreamId(null);
              navigation.goBack();
            },
          },
        ]
      );
      return;
    }

    await clearDraft();
    setSavedDreamId(null);
    setLoadingState('idle');
    navigation.replace('Reading', {
      reading: analyzeResult.reading,
      dreamId: dreamId,
      dreamText: dreamText.trim(),
      alreadySaved: true,
      subscriptionTier: isPremium ? 'premium' : 'free',
    });
  }

  async function handleForgotDream() {
    setLoadingState('saving');
    const saveResult = await saveDream('No dream recalled', undefined, 'forgot');

    if (!saveResult.success) {
      setLoadingState('error');
      Alert.alert('Error', saveResult.error);
      return;
    }

    setLoadingState('idle');
    await clearDraft();
    Alert.alert(
      'Sleep Logged',
      'Sweet dreams next time.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  }

  async function handleConsentAllow() {
    resubmitOnGrantRef.current = true;
    setShowConsentModal(false);
    try {
      await grantConsent();
    } catch (err) {
      resubmitOnGrantRef.current = false;
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save consent.');
    }
    // The useEffect watching hasConsent picks up the flip to true and
    // re-runs handleSubmit in a fresh render where the closure sees
    // the updated consent state.
  }

  function handleConsentDecline() {
    setShowConsentModal(false);
  }

  function handleVoiceTranscription(text: string) {
    // Append transcribed text to existing dream text
    if (dreamText.trim()) {
      setDreamText(dreamText + ' ' + text);
    } else {
      setDreamText(text);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AIConsentModal
        visible={showConsentModal}
        onAllow={handleConsentAllow}
        onDecline={handleConsentDecline}
      />
      <PaperGrain />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            testID="new-dream-back"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={[styles.backButtonText, isLoading && styles.disabledText]}>
              Back
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <DreamLoadingAnimation phase={loadingState === 'saving' ? 'saving' : 'interpreting'} />
        ) : (
          <ScrollView testID="new-dream-scroll-view" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={styles.scroll} contentContainerStyle={[styles.content, contentStyle, isTablet && styles.contentTablet]}>
            <Text style={styles.title}>Record Your Dream</Text>
            <Text style={styles.subtitle}>
              Describe what you remember from your dream...
            </Text>

            {hasDraftRecovered && (
              <View style={styles.draftBanner}>
                <Text style={styles.draftBannerText}>Draft recovered</Text>
                <TouchableOpacity testID="new-dream-draft-clear" accessibilityRole="button" accessibilityLabel="Clear recovered draft" onPress={() => {
                  setDreamText('');
                  setDreamType('dream');
                  setMoods([]);
                  setHasDraftRecovered(false);
                  setSavedDreamId(null);
                  clearDraft();
                }}>
                  <Text style={styles.draftClearText}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dreamTypeContainer}>
              <TouchableOpacity
                testID="new-dream-type-dream"
                style={[
                  styles.dreamTypeButton,
                  isTablet && styles.dreamTypeButtonTablet,
                  dreamType === 'dream' && styles.dreamTypeButtonSelected,
                ]}
                onPress={() => { setDreamType('dream'); setMoods([]); setMoodExpanded(false); }}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Dream"
                accessibilityState={{ selected: dreamType === 'dream' }}
              >
                <SymbolIcon
                  name="moon"
                  size={isTablet ? 24 : 18}
                  color={dreamType === 'dream' ? colors.ochre.gold : colors.paper.boneFaint}
                  strokeWidth={1.75}
                />
                <Text
                  style={[
                    styles.dreamTypeText,
                    isTablet && styles.dreamTypeTextTablet,
                    dreamType === 'dream' && styles.dreamTypeTextSelected,
                  ]}
                >
                  Dream
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="new-dream-type-nightmare"
                style={[
                  styles.dreamTypeButton,
                  isTablet && styles.dreamTypeButtonTablet,
                  dreamType === 'nightmare' && styles.nightmareTypeButtonSelected,
                ]}
                onPress={() => { setDreamType('nightmare'); setMoods([]); setMoodExpanded(false); }}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Nightmare"
                accessibilityState={{ selected: dreamType === 'nightmare' }}
              >
                <SymbolIcon
                  name="fire"
                  size={isTablet ? 24 : 18}
                  color={dreamType === 'nightmare' ? colors.nightmare.vermilion : colors.paper.boneFaint}
                  strokeWidth={1.75}
                />
                <Text
                  style={[
                    styles.dreamTypeText,
                    isTablet && styles.dreamTypeTextTablet,
                    dreamType === 'nightmare' && styles.nightmareTypeTextSelected,
                  ]}
                >
                  Nightmare
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="new-dream-forgot"
              style={[styles.forgotButton, isTablet && styles.forgotButtonTablet]}
              onPress={handleForgotDream}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="I don't remember my dream"
              activeOpacity={0.7}
            >
              <Text style={[styles.forgotButtonText, isTablet && styles.forgotButtonTextTablet]}>{"I don't remember —"}</Text>
            </TouchableOpacity>

            <View style={styles.moodContainer}>
              <Text style={styles.moodLabel}>How did it feel?</Text>
              <Text style={styles.moodHint}>(select up to 3)</Text>
              <View style={styles.moodChips}>
                {(() => {
                  const allMoods = dreamType === 'nightmare' ? orderedNightmareMoods : orderedDreamMoods;
                  const visibleMoods = (isTablet || moodExpanded) ? allMoods : allMoods.slice(0, INITIAL_VISIBLE);
                  return (
                    <>
                      {visibleMoods.map((option) => {
                        const selected = moods.includes(option);
                        return (
                          <TouchableOpacity
                            key={option}
                            testID={`new-dream-mood-${option.toLowerCase()}`}
                            style={[
                              styles.moodChip,
                              dreamType === 'nightmare' && styles.nightmareMoodChip,
                              selected && (dreamType === 'nightmare' ? styles.nightmareMoodChipSelected : styles.moodChipSelected),
                            ]}
                            onPress={() =>
                              setMoods((current) => {
                                if (current.includes(option)) {
                                  return current.filter((m) => m !== option);
                                }
                                if (current.length >= 3) return current;
                                return [...current, option];
                              })
                            }
                            disabled={isLoading}
                            accessibilityLabel={`Mood ${option}`}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.moodChipText,
                                dreamType === 'nightmare' && styles.nightmareMoodChipText,
                                selected && (dreamType === 'nightmare' ? styles.nightmareMoodChipTextSelected : styles.moodChipTextSelected),
                              ]}
                            >
                              {option}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {!isTablet && (
                        <TouchableOpacity
                          testID="new-dream-mood-toggle"
                          style={styles.moodMoreChip}
                          onPress={() => setMoodExpanded((v) => !v)}
                          accessibilityLabel={moodExpanded ? 'Show fewer moods' : 'Show more moods'}
                          accessibilityRole="button"
                        >
                          <Text style={styles.moodMoreText}>
                            {moodExpanded ? 'Less \u2212' : 'More +'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              </View>
            </View>

            <TextInput
              testID="new-dream-text-input"
              style={[styles.dreamInput, isTablet && styles.dreamInputTablet]}
              placeholder="I was walking through a forest when..."
              placeholderTextColor={colors.paper.boneFaint}
              value={dreamText}
              onChangeText={setDreamText}
              multiline
              textAlignVertical="top"
              editable={!isLoading}
            />

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.submitRow}>
              <VoiceRecorder
                onTranscription={handleVoiceTranscription}
                disabled={isLoading}
                compact
                large={isTablet}
              />
              <TouchableOpacity
                testID="new-dream-submit"
                style={[styles.submitButton, isTablet && styles.submitButtonTablet, isLoading && styles.submitButtonDisabled]}
                onPress={() => handleSubmit()}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <Text style={[styles.submitButtonText, isTablet && styles.submitButtonTextTablet]}>Interpret Dream</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink.aubergine,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.gutter,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.base,
  },
  backButtonText: {
    ...typography.label,
    fontSize: 11,
    color: colors.ochre.gold,
  },
  disabledText: {
    opacity: 0.5,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.gutter,
    paddingTop: spacing.sm,
  },
  contentTablet: {
    flexGrow: 1,
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.paper.bone,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.serifBody,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.paper.boneMuted,
    marginBottom: spacing.base,
  },
  draftBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.ochre.gold,
    backgroundColor: colors.ink.aubergineLift,
  },
  draftBannerText: {
    ...typography.caption,
    color: colors.paper.boneMuted,
  },
  draftClearText: {
    ...typography.label,
    fontSize: 10,
    color: colors.ochre.gold,
  },
  forgotButton: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.base,
  },
  forgotButtonTablet: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  forgotButtonText: {
    ...typography.label,
    fontSize: 10,
    color: colors.paper.boneMuted,
  },
  forgotButtonTextTablet: {
    fontSize: 12,
  },
  moodContainer: {
    marginBottom: spacing.base,
  },
  moodLabel: {
    ...typography.label,
    color: colors.ochre.gold,
    marginBottom: spacing.xs / 2,
  },
  moodHint: {
    ...typography.caption,
    color: colors.paper.boneFaint,
    marginBottom: spacing.sm,
  },
  moodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moodChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.aubergineHair,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  moodChipSelected: {
    borderColor: colors.ochre.gold,
    backgroundColor: colors.ochre.gold,
  },
  nightmareMoodChip: {
    borderColor: colors.ink.aubergineHair,
  },
  nightmareMoodChipSelected: {
    borderColor: colors.nightmare.vermilion,
    backgroundColor: colors.nightmare.vermilion,
  },
  moodChipText: {
    ...typography.caption,
    color: colors.paper.boneMuted,
    fontSize: 13,
  },
  nightmareMoodChipText: {
    color: colors.paper.boneMuted,
  },
  moodChipTextSelected: {
    color: colors.ink.aubergine,
  },
  nightmareMoodChipTextSelected: {
    color: colors.paper.bone,
  },
  moodMoreChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ochre.gold,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  moodMoreText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.ochre.gold,
  },
  dreamTypeContainer: {
    flexDirection: 'row',
    marginBottom: spacing.base,
    gap: spacing.md,
  },
  dreamTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.aubergineHair,
    gap: spacing.sm,
  },
  dreamTypeButtonTablet: {
    paddingVertical: spacing.lg,
  },
  dreamTypeButtonSelected: {
    borderColor: colors.ochre.gold,
  },
  nightmareTypeButtonSelected: {
    borderColor: colors.nightmare.vermilion,
  },
  dreamTypeText: {
    ...typography.subtitle,
    fontSize: 15,
    color: colors.paper.boneMuted,
  },
  dreamTypeTextTablet: {
    fontSize: 18,
  },
  dreamTypeTextSelected: {
    color: colors.paper.bone,
  },
  nightmareTypeTextSelected: {
    color: colors.paper.bone,
  },
  dreamInput: {
    ...typography.serifBody,
    fontSize: 17,
    color: colors.paper.bone,
    paddingVertical: spacing.base,
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink.aubergineHair,
    borderBottomColor: colors.ink.aubergineHair,
    minHeight: 200,
  },
  dreamInputTablet: {
    flex: 1,
    minHeight: 300,
    fontSize: 19,
  },
  errorContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.nightmare.vermilion,
    backgroundColor: colors.ink.aubergineLift,
  },
  errorText: {
    ...typography.body,
    color: colors.nightmare.vermilion,
    textAlign: 'left',
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.paper.bone,
    borderRadius: radii.button,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  submitButtonTablet: {
    paddingVertical: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.subtitle,
    fontSize: 17,
    color: colors.ink.aubergine,
  },
  submitButtonTextTablet: {
    fontSize: 22,
  },
});
