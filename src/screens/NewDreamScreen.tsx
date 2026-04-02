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
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { saveDream, analyzeDream, AnalyzeDreamContext } from '../lib/dreamService';
import { getProfile } from '../lib/profileService';
import { saveDraft, loadDraft, clearDraft } from '../lib/draftService';
import { checkPremiumAccess } from '../lib/purchaseService';
import { preloadInterstitialAd, showInterstitialAd } from '../lib/adService';
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

  async function handleSubmit() {
    if (!dreamText.trim()) {
      Alert.alert('Error', 'Please describe your dream');
      return;
    }

    if (moods.length === 0) {
      Alert.alert('Error', 'Please select how your dream felt');
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
      <LinearGradient
        colors={['#1a1a2e', '#1e1a3a']}
        style={styles.gradient}
      >
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
                <Text style={[styles.dreamTypeIcon, isTablet && styles.dreamTypeIconTablet]}>
                  {dreamType === 'dream' ? '\u{1F319}' : '\u{1F311}'}
                </Text>
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
                <Text style={[styles.dreamTypeIcon, isTablet && styles.dreamTypeIconTablet]}>
                  {dreamType === 'nightmare' ? '\u{26A1}' : '\u{1F329}'}
                </Text>
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
              <Text style={[styles.forgotButtonIcon, isTablet && styles.forgotButtonIconTablet]}>{'\u{1F319}'}</Text>
              <Text style={[styles.forgotButtonText, isTablet && styles.forgotButtonTextTablet]}>{"I don't remember"}</Text>
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
              placeholderTextColor="#6b5b8a"
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
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#6b4e9e', '#8b6cc1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.ctaGradient, isTablet && styles.ctaGradientTablet]}
                >
                  <Text style={[styles.submitButtonText, isTablet && styles.submitButtonTextTablet]}>Interpret Dream</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    color: '#6b4e9e',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledText: {
    opacity: 0.5,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 8,
  },
  contentTablet: {
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a89cc8',
    marginBottom: 16,
  },
  draftBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2e3545',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4a5568',
  },
  draftBannerText: {
    fontSize: 13,
    color: '#a8b8c8',
  },
  draftClearText: {
    fontSize: 13,
    color: '#9b7fd4',
    fontWeight: '500',
  },
  forgotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#252542',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    gap: 8,
  },
  forgotButtonIcon: {
    fontSize: 14,
  },
  forgotButtonIconTablet: {
    fontSize: 18,
  },
  forgotButtonTablet: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
  },
  forgotButtonText: {
    color: '#8b7fa8',
    fontSize: 14,
    fontWeight: '500',
  },
  forgotButtonTextTablet: {
    fontSize: 18,
  },
  moodContainer: {
    marginBottom: 16,
  },
  moodLabel: {
    fontSize: 14,
    color: '#a89cc8',
    marginBottom: 2,
    fontWeight: '600',
  },
  moodHint: {
    fontSize: 12,
    color: '#6b5b8a',
    marginBottom: 8,
  },
  moodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moodChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    backgroundColor: '#2a2a4e',
    marginRight: 8,
    marginBottom: 8,
  },
  moodChipSelected: {
    borderColor: '#9b7fd4',
    backgroundColor: '#3a3a6e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nightmareMoodChip: {
    borderColor: '#4a2a3e',
    backgroundColor: '#2e1a2a',
  },
  nightmareMoodChipSelected: {
    borderColor: '#8a3a5a',
    backgroundColor: '#3e2a3a',
  },
  moodChipText: {
    color: '#a89cc8',
    fontSize: 13,
    fontWeight: '500',
  },
  nightmareMoodChipText: {
    color: '#b89ca8',
  },
  moodChipTextSelected: {
    color: '#e0d4f7',
  },
  nightmareMoodChipTextSelected: {
    color: '#e8b8c8',
  },
  moodMoreChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6b4e9e',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    marginRight: 8,
    marginBottom: 8,
  },
  moodMoreText: {
    color: '#9b7fd4',
    fontSize: 13,
    fontWeight: '500',
  },
  dreamTypeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dreamTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    marginRight: 12,
  },
  dreamTypeButtonTablet: {
    paddingVertical: 18,
    borderRadius: 16,
  },
  dreamTypeButtonSelected: {
    backgroundColor: '#3a3a6e',
    borderColor: '#9b7fd4',
  },
  nightmareTypeButtonSelected: {
    backgroundColor: '#3e2a3a',
    borderColor: '#8a3a5a',
  },
  dreamTypeIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  dreamTypeIconTablet: {
    fontSize: 24,
  },
  dreamTypeText: {
    fontSize: 15,
    color: '#a89cc8',
    fontWeight: '500',
  },
  dreamTypeTextTablet: {
    fontSize: 20,
  },
  dreamTypeTextSelected: {
    color: '#e0d4f7',
  },
  nightmareTypeTextSelected: {
    color: '#e8b8c8',
  },
  dreamInput: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#e0d4f7',
    borderWidth: 1,
    borderColor: '#3a3a5e',
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  dreamInputTablet: {
    flex: 1,
    minHeight: 300,
    fontSize: 18,
  },
  errorContainer: {
    backgroundColor: '#3e2a2a',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#5e3a3a',
  },
  errorText: {
    color: '#e8a8a8',
    fontSize: 14,
    textAlign: 'center',
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 32,
  },
  submitButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  ctaGradient: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  ctaGradientTablet: {
    padding: 32,
    borderRadius: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  submitButtonTextTablet: {
    fontSize: 24,
    fontWeight: '700',
  },
});
