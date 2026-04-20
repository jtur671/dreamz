import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';

import AuthScreen, { setOnNewUserSignup } from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewDreamScreen from './src/screens/NewDreamScreen';
import GrimoireScreen from './src/screens/GrimoireScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import DictionaryScreen from './src/screens/DictionaryScreen';
import ReadingScreen from './src/screens/ReadingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import VerifyResetCodeScreen from './src/screens/VerifyResetCodeScreen';
import { DreamProvider } from './src/context/DreamContext';
import { getProfile } from './src/lib/profileService';
import { initPurchases } from './src/lib/purchaseService';
import { initializeNotifications } from './src/lib/notificationService';
import { initializeAds } from './src/lib/adService';
import { withTimeout } from './src/lib/timeout';
import { featureFlags } from './src/lib/featureFlags';
import { setBootstrapStatus } from './src/lib/bootstrapStatus';

// Build tag — bumped per hotfix. Visible on-screen via AuthScreen badge
// so testers can confirm which bundle is running without device logs.
export const BUILD_TAG = 'v5';

const PROFILE_FETCH_TIMEOUT_MS = 5000;

// Kick off the session read at module-load time so it races the JS bundle's
// initialization. Most cold launches have a cached session in SecureStore
// that resolves in <300ms, so by the time App mounts, the session is ready
// and we render MainTabs on the first frame with no AuthScreen flash.
const initialSessionPromise = supabase.auth.getSession();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


// Tab icon component
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '☽',
    Grimoire: '📖',
    Insights: '✧',
    Dictionary: '📜',
    Settings: '⚙',
  };

  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconContainerFocused]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>
        {icons[name] || '•'}
      </Text>
    </View>
  );
}

// Main tabs navigator
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <DreamProvider>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            ...styles.tabBar,
            paddingBottom: Math.max(insets.bottom, 8),
            height: 62 + Math.max(insets.bottom, 8),
          },
          tabBarActiveTintColor: '#e0d4f7',
          tabBarInactiveTintColor: '#6b5b8a',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={route.name} focused={focused} />
          ),
          tabBarLabelStyle: styles.tabLabel,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarLabel: 'Dream', tabBarButtonTestID: 'tab-dream' }}
        />
        <Tab.Screen
          name="Grimoire"
          component={GrimoireScreen}
          options={{ tabBarLabel: 'Grimoire', tabBarButtonTestID: 'tab-grimoire' }}
        />
        <Tab.Screen
          name="Insights"
          component={InsightsScreen}
          options={{ tabBarLabel: 'Insights', tabBarButtonTestID: 'tab-insights' }}
        />
        <Tab.Screen
          name="Dictionary"
          component={DictionaryScreen}
          options={{ tabBarLabel: 'Dictionary', tabBarButtonTestID: 'tab-dictionary' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarLabel: 'Settings', tabBarButtonTestID: 'tab-settings' }}
        />
      </Tab.Navigator>
    </DreamProvider>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    // Initialize RevenueCat
    initPurchases().catch((e) => console.error('[App] initPurchases error:', e));

    // Initialize notifications
    initializeNotifications().catch((e) => console.error('[App] initializeNotifications error:', e));

    // Initialize Google Mobile Ads SDK. Without this call the SDK stays
    // dormant and free-tier users never see interstitial ads.
    initializeAds().catch((e) => console.error('[App] initializeAds error:', e));

    // Navigate to NewDream when user taps a reminder notification
    const notificationResponseSub = Notifications.addNotificationResponseReceivedListener(() => {
      // Small delay to ensure navigation is ready (app may be cold-starting)
      setTimeout(() => {
        if (navigationRef.current?.isReady()) {
          (navigationRef.current as any).navigate('NewDream');
        }
      }, 500);
    });

    // Set up callback for new user signup
    setOnNewUserSignup(() => {
      setNeedsOnboarding(true);
    });

    // Subscribe to the session kicked off at module load. We don't gate any
    // rendering on this — the app renders AuthScreen immediately and swaps
    // to MainTabs once the session resolves. If this Promise never settles
    // (Supabase SDK hung), the user is still in AuthScreen and can sign in
    // manually; they're never stuck on a blocking spinner.
    let cancelled = false;
    initialSessionPromise
      .then(async ({ data: { session: initialSession } }) => {
        if (cancelled) return;
        if (initialSession && featureFlags.bootstrapProfileFetchEnabled) {
          try {
            const profile = await withTimeout(
              getProfile(),
              PROFILE_FETCH_TIMEOUT_MS,
              'getProfile:bootstrap',
            );
            if (!cancelled && profile?.onboarding_completed === false) {
              setNeedsOnboarding(true);
            }
          } catch (profileErr: any) {
            console.warn('[App] Bootstrap profile check failed:', profileErr?.message);
          }
        }
        if (!cancelled) {
          setSession(initialSession);
          setBootstrapStatus('ready');
        }
      })
      .catch((err: any) => {
        console.warn('[App] Bootstrap session check failed:', err?.message);
        if (!cancelled) {
          setSession(null);
          setBootstrapStatus('failed');
        }
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          try {
            const profile = await withTimeout(
              getProfile(),
              PROFILE_FETCH_TIMEOUT_MS,
              'getProfile:onAuthStateChange',
            );
            if (profile?.onboarding_completed === false) {
              setNeedsOnboarding(true);
            }
          } catch (err: any) {
            console.warn('[App] Post-signIn profile check failed:', err?.message);
          }
          setSession(session);
        } else if (!session) {
          // Reset state on sign out
          setNeedsOnboarding(false);
          setSession(session);
        } else {
          setSession(session);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      notificationResponseSub.remove();
      setOnNewUserSignup(null);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="light" />
        {session ? (
          <Stack.Navigator
            initialRouteName={needsOnboarding ? 'Onboarding' : 'MainTabs'}
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#1a1a2e' },
            }}
          >
            {needsOnboarding ? (
              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                listeners={{
                  beforeRemove: () => {
                    // When leaving onboarding, mark as complete
                    setNeedsOnboarding(false);
                  },
                }}
              />
            ) : null}
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="NewDream" component={NewDreamScreen} />
            <Stack.Screen name="Reading" component={ReadingScreen} />
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{ presentation: 'modal' }}
            />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#1a1a2e' },
            }}
          >
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1a1a2e',
    borderTopWidth: 0,
    paddingTop: 8,
    // paddingBottom and height are set dynamically based on safe area insets
    elevation: 0,
  },
  tabIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  tabIconContainerFocused: {
    backgroundColor: 'rgba(107,78,158,0.15)',
  },
  tabIcon: {
    fontSize: 24,
    color: '#6b5b8a',
  },
  tabIconFocused: {
    color: '#e0d4f7',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
  },
});
