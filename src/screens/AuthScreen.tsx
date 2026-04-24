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
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { updateProfile } from '../lib/profileService';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { withTimeout, TimeoutError } from '../lib/timeout';
import { featureFlags } from '../lib/featureFlags';
import { useBootstrapStatus } from '../lib/bootstrapStatus';
import { colors, typography, spacing, radii } from '../theme';
import { PaperGrain } from '../components/PaperGrain';

// Bumped every hotfix. On-device testers can confirm which bundle is
// running by looking at the badge in the top-right corner of AuthScreen.
const BUILD_TAG = 'v7';

WebBrowser.maybeCompleteAuthSession();

// Callback to notify App.tsx that a new user signed up and needs onboarding
let onNewUserSignup: (() => void) | null = null;
export function setOnNewUserSignup(callback: (() => void) | null) {
  onNewUserSignup = callback;
}

const OAUTH_TIMEOUT_MS = 60000;
const RETRY_HINT_DELAY_MS = 10000;
const SIGN_IN_NETWORK_TIMEOUT_MS = 15000;
const PROFILE_UPDATE_TIMEOUT_MS = 5000;

export default function AuthScreen() {
  const navigation = useNavigation<any>();
  const { contentStyle } = useResponsiveLayout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRetryHint, setShowRetryHint] = useState(false);
  const bootstrapStatus = useBootstrapStatus();

  async function handleEmailAuth() {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
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
      redirectTo: process.env.EXPO_PUBLIC_PASSWORD_RESET_URL || 'https://dreamz-journal.com/reset.html',
    });
    setLoading(false);
    if (error && (error as any).status >= 500) {
      Alert.alert('Reset Error', 'Something went wrong. Please try again.');
    } else {
      Alert.alert(
        'Check Your Email',
        'If you signed up with email, we sent a reset link. If you signed up with Apple or Google, use that button above instead — no password needed.',
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
      navigation.navigate('VerifyResetCode', { email: trimmedEmail });
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
        const { data, error } = await withTimeout(
          supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          }),
          SIGN_IN_NETWORK_TIMEOUT_MS,
          'signInWithIdToken:apple',
        );

        if (error) {
          Alert.alert('Apple Sign In Error', error.message);
        } else if (data?.user) {
          // Save display name from Apple if provided. Best-effort — don't
          // block sign-in completion on this.
          const fullName = credential.fullName;
          if (fullName?.givenName) {
            const displayName = [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
            await withTimeout(
              updateProfile({ display_name: displayName }),
              PROFILE_UPDATE_TIMEOUT_MS,
              'updateProfile:appleDisplayName',
            ).catch((err: any) => {
              console.warn('[Auth] updateProfile after Apple sign-in failed:', err?.message);
            });
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
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled the Apple sheet — silent.
      } else if (error instanceof TimeoutError) {
        Alert.alert(
          'Sign-In Timed Out',
          'Apple sign-in took too long to complete. Please check your connection and try again, or tap "Having trouble?" at the bottom to reset.',
        );
      } else {
        Alert.alert('Apple Sign In Error', error.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetAppData() {
    Alert.alert(
      'Reset Sign-In State?',
      'This clears any stuck login session stored on this device. You can then try signing in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
              const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
              const host = url.replace(/^https?:\/\//, '').split('.')[0];
              const key = host ? `sb-${host}-auth-token` : null;
              if (key) {
                await SecureStore.deleteItemAsync(key).catch(() => {});
                await SecureStore.deleteItemAsync(`${key}_count`).catch(() => {});
                for (let i = 0; i < 64; i++) {
                  await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
                }
              }
              Alert.alert(
                'Reset Complete',
                'Please fully close Dreamz (swipe up from the app switcher) and reopen it.',
              );
            } catch (error: any) {
              Alert.alert('Reset Error', error?.message || 'Could not reset app data.');
            }
          },
        },
      ],
    );
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
      <PaperGrain />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, contentStyle]}>
          <Text style={styles.title}>Dreamz</Text>
          <Text style={styles.subtitle}>Your dreams, divined</Text>
          <View pointerEvents="none" style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>{BUILD_TAG}</Text>
          </View>

          <View style={styles.socialButtons}>
            {Platform.OS === 'ios' && featureFlags.appleSignInEnabled && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}

            {featureFlags.googleSignInEnabled && (
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            )}

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
              placeholderTextColor={colors.paper.boneFaint}
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
                placeholderTextColor={colors.paper.boneFaint}
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
                <Text style={styles.eyeLabel}>{showPassword ? 'Hide' : 'Show'}</Text>
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

          <TouchableOpacity
            testID="auth-reset-app-data"
            style={styles.resetButton}
            onPress={handleResetAppData}
            accessibilityRole="button"
            accessibilityLabel="Having trouble signing in? Tap to reset app data"
          >
            <Text style={styles.resetText}>Having trouble? Tap to reset</Text>
          </TouchableOpacity>

          <Text
            style={styles.privacyNote}
            onPress={() => Linking.openURL('https://dreamz-journal.com/privacy.html')}
            accessibilityRole="link"
          >
            Your dreams are private. Always.
          </Text>

          {bootstrapStatus !== 'ready' && (
            <Text style={styles.bootstrapStatus} accessibilityLiveRegion="polite">
              {bootstrapStatus === 'pending' ? '· checking session' : '· session check failed — sign in below'}
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink.aubergine,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.section,
  },
  title: {
    ...typography.display,
    fontSize: 56,
    lineHeight: 60,
    color: colors.paper.bone,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.serifBody,
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.paper.boneMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  socialButtons: {
    marginBottom: spacing.xl,
  },
  appleButton: {
    height: 50,
    width: '100%',
    marginBottom: spacing.md,
  },
  googleButton: {
    backgroundColor: colors.paper.bone,
    borderRadius: radii.button,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleButtonText: {
    ...typography.bodyLarge,
    fontFamily: 'InstrumentSans_600SemiBold',
    color: colors.ink.aubergine,
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.ink.aubergineHair,
  },
  dividerText: {
    ...typography.label,
    color: colors.paper.boneFaint,
    paddingHorizontal: spacing.base,
  },
  form: {},
  input: {
    ...typography.bodyLarge,
    color: colors.paper.bone,
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink.aubergineHair,
    marginBottom: spacing.base,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink.aubergineHair,
    marginBottom: spacing.base,
  },
  passwordInput: {
    ...typography.bodyLarge,
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.paper.bone,
  },
  eyeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  eyeLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.ochre.gold,
  },
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  forgotPasswordText: {
    ...typography.caption,
    color: colors.ochre.gold,
  },
  button: {
    backgroundColor: colors.paper.bone,
    borderRadius: radii.button,
    paddingVertical: spacing.base,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.subtitle,
    color: colors.ink.aubergine,
    fontSize: 17,
  },
  switchButton: {
    alignItems: 'center',
    marginTop: spacing.base,
  },
  switchText: {
    ...typography.body,
    color: colors.paper.boneMuted,
    fontSize: 14,
  },
  retryHint: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  retryHintText: {
    ...typography.body,
    color: colors.ochre.gold,
  },
  privacyNote: {
    ...typography.caption,
    color: colors.paper.boneFaint,
    textAlign: 'center',
    marginTop: spacing.xxl,
    textDecorationLine: 'underline',
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.base,
  },
  resetText: {
    ...typography.caption,
    color: colors.paper.boneFaint,
  },
  bootstrapStatus: {
    ...typography.caption,
    fontSize: 10,
    color: colors.paper.boneFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
    opacity: 0.6,
  },
  versionBadge: {
    position: 'absolute',
    top: 8,
    right: 16,
    backgroundColor: colors.nightmare.vermilion,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.hairline,
  },
  versionBadgeText: {
    ...typography.label,
    fontSize: 9,
    color: colors.paper.bone,
  },
});
