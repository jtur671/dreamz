import React, { useState } from 'react';
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
  Linking,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { updateProfile } from '../lib/profileService';

WebBrowser.maybeCompleteAuthSession();

// Callback to notify App.tsx that a new user signed up and needs onboarding
let onNewUserSignup: (() => void) | null = null;
export function setOnNewUserSignup(callback: (() => void) | null) {
  onNewUserSignup = callback;
}

const OAUTH_TIMEOUT_MS = 60000;
const RETRY_HINT_DELAY_MS = 10000;

export default function AuthScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRetryHint, setShowRetryHint] = useState(false);

  async function handleEmailAuth() {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (error) {
        if (error.message.includes('already registered')) {
          Alert.alert(
            'Account Exists',
            'This email is already registered. Would you like to sign in instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign In', onPress: () => setIsSignUp(false) },
            ]
          );
        } else {
          Alert.alert('Sign Up Error', error.message);
        }
      } else {
        // New user — auto-signed-in, onAuthStateChange handles navigation
        onNewUserSignup?.();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          Alert.alert(
            'Sign In Failed',
            'Invalid credentials. Would you like to create a new account with this email?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Create Account', onPress: () => setIsSignUp(true) },
            ]
          );
        } else {
          Alert.alert('Sign In Error', error.message);
        }
      }
    }

    setLoading(false);
  }

  async function handleForgotPassword() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Email Required', 'Please enter your email address first.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: 'https://dreamz-journal.com/reset.html',
    });
    setLoading(false);
    if (error && (error as any).status >= 500) {
      Alert.alert('Reset Error', 'Something went wrong. Please try again.');
    } else {
      Alert.alert(
        'Check Your Email',
        'If an account exists, we sent a password reset link. Open it to set a new password.',
      );
    }
  }

  async function handleSignInWithCode() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Email Required', 'Please enter your email address first.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail });
    setLoading(false);
    // Only show error for server errors. Client errors navigate to OTP screen
    // to prevent email enumeration.
    if (error && (error as any).status >= 500) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } else {
      navigation.navigate('VerifyResetCode', { email: trimmedEmail, mode: 'login' });
    }
  }

  async function handleAppleSignIn() {
    try {
      setLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) {
          Alert.alert('Apple Sign In Error', error.message);
        } else if (data?.user) {
          // Save display name from Apple if provided
          const fullName = credential.fullName;
          if (fullName?.givenName) {
            const displayName = [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
            await updateProfile({ display_name: displayName });
          }

          // Check if this is a new user (created within last minute)
          const createdAt = new Date(data.user.created_at);
          const now = new Date();
          const isNewUser = (now.getTime() - createdAt.getTime()) < 60000;
          if (isNewUser) {
            onNewUserSignup?.();
          }
        }
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In Error', error.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    let retryHintTimer: NodeJS.Timeout | null = null;

    try {
      setLoading(true);
      setShowRetryHint(false);

      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'dreamz',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert('Google Sign In Error', error.message);
        return;
      }

      if (data?.url) {
        // Show retry hint after 10s of waiting
        retryHintTimer = setTimeout(() => setShowRetryHint(true), RETRY_HINT_DELAY_MS);

        // Race the auth session against a timeout
        const timeoutPromise = new Promise<{ type: 'timeout' }>((resolve) =>
          setTimeout(() => resolve({ type: 'timeout' }), OAUTH_TIMEOUT_MS)
        );

        const result = await Promise.race([
          WebBrowser.openAuthSessionAsync(data.url, redirectUrl),
          timeoutPromise,
        ]);

        if (result.type === 'timeout') {
          WebBrowser.dismissBrowser();
          Alert.alert(
            'Sign In Timed Out',
            'Google sign-in took too long. Would you like to try again?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => handleGoogleSignIn() },
            ]
          );
          return;
        }

        if (result.type === 'cancel' || result.type === 'dismiss') {
          // User cancelled or dismissed - silently clear loading
          return;
        }

        if (result.type === 'success' && result.url) {
          const params = new URL(result.url).hash.substring(1);
          const urlParams = new URLSearchParams(params);
          const accessToken = urlParams.get('access_token');
          const refreshToken = urlParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data: sessionData } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            // Save display name from Google user metadata
            const fullName = sessionData?.user?.user_metadata?.full_name ||
              sessionData?.user?.user_metadata?.name;
            if (fullName) {
              await updateProfile({ display_name: fullName });
            }

            // Check if this is a new user (created within last minute)
            if (sessionData?.user?.created_at) {
              const createdAt = new Date(sessionData.user.created_at);
              const now = new Date();
              const isNewUser = (now.getTime() - createdAt.getTime()) < 60000;
              if (isNewUser) {
                onNewUserSignup?.();
              }
            }
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Google Sign In Error', error.message || 'An error occurred');
    } finally {
      if (retryHintTimer) clearTimeout(retryHintTimer);
      setLoading(false);
      setShowRetryHint(false);
    }
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
          <Text style={styles.title}>Dreamz</Text>
          <Text style={styles.subtitle}>Your dreams, divined</Text>

          <View style={styles.socialButtons}>
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {showRetryHint && (
              <TouchableOpacity
                style={styles.retryHint}
                onPress={handleGoogleSignIn}
                accessibilityRole="button"
                accessibilityLabel="Taking too long? Tap to retry"
              >
                <Text style={styles.retryHintText}>Taking too long? Tap to retry</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            <TextInput
              testID="auth-email-input"
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#8b7fa8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.passwordContainer}>
              <TextInput
                testID="auth-password-input"
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#8b7fa8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                testID="auth-password-toggle"
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
              </TouchableOpacity>
            </View>

            {!isSignUp && (
              <View style={styles.forgotRow}>
                <TouchableOpacity
                  testID="auth-forgot-password"
                  onPress={handleForgotPassword}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password?"
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="auth-sign-in-with-code"
                  onPress={handleSignInWithCode}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with a code"
                >
                  <Text style={styles.forgotPasswordText}>Use a Code</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              testID="auth-submit-button"
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleEmailAuth}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={isSignUp ? 'Create Account' : 'Sign In'}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="auth-mode-switch"
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
              accessibilityRole="button"
              accessibilityLabel={isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            >
              <Text style={styles.switchText}>
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={styles.privacyNote}
            onPress={() => Linking.openURL('https://dreamz-journal.com/privacy.html')}
            accessibilityRole="link"
          >
            Your dreams are private. Always.
          </Text>
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
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#a89cc8',
    textAlign: 'center',
    marginBottom: 8,
  },
  socialButtons: {
    marginBottom: 24,
  },
  appleButton: {
    height: 50,
    width: '100%',
    marginBottom: 12,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#3a3a5e',
  },
  dividerText: {
    color: '#8b7fa8',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  form: {
  },
  input: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#e0d4f7',
    borderWidth: 1,
    borderColor: '#3a3a5e',
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#e0d4f7',
  },
  eyeButton: {
    padding: 16,
  },
  eyeIcon: {
    fontSize: 20,
  },
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: '#9b7fd4',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#6b4e9e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  switchText: {
    color: '#a89cc8',
    fontSize: 14,
  },
  retryHint: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  retryHintText: {
    color: '#9b7fd4',
    fontSize: 14,
    fontWeight: '500',
  },
  privacyNote: {
    color: '#6b5b8a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
    textDecorationLine: 'underline',
  },
});
