import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets, RecordingStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';

// Audio file extensions by platform (SDK 54 workaround)
const AUDIO_EXTENSIONS = Platform.OS === 'ios'
  ? ['.caf', '.m4a', '.wav']
  : ['.m4a', '.mp4', '.3gp'];

// Minimum recording duration in seconds before allowing stop
const MIN_RECORDING_SECONDS = 1;

// SDK 54 Bug Workaround: audioRecorder.uri can be empty after stop()
// See: https://github.com/expo/expo/issues/39646
// This function scans multiple directories to find the actual recording file
async function findRecordingFile(): Promise<string | null> {
  const possibleDirs = [
    `${FileSystem.cacheDirectory}ExpoAudio/`,
    `${FileSystem.cacheDirectory}Audio/`,
    `${FileSystem.cacheDirectory}`,
    `${FileSystem.documentDirectory}ExpoAudio/`,
    `${FileSystem.documentDirectory}Audio/`,
    `${FileSystem.documentDirectory}`,
  ];

  console.log('[VOICE] findRecordingFile() called');
  console.log('[VOICE] Searching directories:', possibleDirs);

  try {
    let bestFile: { path: string; size: number; mtime: number } | null = null;

    for (const cacheDir of possibleDirs) {
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      console.log(`[VOICE] Directory ${cacheDir}: exists=${dirInfo.exists}`);
      if (!dirInfo.exists) continue;

      const files = await FileSystem.readDirectoryAsync(cacheDir);
      console.log(`[VOICE] Files in ${cacheDir}:`, files);

      for (const filename of files) {
        const hasValidExtension = AUDIO_EXTENSIONS.some(ext =>
          filename.toLowerCase().endsWith(ext)
        );
        if (!hasValidExtension) continue;

        const filePath = `${cacheDir}${filename}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
          const mtime = fileInfo.modificationTime || 0;
          if (!bestFile || mtime > bestFile.mtime || (mtime === bestFile.mtime && fileInfo.size > bestFile.size)) {
            bestFile = { path: filePath, size: fileInfo.size, mtime };
          }
        }
      }
    }

    return bestFile?.path || null;
  } catch (error) {
    console.error('[VOICE] Error scanning for recording:', error);
    return null;
  }
}

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  compact?: boolean;
  large?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'transcribing';

export default function VoiceRecorder({ onTranscription, disabled, compact, large }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  // Track actual duration from recorder status (more reliable than manual timer)
  const actualDurationRef = useRef(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Status listener: track actual duration + handle errors
  const handleRecordingStatus = (status: RecordingStatus) => {
    if (status.hasError) {
      console.error('[VOICE] Recording status error:', status.error);
      setRecordingState('idle');
      Alert.alert('Recording Error', status.error || 'An error occurred while recording.');
      return;
    }
  };

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, handleRecordingStatus);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  async function startRecording() {
    console.log('[VOICE] startRecording() called');
    console.log('[VOICE] Platform:', Platform.OS);

    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          'Permission Required',
          'Please enable microphone access to record your dream.'
        );
        return;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Ensure Audio cache directory exists (SDK 54 workaround for Android)
      const audioCacheDir = `${FileSystem.cacheDirectory}Audio/`;
      const dirInfo = await FileSystem.getInfoAsync(audioCacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(audioCacheDir, { intermediates: true });
      }

      // Reset actual duration tracker
      actualDurationRef.current = 0;

      // IMPORTANT: Must prepare before recording.
      // useAudioRecorder creates the recorder but does NOT auto-prepare.
      // Without this, Android's native record() silently does nothing (isPrepared=false).
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingState('recording');
      setRecordingDuration(0);

      // Start UI duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[VOICE] Failed to start recording:', error);
      Alert.alert('Recording Error', 'Could not start recording. Please try again.');
    }
  }

  async function stopRecording() {
    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Check minimum duration (use UI timer as fallback if recorder duration is 0)
    const effectiveDuration = Math.max(actualDurationRef.current / 1000, recordingDuration);
    if (effectiveDuration < MIN_RECORDING_SECONDS) {
      Alert.alert(
        'Recording Too Short',
        'Please hold the button and speak for at least a second.'
      );
      setRecordingState('idle');
      setRecordingDuration(0);
      // Still stop the recorder to clean up
      try {
        await audioRecorder.stop();
      } catch {
        // ignore cleanup error
      }
      return;
    }

    setRecordingState('transcribing');

    try {
      await audioRecorder.stop();

      // Wait for file to be written (SDK 54 race condition workaround)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to get URL from recorder
      const state = audioRecorder.getStatus();
      let url = state.url || audioRecorder.uri;

      // If no URL or empty, scan cache directory (SDK 54 workaround)
      if (!url) {
        url = await findRecordingFile();
      }

      // Verify file exists and has content, with retry logic
      if (url) {
        let fileInfo = await FileSystem.getInfoAsync(url);
        let attempts = 0;
        const maxRetries = 3;

        while (fileInfo.exists && (!fileInfo.size || fileInfo.size === 0) && attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          fileInfo = await FileSystem.getInfoAsync(url);
          attempts++;
        }

        if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
          url = await findRecordingFile();
        }
      }

      if (url) {
        await transcribeAudio(url);
      } else {
        // No file found
        throw new Error(
          'No audio was captured. ' +
          (Platform.OS === 'ios' ? 'If using the Simulator, the mic may not be available. ' : '') +
          'Please check your microphone and try again.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not process recording.';
      console.error('[VOICE] stopRecording error:', msg);
      console.error('[VOICE] stopRecording full error:', err);
      Alert.alert('Recording Error', msg);
      setRecordingState('idle');
    }
  }

  async function transcribeAudio(uri: string) {
    try {
      // Read file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (base64Audio.length === 0) {
        throw new Error('Recording file was empty');
      }

      // Call transcription Edge Function via supabase.functions.invoke
      // (handles auth headers automatically, same pattern as analyze-dream)
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audio: base64Audio,
          mimeType: 'audio/m4a',
          filename: 'recording.m4a',
        },
      });

      if (error) {
        // Extract real error body from FunctionsHttpError
        let errorBody: any = null;
        try {
          if ((error as any).context && typeof (error as any).context.json === 'function') {
            errorBody = await (error as any).context.json();
          }
        } catch { /* ignore */ }

        console.error('[VOICE] Transcription error:', error.message, errorBody);
        const message = errorBody?.error || error.message || 'Transcription failed';
        throw new Error(message);
      }

      if (data?.text) {
        onTranscription(data.text);

        // Clean up recording file
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {
          // Ignore cleanup errors
        }
      } else {
        throw new Error('No transcription returned');
      }
    } catch (error) {
      console.error('[VOICE] Transcription error:', error);
      Alert.alert(
        'Transcription Failed',
        error instanceof Error ? error.message : 'Could not transcribe your recording. Please try typing your dream instead.'
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

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {recordingState === 'recording' && (
          <View style={styles.compactBanner}>
            <WaveformBars />
            <View style={styles.recordingDot} />
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}
        {recordingState === 'transcribing' && (
          <View style={styles.compactBanner}>
            <ActivityIndicator size="small" color="#9b7fd4" />
            <Text style={styles.statusText}>Transcribing...</Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.compactButton,
            large && styles.compactButtonLarge,
            recordingState === 'recording' && styles.compactButtonRecording,
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
            <Text style={[styles.compactButtonIcon, large && styles.compactButtonIconLarge]}>
              {recordingState === 'recording' ? '⏹' : '🎙'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {recordingState === 'recording' && (
        <WaveformBars />
      )}

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

const BAR_COUNT = 5;

function WaveformBars() {
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations = bars.map((bar, i) => {
      const delay = i * 120;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(bar, {
            toValue: 0.6 + Math.random() * 0.4,
            duration: 300 + Math.random() * 200,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.2 + Math.random() * 0.2,
            duration: 300 + Math.random() * 200,
            useNativeDriver: true,
          }),
        ])
      );
    });

    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [bars]);

  return (
    <View style={styles.waveformContainer}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            { transform: [{ scaleY: bar }] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    alignItems: 'center',
  },
  compactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  compactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3a3a5e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#4a4a6e',
  },
  compactButtonLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
  compactButtonRecording: {
    backgroundColor: '#5e3a3a',
    borderColor: '#8a4a4a',
  },
  compactButtonIcon: {
    fontSize: 18,
  },
  compactButtonIconLarge: {
    fontSize: 34,
  },
  container: {
    alignItems: 'center',
    marginBottom: 16,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    marginBottom: 12,
    gap: 4,
  },
  waveformBar: {
    width: 4,
    height: 28,
    borderRadius: 2,
    backgroundColor: '#e07a7a',
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
