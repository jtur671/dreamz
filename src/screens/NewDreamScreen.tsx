import React, { useState } from 'react';
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

type NewDreamScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type LoadingState = 'idle' | 'saving' | 'interpreting' | 'error';

const LOADING_MESSAGES = {
  saving: 'Recording your dream...',
  interpreting: 'Consulting the dream oracle...',
};

export default function NewDreamScreen({ navigation }: NewDreamScreenProps) {
  const [dreamText, setDreamText] = useState('');
  const [mood, setMood] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const moods = ['Peaceful', 'Anxious', 'Excited', 'Confused', 'Fearful', 'Joyful'];

  const isLoading = loadingState === 'saving' || loadingState === 'interpreting';

  async function handleSubmit() {
    if (!dreamText.trim()) {
      Alert.alert('Error', 'Please describe your dream');
      return;
    }

    setErrorMessage(null);

    // Step 1: Save the dream
    setLoadingState('saving');

    const saveResult = await saveDream(dreamText.trim(), mood || undefined);

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
      dream.id
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

    // Step 3: Navigate to reading screen
    setLoadingState('idle');
    navigation.replace('Reading', {
      reading: analyzeResult.reading,
      dreamId: dream.id,
      alreadySaved: false,
    });
  }

  async function retryAnalysis(dreamId: string) {
    setLoadingState('interpreting');
    setErrorMessage(null);

    const analyzeResult = await analyzeDream(
      dreamText.trim(),
      mood || undefined,
      dreamId
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
      alreadySaved: false,
    });
  }

  function getLoadingMessage(): string {
    if (loadingState === 'saving') {
      return LOADING_MESSAGES.saving;
    }
    if (loadingState === 'interpreting') {
      return LOADING_MESSAGES.interpreting;
    }
    return '';
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
            <Text style={styles.loadingSubtext}>
              The mysteries of your subconscious are being revealed...
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Record Your Dream</Text>
            <Text style={styles.subtitle}>
              Describe what you remember from your dream...
            </Text>

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
    marginBottom: 24,
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
