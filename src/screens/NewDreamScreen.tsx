import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { saveDream, analyzeDream, AnalyzeDreamContext } from '../lib/dreamService';
import { getProfile } from '../lib/profileService';
import { saveDraft, loadDraft, clearDraft } from '../lib/draftService';
import VoiceRecorder from '../components/VoiceRecorder';
import DreamLoadingAnimation from '../components/DreamLoadingAnimation';
import type { Profile } from '../types';

type NewDreamScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type LoadingState = 'idle' | 'saving' | 'interpreting' | 'error';

const DREAM_MOODS = ['Peaceful', 'Curious', 'Inspired', 'Joyful', 'Confused', 'Nostalgic', 'Vivid', 'Surreal'];
const NIGHTMARE_MOODS = ['Anxious', 'Fearful', 'Trapped', 'Chased', 'Confused', 'Helpless', 'Disturbed', 'Unsettled'];

export default function NewDreamScreen({ navigation }: NewDreamScreenProps) {
  const [dreamText, setDreamText] = useState('');
  const [dreamType, setDreamType] = useState<'dream' | 'nightmare'>('dream');
  const [mood, setMood] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasDraftRecovered, setHasDraftRecovered] = useState(false);
  const [savedDreamId, setSavedDreamId] = useState<string | null>(null);
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isLoading = loadingState === 'saving' || loadingState === 'interpreting';

  // Load profile and draft on mount
  useEffect(() => {
    async function initialize() {
      // Load profile (includes zodiac, gender, age_range for personalized readings)
      const profile = await getProfile();
      if (profile) {
        setUserProfile(profile);
      }

      // Load draft
      const draft = await loadDraft();
      if (draft && draft.dreamText.trim()) {
        setDreamText(draft.dreamText);
        setDreamType(draft.dreamType);
        if (draft.mood) {
          setMood(draft.mood);
        }
        setHasDraftRecovered(true);
      }
    }
    initialize();
  }, []);

  // Auto-save draft with debounce
  const autoSaveDraft = useCallback(() => {
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }

    draftTimeoutRef.current = setTimeout(() => {
      if (dreamText.trim()) {
        saveDraft({ dreamText, dreamType, mood: mood || undefined });
      }
    }, 1000); // Save after 1 second of inactivity
  }, [dreamText, dreamType, mood]);

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

    if (!mood) {
      Alert.alert('Error', 'Please select how your dream felt');
      return;
    }

    setErrorMessage(null);

    // Step 1: Save the dream (skip if already saved from a previous attempt)
    let dreamId = savedDreamId;

    if (!dreamId) {
      setLoadingState('saving');

      const saveResult = await saveDream(dreamText.trim(), mood || undefined, dreamType);

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
      mood: mood || undefined,
      zodiacSign: userProfile?.zodiac_sign,
      gender: userProfile?.gender,
      ageRange: userProfile?.age_range,
    };

    const analyzeResult = await analyzeDream(dreamText.trim(), analyzeContext);

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
    });
  }

  async function retryAnalysis(dreamId: string) {
    setLoadingState('interpreting');
    setErrorMessage(null);

    const retryContext: AnalyzeDreamContext = {
      dreamId,
      mood: mood || undefined,
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

    setLoadingState('idle');
    navigation.replace('Reading', {
      reading: analyzeResult.reading,
      dreamId: dreamId,
      dreamText: dreamText.trim(),
      alreadySaved: true,
    });
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
    <SafeAreaView style={styles.safeArea}>
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
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Record Your Dream</Text>
            <Text style={styles.subtitle}>
              Describe what you remember from your dream...
            </Text>

            {hasDraftRecovered && (
              <View style={styles.draftBanner}>
                <Text style={styles.draftBannerText}>Draft recovered</Text>
                <TouchableOpacity onPress={() => {
                  setDreamText('');
                  setDreamType('dream');
                  setMood(null);
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
                style={[
                  styles.dreamTypeButton,
                  dreamType === 'dream' && styles.dreamTypeButtonSelected,
                ]}
                onPress={() => { setDreamType('dream'); setMood(null); }}
                disabled={isLoading}
              >
                <Text style={styles.dreamTypeIcon}>
                  {dreamType === 'dream' ? '\u{1F319}' : '\u{1F311}'}
                </Text>
                <Text
                  style={[
                    styles.dreamTypeText,
                    dreamType === 'dream' && styles.dreamTypeTextSelected,
                  ]}
                >
                  Dream
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dreamTypeButton,
                  dreamType === 'nightmare' && styles.nightmareTypeButtonSelected,
                ]}
                onPress={() => { setDreamType('nightmare'); setMood(null); }}
                disabled={isLoading}
              >
                <Text style={styles.dreamTypeIcon}>
                  {dreamType === 'nightmare' ? '\u{26A1}' : '\u{1F329}'}
                </Text>
                <Text
                  style={[
                    styles.dreamTypeText,
                    dreamType === 'nightmare' && styles.nightmareTypeTextSelected,
                  ]}
                >
                  Nightmare
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.moodContainer}>
              <Text style={styles.moodLabel}>How did it feel?</Text>
              <View style={styles.moodChips}>
                {(dreamType === 'nightmare' ? NIGHTMARE_MOODS : DREAM_MOODS).map((option) => {
                  const selected = mood === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.moodChip,
                        dreamType === 'nightmare' && styles.nightmareMoodChip,
                        selected && (dreamType === 'nightmare' ? styles.nightmareMoodChipSelected : styles.moodChipSelected),
                      ]}
                      onPress={() =>
                        setMood((current) => (current === option ? null : option))
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
              </View>
            </View>

            {/* Voice Recorder */}
            <View style={styles.voiceRecorderContainer}>
              <Text style={styles.voiceLabel}>Or speak your dream</Text>
              <VoiceRecorder
                onTranscription={handleVoiceTranscription}
                disabled={isLoading}
              />
            </View>

            <TextInput
              style={styles.dreamInput}
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

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6b4e9e', '#8b6cc1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.submitButtonText}>Interpret Dream</Text>
              </LinearGradient>
            </TouchableOpacity>
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
  moodContainer: {
    marginBottom: 16,
  },
  moodLabel: {
    fontSize: 14,
    color: '#a89cc8',
    marginBottom: 8,
    fontWeight: '600',
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
  voiceRecorderContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#252542',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  voiceLabel: {
    fontSize: 14,
    color: '#8b7fa8',
    marginBottom: 12,
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
  dreamTypeText: {
    fontSize: 15,
    color: '#a89cc8',
    fontWeight: '500',
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
  submitButton: {
    borderRadius: 16,
    marginTop: 32,
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
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
