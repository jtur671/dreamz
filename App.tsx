import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
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

const SESSION_BOOTSTRAP_TIMEOUT_MS = 5000;
const PROFILE_FETCH_TIMEOUT_MS = 5000;
// Hard safety net: no matter what happens in the bootstrap promise chain,
// the loading spinner must dismiss within this window. Prevents the
// "stuck on purple spinner for an hour" class of bug where `withTimeout`
// doesn't save us (e.g. when the Supabase SDK's internal token-refresh
// chain starves `setTimeout` callbacks via a microtask-heavy await loop).
const LOADING_HARD_DISMISS_MS = 8000;

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
  const [loading, setLoading] = useState(true);
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


    // Unconditional safety net. Runs independently of the promise chain
    // below so the user can never be trapped on the loading spinner, even
    // if every Promise/withTimeout fails to fire.
    const hardDismissTimer = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          console.warn('[App] Hard loading dismiss fired — bootstrap did not complete in time');
        }
        return false;
      });
    }, LOADING_HARD_DISMISS_MS);

    // Get initial session. Both getSession (reads SecureStore) and getProfile
    // (network) can hang silently; race them against timeouts so the loading
    // gate is guaranteed to clear and the user always reaches AuthScreen.
    withTimeout(
      supabase.auth.getSession(),
      SESSION_BOOTSTRAP_TIMEOUT_MS,
      'getSession',
    )
      .then(async ({ data: { session: initialSession } }) => {
        if (initialSession && featureFlags.bootstrapProfileFetchEnabled) {
          try {
            const profile = await withTimeout(
              getProfile(),
              PROFILE_FETCH_TIMEOUT_MS,
              'getProfile:bootstrap',
            );
            if (profile?.onboarding_completed === false) {
              setNeedsOnboarding(true);
            }
          } catch (profileErr: any) {
            console.warn('[App] Bootstrap profile check failed:', profileErr?.message);
          }
        }
        setSession(initialSession);
      })
      .catch((err: any) => {
        console.warn('[App] Bootstrap session check failed:', err?.message);
        setSession(null);
      })
      .finally(() => {
        clearTimeout(hardDismissTimer);
        setLoading(false);
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
      clearTimeout(hardDismissTimer);
      subscription.unsubscribe();
      notificationResponseSub.remove();
      setOnNewUserSignup(null);
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b4e9e" />
        <StatusBar style="light" />
      </View>
    );
  }

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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
