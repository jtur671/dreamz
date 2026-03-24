import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface VerifyResetCodeScreenProps {
  navigation: any;
  route: { params: { email: string } };
}

export default function VerifyResetCodeScreen({ navigation, route }: VerifyResetCodeScreenProps) {
  const { email } = route.params;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  function handleCodeChange(text: string, index: number) {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    // Handle backspace — go to previous input
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  }

  async function handleVerify() {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      Alert.alert('Incomplete Code', 'Please enter the full 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: fullCode,
        type: 'recovery',
      });

      if (error) {
        Alert.alert('Invalid Code', 'The code is incorrect or has expired. Please try again.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        navigation.replace('ResetPassword');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    await supabase.auth.resetPasswordForEmail(email);
    setResending(false);
    Alert.alert('Code Sent', 'A new code has been sent to your email.');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Enter Code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                testID={`otp-input-${index}`}
                style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={index === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          <TouchableOpacity
            testID="verify-submit-button"
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Verify Code"
          >
            <Text style={styles.buttonText}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="resend-code-button"
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resending}
            accessibilityRole="button"
            accessibilityLabel="Resend Code"
          >
            <Text style={styles.resendText}>
              {resending ? 'Sending...' : "Didn't get it? Resend Code"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to Sign In"
          >
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a89cc8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  emailText: {
    color: '#e0d4f7',
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e0d4f7',
  },
  codeInputFilled: {
    borderColor: '#6b4e9e',
  },
  button: {
    backgroundColor: '#6b4e9e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    color: '#9b7fd4',
    fontSize: 14,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  backText: {
    color: '#6b5b8a',
    fontSize: 14,
  },
});
