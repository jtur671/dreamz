import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
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

    if (bestFile) {
      console.log(`[VOICE] Found recording: ${bestFile.path} (${bestFile.size} bytes)`);
    } else {
      console.log('[VOICE] No recording file found in any directory');
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
}

type RecordingState = 'idle' | 'recording' | 'transcribing';

export default function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
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
    // Update actual duration from recorder (more reliable than manual timer)
    if (status.durationMillis !== undefined) {
      actualDurationRef.current = status.durationMillis;
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
      console.log('[VOICE] Permission status:', status);
      if (!status.granted) {
        Alert.alert(
          'Permission Required',
          'Please enable microphone access to record your dream.'
        );
        return;
      }

      console.log('[VOICE] Setting audio mode...');
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      console.log('[VOICE] Audio mode set');

      // Ensure Audio cache directory exists (SDK 54 workaround for Android)
      console.log('[VOICE] Creating Audio directory...');
      const audioCacheDir = `${FileSystem.cacheDirectory}Audio/`;
      const dirInfo = await FileSystem.getInfoAsync(audioCacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(audioCacheDir, { intermediates: true });
      }
      console.log('[VOICE] Directory ready');

      // Reset actual duration tracker
      actualDurationRef.current = 0;

      // IMPORTANT: Must prepare before recording.
      // useAudioRecorder creates the recorder but does NOT auto-prepare.
      // Without this, Android's native record() silently does nothing (isPrepared=false).
      console.log('[VOICE] Preparing recorder...');
      await audioRecorder.prepareToRecordAsync();
      console.log('[VOICE] Recorder prepared');

      console.log('[VOICE] Starting recorder...');
      audioRecorder.record();
      console.log('[VOICE] Recording started');
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
    console.log('[VOICE] stopRecording() called');
    console.log('[VOICE] Actual duration from recorder:', actualDurationRef.current, 'ms');
    console.log('[VOICE] UI duration:', recordingDuration, 's');
    console.log('[VOICE] audioRecorder.isRecording:', audioRecorder.isRecording);

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Check minimum duration (use UI timer as fallback if recorder duration is 0)
    const effectiveDuration = Math.max(actualDurationRef.current / 1000, recordingDuration);
    if (effectiveDuration < MIN_RECORDING_SECONDS) {
      console.log('[VOICE] Recording too short:', effectiveDuration, 's');
      Alert.alert(
        'Recording Too Short',
        'Please hold the button and speak for at least a second.'
      );
      setRecordingState('idle');
      setRecordingDuration(0);
      // Still stop the recorder to clean up
      try {
        await audioRecorder.stop();
      } catch (_e) {
        // ignore cleanup error
      }
      return;
    }

    setRecordingState('transcribing');

    try {
      // Get status before stopping for diagnostics
      const preStopStatus = audioRecorder.getStatus();
      console.log('[VOICE] Pre-stop status:', JSON.stringify(preStopStatus));
      console.log('[VOICE] Pre-stop uri:', audioRecorder.uri);

      console.log('[VOICE] Stopping recorder...');
      await audioRecorder.stop();
      console.log('[VOICE] Recorder stopped');

      // Wait for file to be written (SDK 54 race condition workaround)
      console.log('[VOICE] Waiting 1000ms for file write...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to get URL from recorder
      const state = audioRecorder.getStatus();
      let url = state.url || audioRecorder.uri;

      console.log('[VOICE] Post-stop status:', JSON.stringify(state));
      console.log('[VOICE] Post-stop uri:', audioRecorder.uri);
      console.log('[VOICE] URL to use:', url || '(empty)');

      // If no URL or empty, scan cache directory (SDK 54 workaround)
      if (!url) {
        console.log('[VOICE] No direct URI, scanning cache directory...');
        url = await findRecordingFile();
      }

      // Verify file exists and has content, with retry logic
      if (url) {
        let fileInfo = await FileSystem.getInfoAsync(url);
        console.log('[VOICE] Initial file check:', JSON.stringify({ exists: fileInfo.exists, size: (fileInfo as any).size }));
        let attempts = 0;
        const maxRetries = 3;

        while (fileInfo.exists && (!fileInfo.size || fileInfo.size === 0) && attempts < maxRetries) {
          console.log(`[VOICE] File empty, retry ${attempts + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          fileInfo = await FileSystem.getInfoAsync(url);
          attempts++;
        }

        if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
          console.log('[VOICE] File still empty after retries, re-scanning...');
          url = await findRecordingFile();
        } else {
          console.log(`[VOICE] File confirmed: ${url} (${fileInfo.size} bytes)`);
        }
      }

      if (url) {
        console.log('[VOICE] Proceeding to transcribe:', url);
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
    console.log('[VOICE] transcribeAudio() called with:', uri);

    try {
      // Read file as base64
      console.log('[VOICE] Reading file as base64...');
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('[VOICE] Base64 length:', base64Audio.length);

      if (base64Audio.length === 0) {
        throw new Error('Recording file was empty');
      }

      // Call transcription Edge Function via supabase.functions.invoke
      // (handles auth headers automatically, same pattern as analyze-dream)
      console.log('[VOICE] Calling transcribe-audio edge function...');
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

      console.log('[VOICE] Transcription result:', data?.text ? `"${data.text.substring(0, 50)}..."` : 'no text');

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
