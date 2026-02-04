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
import { saveDream, analyzeDream } from '../lib/dreamService';
import { getProfile } from '../lib/profileService';
import { saveDraft, loadDraft, clearDraft } from '../lib/draftService';

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

export default function NewDreamScreen({ navigation }: NewDreamScreenProps) {
  const [dreamText, setDreamText] = useState('');
  const [mood, setMood] = useState('');
  const [dreamType, setDreamType] = useState<'dream' | 'nightmare'>('dream');
  const [zodiacSign, setZodiacSign] = useState<string | undefined>();
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasDraftRecovered, setHasDraftRecovered] = useState(false);
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const moods = ['Peaceful', 'Anxious', 'Excited', 'Confused', 'Fearful', 'Joyful'];

  const isLoading = loadingState === 'saving' || loadingState === 'interpreting';

  // Load profile and draft on mount
  useEffect(() => {
    async function initialize() {
      // Load profile
      const profile = await getProfile();
      if (profile?.zodiac_sign) {
        setZodiacSign(profile.zodiac_sign);
      }

      // Load draft
      const draft = await loadDraft();
      if (draft && draft.dreamText.trim()) {
        setDreamText(draft.dreamText);
        setMood(draft.mood);
        setDreamType(draft.dreamType);
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
        saveDraft({ dreamText, mood, dreamType });
      }
    }, 1000); // Save after 1 second of inactivity
  }, [dreamText, mood, dreamType]);

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

    setErrorMessage(null);

    // Step 1: Save the dream
    setLoadingState('saving');

    const saveResult = await saveDream(dreamText.trim(), mood || undefined, dreamType);

    if (!saveResult.success) {
      setLoadingState('error');
      setErrorMessage(saveResult.error);
      Alert.alert('Error', saveResult.error);
      return;
    }

    const dream = saveResult.dream;

    // Step 2: Analyze the dream
    setLoadingState('interpreting');

    const analyzeResult = await analyzeDream(
      dreamText.trim(),
      mood || undefined,
      dream.id,
      zodiacSign
    );

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
            onPress: () => navigation.goBack(),
            style: 'cancel',
          },
          {
            text: 'Try Again',
            onPress: () => retryAnalysis(dream.id),
          },
        ]
      );
      return;
    }

    // Step 3: Clear draft and navigate to reading screen
    // Note: The Edge Function auto-saves the reading to the dream record
    await clearDraft();
    setLoadingState('idle');
    navigation.replace('Reading', {
      reading: analyzeResult.reading,
      dreamId: dream.id,
      alreadySaved: true,
    });
  }

  async function retryAnalysis(dreamId: string) {
    setLoadingState('interpreting');
    setErrorMessage(null);

    const analyzeResult = await analyzeDream(
      dreamText.trim(),
      mood || undefined,
      dreamId,
      zodiacSign
    );

    if (!analyzeResult.success) {
      setLoadingState('error');
      setErrorMessage(analyzeResult.error);
      Alert.alert(
        'Reading Unavailable',
        'The oracle remains silent. Your dream has been saved to your Grimoire.',
        [
          {
            text: 'Return Home',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return;
    }

    setLoadingState('idle');
    navigation.replace('Reading', {
      reading: analyzeResult.reading,
      dreamId: dreamId,
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
                  setMood('');
                  setDreamType('dream');
                  setHasDraftRecovered(false);
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

            <Text style={styles.moodLabel}>How did you feel?</Text>
            <View style={styles.moodContainer}>
              {moods.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.moodChip, mood === m && styles.moodChipSelected]}
                  onPress={() => setMood(mood === m ? '' : m)}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.moodChipText,
                      mood === m && styles.moodChipTextSelected,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
  dreamTypeContainer: {
    flexDirection: 'row',
    gap: 12,
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
    gap: 8,
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
  moodLabel: {
    fontSize: 16,
    color: '#e0d4f7',
    marginTop: 24,
    marginBottom: 12,
  },
  moodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodChip: {
    backgroundColor: '#2a2a4e',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  moodChipSelected: {
    backgroundColor: '#6b4e9e',
    borderColor: '#6b4e9e',
  },
  moodChipText: {
    color: '#a89cc8',
    fontSize: 14,
  },
  moodChipTextSelected: {
    color: '#fff',
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
