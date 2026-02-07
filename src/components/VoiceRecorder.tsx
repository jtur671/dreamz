import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'transcribing';

export default function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  async function startRecording() {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable microphone access to record your dream.'
        );
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecordingState('recording');
      setRecordingDuration(0);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Could not start recording. Please try again.');
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setRecordingState('transcribing');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        await transcribeAudio(uri);
      } else {
        throw new Error('No recording URI');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Recording Error', 'Could not process recording. Please try again.');
      setRecordingState('idle');
    }
  }

  async function transcribeAudio(uri: string) {
    try {
      // For now, we'll use a placeholder since we need to set up the Edge Function
      // In production, this would call the transcribe-audio Edge Function

      // Read the file and create form data
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      // Get auth token
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Call transcription Edge Function
      const transcribeResponse = await fetch(
        'https://vjqvxraqeptgmbxnipqo.supabase.co/functions/v1/transcribe-audio',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await transcribeResponse.json();

      if (data.text) {
        onTranscription(data.text);
      } else {
        throw new Error('No transcription returned');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert(
        'Transcription Failed',
        'Could not transcribe your recording. Please try typing your dream instead.'
      );
    } finally {
      setRecordingState('idle');
      setRecordingDuration(0);
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handlePress() {
    if (recordingState === 'idle') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  }

  const isDisabled = disabled || recordingState === 'transcribing';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          recordingState === 'recording' && styles.buttonRecording,
          isDisabled && styles.buttonDisabled,
        ]}
        onPress={handlePress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={
          recordingState === 'idle'
            ? 'Start voice recording'
            : recordingState === 'recording'
            ? 'Stop recording'
            : 'Transcribing'
        }
      >
        {recordingState === 'transcribing' ? (
          <ActivityIndicator size="small" color="#e0d4f7" />
        ) : (
          <Text style={styles.buttonIcon}>
            {recordingState === 'recording' ? '⏹' : '🎙'}
          </Text>
        )}
      </TouchableOpacity>

      {recordingState === 'recording' && (
        <View style={styles.recordingInfo}>
          <View style={styles.recordingDot} />
          <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
        </View>
      )}

      {recordingState === 'transcribing' && (
        <Text style={styles.statusText}>Transcribing...</Text>
      )}

      {recordingState === 'idle' && (
        <Text style={styles.hintText}>Tap to record</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 16,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3a3a5e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4a4a6e',
  },
  buttonRecording: {
    backgroundColor: '#5e3a3a',
    borderColor: '#8a4a4a',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    fontSize: 24,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e07a7a',
    marginRight: 6,
  },
  durationText: {
    color: '#e07a7a',
    fontSize: 14,
    fontWeight: '500',
  },
  statusText: {
    color: '#9b7fd4',
    fontSize: 13,
    marginTop: 8,
  },
  hintText: {
    color: '#6b5b8a',
    fontSize: 12,
    marginTop: 6,
  },
});
