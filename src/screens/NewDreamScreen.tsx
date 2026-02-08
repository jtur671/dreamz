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
  ActivityIndicator,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { saveDream, analyzeDream, AnalyzeDreamContext } from '../lib/dreamService';
import { getProfile } from '../lib/profileService';
import { saveDraft, loadDraft, clearDraft } from '../lib/draftService';
import VoiceRecorder from '../components/VoiceRecorder';
import type { Profile } from '../types';

type NewDreamScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type LoadingState = 'idle' | 'saving' | 'interpreting' | 'error';

const LOADING_MESSAGES = {
  saving: ['Recording your dream...', 'Preserving the vision...', 'Capturing the threads...'],
  interpreting: [
    'Consulting the dream oracle...',
    'Reading the symbols...',
    'Gazing into the depths...',
    'Interpreting the signs...',
    'Unraveling the mystery...',
  ],
};

const LOADING_SUBTEXTS = [
  'The mysteries of your subconscious are being revealed...',
  'Every symbol holds a message for you...',
  'The veil between worlds grows thin...',
  'Ancient wisdom stirs in the depths...',
  'Your dreams speak in riddles and metaphors...',
];

const MOOD_OPTIONS = ['Peaceful', 'Curious', 'Inspired', 'Confused', 'Anxious', 'Fearful'];

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
    console.log('[SUBMIT] handleSubmit() called');
    console.log('[SUBMIT] dreamText length:', dreamText.trim().length);
    console.log('[SUBMIT] dreamType:', dreamType);
    console.log('[SUBMIT] mood:', mood);

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

      console.log('[SUBMIT] Calling saveDream()...');
      const saveResult = await saveDream(dreamText.trim(), mood || undefined, dreamType);
      console.log('[SUBMIT] saveDream result:', saveResult);

      if (!saveResult.success) {
        console.log('[SUBMIT] Save failed:', saveResult.error);
        setLoadingState('error');
        setErrorMessage(saveResult.error);
        Alert.alert('Error', saveResult.error);
        return;
      }

      dreamId = saveResult.dream.id;
      setSavedDreamId(dreamId);
      console.log('[SUBMIT] Dream saved, ID:', dreamId);
    } else {
      console.log('[SUBMIT] Reusing existing dream ID:', dreamId);
    }

    // Step 2: Analyze the dream with user profile context
    setLoadingState('interpreting');

    console.log('[SUBMIT] Loading profile for context...');
    const analyzeContext: AnalyzeDreamContext = {
      dreamId,
      mood: mood || undefined,
      zodiacSign: userProfile?.zodiac_sign,
      gender: userProfile?.gender,
      ageRange: userProfile?.age_range,
    };
    console.log('[SUBMIT] Analyze context:', analyzeContext);

    console.log('[SUBMIT] Calling analyzeDream()...');
    const analyzeResult = await analyzeDream(dreamText.trim(), analyzeContext);
    console.log('[SUBMIT] analyzeDream result:', analyzeResult);

    if (!analyzeResult.success) {
      console.log('[SUBMIT] Analysis failed:', analyzeResult.error);
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

  const [loadingMessageIndex] = useState(() => Math.floor(Math.random() * 5));

  function getLoadingMessage(): string {
    if (loadingState === 'saving') {
      return LOADING_MESSAGES.saving[loadingMessageIndex % LOADING_MESSAGES.saving.length];
    }
    if (loadingState === 'interpreting') {
      return LOADING_MESSAGES.interpreting[loadingMessageIndex % LOADING_MESSAGES.interpreting.length];
    }
    return '';
  }

  function getLoadingSubtext(): string {
    return LOADING_SUBTEXTS[loadingMessageIndex % LOADING_SUBTEXTS.length];
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
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#9b7fd4" />
            <Text style={styles.loadingText}>{getLoadingMessage()}</Text>
            <Text style={styles.loadingSubtext}>{getLoadingSubtext()}</Text>
          </View>
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
                onPress={() => setDreamType('dream')}
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
                onPress={() => setDreamType('nightmare')}
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
                {MOOD_OPTIONS.map((option) => {
                  const selected = mood === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.moodChip,
                        selected && styles.moodChipSelected,
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
                          selected && styles.moodChipTextSelected,
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
            >
              <Text style={styles.submitButtonText}>Interpret Dream</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
  },
  moodChipText: {
    color: '#a89cc8',
    fontSize: 13,
    fontWeight: '500',
  },
  moodChipTextSelected: {
    color: '#e0d4f7',
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
    backgroundColor: '#6b4e9e',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 32,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0d4f7',
    marginTop: 24,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#8b7fa8',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
